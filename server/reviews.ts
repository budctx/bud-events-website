import {liveBackend,liveResponse} from './live-commerce.ts';
import {boundedProviderText} from './whop.ts';
import type {AuthEnv} from './auth.ts';
export async function handlePublicReviews(request:Request,env:AuthEnv=(globalThis as unknown as {process?:{env?:AuthEnv}}).process?.env??{},transport:typeof fetch=fetch){
 const url=new URL(request.url);
 if(request.method!=='GET')return liveResponse(405,'METHOD_NOT_ALLOWED');
 if(url.searchParams.size!==1||url.searchParams.get('public')!=='reviews')return liveResponse(400,'INVALID_REQUEST');
 const secret=liveBackend(env);if(!secret||env.BUD_REVIEWS_ENABLED!=='true')return liveResponse(503,'REVIEWS_NOT_CONFIGURED');
 try{
  const res=await transport('https://cepmvqqrjcvhyzszqand.supabase.co/rest/v1/rpc/bud_reviews_public',{method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:'{}'});
  const rows:unknown=JSON.parse(await boundedProviderText(res.body,32000));
  if(!res.ok||!Array.isArray(rows)||rows.length>12)throw Error();
  const safe=rows.map(row=>{if(!row||typeof row!=='object'||typeof row.id!=='string'||typeof row.name!=='string'||row.name.length>60||typeof row.comment!=='string'||row.comment.length>500||!Number.isInteger(row.rating)||row.rating<1||row.rating>5)throw Error();return {id:row.id,name:row.name,comment:row.comment,rating:row.rating};});
  // No CDN cache: owner hiding takes effect on the next page load.
  return liveResponse(200,'OK',safe);
 }catch{return liveResponse(503,'REVIEWS_UNAVAILABLE');}
}
