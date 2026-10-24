import { inspectProductionPlan, productionProvider, ProductionPlanMismatch } from './whop-production.ts';
import type { ProductionPlanExpectation } from './whop-production.ts';
import { WhopError } from './whop.ts';

// Separate dated contract: this diagnostic never creates or consumes a payment.
export const QUOTE_VERSION = '2026-10-24';
const object=(v:unknown):v is Record<string,unknown>=>!!v && typeof v==='object' && !Array.isArray(v);
function minor(v:unknown):number|null {
  if(!object(v)||v.currency!=='sar'||v.decimals!==2||typeof v.amount!=='string')return null;
  const match=/^(0|[1-9][0-9]{0,6})(?:\.([0-9]{1,2}))?$/.exec(v.amount);
  return match?Number(match[1])*100+Number((match[2]??'').padEnd(2,'0')):null;
}
export async function previewProductionQuote(config:ProductionPlanExpectation, transport:typeof fetch=fetch) {
  if(!config.product)throw new WhopError('QUOTE_PRODUCT_BINDING_REQUIRED');
  try { await inspectProductionPlan(config,transport); }
  catch(error) {
    // Only this preview can examine a quote despite raw settings. Checkout stays strict.
    if(!(error instanceof ProductionPlanMismatch)||!error.fields.every(field=>field==='conversion'||field==='tax'))throw error;
  }
  const quote=await productionProvider('/payment_quotes',config,transport,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({account_id:config.company,line_items:[{plan_id:config.plan,quantity:1}],presentment_country:'SA',presentment_currency:'sar'})},QUOTE_VERSION);
  const lines=quote.line_items;
  const total=minor(quote.total),baseTotal=minor(quote.base_total),subtotal=minor(quote.subtotal),tax=minor(quote.tax_amount),discount=minor(quote.discount);
  if(quote.account_id!==config.company||quote.currency!=='sar'||quote.base_currency!=='sar'||quote.exchange_rate!==null
    ||quote.payment_id!==null||quote.promo_code_id!==null||quote.located_by!=='presentment_country'
    ||typeof quote.id!=='string'||!/^pq_[A-Za-z0-9]{5,80}$/.test(quote.id)
    ||typeof quote.expires_at!=='string'||!Number.isFinite(Date.parse(quote.expires_at))||Date.parse(quote.expires_at)<=Date.now()
    ||!Array.isArray(lines)||lines.length!==1||!object(lines[0])||lines[0].plan_id!==config.plan||lines[0].quantity!==1
    ||total===null||baseTotal!==total||subtotal!==config.amount||tax===null||discount!==0
    ||minor(lines[0].total)!==total||minor(lines[0].subtotal)!==subtotal||minor(lines[0].tax_amount)!==tax||minor(lines[0].discount)!==0
    ||(quote.tax_status!=='calculated'&&quote.tax_status!=='not_applicable')
    ||![null,'inclusive','exclusive'].includes(quote.tax_behavior as null|string)
    ||(quote.tax_status==='not_applicable'&&(tax!==0||quote.tax_behavior!==null))
    ||(quote.tax_status==='calculated'&&quote.tax_behavior===null)
    ||total!==subtotal+(quote.tax_behavior==='exclusive'?tax:0)||tax>total)throw new WhopError('INVALID_PRODUCTION_QUOTE');
  // No quote ID, address, account registrations or provider body leaves the server.
  return {apiVersion:QUOTE_VERSION,country:'SA',currency:'sar',quantity:1,subtotalMinor:subtotal,totalMinor:total,taxAmountMinor:tax,
    taxStatus:quote.tax_status as 'calculated'|'not_applicable',taxBehavior:quote.tax_behavior as null|'inclusive'|'exclusive',
    matchesApprovedPrice:total===config.amount,previewOnly:true,paymentCreated:false,checkoutCreated:false,creditGranted:false};
}
