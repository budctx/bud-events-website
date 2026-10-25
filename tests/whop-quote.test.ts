import test from 'node:test';
import assert from 'node:assert/strict';
import { previewProductionQuote, QUOTE_VERSION } from '../server/whop-quote.ts';
import { inspectProductionPlan, classifyProductionRejection, ProductionProviderRejection } from '../server/whop-production.ts';

const config={token:'fixture-secret',company:'biz_fixture123',plan:'plan_fixture123',product:'prod_fixture123',currency:'sar' as const,amount:200};
const plan={id:config.plan,company:{id:config.company},product:{id:config.product},currency:'sar',initial_price:2,renewal_price:0,plan_type:'one_time',adaptive_pricing_enabled:true,collect_tax:true,tax_type:'exclusive'};
const money=(amount:string)=>({amount,currency:'sar',decimals:2});
function fixture() { return {id:'pq_fixture123',account_id:config.company,currency:'sar',base_currency:'sar',exchange_rate:null,payment_id:null,promo_code_id:null,
 located_by:'presentment_country',expires_at:new Date(Date.now()+300000).toISOString(),total:money('2.00'),base_total:money('2.00'),subtotal:money('2.00'),tax_amount:money('0.00'),discount:money('0'),
 tax_status:'not_applicable',tax_behavior:null,line_items:[{plan_id:config.plan,quantity:1,total:money('2.00'),subtotal:money('2.00'),tax_amount:money('0'),discount:money('0')}]}; }
test('preview verifies exact product then posts only fixed scenario; raw flags still reject checkout inspection',async()=>{
 let calls=0;
 const result=await previewProductionQuote(config,async(input,init)=>{
  calls++;assert.equal(init?.cache,'no-store');
  if(calls===1)return Response.json(plan);
  assert.equal(String(input),'https://api.whop.com/api/v1/payment_quotes');assert.equal(init?.method,'POST');
  assert.equal(new Headers(init?.headers).get('api-version-date'),QUOTE_VERSION);
  const request=JSON.parse(String(init?.body));
  assert.deepEqual(request,{account_id:config.company,line_items:[{plan_id:config.plan,quantity:1}],presentment_country:'SA'});
  // Whop requires country instead of currency. Do not model an invalid request as a successful quote.
  assert.equal(Object.hasOwn(request,'presentment_currency'),false);
  return Response.json({...fixture(),privateCustomer:'never return'});
 });
 assert.equal(calls,2);assert.equal(result.totalMinor,200);assert.equal(result.taxAmountMinor,0);assert.equal(result.previewOnly,true);assert.equal(result.paymentCreated,false);
 assert.doesNotMatch(JSON.stringify(result),/fixture-secret|pq_fixture|never return|privateCustomer/);
 await assert.rejects(inspectProductionPlan(config,async()=>Response.json(plan)),/PRODUCTION_PLAN_MISMATCH/);
});
test('quote refuses identity, price or product failure before any POST',async()=>{
 for(const change of [{id:'plan_other123'},{company:{id:'biz_other123'}},{product:{id:'prod_other123'}},{initial_price:3}]) {
  let calls=0;await assert.rejects(previewProductionQuote(config,async()=>{calls++;return Response.json({...plan,...change});}));assert.equal(calls,1);
 }
});
test('quote rejects malformed, converted, spent, expired, unavailable or foreign responses',async()=>{
 for(const change of [{account_id:'biz_other123'},{currency:'usd'},{base_currency:'usd'},{exchange_rate:'1.0'},{payment_id:'pay_other123'},
  {expires_at:'2020-01-01T00:00:00Z'},{tax_status:'unavailable'},{located_by:'address'},{total:money('NaN')},
  {line_items:[{...fixture().line_items[0],quantity:2}]},{line_items:[{...fixture().line_items[0],plan_id:'plan_other123'}]}]) {
  await assert.rejects(previewProductionQuote(config,async input=>Response.json(String(input).includes('/plans/')?plan:{...fixture(),...change})),/INVALID_PRODUCTION_QUOTE/);
 }
});
test('additive tax is reported as a mismatching preview, never normalized to the approved price',async()=>{
 const quote=fixture();quote.tax_status='calculated';(quote as Record<string,unknown>).tax_behavior='exclusive';
 quote.total=money('2.30');quote.base_total=money('2.30');quote.tax_amount=money('0.30');quote.line_items[0].total=money('2.30');quote.line_items[0].tax_amount=money('0.30');
 const result=await previewProductionQuote(config,async input=>Response.json(String(input).includes('/plans/')?plan:quote));
 assert.equal(result.totalMinor,230);assert.equal(result.taxAmountMinor,30);assert.equal(result.matchesApprovedPrice,false);
});

test('request rejection returns only allowlisted classifications and identifies quote POST separately from GET',async()=>{
 const secret='private-token-do-not-return';
 assert.deepEqual(classifyProductionRejection({error:{message:'company_id is required '+secret,param:'company_id',code:secret}}),{reason:'required_field',field:'company_id'});
 assert.deepEqual(classifyProductionRejection({error:{message:'Unsupported API version '+secret}}),{reason:'version',field:null});
 assert.deepEqual(classifyProductionRejection({error:{message:secret,param:secret,code:secret}}),{reason:'unclassified',field:null});
 await assert.rejects(previewProductionQuote(config,async input=>String(input).includes('/plans/')?Response.json(plan)
  :Response.json({error:{message:'company_id is required '+secret,param:'company_id'}},{status:422})),error=>{
   assert.ok(error instanceof ProductionProviderRejection);
   assert.deepEqual(error.request,{operation:'quote_preview',apiVersion:QUOTE_VERSION,providerStatus:422,reason:'required_field',field:'company_id'});
   assert.doesNotMatch(JSON.stringify(error),/private-token-do-not-return/);return true;
  });
});
