import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Optional local PostgreSQL WASM runner; never runs against a remote database.
// BUD_TEST_PGLITE_MODULE points at an exact, separately installed test dependency.
const modulePath = process.env.BUD_TEST_PGLITE_MODULE ?? '@electric-sql/pglite';
test('actual additive SQL: privilege boundaries, purchase replay, event replay and resume', async () => {
  const { PGlite } = await import(modulePath!);
  const db = new PGlite();
  const host = '132ccbd6-7581-41ac-a5f5-dc301334b7ba';
  const other = '332ccbd6-7581-41ac-a5f5-dc301334b7ba';
  const order = '232ccbd6-7581-41ac-a5f5-dc301334b7ba';
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      insert into auth.users values('${host}'),('${other}');`);
    await db.exec(await readFile(new URL('../supabase/migrations/20261022084336_bud_manual_commerce_contract.sql', import.meta.url), 'utf8'));
    const q = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows;
    const value = async (sql: string, params: unknown[] = []) => (await q(sql, params))[0].result;
    const privileges = await q(`select has_schema_privilege('anon','bud_platform','USAGE') as anon_schema,
      has_function_privilege('authenticated','public.bud_start_event(uuid,text,text)','EXECUTE') as user_start,
      has_function_privilege('service_role','public.bud_start_event(uuid,text,text)','EXECUTE') as server_start,
      has_table_privilege('service_role','bud_platform.credit_ledger','UPDATE') as ledger_update`);
    assert.deepEqual(privileges[0], { anon_schema: false, user_start: false, server_start: true, ledger_update: false });
    await db.query(`insert into bud_platform.checkout_orders(id,host_id,company_id,product_id,environment,currency,amount_minor)
      values($1,$2,'company-test','slot-test','sandbox','SAR',100)`, [order,host]);
    await db.exec('set role service_role');
    const credit = `select public.bud_credit_verified_purchase($1,'sandbox','company-test','slot-test','SAR',$2,$3,$4) as result`;
    await assert.rejects(value(credit,[order,99,'pay-test','msg-wrong']), /BUD_PAYMENT_MISMATCH/);
    assert.deepEqual(await value(credit,[order,100,'pay-test','msg-first']), { credited: true, replayed: false });
    assert.deepEqual(await value(credit,[order,100,'pay-test','msg-retry']), { credited: false, replayed: true });
    const duplicateOrder = '432ccbd6-7581-41ac-a5f5-dc301334b7ba';
    await db.query(`insert into bud_platform.checkout_orders(id,host_id,company_id,product_id,environment,currency,amount_minor)
      values($1,$2,'company-test','slot-test','sandbox','SAR',100)`, [duplicateOrder,host]);
    await assert.rejects(value(credit,[duplicateOrder,100,'pay-test','msg-duplicate-order']), /unique constraint/);
    await assert.rejects(db.query(`insert into bud_platform.checkout_orders(host_id,company_id,product_id,environment,currency,amount_minor)
      values($1,'company-test','slot-test','production','SAR',100)`,[host]), /check constraint/);
    assert.deepEqual(await value('select public.bud_slot_balance($1) as result',[host]), { credits: 1 });
    const start = `select public.bud_start_event($1,$2,$3) as result`;
    const first = await value(start,[host,'start-key-1234567890','Game']);
    assert.equal(first.replayed,false);
    assert.deepEqual(await value(start,[host,'start-key-1234567890','Game']), { ...first, replayed: true });
    await assert.rejects(value(start,[host,'start-key-1234567890','Changed']), /BUD_KEY_REUSED/);
    await assert.rejects(value(start,[host,'different-start-key-123','Game']), /BUD_ACTIVE_EVENT/);
    const before = await q('select delta,kind from bud_platform.credit_ledger order by id');
    assert.deepEqual(before,[{delta:1,kind:'purchase'},{delta:-1,kind:'event_start'}]);
    await value('select public.bud_resume_event($1,$2) as result',[host,first.eventId]);
    assert.deepEqual(await q('select delta,kind from bud_platform.credit_ledger order by id'),before);
    await assert.rejects(value('select public.bud_resume_event($1,$2) as result',[other,first.eventId]), /BUD_EVENT_NOT_FOUND/);
    assert.deepEqual(await value('select public.bud_slot_balance($1) as result',[host]), {credits:0});
    await assert.rejects(value(start,[other,'other-host-key-123456','No credit']), /BUD_NO_CREDIT/);
  } finally { await db.close(); }
});
