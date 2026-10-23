import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { initialManualState, manualGameReducer } from '../src/manual-game.ts';

test('host SQL: draft gate, isolated ownership, atomic starts, CAS/replay and persistent results', async () => {
  const db = new PGlite();
  const host = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
  const fingerprint = 'a'.repeat(64), changed = 'b'.repeat(64);
  const config = { duration: 5, timerEnabled: true, attempts: 2 as const };
  const state = manualGameReducer(initialManualState(), { type: 'start', config, prizeText: 'Gift\nGift' });
  const value = async (sql: string, params: unknown[] = []) => (await db.query<{result:any}>(sql,params)).rows[0].result;
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); insert into auth.users values('${host}'),('${other}');`);
    await db.exec(await readFile(new URL('../supabase/migrations/20261022215208_host_persistence_foundation.sql', import.meta.url),'utf8'));
    await db.query('insert into bud_platform.wallets(host_id,credits) values($1,2),($2,1)',[host,other]);
    const start = 'select public.bud_host_start($1,$2,$3,$4,$5,$6,$7) as result';
    const params = [host,'start-request-key-12345','Event',config,'Gift\nGift',state,fingerprint];
    await db.exec('set role service_role');
    await assert.rejects(value(start,params),/BUD_PRODUCT_UNAVAILABLE/);
    assert.equal((await value('select public.bud_slot_balance($1) as result',[host])).credits,2);
    await db.exec("reset role; update bud_platform.content_versions set status='published'; update bud_platform.products set status='published'; set role service_role;");
    const first = await value(start,params);
    assert.equal(first.version,1); assert.deepEqual(first.state,state); assert.ok(first.cards.question); assert.ok(first.cardsEn.question);
    const replay = await value(start,params); assert.equal(replay.eventId,first.eventId);
    await assert.rejects(value(start,[...params.slice(0,6),changed]),/BUD_KEY_REUSED/);
    await assert.rejects(value(start,[host,'start-another-key-12345','Event',config,'Gift\nGift',state,changed]),/BUD_ACTIVE_EVENT/);
    assert.equal((await value('select public.bud_slot_balance($1) as result',[host])).credits,1);
    const expiring = await value(start,[other,'expiry-start-key-12345','Four hours',config,'Gift\nGift',state,fingerprint]);
    await db.exec('reset role');
    await db.query("update bud_platform.events set started_at=now()-interval '4 hours 1 second' where id=$1",[expiring.eventId]);
    await db.exec('set role service_role');
    const expired = await value('select public.bud_host_resume($1,$2) as result',[other,expiring.eventId]);
    assert.equal(expired.phase,'completed'); assert.equal(expired.state.phase,'closing'); assert.equal(expired.state.deadline,null);
    assert.equal((await value('select public.bud_slot_balance($1) as result',[other])).credits,0);
    await assert.rejects(value('select public.bud_host_resume($1,$2) as result',[other,first.eventId]),/BUD_EVENT_NOT_FOUND/);
    const otherEvents = (await value('select public.bud_host_dashboard($1) as result',[other])).events;
    assert.equal(otherEvents.length,1); assert.equal(otherEvents[0].eventId,expiring.eventId);
    const update = 'select public.bud_host_update($1,$2,$3,$4,$5,$6,$7) as result';
    const next = manualGameReducer(state,{type:'add-winner',name:'Same'});
    const second = await value(update,[host,first.eventId,1,'action-request-key-123',next,'add-winner',fingerprint]);
    assert.equal(second.version,2); assert.equal(second.state.winners[0].name,'Same');
    assert.deepEqual(await value(update,[host,first.eventId,1,'action-request-key-123',next,'add-winner',fingerprint]),second);
    await assert.rejects(value(update,[host,first.eventId,1,'another-action-key-123',next,'add-winner',changed]),/BUD_VERSION_CONFLICT/);
    await assert.rejects(value('select public.bud_host_receipt($1,$2,$3,$4) as result',[host,first.eventId,'action-request-key-123',changed]),/BUD_KEY_REUSED/);
    const duplicate = manualGameReducer(next,{type:'add-winner',name:'Same'});
    const third = await value(update,[host,first.eventId,2,'duplicate-name-key-123',duplicate,'add-winner',changed]);
    assert.equal(third.state.winners.length,2); assert.notEqual(third.state.winners[0].id,third.state.winners[1].id);
    let ending = manualGameReducer(duplicate,{type:'phase',phase:'prizes'});
    ending = manualGameReducer(ending,{type:'open-prize',prizeId:'prize-1'});
    ending = manualGameReducer(ending,{type:'phase',phase:'closing'});
    const closed = await value(update,[host,first.eventId,3,'closing-action-key-123',ending,'phase','c'.repeat(64)]);
    assert.equal(closed.phase,'completed'); assert.equal(closed.state.prizes[0].revealed,true);
    await assert.rejects(value(update,[host,first.eventId,4,'closed-action-key-123',ending,'phase','d'.repeat(64)]),/BUD_EVENT_CLOSED/);
    assert.equal((await value('select public.bud_slot_balance($1) as result',[host])).credits,1);
    const privileges = (await db.query(`select has_schema_privilege('anon','bud_platform','usage') a, has_function_privilege('authenticated','public.bud_host_dashboard(uuid)','execute') b,has_table_privilege('service_role','bud_platform.action_receipts','update') c`)).rows[0];
    assert.deepEqual(privileges,{a:false,b:false,c:false});
    await db.exec("reset role");
    await assert.rejects(db.exec("update bud_platform.content_versions set questions='[]'"),/BUD_IMMUTABLE_CONTENT/);
    // Separate isolated restore from a logical event backup, never a remote PITR claim.
    const backup = await value('select public.bud_host_resume($1,$2) as result',[host,first.eventId]);
    const dump = await db.dumpDataDir();
    const restored = new PGlite({loadDataDir:dump});
    try {
      const snapshot = (await restored.query<{result:any}>('select public.bud_host_resume($1,$2) as result',[host,first.eventId])).rows[0].result;
      assert.deepEqual(snapshot.state,backup.state); assert.equal(snapshot.version,backup.version);
      const ledger = (await restored.query('select count(*)::int as count from bud_platform.credit_ledger')).rows[0];
      assert.equal(ledger.count,2);
      assert.deepEqual(backup.state,closed.state);
    } finally { await restored.close(); }
  } finally { await db.close(); }
});
