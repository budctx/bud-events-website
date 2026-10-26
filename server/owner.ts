import { createHmac, randomBytes } from 'node:crypto';
import { resolveOwnerSession } from './auth.ts';
import type { AuthEnv } from './auth.ts';
import { enforceRateLimit } from './rate-limit.ts';
import { boundedProviderText, WhopError } from './whop.ts';
import { liveBackend, liveResponse } from './live-commerce.ts';
import { assertProductionPaymentMatches, lookupProductionPayment, whopProductionProcessingConfig } from './whop-production.ts';
import type { ProductionOrder } from './whop-production.ts';

const project = 'https://cepmvqqrjcvhyzszqand.supabase.co';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, fields: string[]) => Object.keys(v).every(k => fields.includes(k));
const envNow = (): AuthEnv => (globalThis as unknown as { process?: { env?: AuthEnv } }).process?.env ?? {};
const integer = (v: unknown, max: number) => Number.isSafeInteger(v) && Number(v) > 0 && Number(v) <= max;
function codeDigest(code: string, env: AuthEnv) {
  if (!env.BUD_REDEEM_HASH_SECRET || Buffer.byteLength(env.BUD_REDEEM_HASH_SECRET) < 32) throw new WhopError('REDEEM_NOT_CONFIGURED');
  return createHmac('sha256', env.BUD_REDEEM_HASH_SECRET).update(code).digest('hex');
}
const sqlErrors: Record<string, [number,string]> = {
  BUD_OWNER_REQUIRED: [403,'OWNER_REQUIRED'], BUD_INVALID_CODE: [400,'INVALID_OR_EXPIRED_CODE'],
  BUD_KEY_REUSED: [409,'IDEMPOTENCY_KEY_REUSED'], BUD_INVALID_REQUEST: [400,'INVALID_REQUEST'],
  BUD_RESOURCE_NOT_FOUND: [404,'RESOURCE_NOT_FOUND'], BUD_ACCOUNT_RESTRICTED: [403,'ACCOUNT_RESTRICTED'],
};
async function rpc(name: string, params: object, secret: string, transport: typeof fetch): Promise<unknown> {
  const res = await transport(project+'/rest/v1/rpc/'+name, {method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),
    headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify(params)});
  const data: unknown = JSON.parse(await boundedProviderText(res.body, 256000));
  if (!res.ok) {
    const mapped = object(data) && typeof data.message === 'string' ? sqlErrors[data.message] : null;
    throw mapped ? new WhopError(mapped[1],mapped[0]) : new WhopError('OWNER_BACKEND_UNAVAILABLE');
  }
  return data;
}

/** Consumer and owner actions use one protected endpoint, independently disabled until reviewed deployment. */
export async function handleOwner(request: Request, env: AuthEnv = envNow(), transport: typeof fetch = fetch): Promise<Response> {
  if (request.method !== 'POST') return liveResponse(405,'METHOD_NOT_ALLOWED');
  const secret = liveBackend(env);
  if (env.BUD_OWNER_PANEL_ENABLED !== 'true' || !secret || env.BUD_AUTH_ENABLED !== 'true' || !env.BUD_APP_ORIGIN)
    return liveResponse(503,'OWNER_PANEL_NOT_CONFIGURED');
  const url = new URL(request.url);
  if (url.origin !== env.BUD_APP_ORIGIN || request.headers.get('origin') !== url.origin) return liveResponse(403,'ORIGIN_DENIED');
  if (url.search) return liveResponse(400,'INVALID_REQUEST');
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return liveResponse(415,'JSON_REQUIRED');
  let refreshed: Headers | undefined;
  try {
    const limited = await enforceRateLimit(request,env,transport,'checkout'); if(limited) return limited;
    const session = await resolveOwnerSession(request,env,transport);
    if (!session) {
      await rpc('bud_owner_access_event',{p_actor:null,p_kind:'authentication_failed'},secret,transport);
      return liveResponse(401,'DISCORD_AUTH_REQUIRED');
    }
    refreshed=session.headers;
    const hostLimit=await enforceRateLimit(request,env,transport,'checkout','owner:'+session.hostId);
    if(hostLimit) { for(const c of refreshed.getSetCookie())hostLimit.headers.append('Set-Cookie',c);return hostLimit; }
    let body: unknown;
    try { body=JSON.parse(await boundedProviderText(request.body,4096)); } catch { return liveResponse(400,'INVALID_REQUEST',undefined,refreshed); }
    if(!object(body) || typeof body.action!=='string') throw new WhopError('INVALID_REQUEST',400);
    const isOwner = session.discordId !== null && await rpc('bud_owner_check',{p_actor:session.hostId,p_discord:session.discordId},secret,transport) === true;
    if(body.action==='profile' && exact(body,['action'])) return liveResponse(200,'OK',{owner:isOwner},refreshed);
    if(body.action==='redeem') {
      if(env.BUD_REDEEM_ENABLED!=='true') throw new WhopError('REDEEM_NOT_CONFIGURED');
      if(!exact(body,['action','code','operationId']) || typeof body.code!=='string' || !/^BUD-[A-Z2-7]{32}$/.test(body.code)
        || typeof body.operationId!=='string' || !uuid.test(body.operationId)) throw new WhopError('INVALID_OR_EXPIRED_CODE',400);
      const receipt=await rpc('bud_bonus_redeem',{p_host:session.hostId,p_digest:codeDigest(body.code,env),p_operation:body.operationId},secret,transport);
      return liveResponse(200,'OK',receipt,refreshed);
    }
    if(!isOwner) {
      await rpc('bud_owner_access_event',{p_actor:session.hostId,p_kind:['createCode','grant'].includes(body.action)?'issuance_denied':'owner_denied'},secret,transport);
      throw new WhopError('OWNER_REQUIRED',403);
    }
    if(body.action==='view') {
      if(!exact(body,['action','section','search','offset']) || typeof body.section!=='string' || !['overview','users','user','keys','payments','events','audit','health','settings','search'].includes(body.section)
        || typeof body.search!=='string' || body.search.length>80 || !Number.isSafeInteger(body.offset) || Number(body.offset)<0 || Number(body.offset)>100000) throw new WhopError('INVALID_REQUEST',400);
      const staleSeconds=Number(env.BUD_OWNER_ALERT_STALE_SECONDS);
      if(body.section==='overview'&&Number.isSafeInteger(staleSeconds)&&staleSeconds>=60&&staleSeconds<=86400)
        await rpc('bud_owner_sync_alerts',{p_actor:session.hostId,p_discord:session.discordId,p_stale_seconds:staleSeconds,
          p_expiry_seconds:Number(env.BUD_OWNER_ALERT_EXPIRY_SECONDS??0),p_failure_limit:Number(env.BUD_OWNER_ALERT_AUTH_FAILURES??0)},secret,transport);
      const data=await rpc('bud_owner_view',{p_actor:session.hostId,p_discord:session.discordId,p_section:body.section,p_search:body.search,p_offset:body.offset},secret,transport);
      return liveResponse(200,'OK',data,refreshed);
    }
    if(!exact(body,['action','operationId','confirmed','reason','payload']) || typeof body.operationId!=='string' || !uuid.test(body.operationId)
      || body.confirmed!==true || typeof body.reason!=='string' || body.reason.trim().length<3 || body.reason.trim().length>300 || !object(body.payload)) throw new WhopError('CONFIRMATION_REQUIRED',400);
    // Re-check provider-bound identity on every request. Cookie refresh must not renew this timestamp.
    const age=Date.now()/1000-session.authenticatedAt;
    if(!Number.isFinite(age) || age<0 || age>300) throw new WhopError('OWNER_REAUTH_REQUIRED',403);
    const p=body.payload;
    if(body.action==='inspectPayment'||body.action==='recoverPayment') {
      const config=whopProductionProcessingConfig(env);
      if(env.BUD_PAYMENT_RECOVERY_ENABLED!=='true'||!config)throw new WhopError('PAYMENT_RECOVERY_NOT_CONFIGURED');
      if(!exact(p,['orderId','paymentId'])||typeof p.orderId!=='string'||!uuid.test(p.orderId)||typeof p.paymentId!=='string'||!/^pay_[A-Za-z0-9]{5,80}$/.test(p.paymentId))throw new WhopError('INVALID_REQUEST',400);
      const lookup=await lookupProductionPayment(p.paymentId,config,transport);
      if(lookup.orderId!==p.orderId)throw new WhopError('PRODUCTION_PAYMENT_MISMATCH',409);
      const stored=await rpc('bud_live_order',{p_order:p.orderId},secret,transport);
      if(!object(stored)||stored.orderId!==p.orderId)throw new WhopError('PRODUCTION_PAYMENT_MISMATCH',409);
      assertProductionPaymentMatches(lookup.payment,stored as ProductionOrder,config);
      if(body.action==='inspectPayment')return liveResponse(200,'OK',{verified:true,orderId:p.orderId,amountMinor:stored.amountMinor,currency:stored.currency,fulfilled:stored.fulfilled,credited:false},refreshed);
      const receipt=await rpc('bud_owner_recover_payment',{p_actor:session.hostId,p_discord:session.discordId,p_operation:body.operationId,
        p_payment:p.paymentId,p_order:p.orderId,p_expected:stored,p_reason:body.reason.trim()},secret,transport);
      return liveResponse(200,'OK',receipt,refreshed);
    }
    let rawCode: string | undefined;
    let params: Record<string,unknown>;
    switch(body.action) {
      case 'createCode': {
        if(env.BUD_REDEEM_ENABLED!=='true') throw new WhopError('REDEEM_NOT_CONFIGURED');
        const qtyLimit=Number(env.BUD_OWNER_MAX_GRANT_SLOTS),usesLimit=Number(env.BUD_OWNER_MAX_CODE_USES);
        if(!integer(qtyLimit,100)||!integer(usesLimit,10000)) throw new WhopError('OWNER_POLICY_NOT_CONFIGURED');
        if(!exact(p,['qty','maxUses','expiresAt'])||!integer(p.qty,qtyLimit)||!integer(p.maxUses,usesLimit)||typeof p.expiresAt!=='string'||!Number.isFinite(Date.parse(p.expiresAt))||Date.parse(p.expiresAt)<=Date.now()) throw new WhopError('INVALID_REQUEST',400);
        const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        rawCode='BUD-'+[...randomBytes(32)].map(v=>alphabet[v&31]).join('');
        params={...p,digest:codeDigest(rawCode,env)}; break;
      }
      case 'suspendCode':
        if(!exact(p,['id'])||typeof p.id!=='string'||!uuid.test(p.id)) throw new WhopError('INVALID_REQUEST',400);
        params=p; break;
      case 'grant': {
        const ceiling=Number(env.BUD_OWNER_MAX_GRANT_SLOTS);
        if(!integer(ceiling,100)) throw new WhopError('OWNER_POLICY_NOT_CONFIGURED');
        if(!exact(p,['hostId','qty'])||typeof p.hostId!=='string'||!uuid.test(p.hostId)||!integer(p.qty,ceiling)) throw new WhopError('INVALID_REQUEST',400);
        params=p; break;
      }
      case 'restrict':
        if(!exact(p,['hostId','suspended'])||typeof p.hostId!=='string'||!uuid.test(p.hostId)||typeof p.suspended!=='boolean') throw new WhopError('INVALID_REQUEST',400);
        params=p;break;
      case 'setting':
        if(!exact(p,['name','value'])||p.name!=='operations_note'||typeof p.value!=='string'||p.value.length>500) throw new WhopError('INVALID_REQUEST',400);
        params=p;break;
      case 'ack':
        if(!exact(p,['fingerprint'])||typeof p.fingerprint!=='string'||p.fingerprint.length<1||p.fingerprint.length>160) throw new WhopError('INVALID_REQUEST',400);
        params=p;break;
      default: throw new WhopError('INVALID_REQUEST',400);
    }
    const receipt=await rpc('bud_owner_command',{p_actor:session.hostId,p_discord:session.discordId,p_operation:body.operationId,p_kind:body.action,p_body:{...params,reason:body.reason.trim()}},secret,transport);
    if(!object(receipt)||typeof receipt.replayed!=='boolean') throw new WhopError('OWNER_RECEIPT_UNCONFIRMED');
    return liveResponse(200,'OK',{...receipt,...(rawCode&&receipt.replayed===false?{code:rawCode}:{})},refreshed);
  }catch(error){
    return error instanceof WhopError ? liveResponse(error.status,error.code,undefined,refreshed) : liveResponse(503,'OWNER_SERVICE_UNAVAILABLE',undefined,refreshed);
  }
}
