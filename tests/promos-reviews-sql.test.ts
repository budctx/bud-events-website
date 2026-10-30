import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const host='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',event='33333333-3333-4333-8333-333333333333',discord='123456789012345678';
const op=(n:number)=>'44444444-4444-4444-8444-'+String(n).padStart(12,'0');
test('promo snapshots and reviews enforce ownership, consent, replay and private tables',async()=>{
 const db=new PGlite();const value=async(sql:string,args:unknown[]=[]) =>(await db.query<{v:any}>(sql,args)).rows[0]?.v;
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,created_at timestamptz default now());create table auth.identities(user_id uuid,provider text,identity_data jsonb);insert into auth.users(id) values('${host}'),('${other}');`);
 for(const name of ['20261022215208_host_persistence_foundation.sql','20261023173930_production_commerce_foundation.sql','20261023193330_live_payment_queue_and_event_consumption.sql','20261023202259_live_payment_operations_and_receipts.sql','20261026042029_owner_panel_and_bonus_ledger.sql','20261030141041_whop_promo_orders.sql','20261030141500_event_reviews.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
 await db.exec(`insert into bud_platform.platform_owners values('${other}','${discord}');update bud_platform.live_commerce_control set enabled=true,fulfillment_enabled=true;insert into bud_platform.live_events(id,host_id,title,start_key,phase,version,state,start_fingerprint,content_version,pair_order) values('${event}','${host}','fixture','start-fixture-123456','live',1,'{}',repeat('a',64),'qc-example-v1','[]');insert into bud_platform.live_event_debits(event_id,host_id) values('${event}','${host}');set role service_role;`);
 const submit=(actor:string,rating:number,consent:boolean)=>value('select public.bud_review_submit($1,$2,$3,$4,$5,$6) v',[actor,event,rating,'تجربة جميلة','اسم اختاره المستخدم',consent]);
 await assert.rejects(submit(other,5,true),/BUD_RESOURCE_NOT_FOUND/);
 const review=await submit(host,4,false);assert.equal(review.received,true);assert.deepEqual(await submit(host,4,false),review);
 await assert.rejects(submit(host,5,false),/BUD_KEY_REUSED/);
 assert.deepEqual(await value('select public.bud_reviews_public() v'),[]);
 const moderate=(status:string,n:number)=>value('select public.bud_review_moderate($1,$2,$3,$4,$5,$6) v',[other,discord,op(n),review.id,status,'مراجعة التقييم']);
 await assert.rejects(moderate('published',1),/BUD_INVALID_REQUEST/);
 assert.equal((await moderate('hidden',2)).status,'hidden');assert.equal((await moderate('hidden',2)).replayed,true);
 await assert.rejects(value('select public.bud_review_moderate($1,$2,$3,$4,$5,$6) v',[host,discord,op(3),review.id,'hidden','رفض الوصول']),/BUD_OWNER_REQUIRED/);
 // Simulate a separately consenting review record, never production content.
 await db.exec(`reset role;update bud_platform.event_reviews set publish_consent=true;set role service_role;`);
 await moderate('published',4);const published=await value('select public.bud_reviews_public() v');assert.equal(published.length,1);assert.equal(published[0].rating,4);assert.doesNotMatch(JSON.stringify(published),/host_id|event_id|publish_consent/);
 await moderate('hidden',5);assert.deepEqual(await value('select public.bud_reviews_public() v'),[]);
 const promo={id:'promo_fixture123',code:'bud10',baseAmountMinor:2000,discountMinor:200,percent:10};
 const create=(promotion:object)=>value('select public.bud_live_create_promo_order($1,$2,$3,$4,$5,$6,$7,$8,$9) v',[host,'promo-fixture-123456','biz_fixture123','prod_fixture123','plan_fixture123','sar',1800,'ar',promotion]);
 const order=await create(promo);assert.equal(order.amountMinor,1800);assert.deepEqual(order.promotion,promo);assert.equal((await create(promo)).orderId,order.orderId);
 await assert.rejects(create({...promo,id:'promo_other123'}),/BUD_KEY_REUSED/);
 const req={code:'bud10',percent:10,reason:'إنشاء خصم'};
 const reserve=(request:object,result:object|null)=>value('select public.bud_owner_promo_operation($1,$2,$3,$4,$5,$6) v',[other,discord,op(10),'promoCreate',request,result]);
 assert.equal((await reserve(req,null)).prepared,true);await assert.rejects(reserve({...req,percent:20},null),/BUD_KEY_REUSED/);
 assert.equal((await reserve(req,{id:promo.id})).replayed,false);assert.equal((await reserve(req,null)).replayed,true);
 for(const role of ['anon','authenticated']){
  assert.equal(await value(`select has_table_privilege('${role}','bud_platform.event_reviews','select') v`),false);
  assert.equal(await value(`select has_function_privilege('${role}','public.bud_reviews_public()','execute') v`),false);
 }
 assert.equal(await value('select count(*)::int v from bud_platform.live_credit_ledger'),0);
 }finally{await db.close();}
});
