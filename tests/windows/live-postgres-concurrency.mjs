// Optional LOCAL-ONLY multi-connection regression. Never imports backup code or reads production credentials.
// Uses existing portable tools, a disposable loopback-only cluster and fabricated accounts/payments.
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, realpath, rm } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { initialManualState, manualGameReducer } from '../../src/manual-game.ts';

const execute = promisify(execFile);
const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const nativeRoot = process.env.BUD_PG_NATIVE_TEST_ROOT;
if (process.argv[2] !== '--local-only' || !nativeRoot || !/^[\x20-\x7e]+$/.test(nativeRoot)
  || (await realpath(nativeRoot)).toLowerCase() !== (await realpath(root)).toLowerCase()) throw Error('LOCAL_TEST_ROOT_REQUIRED');
const tempRoot = join(nativeRoot, 'supabase', '.temp');
const work = await mkdtemp(join(tempRoot, 'live-concurrency-'));
const bin = join(nativeRoot, 'supabase', '.temp', 'backup-tools', 'runtime', 'pgsql', 'bin');
const toolPath = name => join(bin, name + '.exe');
// Ignore any inherited PostgreSQL environment, even when a developer has a remote connection configured.
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^PG/i.test(name)));
const password = randomBytes(24).toString('hex');
const data = join(work, 'cluster'), pgpass = join(work, 'fixture.pgpass'), pwfile = join(work, 'init-password');
let startRequested = false;
const executeTool = async (name, args, options = {}) => (await execute(toolPath(name), args,
  { env, windowsHide: true, timeout: 45000, maxBuffer: 1024 * 1024, ...options })).stdout.trim();
const ctl = args => new Promise((accept, reject) => {
  const child = spawn(toolPath('pg_ctl'), args, { env, windowsHide: true, stdio: 'ignore' });
  const timeout = setTimeout(() => { child.kill(); reject(Error('LOCAL_PG_CTL_TIMEOUT')); }, 45000);
  child.once('error', error => { clearTimeout(timeout); reject(error); });
  child.once('exit', code => { clearTimeout(timeout); code === 0 ? accept() : reject(Error('LOCAL_PG_CTL_FAILED')); });
});
try {
  await writeFile(pwfile, password, { mode: 0o600 });
  await executeTool('initdb', ['-D', data, '-U', 'fixture_admin', '--pwfile=' + pwfile, '--auth=scram-sha-256', '--encoding=UTF8', '--locale=C'], { timeout: 90000 });
  const listener = createServer();
  await new Promise((accept, reject) => { listener.once('error', reject); listener.listen(0, '127.0.0.1', accept); });
  const port = listener.address().port;
  await new Promise((accept, reject) => listener.close(error => error ? reject(error) : accept()));
  await writeFile(pgpass, `127.0.0.1:${port}:postgres:fixture_admin:${password}\n`, { mode: 0o600 });
  Object.assign(env, { PGHOST: '127.0.0.1', PGPORT: String(port), PGDATABASE: 'postgres', PGUSER: 'fixture_admin', PGPASSFILE: pgpass,
    PGCONNECT_TIMEOUT: '5', PGSSLMODE: 'disable', PGCLIENTENCODING: 'UTF8' });
  startRequested = true;
  await ctl(['-D', data, '-l', join(work, 'server.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']);
  const query = sql => executeTool('psql', ['-X', '-w', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', sql]);
  const host = '11111111-1111-4111-8111-111111111111';
  await query(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${host}')`);
  for (const file of ['20261022215208_host_persistence_foundation.sql', '20261023173930_production_commerce_foundation.sql', '20261023193330_live_payment_queue_and_event_consumption.sql','20261023202259_live_payment_operations_and_receipts.sql']) {
    // -f reads only tracked migrations; each command targets the disposable cluster's loopback port.
    await executeTool('psql', ['-X', '-w', '-v', 'ON_ERROR_STOP=1', '-f', join(nativeRoot, 'supabase', 'migrations', file)]);
  }
  await query(`update bud_platform.live_commerce_control set enabled=true,fulfillment_enabled=true,host_enabled=true;
    update bud_platform.products set status='published';update bud_platform.content_versions set status='published';
    insert into bud_platform.wallets(host_id,credits) values('${host}',5)`);
  const serviceQuery = sql => query('set role service_role;' + sql).then(output => output.split(/\r?\n/).map(line => line.trim()).filter(line => line && line !== 'SET').join('\n'));
  const createOrder = () => serviceQuery(`select public.bud_live_create_order('${host}','fixture-parallel-order-key','biz_fixture123','prod_fixture123','plan_fixture123','sar',200,'en')`);
  const orders = (await Promise.all(Array.from({ length: 12 }, createOrder))).map(JSON.parse);
  assert.equal(new Set(orders.map(order => order.orderId)).size, 1);
  const orderId = orders[0].orderId;
  await serviceQuery(`select public.bud_live_attach_checkout('${host}','${orderId}','ch_fixture123','https://whop.com/checkout/ch_fixture123/')`);
  const grants = await Promise.all(Array.from({ length: 12 }, (_, i) => serviceQuery(`select public.bud_live_credit_purchase('${orderId}',
    'biz_fixture123','prod_fixture123','plan_fixture123','sar',200,'ch_fixture123','pay_fixture123','msg_parallel${i}')`)));
  assert.equal(grants.map(JSON.parse).filter(value => value.credited).length, 1);
  assert.equal(await query('select count(*) from bud_platform.live_credit_ledger'), '1');
  const config = { duration: 5, timerEnabled: true, attempts: 2 };
  const state = manualGameReducer(initialManualState(), { type: 'start', config, prizeText: 'Fixture' });
  const start = () => serviceQuery(`select public.bud_live_host_start('${host}','fixture-parallel-start-key','Fixture',
    '${JSON.stringify(config)}','Fixture','${JSON.stringify(state)}','${'a'.repeat(64)}')`);
  const events = (await Promise.all(Array.from({ length: 12 }, start))).map(JSON.parse);
  assert.equal(new Set(events.map(event => event.eventId)).size, 1);
  assert.equal(await query('select count(*) from bud_platform.live_event_debits'), '1');
  assert.equal(await query('select credits from bud_platform.live_wallets'), '0');
  assert.equal(await query('select credits from bud_platform.wallets'), '5');
  await Promise.all(Array.from({ length: 12 }, (_, i) => serviceQuery(`select public.bud_live_enqueue_payment('msg_claim${i}','pay_fixture123')`)));
  const claims = (await Promise.all(Array.from({ length: 12 }, () => serviceQuery('select public.bud_live_claim_payments(1)')))).flatMap(JSON.parse);
  assert.equal(claims.length, 12); assert.equal(new Set(claims.map(job => job.messageId)).size, 12);
  await Promise.all(claims.map(job => serviceQuery(`select public.bud_live_finish_payment('${job.messageId}','${job.leaseToken}','${orderId}',
    'biz_fixture123','prod_fixture123','plan_fixture123','sar',200,'ch_fixture123','pay_fixture123')`)));
  assert.equal(await query("select count(*) from bud_platform.live_payment_jobs where status='done'"), '12');
  assert.equal(await query('select count(*) from bud_platform.live_credit_ledger'), '1');
  assert.equal(await query('select credits from bud_platform.live_wallets'), '0');
  const reconciliations = (await Promise.all(Array.from({ length:12 }, () => serviceQuery('select public.bud_live_claim_reconciliation()')))).flatMap(JSON.parse);
  assert.equal(reconciliations.length,1);
  await serviceQuery(`select public.bud_live_record_reconciliation('${orderId}','${reconciliations[0].leaseToken}','refunded')`);
  assert.equal(await query('select credits from bud_platform.live_wallets'),'0');
  assert.equal(await query("select state from bud_platform.live_reconciliation"),'refunded');
  process.stdout.write('LOCAL_POSTGRES_MULTI_CONNECTION_PASSED orders=12 credits=12 starts=12 claims=12 wallet=0 sandbox=5\n');
} finally {
  // Never delete a running cluster, and verify exact resolved containment before recursive cleanup.
  if (startRequested) await ctl(['-D', data, '-m', 'fast', '-w', 'stop']);
  const absoluteWork = await realpath(work), absoluteTemp = await realpath(tempRoot);
  const child = relative(absoluteTemp, absoluteWork);
  if (!child || child.startsWith('..') || isAbsolute(child)) throw Error('UNSAFE_TEST_CLEANUP');
  await rm(absoluteWork, { recursive: true, force: true });
}
