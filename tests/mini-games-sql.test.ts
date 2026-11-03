import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {initialManualState,manualGameReducer} from '../src/manual-game.ts';
import {beginQuestionCondition} from '../src/question-condition-activity.ts';

const host='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const migrations=[
 '20261022215208_host_persistence_foundation.sql',
 '20261023173930_production_commerce_foundation.sql',
 '20261023193330_live_payment_queue_and_event_consumption.sql',
 '20261023202259_live_payment_operations_and_receipts.sql',
 '20261025093000_question_condition_activity_draw.sql',
 '20261025093001_question_condition_live_draw.sql',
 '20261026042029_owner_panel_and_bonus_ledger.sql',
 '20261026064517_local_event_runtime.sql',
 '20261103233000_mini_games_event_contract.sql',
];

test('Mini Games shares the existing wallet and debits exactly once, without revealing gameplay or modifying Question & Condition',async()=>{
 const db=new PGlite();
 const value=async(sql:string,args:unknown[]=[])=> (await db.query<{v:any}>(sql,args)).rows[0].v;
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
   create schema auth;create table auth.users(id uuid primary key,created_at timestamptz default now());
   create table auth.identities(user_id uuid,provider text,identity_data jsonb);
   insert into auth.users(id) values('${host}'),('${other}');`);
  for(const file of migrations)await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  await db.exec(`update bud_platform.live_commerce_control set host_enabled=true;
   update bud_platform.products set status='published';
   update bud_platform.content_versions set status='published',eligible_pairs='[["0","0"],["1","1"]]';
   insert into bud_platform.live_wallets(host_id,credits) values('${host}',2);
   set role service_role;`);
  const start='select public.bud_live_host_mini_start($1,$2,$3,$4) v';
  const receipt=await value(start,[host,'mini-start-unique-123','ميني قيمز','a'.repeat(64)]);
  assert.equal(receipt.kind,'mini-games');
  assert.equal(receipt.storage,'browser-v2');
  assert.equal(receipt.phase,'live');
  assert.equal((await value(start,[host,'mini-start-unique-123','ميني قيمز','a'.repeat(64)])).eventId,receipt.eventId);
  assert.equal((await value('select public.bud_live_balance($1) v',[host])).credits,1);
  assert.equal(await value('select count(*)::int v from bud_platform.live_event_debits where host_id=$1',[host]),1);
  assert.equal(await value('select event_kind v from bud_platform.live_events where id=$1',[receipt.eventId]),'mini-games');
  assert.equal(await value('select content_version is null v from bud_platform.live_events where id=$1',[receipt.eventId]),true);
  await assert.rejects(value(start,[host,'mini-start-unique-123','ميني قيمز','b'.repeat(64)]),/BUD_KEY_REUSED/);
  await assert.rejects(value(start,[host,'mini-start-unique-456','ميني قيمز','a'.repeat(64)]),/BUD_ACTIVE_EVENT/);
  const content=await value('select public.bud_live_host_mini_content($1,$2) v',[host,receipt.eventId]);
  assert.equal(content.ownerId,host);
  assert.equal(content.kind,'mini-games');
  assert.ok(Number.isFinite(Date.parse(content.expiresAt)));
  assert.doesNotMatch(JSON.stringify(content),/questions|conditions|winners|prizes|activityDraw/i);
  await assert.rejects(value('select public.bud_live_host_mini_content($1,$2) v',[other,receipt.eventId]),/BUD_EVENT_NOT_FOUND/);
  await assert.rejects(value('select public.bud_live_host_mini_finish($1,$2) v',[other,receipt.eventId]),/BUD_EVENT_NOT_FOUND/);
  assert.equal((await value('select public.bud_live_host_mini_finish($1,$2) v',[host,receipt.eventId])).closed,true);
  assert.equal((await value('select public.bud_live_host_mini_finish($1,$2) v',[host,receipt.eventId])).closed,true);
  assert.equal((await value('select public.bud_live_balance($1) v',[host])).credits,1);
  await assert.rejects(value('select public.bud_live_host_mini_content($1,$2) v',[host,receipt.eventId]),/BUD_EVENT_CLOSED/);

  // Existing Question & Condition uses the same wallet and a distinct schema-1 catalog.
  const cfg={duration:5,timerEnabled:false,attempts:1 as const};
  const state={...manualGameReducer(initialManualState(),{type:'start',config:cfg,prizeText:''}),activityDraw:beginQuestionCondition([['0','0'],['1','1']]).activity};
  const qc=await value('select public.bud_live_host_start_draw($1,$2,$3,$4,$5,$6,$7,$8) v',
   [host,'qc-after-mini-unique-123','سؤال وشرط',cfg,'',state,'c'.repeat(64),'qc-example-v1']);
  assert.equal(qc.phase,'live');
  assert.equal((await value('select public.bud_live_balance($1) v',[host])).credits,0);
  assert.equal(await value('select count(*)::int v from bud_platform.live_event_debits where host_id=$1',[host]),2);
  assert.equal(await value('select event_kind v from bud_platform.live_events where id=$1',[qc.eventId]),'question-condition');
  const cards=qc.cards;
  assert.ok(typeof cards?.question==='string');
  assert.ok(typeof cards?.condition==='string');
  await assert.rejects(value(start,[host,'mini-out-of-credit-123','ميني قيمز','d'.repeat(64)]),/BUD_ACTIVE_EVENT/);
  const balances=await value('select count(*)::int v from bud_platform.live_wallets where credits<0');
  assert.equal(balances,0);
  for(const role of ['anon','authenticated'])for(const name of ['start','content','finish']){
   const signature=name==='start'?'uuid,text,text,text':'uuid,uuid';
   assert.equal(await value(`select has_function_privilege('${role}','public.bud_live_host_mini_${name}(${signature})','execute') v`),false);
  }
 }finally{await db.close();}
});
