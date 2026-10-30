import {productionPlanExpectation,inspectProductionPlan} from './whop-production.ts';
import {findPromo,normalizePromo} from './whop-promos.ts';
import {liveResponse} from './live-commerce.ts';
import {enforceRateLimit} from './rate-limit.ts';
import {WhopError} from './whop.ts';
import type {CommerceEnv} from './whop.ts';
export async function handlePrice(request:Request,env:CommerceEnv=(globalThis as unknown as {process?:{env?:CommerceEnv}}).process?.env??{},transport:typeof fetch=fetch){
 if(request.method!=='GET')return liveResponse(405,'METHOD_NOT_ALLOWED');
 const url=new URL(request.url),config=productionPlanExpectation(env);
 if(url.origin!==env.BUD_APP_ORIGIN||url.searchParams.size>1||[...url.searchParams.keys()].some(k=>!['promoCode','price'].includes(k)))return liveResponse(400,'INVALID_REQUEST');
 if(!config||!config.product)return liveResponse(503,'PRICE_NOT_CONFIGURED');
 try{
  const limited=await enforceRateLimit(request,env,transport,'host');if(limited)return limited;
  const code=url.searchParams.get('promoCode')??(env.BUD_PROMO_CODES_ENABLED==='true'?env.BUD_DEFAULT_PROMO_CODE??null:null);
  if(code!==null&&env.BUD_PROMO_CODES_ENABLED!=='true')throw new WhopError('PROMO_NOT_CONFIGURED');
  if(code!==null)await inspectProductionPlan(config,transport);
  const promo=code===null?null:await findPromo(normalizePromo(code),config,transport);
  return liveResponse(200,'OK',{baseAmountMinor:config.amount,amountMinor:config.amount-(promo?.discountMinor??0),currency:'sar',
   promotion:promo?{code:promo.code,percent:promo.percent}:null});
 }catch(error){return error instanceof WhopError?liveResponse(error.status,error.code):liveResponse(503,'PRICE_UNAVAILABLE');}
}
