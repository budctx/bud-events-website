import {listPromos,mutatePromo} from './whop-promos.ts';
import {productionPlanExpectation} from './whop-production.ts';
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
    let body: unknown;
    try { body=JSON.parse(await boundedProviderText(request.body,4096)); } catch { return liveResponse(400,'INVALID_REQUEST'); }
    if(!object(body) || typeof body.action!=='string') throw new WhopError('INVALID_REQUEST',400);
    // Read-only navigation must not consume the stricter purchase/redemption/mutation budget.
    const scope=['profile','view','receipt','partners','promos','reviews'].includes(body.action)?'host':'checkout';
    const limited = await enforceRateLimit(request,env,transport,scope); if(limited) return limited;
    const session = await resolveOwnerSession(request,env,transport);
    if (!session) {
      await rpc('bud_owner_access_event',{p_actor:null,p_kind:'authentication_failed'},secret,transport);
      return liveResponse(401,'DISCORD_AUTH_REQUIRED');
    }
    refreshed=session.headers;
    const hostLimit=await enforceRateLimit(request,env,transport,scope,'owner:'+session.hostId);
    if(hostLimit) { for(const c of refreshed.getSetCookie())hostLimit.headers.append('Set-Cookie',c);return hostLimit; }
    const isOwner = session.discordId !== null && await rpc('bud_owner_check',{p_actor:session.hostId,p_discord:session.discordId},secret,transport) === true;
    if(body.action==='profile' && exact(body,['action'])) return liveResponse(200,'OK',{owner:isOwner},refreshed);
    if(body.action==='reviewSubmit') {
      if(env.BUD_REVIEWS_ENABLED!=='true')throw new WhopError('REVIEWS_NOT_CONFIGURED');
      if(!exact(body,['action','eventId','rating','comment','displayName','publishConsent'])||typeof body.eventId!=='string'||!uuid.test(body.eventId)
       ||!integer(body.rating,5)||typeof body.comment!=='string'||body.comment.length>500||typeof body.displayName!=='string'
       ||body.displayName.trim().length<1||body.displayName.trim().length>60||typeof body.publishConsent!=='boolean')throw new WhopError('INVALID_REQUEST',400);
      const receipt=await rpc('bud_review_submit',{p_host:session.hostId,p_event:body.eventId,p_rating:body.rating,p_comment:body.comment.trim(),p_name:body.displayName.trim(),p_consent:body.publishConsent},secret,transport);
      return liveResponse(200,'OK',receipt,refreshed);
    }
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
    if(body.action==='reviews') {
      if(env.BUD_REVIEWS_ENABLED!=='true')throw new WhopError('REVIEWS_NOT_CONFIGURED');
      if(!exact(body,['action','offset'])||!Number.isSafeInteger(body.offset)||Number(body.offset)<0||Number(body.offset)>100000)throw new WhopError('INVALID_REQUEST',400);
      return liveResponse(200,'OK',await rpc('bud_reviews_owner',{p_actor:session.hostId,p_discord:session.discordId,p_offset:body.offset},secret,transport),refreshed);
    }
    if(body.action==='promos') {
      const config=productionPlanExpectation(env);
      if(env.BUD_PROMO_MANAGEMENT_ENABLED!=='true'||!config?.product)throw new WhopError('PROMO_NOT_CONFIGURED');
      if(!exact(body,['action','after'])||(body.after!==null&&typeof body.after!=='string'))throw new WhopError('INVALID_REQUEST',400);
      return liveResponse(200,'OK',{...await listPromos(config,body.after as string|null,transport),checkoutEnabled:env.BUD_PROMO_CODES_ENABLED==='true',baseAmountMinor:config.amount},refreshed);
    }
    if(body.action==='partners'&&exact(body,['action'])) {
      const list=await rpc('bud_site_partners_owner',{p_actor:session.hostId,p_discord:session.discordId},secret,transport);
      if(!Array.isArray(list)||list.length>30)throw new WhopError('OWNER_BACKEND_UNAVAILABLE');
      return liveResponse(200,'OK',list,refreshed);
    }
    if(body.action==='receipt') {
      if(!exact(body,['action','operationId'])||typeof body.operationId!=='string'||!uuid.test(body.operationId))throw new WhopError('INVALID_REQUEST',400);
      const receipt=await rpc('bud_owner_receipt',{p_actor:session.hostId,p_discord:session.discordId,p_operation:body.operationId},secret,transport);
      if(!object(receipt)||typeof receipt.found!=='boolean')throw new WhopError('OWNER_RECEIPT_UNCONFIRMED');
      return liveResponse(200,'OK',receipt,refreshed);
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
    // The verified session and owner check above authorize every command.
    // Token refresh preserves the session lifetime without another Discord redirect.
    const p=body.payload;
    if(body.action==='reviewModerate') {
      if(env.BUD_REVIEWS_ENABLED!=='true')throw new WhopError('REVIEWS_NOT_CONFIGURED');
      if(!exact(p,['id','status'])||typeof p.id!=='string'||!uuid.test(p.id)||!['published','hidden'].includes(String(p.status)))throw new WhopError('INVALID_REQUEST',400);
      return liveResponse(200,'OK',await rpc('bud_review_moderate',{p_actor:session.hostId,p_discord:session.discordId,p_operation:body.operationId,p_id:p.id,p_status:p.status,p_reason:body.reason.trim()},secret,transport),refreshed);
    }

    if(['promoCreate','promoPause','promoResume'].includes(body.action)) {
      const config=productionPlanExpectation(env);
      if(env.BUD_PROMO_MANAGEMENT_ENABLED!=='true'||!config?.product)throw new WhopError('PROMO_NOT_CONFIGURED');
      const params={p_actor:session.hostId,p_discord:session.discordId,p_operation:body.operationId,p_kind:body.action,p_request:{...p,reason:body.reason.trim()}};
      const prepared=await rpc('bud_owner_promo_operation',{...params,p_result:null},secret,transport);
      if(object(prepared)&&prepared.replayed===true)return liveResponse(200,'OK',prepared,refreshed);
      const row=await mutatePromo(body.action,p,body.operationId,config,transport);
      const receipt=await rpc('bud_owner_promo_operation',{...params,p_result:{id:row.id,promotion:row}},secret,transport);
      return liveResponse(200,'OK',receipt,refreshed);
    }

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
    if(body.action==='partnerSave'||body.action==='partnerDelete'){
      if(body.action==='partnerSave'){
        if(!exact(p,['id','name','logoUrl','websiteUrl','sortOrder','visible'])||
          (p.id!==null&&(typeof p.id!=='string'||!uuid.test(p.id)))||
          typeof p.name!=='string'||p.name.trim().length<2||p.name.trim().length>80||
          typeof p.logoUrl!=='string'||p.logoUrl.length>500||
          typeof p.websiteUrl!=='string'||p.websiteUrl.length>500||
          !Number.isInteger(p.sortOrder)||Number(p.sortOrder)<0||Number(p.sortOrder)>999||
          typeof p.visible!=='boolean')throw new WhopError('INVALID_REQUEST',400);
        const validUrl=(raw:string,isLogo:boolean)=>{
          try{const url=new URL(raw);return url.protocol==='https:'&&!!url.hostname&&!url.username&&!url.password&&
            (!isLogo||/\.(png|jpe?g|webp)$/i.test(url.pathname))&&url.hash==='';}catch{return false;}
        };
        if(!validUrl(p.logoUrl,true)||(p.websiteUrl!==''&&!validUrl(p.websiteUrl,false)))throw new WhopError('INVALID_REQUEST',400);
      }else if(!exact(p,['id'])||typeof p.id!=='string'||!uuid.test(p.id))throw new WhopError('INVALID_REQUEST',400);
      const receipt=await rpc('bud_site_partner_command',{p_actor:session.hostId,p_discord:session.discordId,
        p_operation:body.operationId,p_kind:body.action,p_body:{...p,reason:body.reason.trim()}},secret,transport);
      if(!object(receipt)||typeof receipt.replayed!=='boolean')throw new WhopError('OWNER_RECEIPT_UNCONFIRMED');
      return liveResponse(200,'OK',receipt,refreshed);
    }
    let rawCode: string | undefined;
    let params: Record<string,unknown>;
    switch(body.action) {
      case 'createCode': {
        if(env.BUD_REDEEM_ENABLED!=='true') throw new WhopError('REDEEM_NOT_CONFIGURED');
        const qtyLimit=Number(env.BUD_OWNER_MAX_GRANT_SLOTS),usesLimit=Number(env.BUD_OWNER_MAX_CODE_USES);
        if(!integer(qtyLimit,100)||!integer(usesLimit,10000)) throw new WhopError('OWNER_POLICY_NOT_CONFIGURED');
        // Legacy expiry fields are accepted for pending receipts; the database sets new-key expiry.
        if(!exact(p,['qty','maxUses','expiresAt'])||!integer(p.qty,qtyLimit)||!integer(p.maxUses,usesLimit)) throw new WhopError('INVALID_REQUEST',400);
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
