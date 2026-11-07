import {liveBackend,liveResponse} from './live-commerce.ts';
import {boundedProviderText} from './whop.ts';
import type {AuthEnv} from './auth.ts';
type PublicReview={id:string;name:string;comment:string;rating:number;avatarUrl:string|null};
const discordAvatar=/^https:\/\/cdn\.discordapp\.com\/(?:avatars\/[1-9][0-9]{5,19}\/(?:a_)?[a-f0-9]{32}\.png\?size=64|embed\/avatars\/[0-5]\.png)$/;
export async function handlePublicReviews(request:Request,env:AuthEnv=(globalThis as unknown as {process?:{env?:AuthEnv}}).process?.env??{},transport:typeof fetch=fetch){
 const url=new URL(request.url);
 if(request.method!=='GET')return liveResponse(405,'METHOD_NOT_ALLOWED');
 if(url.searchParams.size!==1||url.searchParams.get('public')!=='reviews')return liveResponse(400,'INVALID_REQUEST');
 const secret=liveBackend(env);if(!secret||env.BUD_REVIEWS_ENABLED!=='true')return liveResponse(503,'REVIEWS_NOT_CONFIGURED');
 try{
  const res=await transport('https://cepmvqqrjcvhyzszqand.supabase.co/rest/v1/rpc/bud_reviews_public_text',{method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:'{}'});
  const rows:unknown=JSON.parse(await boundedProviderText(res.body,32000));
  if(!res.ok||!Array.isArray(rows)||rows.length>5)throw Error();
  const safe=rows.map((row:unknown):PublicReview=>{
   if(!row||typeof row!=='object')throw Error();
   const v=row as Record<string,unknown>;
   if(typeof v.id!=='string'||typeof v.name!=='string'||v.name.length<1||v.name.length>60
    ||typeof v.comment!=='string'||v.comment.length<3||v.comment.length>500
    ||!Number.isInteger(v.rating)||Number(v.rating)<1||Number(v.rating)>5
    ||!(v.avatarUrl===null||(typeof v.avatarUrl==='string'&&discordAvatar.test(v.avatarUrl))))throw Error();
   return {id:v.id,name:v.name,comment:v.comment,rating:Number(v.rating),avatarUrl:v.avatarUrl as string|null};
  });
  return liveResponse(200,'OK',safe);
 }catch{return liveResponse(503,'REVIEWS_UNAVAILABLE');}
}

export async function handleLatestReviews(request:Request,env:AuthEnv=(globalThis as unknown as {process?:{env?:AuthEnv}}).process?.env??{},transport:typeof fetch=fetch){
 const url=new URL(request.url);
 if(request.method!=='GET')return liveResponse(405,'METHOD_NOT_ALLOWED');
 if(url.searchParams.get('public')!=='latest-reviews'||url.searchParams.size>2
 ||[...url.searchParams.keys()].some(key=>!['public','offset'].includes(key)))return liveResponse(400,'INVALID_REQUEST');
 const raw=url.searchParams.get('offset')??'0';
 if(!/^(0|[1-9][0-9]{0,4})$/.test(raw)||Number(raw)>10000)return liveResponse(400,'INVALID_REQUEST');
 const secret=liveBackend(env);if(!secret||env.BUD_REVIEWS_ENABLED!=='true')return liveResponse(503,'REVIEWS_NOT_CONFIGURED');
 try{
  const res=await transport('https://cepmvqqrjcvhyzszqand.supabase.co/rest/v1/rpc/bud_reviews_latest_text',{
   method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),
   headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'},
   body:JSON.stringify({p_offset:Number(raw),p_limit:12})
  });
  const data:unknown=JSON.parse(await boundedProviderText(res.body,64000));
  if(!res.ok||!data||typeof data!=='object'||Array.isArray(data))throw Error();
  const value=data as Record<string,unknown>;
  if(!Array.isArray(value.items)||value.items.length>12||typeof value.hasMore!=='boolean')throw Error();
  const items=value.items.map((row:unknown)=>{
   if(!row||typeof row!=='object')throw Error();
   const v=row as Record<string,unknown>;
   if(typeof v.id!=='string'||typeof v.name!=='string'||v.name.length<1||v.name.length>60
   ||typeof v.comment!=='string'||v.comment.length<3||v.comment.length>500
   ||!Number.isInteger(v.rating)||Number(v.rating)<1||Number(v.rating)>5
   ||typeof v.publishedAt!=='string'||!(v.avatarUrl===null||(typeof v.avatarUrl==='string'&&discordAvatar.test(v.avatarUrl))))throw Error();
   return {id:v.id,name:v.name,comment:v.comment,rating:Number(v.rating),avatarUrl:v.avatarUrl,publishedAt:v.publishedAt};
  });
  return liveResponse(200,'OK',{items,hasMore:value.hasMore});
 }catch{return liveResponse(503,'REVIEWS_UNAVAILABLE');}
}
