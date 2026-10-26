import {createHash,timingSafeEqual} from 'node:crypto';
import {liveBackend,liveResponse,liveRpc} from './live-commerce.ts';
import {boundedProviderText} from './whop.ts';
import type {AuthEnv} from './auth.ts';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const email=/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/;
const environment=():AuthEnv=>(globalThis as unknown as {process?:{env?:AuthEnv}}).process?.env??{};
function authorized(request:Request,secret:string|undefined){
 if(!secret||!/^[A-Za-z0-9_-]{32,128}$/.test(secret))return false;
 const value=request.headers.get('authorization')??'';if(value.length>256)return false;
 const digest=(s:string)=>createHash('sha256').update(s).digest();return timingSafeEqual(digest(value),digest('Bearer '+secret));
}
/** No scheduler, recipient or domain is enabled by this code. Operator-only, opt-in, bounded work. */
export async function handleOwnerMonitor(request:Request,env:AuthEnv=environment(),transport:typeof fetch=fetch):Promise<Response>{
 if(request.method!=='GET')return liveResponse(405,'METHOD_NOT_ALLOWED');
 if(!authorized(request,env.CRON_SECRET))return liveResponse(401,'WORKER_AUTH_REQUIRED');
 if(env.BUD_OWNER_MONITOR_ENABLED!=='true')return liveResponse(200,'MONITOR_DISABLED',{active:false});
 const secret=liveBackend(env),url=new URL(request.url),actor=env.BUD_OWNER_HOST_ID,discord=env.BUD_OWNER_DISCORD_ID;
 const stale=Number(env.BUD_OWNER_ALERT_STALE_SECONDS),escalation=Number(env.BUD_OWNER_ALERT_ESCALATION_SECONDS);
 const from=env.BUD_OWNER_ALERT_FROM,to=env.BUD_OWNER_ALERT_TO,key=env.RESEND_API_KEY;
 if(!secret||env.VERCEL_ENV!=='production'||!env.BUD_APP_ORIGIN||!actor||!uuid.test(actor)||!discord||!/^[1-9][0-9]{5,19}$/.test(discord)
  ||!Number.isSafeInteger(stale)||stale<60||stale>86400||!Number.isSafeInteger(escalation)||escalation<300||escalation>86400
  ||!key||!from||!to||from.length>254||to.length>254||!email.test(from)||!email.test(to))return liveResponse(503,'MONITOR_NOT_CONFIGURED');
 if(url.origin!==env.BUD_APP_ORIGIN||url.search||request.body!==null)return liveResponse(400,'INVALID_WORKER_REQUEST');
 try{
  const params={p_actor:actor,p_discord:discord};
  await liveRpc('bud_owner_sync_alerts',{...params,p_stale_seconds:stale,p_expiry_seconds:Number(env.BUD_OWNER_ALERT_EXPIRY_SECONDS??0),p_failure_limit:Number(env.BUD_OWNER_ALERT_AUTH_FAILURES??0)},secret,transport);
  const job=await liveRpc('bud_owner_claim_notification',{...params,p_recipient_digest:createHash('sha256').update(from+'\n'+to).digest('hex'),p_escalation_seconds:escalation},secret,transport);
  if(job===null)return liveResponse(200,'OK',{processed:0});
  if(!object(job)||typeof job.id!=='string'||!uuid.test(job.id)||typeof job.lease!=='string'||!uuid.test(job.lease)
   ||!['P0','P1'].includes(String(job.severity))||typeof job.kind!=='string'||!/^[a-z_]{1,80}$/.test(job.kind)
   ||typeof job.subject!=='string'||!/^[A-Za-z0-9:_-]{1,160}$/.test(job.subject)||typeof job.cycle!=='string'||!Number.isFinite(Date.parse(job.cycle)))throw new Error();
  let provider:string|null=null,retry=true;
  try{
   const res=await transport('https://api.resend.com/emails',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
    headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':'bud-owner-alert/'+job.id},
    body:JSON.stringify({from,to:[to],subject:`[BU'D] ${job.severity} — تنبيه تشغيل`,
     text:`تنبيه من بُعد\nالأولوية: ${job.severity}\nالنوع: ${job.kind}\nالمرجع: ${job.subject}\nبداية الرصد: ${job.cycle}\n\nراجع لوحة المالك. إقرار التنبيه لا يعني معالجة سببه.\n${env.BUD_APP_ORIGIN}`})});
   retry=res.status===429||res.status>=500||res.status===409;
   if(res.ok){const data:unknown=JSON.parse(await boundedProviderText(res.body,4096));if(object(data)&&typeof data.id==='string'&&uuid.test(data.id))provider=data.id;else retry=true;}
  }catch{retry=true;}
  const recorded=await liveRpc('bud_owner_finish_notification',{...params,p_job:job.id,p_lease:job.lease,p_provider:provider,p_retry:retry},secret,transport);
  if(!object(recorded)||recorded.recorded!==true)throw new Error();
  // Provider acceptance is not inbox delivery. A later real receipt test is a release gate.
  return liveResponse(provider?200:503,provider?'OK':'NOTIFICATION_UNCONFIRMED',{processed:1,accepted:provider!==null,delivered:false});
 }catch{return liveResponse(503,'MONITOR_UNAVAILABLE');}
}
