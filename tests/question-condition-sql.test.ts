import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { initialManualState, manualGameReducer } from '../src/manual-game.ts';
import { beginQuestionCondition, onQuestionConditionRound } from '../server/question-condition-activity.ts';
import type { PairId } from '../src/draw-engine.ts';

test('SQL activity integration pins compatible pairs and resumes the exact server-selected cards', async () => {
  const db = new PGlite();
  const host = '11111111-1111-4111-8111-111111111111';
  const other = '22222222-2222-4222-8222-222222222222';
  const eligible: PairId[] = [['0','1'], ['1','0'], ['2','2']];
  const cfg = { duration: 5, timerEnabled: false, attempts: 1 as const };
  const fingerprint = 'a'.repeat(64);
  const value = async (sql: string, params: unknown[] = []) =>
    (await db.query<{ result: any }>(sql, params)).rows[0].result;
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      insert into auth.users values('${host}'),('${other}');`);
    await db.exec(await readFile(new URL('../supabase/migrations/20261022215208_host_persistence_foundation.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/20261025093000_question_condition_activity_draw.sql', import.meta.url), 'utf8'));
    await db.query('insert into bud_platform.wallets(host_id,credits) values($1,2)', [host]);
    await db.query("update bud_platform.content_versions set eligible_pairs=$1::jsonb, status='published'", [JSON.stringify(eligible)]);
    await db.exec("update bud_platform.products set status='published'");
    await db.exec("set role service_role");
    const catalog = await value('select public.bud_host_draw_catalog($1,$2) as result', [host,null]);
    assert.equal(catalog.version, 'qc-example-v1');
    assert.deepEqual(catalog.pairs, eligible);
    assert.equal(catalog.questionCount,3);
    assert.equal(catalog.conditionCount,3);
    const activity = beginQuestionCondition(eligible, () => 0);
    const state = { ...manualGameReducer(initialManualState(), {type:'start',config:cfg,prizeText:'Prize'}), activityDraw:activity.activity };
    const args = [host,'start-event-draw-key-123','QA event',cfg,'Prize',state,fingerprint,catalog.version];
    const start = 'select public.bud_host_start_draw($1,$2,$3,$4,$5,$6,$7,$8) as result';
    const begun = await value(start,args);
    assert.deepEqual(begun.state.activityDraw,state.activityDraw);
    assert.equal(begun.cards.question,'دولة');
    assert.equal(begun.cards.condition,'تحتوي على حرف م');
    const replay = await value(start,args);
    assert.equal(replay.eventId,begun.eventId);
    assert.deepEqual(replay.cards,begun.cards);
    assert.equal((await value('select public.bud_slot_balance($1) as result',[host])).credits,1);
    const fromOther = value('select public.bud_host_draw_catalog($1,$2) as result',[other,begun.eventId]);
    await assert.rejects(fromOther,/BUD_CONTENT_NOT_READY/);
    const qRevealed = manualGameReducer(state,{type:'reveal',card:'question',now:1});
    const both = manualGameReducer(qRevealed,{type:'reveal',card:'condition',now:1});
    const roundOne = manualGameReducer(both,{type:'wrong'});
    const nextActivity = onQuestionConditionRound(state.activityDraw,roundOne.round,eligible,()=>0).activity;
    const updated = { ...roundOne,activityDraw:nextActivity };
    const update = await value('select public.bud_host_update($1,$2,$3,$4,$5,$6,$7) as result',
      [host,begun.eventId,1,'updated-event-key-12345',updated,'wrong','b'.repeat(64)]);
    assert.equal(update.version,2);
    assert.equal(update.state.round,1);
    assert.deepEqual(update.state.activityDraw.draw.history.length,2);
    assert.equal(update.cards.question,'تطبيق جوال');
    assert.equal(update.cards.condition,'تبدأ بحرف س');
    const resume = await value('select public.bud_host_resume($1,$2) as result',[host,begun.eventId]);
    assert.deepEqual(resume.cards,update.cards);
    assert.equal(resume.state.activityDraw.draw.history.length,2);
    assert.equal((await value('select public.bud_slot_balance($1) as result',[host])).credits,1);
    const perms = (await db.query("select has_function_privilege('authenticated','public.bud_host_draw_catalog(uuid,uuid)','execute') as a, has_function_privilege('anon','public.bud_host_start_draw(uuid,text,text,jsonb,text,jsonb,text,text)','execute') as b")).rows[0];
    assert.deepEqual(perms,{a:false,b:false});
  } finally { await db.close(); }
});
