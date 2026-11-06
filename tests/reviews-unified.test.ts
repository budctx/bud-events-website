import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const host='11111111-1111-4111-8111-111111111111',owner='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333';
const discord='123456789012345678',op=(i:number)=>'44444444-4444-4444-8444-'+String(i).padStart(12,'0');
test('unified reviews require stars, preserve explicit consent, stay account-unique and protect private rows',async()=>{
 const db=new PGlite();
 const value=async(sql:string,args:unknown[]=[]) =>(await db.query<{v:any}>(sql,args)).rows[0]?.v;
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,created_at timestamptz default now());create table auth.identities(user_id uuid,provider text,identity_data jsonb);insert into auth.users(id) values('${host}'),('${owner}'),('${other}');`);
  for(const file of ['20261022215208_host_persistence_foundation.sql','20261023173930_production_commerce_foundation.sql','20261023193330_live_payment_queue_and_event_consumption.sql','20261023202259_live_payment_operations_and_receipts.sql','20261026042029_owner_panel_and_bonus_ledger.sql','20261030141500_event_reviews.sql','20261101141500_text_only_discord_reviews.sql','20261102133000_immediate_public_reviews.sql','20261102191000_review_permanent_delete.sql','20261106190000_rated_review_consent.sql'])
   await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  await db.exec(`insert into bud_platform.platform_owners values('${owner}','${discord}');set role service_role;`);
  const avatar='https://cdn.discordapp.com/embed/avatars/2.png';
  const submit=(actor:string,body:string,rating=5,consent=true)=>value('select public.bud_review_submit_rated($1,$2,$3,$4,$5,$6) v',[actor,rating,body,'حساب Discord',avatar,consent]);
  await assert.rejects(submit(host,'لا'),/BUD_INVALID_REQUEST/);
  await assert.rejects(submit(host,'تجربة ممتازة',0),/BUD_INVALID_REQUEST/);
  const privateReview=await submit(host,'تجربة ممتازة',4,false);
  assert.equal(privateReview.status,'pending');
  assert.deepEqual((await value('select public.bud_reviews_latest_text(0,12) v')).items,[]);
  assert.equal((await value('select public.bud_review_mine($1) v',[host])).publishConsent,false);
  const first=await submit(host,'تجربة ممتازة',4,true);
  assert.equal(first.id,privateReview.id);
  assert.equal(first.received,true);assert.equal(first.status,'published');
  const latest=await value('select public.bud_reviews_latest_text(0,12) v');
  assert.equal(latest.items[0].id,first.id);
  assert.equal(latest.hasMore,false);
  assert.equal(latest.items[0].rating,4);
  assert.equal((await submit(host,'تجربة ممتازة',4,true)).id,first.id);
  assert.equal((await value('select public.bud_review_mine($1) v',[host])).comment,'تجربة ممتازة');
  assert.equal((await value('select public.bud_review_mine($1) v',[other])).comment,undefined);
  const rank=(actor:string,n:number,position:number|null)=>value('select public.bud_review_feature($1,$2,$3,$4,$5,$6) v',[actor,discord,op(n),first.id,position,'اختيار الرأي للنشر']);
  await assert.rejects(rank(host,1,1),/BUD_OWNER_REQUIRED/);
  assert.equal((await rank(owner,2,1)).rank,1);
  assert.equal((await rank(owner,2,1)).replayed,true);
  assert.equal((await value('select public.bud_reviews_public_text() v')).length,1);
  const pub=await value('select public.bud_reviews_public_text() v');
  assert.deepEqual(pub[0],{id:first.id,rating:4,name:'حساب Discord',comment:'تجربة ممتازة',avatarUrl:avatar});
  const list=await value('select public.bud_reviews_owner($1,$2,$3) v',[owner,discord,0]);
  assert.equal(list.rows[0].featured_rank,1);
  assert.equal(list.rows[0].avatar_url,avatar);
  assert.equal((await rank(owner,3,null)).rank,null);
  assert.equal((await value('select public.bud_reviews_latest_text(0,12) v')).items[0].id,first.id);
  const changed=await submit(host,'تجربة جديدة بعد التحديث',5,true);
  assert.equal(changed.id,first.id);assert.equal(changed.status,'published');
  assert.deepEqual(await value('select public.bud_reviews_public_text() v'),[]);
  assert.equal((await value('select count(*)::int v from bud_platform.event_reviews')),1);
  assert.equal((await value('select public.bud_reviews_latest_text(0,12) v')).items[0].comment,'تجربة جديدة بعد التحديث');
  assert.equal((await value('select public.bud_review_moderate($1,$2,$3,$4,$5,$6) v',
    [owner,discord,op(4),first.id,'hidden','إخفاء رأي مخالف'])).status,'hidden');
  assert.deepEqual((await value('select public.bud_reviews_latest_text(0,12) v')).items,[]);
  assert.equal((await submit(host,'تجربة جديدة بعد التحديث',5,true)).status,'published');
  assert.equal((await value('select public.bud_reviews_latest_text(0,12) v')).items[0].id,first.id);
  assert.deepEqual((await value('select public.bud_reviews_latest_text(1,12) v')).items,[]);
  assert.equal((await value('select count(*)::int v from bud_platform.owner_audit where kind=\'reviewFeature\'')),2);
  const deleteReview=(actor:string,n:number,id:string=first.id,reason='حذف تقييم مخالف')=>
   value('select public.bud_review_delete($1,$2,$3,$4,$5) v',[actor,discord,op(n),id,reason]);
  await assert.rejects(deleteReview(host,5),/BUD_OWNER_REQUIRED/);
  assert.equal((await deleteReview(owner,6)).deleted,true);
  assert.equal((await deleteReview(owner,6)).replayed,true);
  await assert.rejects(deleteReview(owner,6,first.id,'طلب مختلف'),/BUD_KEY_REUSED/);
  await assert.rejects(deleteReview(owner,7),/BUD_RESOURCE_NOT_FOUND/);
  assert.equal(await value('select count(*)::int v from bud_platform.event_reviews'),0);
  assert.deepEqual((await value('select public.bud_reviews_latest_text(0,12) v')).items,[]);
  assert.deepEqual(await value('select public.bud_reviews_public_text() v'),[]);
  assert.equal((await value('select public.bud_review_mine($1) v',[host])).id,undefined);
  const logged=await value("select outcome->>'deleted' v from bud_platform.owner_audit where kind='reviewDelete'");
  assert.equal(logged,'true');
  const audit=await value("select outcome::text v from bud_platform.owner_audit where kind='reviewDelete'");
  assert.doesNotMatch(audit,/تجربة جديدة|حساب Discord|cdn\.discordapp/);
  const fresh=await submit(host,'تقييم جديد بعد الحذف',3,true);
  assert.notEqual(fresh.id,first.id);
  assert.equal((await value('select public.bud_reviews_latest_text(0,12) v')).items[0].id,fresh.id);
  await db.exec(`reset role;insert into auth.users(id) select md5('review-page-'||i)::uuid from generate_series(1,12) i;set role service_role;
   insert into bud_platform.event_reviews(host_id,rating,comment,display_name,publish_consent,status,updated_at)
   select md5('review-page-'||i)::uuid,5,'رأي صالح رقم '||i,'حساب '||i,true,'published',clock_timestamp()+i*interval '1 second' from generate_series(1,12) i;`);
  const pageOne=await value('select public.bud_reviews_latest_text(0,12) v');
  const pageTwo=await value('select public.bud_reviews_latest_text(12,12) v');
  assert.equal(pageOne.items.length,12);assert.equal(pageOne.hasMore,true);
  assert.equal(pageTwo.items.length,1);assert.equal(pageTwo.hasMore,false);
  assert.equal(new Set([...pageOne.items,...pageTwo.items].map((row:{id:string})=>row.id)).size,13);
  for(const role of ['anon','authenticated']){
   assert.equal(await value(`select has_table_privilege('${role}','bud_platform.event_reviews','select') v`),false);
   assert.equal(await value(`select has_function_privilege('${role}','public.bud_reviews_public_text()','execute') v`),false);
   assert.equal(await value(`select has_function_privilege('${role}','public.bud_reviews_latest_text(integer,integer)','execute') v`),false);
   assert.equal(await value(`select has_function_privilege('${role}','public.bud_review_delete(uuid,text,uuid,uuid,text)','execute') v`),false);
   assert.equal(await value(`select has_function_privilege('${role}','public.bud_review_submit_rated(uuid,integer,text,text,text,boolean)','execute') v`),false);
  }
 }finally{await db.close();}
});
