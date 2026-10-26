import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {initialManualState,manualGameReducer} from '../src/manual-game.ts';
import {beginQuestionCondition} from '../src/question-condition-activity.ts';
test('local lifecycle RPCs preserve single debit, pin public content and cannot restore adopted progress',async()=>{
 const db=new PGlite();const host='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
 const value=async(sql:string,args:unknown[]=[])=> (await db.query<{v:any}>(sql,args)).rows[0].v;
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,created_at timestamptz default now());create table auth.identities(user_id uuid,provider text,identity_data jsonb);insert into auth.users(id) values('${host}'),('${other}');`);
 for(const name of ['20261022215208_host_persistence_foundation.sql','20261023173930_production_commerce_foundation.sql','20261023193330_live_payment_queue_and_event_consumption.sql','20261023202259_live_payment_operations_and_receipts.sql','20261025093000_question_condition_activity_draw.sql','20261025093001_question_condition_live_draw.sql','20261026042029_owner_panel_and_bonus_ledger.sql','20261026064517_local_event_runtime.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
 await db.exec(`update bud_platform.live_commerce_control set host_enabled=true;update bud_platform.products set status='published';update bud_platform.content_versions set status='published',eligible_pairs='[["0","0"],["1","1"]]',questions=jsonb_set(questions,'{0,private_answer}','"PRIVATE_SENTINEL"');insert into bud_platform.bonus_ledger(host_id,source,actor,operation_id,qty,reason) values('${host}','admin_grant','${other}',gen_random_uuid(),2,'local fixture');insert into bud_platform.live_wallets(host_id,credits) values('${host}',2);set role service_role;`);
 const cfg={duration:5,timerEnabled:false,attempts:1 as const};const state={...manualGameReducer(initialManualState(),{type:'start',config:cfg,prizeText:''}),activityDraw:beginQuestionCondition([['0','0'],['1','1']]).activity};
 const args=[host,'local-start-fixture-123','Local',cfg,'',state,'a'.repeat(64),'qc-example-v1'];const query='select public.bud_live_host_start_draw($1,$2,$3,$4,$5,$6,$7,$8) v';const run=await value(query,args);assert.equal((await value(query,args)).eventId,run.eventId);assert.equal((await value('select public.bud_live_balance($1) v',[host])).credits,1);
 const content='select public.bud_live_host_local_content($1,$2) v';const pkg=await value(content,[host,run.eventId]);assert.equal(pkg.ownerId,host);assert.equal(pkg.legacy.eventId,run.eventId);assert.deepEqual(pkg.content.pairs,[['0','0'],['1','1']]);assert.doesNotMatch(JSON.stringify(pkg.content),/PRIVATE_SENTINEL|private_answer/);
 await assert.rejects(value(content,[other,run.eventId]),/BUD_EVENT_NOT_FOUND/);
 await value('select public.bud_live_host_local_adopt($1,$2) v',[host,run.eventId]);assert.equal((await value(content,[host,run.eventId])).legacy,null);
 await assert.rejects(value('select public.bud_live_host_local_finish($1,$2) v',[other,run.eventId]),/BUD_EVENT_NOT_FOUND/);
 await db.exec(`reset role;insert into bud_platform.user_restrictions values('${host}',true,'test','${other}',now());set role service_role;`);await assert.rejects(value(content,[host,run.eventId]),/BUD_ACCOUNT_RESTRICTED/);
 const close='select public.bud_live_host_local_finish($1,$2) v';assert.equal((await value(close,[host,run.eventId])).closed,true);assert.equal((await value(close,[host,run.eventId])).closed,true);assert.equal((await value('select public.bud_live_balance($1) v',[host])).credits,1);await assert.rejects(value(content,[host,run.eventId]),/BUD_EVENT_CLOSED/);
 for(const role of ['anon','authenticated'])for(const name of ['content','adopt','finish'])assert.equal(await value(`select has_function_privilege('${role}','public.bud_live_host_local_${name}(uuid,uuid)','execute') v`),false);
 }finally{await db.close();}
});
