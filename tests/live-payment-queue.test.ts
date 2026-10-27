import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('live queue SQL fences expired workers, retains retries/review and denies public access', async () => {
  const db = new PGlite();
  const call = async (name: string, args: unknown[] = []) => (await db.query<{ result: any }>(
    `select public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) as result`, args)).rows[0].result;
  const host = '11111111-1111-4111-8111-111111111111';
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${host}');`);
    for (const name of ['20261022215208_host_persistence_foundation.sql', '20261023173930_production_commerce_foundation.sql', '20261023193330_live_payment_queue_and_event_consumption.sql','20261027094000_payment_permanent_review.sql'])
      await db.exec(await readFile(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8'));
    await db.exec('set role service_role');
    // Intake survives a pause; it does not grant money/credit or bypass fulfillment control.
    assert.deepEqual(await call('bud_live_enqueue_payment', ['msg_queue123', 'pay_queue123']), { queued: true });
    assert.deepEqual(await call('bud_live_enqueue_payment', ['msg_queue123', 'pay_queue123']), { queued: true });
    await assert.rejects(call('bud_live_enqueue_payment', ['msg_queue123', 'pay_other123']), /BUD_LIVE_MESSAGE_REUSED/);
    await assert.rejects(call('bud_live_claim_payments', [1]), /BUD_LIVE_FULFILLMENT_DISABLED/);
    await assert.rejects(db.exec('update bud_platform.live_commerce_control set fulfillment_enabled=true'), /permission denied/);
    await db.exec('reset role;update bud_platform.live_commerce_control set fulfillment_enabled=true;set role service_role');
    await assert.rejects(call('bud_live_claim_payments', [6]), /BUD_INVALID_LIVE_BATCH/);
    const first = (await call('bud_live_claim_payments', [1]))[0]; assert.equal(first.messageId, 'msg_queue123');
    assert.deepEqual(await call('bud_live_claim_payments', [1]), []);
    await assert.rejects(call('bud_live_retry_payment', [first.messageId, first.leaseToken, 'raw-secret-error']), /BUD_INVALID_LIVE_RETRY/);
    await assert.rejects(call('bud_live_retry_payment', [first.messageId, host, 'PROVIDER_RETRY']), /BUD_LIVE_LEASE_LOST/);
    await db.exec("reset role;update bud_platform.live_payment_jobs set lease_until=clock_timestamp()-interval '1 second';set role service_role");
    await assert.rejects(call('bud_live_retry_payment', [first.messageId, first.leaseToken, 'PROVIDER_RETRY']), /BUD_LIVE_LEASE_LOST/);
    const reclaimed = (await call('bud_live_claim_payments', [1]))[0]; assert.notEqual(reclaimed.leaseToken, first.leaseToken);
    await assert.rejects(call('bud_live_finish_payment', [first.messageId, first.leaseToken, host, 'biz_queue123', 'prod_queue123', 'plan_queue123', 'sar', 200, 'ch_queue123', 'pay_queue123']), /BUD_LIVE_LEASE_LOST/);
    assert.deepEqual(await call('bud_live_retry_payment', [reclaimed.messageId, reclaimed.leaseToken, 'PROVIDER_RETRY']), { recorded: true });
    assert.deepEqual(await call('bud_live_claim_payments', [1]), []);
    // Duplicate provider delivery must not reset retry count/backoff or create more work.
    await call('bud_live_enqueue_payment', ['msg_queue123', 'pay_queue123']);
    assert.deepEqual(await call('bud_live_claim_payments', [1]), []);
    await db.exec("reset role;update bud_platform.live_payment_jobs set attempts=11,available_at=clock_timestamp()-interval '1 second';set role service_role");
    const last = (await call('bud_live_claim_payments', [1]))[0];
    await call('bud_live_retry_payment', [last.messageId, last.leaseToken, 'PAYMENT_RETRY']);
    let status = await call('bud_live_queue_status'); assert.equal(status.review, 1); assert.equal(status.pending, 0);
    await call('bud_live_enqueue_payment', ['msg_queue123', 'pay_queue123']);
    assert.deepEqual(await call('bud_live_claim_payments', [1]), []);
    await call('bud_live_enqueue_payment', ['msg_crashed123', 'pay_crashed123']);
    await db.exec("reset role;update bud_platform.live_payment_jobs set attempts=11 where message_id='msg_crashed123';set role service_role");
    await call('bud_live_claim_payments', [1]);
    await db.exec("reset role;update bud_platform.live_payment_jobs set lease_until=clock_timestamp()-interval '1 second' where status='processing';set role service_role");
    assert.deepEqual(await call('bud_live_claim_payments', [1]), []);
    status = await call('bud_live_queue_status'); assert.equal(status.review, 2); assert.equal(status.processing, 0);
    await call('bud_live_enqueue_payment', ['msg_terminal123', 'pay_terminal123']);
    const terminal = (await call('bud_live_claim_payments', [1]))[0];
    assert.ok(terminal);
    await call('bud_live_retry_payment', [terminal.messageId, terminal.leaseToken, 'PAYMENT_REVIEW']);
    status = await call('bud_live_queue_status');
    assert.equal(status.review, 3);
    assert.equal(status.pending, 0);
    await call('bud_live_enqueue_payment', ['msg_terminal123', 'pay_terminal123']);
    assert.deepEqual(await call('bud_live_claim_payments', [1]), []);
    await assert.rejects(call('bud_live_retry_payment', [terminal.messageId, terminal.leaseToken, 'PAYMENT_REVIEW']), /BUD_LIVE_LEASE_LOST/);
    assert.equal((await call('bud_live_balance', [host])).credits, 0);
    assert.equal((await db.query<{ n: number }>('select count(*)::int n from bud_platform.live_credit_ledger')).rows[0].n, 0);
    for (const role of ['anon', 'authenticated']) {
      await db.exec('reset role;set role ' + role);
      await assert.rejects(call('bud_live_enqueue_payment', ['msg_public123', 'pay_public123']), /permission denied/);
      await assert.rejects(call('bud_live_queue_status'), /permission denied/);
      await assert.rejects(call('bud_live_host_dashboard', [host]), /permission denied/);
      await assert.rejects(db.exec('select * from bud_platform.live_payment_jobs'), /permission denied/);
    }
    await db.exec('reset role');
    const tables = await db.query<{ name: string; rls: boolean; publicRead: boolean; userRead: boolean }>(
      `select c.relname name,c.relrowsecurity rls,has_table_privilege('anon',c.oid,'SELECT') "publicRead",has_table_privilege('authenticated',c.oid,'SELECT') "userRead"
       from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='bud_platform' and c.relname in ('live_payment_jobs','live_events','live_event_debits','live_action_receipts')`);
    assert.equal(tables.rows.length, 4);
    for (const row of tables.rows) { assert.equal(row.rls, true); assert.equal(row.publicRead, false); assert.equal(row.userRead, false); }
    const audit = (await db.query(`select has_table_privilege('service_role','bud_platform.live_event_debits','UPDATE') a,
      has_table_privilege('service_role','bud_platform.live_action_receipts','DELETE') b,has_table_privilege('service_role','bud_platform.live_commerce_control','UPDATE') c`)).rows[0];
    assert.deepEqual(audit, { a: false, b: false, c: false });
  } finally { await db.close(); }
});
