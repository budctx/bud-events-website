import { liveBackend, liveResponse } from './live-commerce.ts';
import type { AuthEnv } from './auth.ts';
import { boundedProviderText } from './whop.ts';

const PROJECT='https://cepmvqqrjcvhyzszqand.supabase.co';
const envNow=():AuthEnv=>(globalThis as unknown as {process?:{env?:AuthEnv}}).process?.env??{};
export type PublicPartner={id:string;name:string;logoUrl:string;websiteUrl:string};
export async function handlePartners(request:Request,env:AuthEnv=envNow(),transport:typeof fetch=fetch):Promise<Response>{
 if(request.method!=='GET')return liveResponse(405,'METHOD_NOT_ALLOWED');
 const url=new URL(request.url);
 if(!url.pathname.endsWith('/api/owner')||url.searchParams.size!==1||url.searchParams.get('public')!=='partners')return liveResponse(400,'INVALID_REQUEST');
 const secret=liveBackend(env);
 if(!secret)return liveResponse(503,'PARTNERS_NOT_CONFIGURED');
 try{
  const response=await transport(PROJECT+'/rest/v1/rpc/bud_site_partners_public',{
   method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),
   headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:'{}'
  });
  if(!response.ok)return liveResponse(503,'PARTNERS_UNAVAILABLE');
  const data:unknown=JSON.parse(await boundedProviderText(response.body,24000));
  if(!Array.isArray(data)||data.length>30)return liveResponse(503,'PARTNERS_UNAVAILABLE');
  const partners=data.filter((item):item is PublicPartner=>{
   if(!item||typeof item!=='object'||Array.isArray(item))return false;
   const p=item as Record<string,unknown>;
   if(typeof p.id!=='string'||typeof p.name!=='string'||typeof p.logoUrl!=='string'||typeof p.websiteUrl!=='string'||p.name.length>80)return false;
   const safe=(raw:string,logo:boolean)=>{
    try{const url=new URL(raw);return url.protocol==='https:'&&!!url.hostname&&!url.username&&!url.password&&!url.hash&&(!logo||/\.(png|jpe?g|webp)$/i.test(url.pathname));}
    catch{return false;}
   };
   return safe(p.logoUrl,true)&&(p.websiteUrl===''||safe(p.websiteUrl,false));
  });
  return liveResponse(200,'OK',partners);
 }catch{return liveResponse(503,'PARTNERS_UNAVAILABLE');}
}
