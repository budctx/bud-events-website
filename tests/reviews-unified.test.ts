import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const host='11111111-1111-4111-8111-111111111111',owner='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333';
const discord='123456789012345678',op=(i:number)=>'44444444-4444-4444-8444-'+String(i).padStart(12,'0');
test('unified reviews are text-only, account-unique, editable, owner-curated and private',async()=>{
 const db=new PGlite();
 const value=async(sql:string,args:unknown[]=[]) =>(await db.query<{v:any}>(sql,args)).rows[0]?.v;
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,created_at timestamptz default now());create table auth.identities(user_id uuid,provider text,identity_data jsonb);insert into auth.users(id) values('${host}'),('${owner}'),('${other}');`);
  for(const file of ['20261022215208_host_persistence_foundation.sql','20261023173930_production_commerce_foundation.sql','20261023193330_live_payment_queue_and_event_consumption.sql','20261023202259_live_payment_operations_and_receipts.sql','20261026042029_owner_panel_and_bonus_ledger.sql','20261030141500_event_reviews.sql','20261101141500_text_only_discord_reviews.sql'])
   await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  await db.exec(`insert into bud_platform.platform_owners values('${owner}','${discord}');set role service_role;`);
  const avatar='https://cdn.discordapp.com/embed/avatars/2.png';
  const submit=(actor:string,body:string)=>value('select public.bud_review_submit_text($1,$2,$3,$4) v',[actor,body,'حساب Discord',avatar]);
  await assert.rejects(submit(host,'لا'),/BUD_INVALID_REQUEST/);
  const first=await submit(host,'تجربة ممتازة');
  assert.equal(first.received,true);assert.equal(first.status,'pending');
  assert.equal((await submit(host,'تجربة ممتازة')).id,first.id);
  assert.equal((await value('select public.bud_review_mine($1) v',[host])).comment,'تجربة ممتازة');
  assert.equal((await value('select public.bud_review_mine($1) v',[other])).comment,undefined);
  const rank=(actor:string,n:number,position:number|null)=>value('select public.bud_review_feature($1,$2,$3,$4,$5,$6) v',[actor,discord,op(n),first.id,position,'اختيار الرأي للنشر']);
  await assert.rejects(rank(host,1,1),/BUD_OWNER_REQUIRED/);
  assert.equal((await rank(owner,2,1)).rank,1);
  assert.equal((await rank(owner,2,1)).replayed,true);
  assert.equal((await value('select public.bud_reviews_public_text() v')).length,1);
  const pub=await value('select public.bud_reviews_public_text() v');
  assert.deepEqual(pub[0],{id:first.id,name:'حساب Discord',comment:'تجربة ممتازة',avatarUrl:avatar});
  const list=await value('select public.bud_reviews_owner($1,$2,$3) v',[owner,discord,0]);
  assert.equal(list.rows[0].featured_rank,1);
  assert.equal(list.rows[0].avatar_url,avatar);
  const changed=await submit(host,'تجربة جديدة بعد التحديث');
  assert.equal(changed.id,first.id);assert.equal(changed.status,'pending');
  assert.deepEqual(await value('select public.bud_reviews_public_text() v'),[]);
  assert.equal((await value('select count(*)::int v from bud_platform.event_reviews')),1);
  assert.equal((await value('select count(*)::int v from bud_platform.owner_audit where kind=\'reviewFeature\'')),1);
  for(const role of ['anon','authenticated']){
   assert.equal(await value(`select has_table_privilege('${role}','bud_platform.event_reviews','select') v`),false);
   assert.equal(await value(`select has_function_privilege('${role}','public.bud_reviews_public_text()','execute') v`),false);
  }
 }finally{await db.close();}
});
