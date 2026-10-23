import { isIP } from 'node:net';
type Env = Record<string,string|undefined>;
export type RateScope = 'auth-signin'|'auth-session'|'auth-callback'|'auth-logout'|'host'|'checkout'|'webhook';
const project='https://cepmvqqrjcvhyzszqand.supabase.co';
const encoder=new TextEncoder();
function failure(status:number,code:string,retryAfter?:number) {
  return Response.json({code},{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(retryAfter?{'Retry-After':String(retryAfter)}:{})}});
}
/** Only trust the edge header inside the actual Vercel runtime; never store raw IPs. */
export async function enforceRateLimit(request:Request,env:Env,transport:typeof fetch,scope:RateScope,subject?:string):Promise<Response|null> {
  if(env.BUD_RATE_LIMIT_ENABLED!=='true'||env.SUPABASE_URL!==project||!env.SUPABASE_SERVICE_ROLE_KEY||!env.BUD_RATE_LIMIT_SECRET||encoder.encode(env.BUD_RATE_LIMIT_SECRET).length<32) return failure(503,'RATE_LIMIT_NOT_CONFIGURED');
  if(env.VERCEL!=='1') return failure(503,'RATE_LIMIT_EDGE_UNVERIFIED');
  const ip=request.headers.get('x-vercel-forwarded-for')?.trim()??'';
  const family=isIP(ip);
  if(!family) return failure(503,'RATE_LIMIT_EDGE_UNVERIFIED');
  try {
    const address=family===6?new URL('http://['+ip+']').hostname.toLowerCase():ip;
    const key=await crypto.subtle.importKey('raw',encoder.encode(env.BUD_RATE_LIMIT_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const digest=await crypto.subtle.sign('HMAC',key,encoder.encode(scope+'|'+(subject?'host:'+subject:'edge:'+address)));
    const bucket=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
    const response=await transport(project+'/rest/v1/rpc/bud_consume_rate_limit',{method:'POST',redirect:'error',signal:AbortSignal.timeout(5000),headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({p_scope:scope,p_bucket:bucket})});
    if(!response.ok)return failure(503,'RATE_LIMIT_UNAVAILABLE');
    const reader=response.body?.getReader(); if(!reader)return failure(503,'RATE_LIMIT_UNAVAILABLE');
    let size=0,body=''; const decoder=new TextDecoder();
    while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>4096){await reader.cancel();return failure(503,'RATE_LIMIT_UNAVAILABLE');}body+=decoder.decode(part.value,{stream:true});}
    const result=JSON.parse(body+decoder.decode());
    if(!result||typeof result.allowed!=='boolean'||!Number.isSafeInteger(result.retryAfter)||result.retryAfter<0||result.retryAfter>60)return failure(503,'RATE_LIMIT_UNAVAILABLE');
    return result.allowed?null:failure(429,'RATE_LIMITED',Math.max(1,result.retryAfter));
  }catch{return failure(503,'RATE_LIMIT_UNAVAILABLE');}
}
