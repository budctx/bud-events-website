import {productionProvider} from './whop-production.ts';
import type {ProductionPlanExpectation} from './whop-production.ts';
import {WhopError} from './whop.ts';
// Account-model contract verified against whopio/whopsdk-typescript e92be653.
export const PROMO_VERSION='2026-10-29-8';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export const promoPattern=/^[a-z0-9_-]{3,40}$/;
export type PromoSummary={id:string;code:string;percent:number;status:string;uses:number;stock:number;unlimited:boolean;expiresAt:string|null;onePerCustomer:boolean};
export type PromoSnapshot={id:string;code:string;baseAmountMinor:number;discountMinor:number;percent:number};
export function normalizePromo(value:unknown):string {
 if(typeof value!=='string'||!promoPattern.test(value.toLowerCase()))throw new WhopError('PROMO_INVALID',400);
 return value.toLowerCase();
}
function summary(raw:unknown,config:ProductionPlanExpectation,checkAccount=true):PromoSummary {
 if(!object(raw)||typeof raw.id!=='string'||!/^promo_[A-Za-z0-9]{5,80}$/.test(raw.id)
  ||(checkAccount&&(!object(raw.account)||raw.account.id!==config.company))
  ||!object(raw.product)||raw.product.id!==config.product||raw.promo_type!=='percentage'
  ||typeof raw.amount_off!=='number'||!Number.isInteger(Math.round(raw.amount_off*100))
  ||Math.abs(raw.amount_off*100-Math.round(raw.amount_off*100))>0.000001||raw.amount_off<=0||raw.amount_off>=1
  ||!['active','inactive','archived'].includes(String(raw.status))||!Number.isSafeInteger(raw.uses)||Number(raw.uses)<0
  ||!Number.isSafeInteger(raw.stock)||typeof raw.unlimited_stock!=='boolean'||typeof raw.one_per_customer!=='boolean'
  ||(raw.expires_at!==null&&(typeof raw.expires_at!=='string'||!Number.isFinite(Date.parse(raw.expires_at)))))throw new WhopError('PROMO_UNSUPPORTED',409);
 return {id:raw.id,code:normalizePromo(raw.code),percent:Math.round(raw.amount_off*100),status:String(raw.status),uses:Number(raw.uses),stock:Number(raw.stock),
  unlimited:raw.unlimited_stock,expiresAt:raw.expires_at as string|null,onePerCustomer:raw.one_per_customer};
}
export async function retrievePromo(id:string,config:ProductionPlanExpectation,transport:typeof fetch=fetch){
 if(!/^promo_[A-Za-z0-9]{5,80}$/.test(id))throw new WhopError('PROMO_INVALID',400);
 return productionProvider('/promo_codes/'+encodeURIComponent(id),config,transport,{},PROMO_VERSION);
}
export async function listPromos(config:ProductionPlanExpectation,after:string|null=null,transport:typeof fetch=fetch){
 if(after!==null&&(after.length>300||/[\x00-\x1f]/.test(after)))throw new WhopError('INVALID_REQUEST',400);
 const query=new URLSearchParams({account_id:config.company,product_ids:config.product!,first:'50',...(after?{after}:{})});
 const data=await productionProvider('/promo_codes?'+query,config,transport,{},PROMO_VERSION);
 if(!Array.isArray(data.data)||data.data.length>50||!object(data.page_info)||typeof data.page_info.has_next_page!=='boolean')throw new WhopError('PROMO_UNAVAILABLE');
 const rows:PromoSummary[]=[];
 for(const item of data.data){try{rows.push(summary(item,config,false));}catch{/* Other promo types stay managed in Whop; never misrepresent them. */}}
 return {rows,after:data.page_info.has_next_page&&typeof data.page_info.end_cursor==='string'?data.page_info.end_cursor:null};
}
export async function findPromo(code:string,config:ProductionPlanExpectation,transport:typeof fetch=fetch):Promise<PromoSnapshot>{
 const normalized=normalizePromo(code);let after:string|null=null;
 for(let page=0;page<10;page++){
  const list=await listPromos(config,after,transport);
  const found=list.rows.find(row=>row.code===normalized);
  if(found){
   const raw=await retrievePromo(found.id,config,transport);const row=summary(raw,config);
   if(row.code!==normalized||row.status!=='active'||(row.expiresAt&&Date.parse(row.expiresAt)<=Date.now())||(!row.unlimited&&row.uses>=row.stock)
    ||raw.new_users_only!==false||raw.churned_users_only!==false||raw.existing_memberships_only!==false)throw new WhopError('PROMO_INVALID',400);
   const discountMinor=config.amount*row.percent/100;
   // Reject fractional halalas rather than guess the provider's rounding.
   if(!Number.isSafeInteger(discountMinor)||discountMinor<=0||discountMinor>=config.amount)throw new WhopError('PROMO_UNSUPPORTED',409);
   return {id:row.id,code:row.code,percent:row.percent,baseAmountMinor:config.amount,discountMinor};
  }
  after=list.after;if(!after)break;
 }
 throw new WhopError('PROMO_INVALID',400);
}
export async function mutatePromo(action:string,p:Record<string,unknown>,operationId:string,config:ProductionPlanExpectation,transport:typeof fetch=fetch){
 const headers={'Content-Type':'application/json','Idempotency-Key':'bud-promo-'+operationId};
 if(action==='promoCreate'){
  const code=normalizePromo(p.code);
  if(Object.keys(p).some(k=>!['code','percent','stock','expiresAt','onePerCustomer'].includes(k))||!Number.isSafeInteger(p.percent)||Number(p.percent)<1||Number(p.percent)>99
   ||(p.stock!==null&&(!Number.isSafeInteger(p.stock)||Number(p.stock)<1||Number(p.stock)>100000))||typeof p.onePerCustomer!=='boolean'
   ||(p.expiresAt!==null&&(typeof p.expiresAt!=='string'||!Number.isFinite(Date.parse(p.expiresAt))||Date.parse(p.expiresAt)<=Date.now())))throw new WhopError('INVALID_REQUEST',400);
  const raw=await productionProvider('/promo_codes',config,transport,{method:'POST',headers,body:JSON.stringify({account_id:config.company,code,
   promo_type:'percentage',amount_off:p.percent,base_currency:config.currency,product_id:config.product,promo_duration_months:1,
   new_users_only:false,churned_users_only:false,existing_memberships_only:false,one_per_customer:p.onePerCustomer,
   stock:p.stock,unlimited_stock:p.stock===null,expires_at:p.expiresAt})},PROMO_VERSION);
  const row=summary(raw,config);
  if(row.code!==code||row.percent!==p.percent||row.onePerCustomer!==p.onePerCustomer||row.unlimited!==(p.stock===null)
   ||(p.stock!==null&&row.stock!==p.stock)||row.status!=='active')throw new WhopError('PROMO_WRITE_UNCONFIRMED');
  return row;
 }
 if(!['promoPause','promoResume'].includes(action)||Object.keys(p).some(k=>k!=='id')||typeof p.id!=='string')throw new WhopError('INVALID_REQUEST',400);
 const before=summary(await retrievePromo(p.id,config,transport),config);
 if(before.status==='archived')throw new WhopError('PROMO_INVALID',400);
 const raw=await productionProvider('/promo_codes/'+p.id+(action==='promoPause'?'/deactivate':'/activate'),config,transport,{method:'POST',headers},PROMO_VERSION);
 const row=summary(raw,config);
 if(row.id!==p.id||row.status!==(action==='promoPause'?'inactive':'active'))throw new WhopError('PROMO_WRITE_UNCONFIRMED');
 return row;
}
