import test from 'node:test';
import assert from 'node:assert/strict';
import {findPromo,mutatePromo,normalizePromo,PROMO_VERSION} from '../server/whop-promos.ts';
import {assertProductionPaymentMatches,productionOrderMatches} from '../server/whop-production.ts';
import {checkoutDestination} from '../src/checkout-destination.ts';
const config={token:'fixture',company:'biz_fixture123',product:'prod_fixture123',plan:'plan_fixture123',currency:'sar' as const,amount:2000,origin:'https://budteam.net',audience:'public' as const,pilotHostId:'',secret:'fixture',webhookVersion:'2026-10-15-1'};
const raw={id:'promo_fixture123',account:{id:config.company},product:{id:config.product},code:'bud10',amount_off:.1,promo_type:'percentage',status:'active',uses:0,stock:100,unlimited_stock:false,expires_at:null,one_per_customer:false,new_users_only:false,churned_users_only:false,existing_memberships_only:false};
const promo={id:raw.id,code:'bud10',percent:10,baseAmountMinor:2000,discountMinor:200};
const order={orderId:'11111111-1111-4111-8111-111111111111',hostId:'22222222-2222-4222-8222-222222222222',environment:'production' as const,companyId:config.company,productId:config.product,planId:config.plan,currency:'sar',amountMinor:1800,locale:'ar' as const,checkoutId:'ch_fixture123',checkoutUrl:'https://whop.com/checkout/ch_fixture123/',promotion:promo};
const payment={id:'pay_fixture123',checkout_configuration_id:order.checkoutId,company:{id:config.company},product:{id:config.product},plan:{id:config.plan},currency:'sar',subtotal:20,total:18,promo_code:{id:promo.id},metadata:{bud_order_id:order.orderId,bud_environment:'production'},status:'paid',substatus:'succeeded',paid_at:'2026-10-30T10:00:00Z',refunded_amount:0,auto_refunded:false,refunded_at:null,disputes:[]};
test('promo lookup uses scoped bounded provider data and exact percentage arithmetic',async()=>{
 const calls:string[]=[];const result=await findPromo('BUD10',config,async(input,init)=>{calls.push(String(input));assert.equal(new Headers(init?.headers).get('api-version-date'),PROMO_VERSION);return Response.json(String(input).includes('?')?{data:[raw],page_info:{has_next_page:false}}:raw);});
 assert.deepEqual(result,promo);assert.equal(calls.length,2);assert.match(calls[0],/account_id=biz_fixture123/);assert.match(calls[0],/product_ids=prod_fixture123/);
 for(const invalid of ['x','a&return=evil','a b','كوبون'])assert.throws(()=>normalizePromo(invalid));
});
test('inactive, exhausted, expired, restricted and foreign promos never become a price',async()=>{
 for(const change of [{status:'inactive'},{stock:0},{expires_at:'2020-01-01T00:00:00Z'},{new_users_only:true},{account:{id:'biz_other123'}},{product:{id:'prod_other123'}},{amount_off:1},{amount_off:.105}]){
  const changed={...raw,...change};await assert.rejects(findPromo('bud10',config,async input=>Response.json(String(input).includes('?')?{data:[changed],page_info:{has_next_page:false}}:changed)));
 }
});
test('promo creates are scoped, pinned and idempotent without accepting browser product or currency',async()=>{
 const p={code:'BUD10',percent:10,stock:100,expiresAt:null,onePerCustomer:false};let calls=0;
 const row=await mutatePromo('promoCreate',p,'fixture-operation',config,async(input,init)=>{calls++;assert.match(String(input),/\/promo_codes$/);assert.equal(init?.method,'POST');const b=JSON.parse(String(init?.body));assert.equal(b.amount_off,10);assert.equal(b.product_id,config.product);assert.equal(b.account_id,config.company);assert.equal(b.base_currency,'sar');assert.equal(b.new_users_only,false);assert.equal(new Headers(init?.headers).get('idempotency-key'),'bud-promo-fixture-operation');return Response.json(raw);});
 assert.equal(row.percent,10);assert.equal(calls,1);
 await assert.rejects(mutatePromo('promoCreate',{...p,product_id:'prod_other123'},'op',config));
});
test('discounted receipts require immutable promo, base and exact net; unrelated lower payments fail',()=>{
 assert.equal(productionOrderMatches(order,config),true);assert.doesNotThrow(()=>assertProductionPaymentMatches(payment,order,config));
 for(const change of [{total:17},{total:20},{subtotal:18},{promo_code:null},{promo_code:{id:'promo_other123'}},{currency:'usd'},{checkout_configuration_id:'ch_other123'}])assert.throws(()=>assertProductionPaymentMatches({...payment,...change},order,config));
 assert.equal(productionOrderMatches({...order,promotion:undefined},config),false);
 assert.equal(productionOrderMatches({...order,promotion:{...promo,percent:50}},config),false);
 assert.equal(productionOrderMatches({...order,promotion:undefined,amountMinor:300},config),false);
 assert.equal(productionOrderMatches({...order,promotion:undefined,amountMinor:300},config,true),true);
});
test('checkout URL accepts only one bounded promo in addition to an actual session',()=>{
 const base='https://whop.com/checkout/plan_fixture123?session=ch_fixture123';
 assert.equal(checkoutDestination(base+'&promoCode=bud10','production'),base+'&promoCode=bud10');
 for(const url of [base+'&promoCode=bud10&return=evil',base+'&promoCode=bud10&promoCode=other',base+'&promoCode=bad%26code','https://whop.com/checkout/plan_fixture123?promoCode=bud10'])assert.equal(checkoutDestination(url,'production'),null);
});
