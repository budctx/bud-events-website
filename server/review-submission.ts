import {resolveOwnerSession} from './auth.ts';
import type {AuthEnv} from './auth.ts';
import {liveBackend,liveResponse,liveRpc} from './live-commerce.ts';
import {enforceRateLimit} from './rate-limit.ts';
import {boundedProviderText} from './whop.ts';

function environment():AuthEnv{return (globalThis as unknown as {process?:{env?:AuthEnv}}).process?.env??{};}
function record(v:unknown):v is Record<string,unknown>{return !!v&&typeof v==='object'&&!Array.isArray(v);}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function handleReview(request:Request,env:AuthEnv=environment(),transport:typeof fetch=fetch):Promise<Response>{
 if(request.method!=='POST')return liveResponse(405,'METHOD_NOT_ALLOWED');
 const secret=liveBackend(env);
 if(!secret||env.BUD_REVIEWS_ENABLED!=='true'||env.BUD_AUTH_ENABLED!=='true'||!env.BUD_APP_ORIGIN)return liveResponse(503,'REVIEWS_NOT_CONFIGURED');
 if(new URL(request.url).origin!==env.BUD_APP_ORIGIN||request.headers.get('origin')!==env.BUD_APP_ORIGIN||(new URL(request.url).searchParams.size!==1||new URL(request.url).searchParams.get('flow')!=='review'))return liveResponse(403,'ORIGIN_DENIED');
 if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return liveResponse(415,'JSON_REQUIRED');
 let body:unknown;
 try{body=JSON.parse(await boundedProviderText(request.body,4096));}
 catch{return liveResponse(400,'INVALID_REQUEST');}
 if(!record(body)||!['mine','submit','feature'].includes(String(body.action)))return liveResponse(400,'INVALID_REQUEST');
 const action=String(body.action);
 const expected=action==='mine'?['action']:action==='submit'?['action','comment']:['action','id','rank','operationId'];
 if(Object.keys(body).length!==expected.length||!expected.every(key=>Object.prototype.hasOwnProperty.call(body,key)))return liveResponse(400,'INVALID_REQUEST');
 if(action==='submit'&&(typeof body.comment!=='string'||body.comment.trim().length<3||body.comment.length>500))return liveResponse(400,'INVALID_REQUEST');
 if(action==='feature'&&(!uuid.test(String(body.id))||!uuid.test(String(body.operationId))||!(body.rank===null||Number.isInteger(body.rank)&&Number(body.rank)>=1&&Number(body.rank)<=5)))return liveResponse(400,'INVALID_REQUEST');
 const limited=await enforceRateLimit(request,env,transport,action==='mine'?'host':'checkout');if(limited)return limited;
 const session=await resolveOwnerSession(request,env,transport);if(!session)return liveResponse(401,'DISCORD_AUTH_REQUIRED');
 const userLimited=await enforceRateLimit(request,env,transport,action==='mine'?'host':'checkout','review:'+session.hostId);if(userLimited)return userLimited;
 try{
  if(action==='mine')return liveResponse(200,'OK',await liveRpc('bud_review_mine',{p_host:session.hostId},secret,transport),session.headers);
  if(action==='submit')return liveResponse(200,'OK',await liveRpc('bud_review_submit_text',{
   p_host:session.hostId,p_comment:(body.comment as string).trim(),p_name:session.displayName.trim().slice(0,60),p_avatar:session.avatarUrl
  },secret,transport),session.headers);
  if(!session.discordId)return liveResponse(403,'OWNER_REQUIRED',undefined,session.headers);
  const result=await liveRpc('bud_review_feature',{
   p_actor:session.hostId,p_discord:session.discordId,p_operation:body.operationId,p_id:body.id,p_rank:body.rank,
   p_reason:'مراجعة اختيار وترتيب آراء المستخدمين'
  },secret,transport);
  return liveResponse(200,'OK',result,session.headers);
 }catch{return liveResponse(503,'REVIEWS_UNAVAILABLE',undefined,session.headers);}
}
