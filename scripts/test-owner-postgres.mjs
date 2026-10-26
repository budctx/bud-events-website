// Disposable loopback PostgreSQL only. No production credentials, remote targets or cleanup of existing databases.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const exec=promisify(execFile);
if(process.argv[2]!=='--local-only'||process.env.BUD_OWNER_SQL_FIXTURE!=='disposable'
 ||process.env.PGHOST!=='127.0.0.1'||process.env.PGDATABASE!=='bud_owner_fixture'||process.env.PGPORT!=='55432'
 ||process.env.PGUSER!=='postgres'||process.env.PGPASSWORD!=='owner-fixture-only')throw Error('DISPOSABLE_LOOPBACK_FIXTURE_REQUIRED');
const sql=async(text)=> (await exec('psql',['-X','-v','ON_ERROR_STOP=1','-t','-A','-c',text],{timeout:45000,maxBuffer:1048576})).stdout.trim();
assert.equal(await sql("select count(*) from information_schema.tables where table_schema in ('public','auth','bud_platform')"),'0','fixture must start empty');
const owner='11111111-1111-4111-8111-111111111111',user='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333',discord='123456789012345678';
const op=n=>`44444444-4444-4444-8444-${String(n).padStart(12,'0')}`;
await sql(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,created_at timestamptz default now());create table auth.identities(user_id uuid,provider text,identity_data jsonb);
 insert into auth.users(id) values('${owner}'),('${user}'),('${other}');
 insert into auth.identities values('${owner}','discord','{"sub":"${discord}"}'),('${user}','discord','{"sub":"223456789012345678"}'),('${other}','discord','{"sub":"323456789012345678"}');`);
for(const name of ['20261022215208_host_persistence_foundation.sql','20261023173930_production_commerce_foundation.sql','20261023193330_live_payment_queue_and_event_consumption.sql','20261023202259_live_payment_operations_and_receipts.sql','20261026042029_owner_panel_and_bonus_ledger.sql'])await sql(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
await sql(`insert into bud_platform.platform_owners values('${owner}','${discord}')`);
const command=(n,kind,body)=>sql(`set role service_role;select public.bud_owner_command('${owner}','${discord}','${op(n)}','${kind}','${JSON.stringify(body).replaceAll("'","''")}')`);
await command(1,'createCode',{digest:'a'.repeat(64),qty:1,maxUses:1,expiresAt:'2099-01-01T00:00:00Z',reason:'fixture concurrent redeem'});
const results=await Promise.allSettled(Array.from({length:20},(_,i)=>sql(`set role service_role;select public.bud_bonus_redeem('${i%2?user:other}',repeat('a',64),'${op(10+i)}')`)));
assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
for(const result of results)if(result.status==='rejected')assert.match(result.reason.stderr,/BUD_INVALID_CODE/);
const grants=await Promise.all(Array.from({length:20},()=>command(100,'grant',{hostId:user,qty:2,reason:'fixture duplicate grant'})));
assert.equal(grants.length,20);
assert.equal(await sql('select count(*) from bud_platform.bonus_ledger'),'2');
assert.equal(await sql('select sum(credits) from bud_platform.live_wallets'),'3');
assert.equal(await sql('select count(*) from bud_platform.live_credit_ledger'),'0');
assert.equal(await sql('select count(*) from bud_platform.live_orders'),'0');
assert.equal(await sql('select count(*) from bud_platform.owner_audit where kind=\'grant\''),'1');
await assert.rejects(command(100,'grant',{hostId:user,qty:3,reason:'fixture changed payload'}),e=>/BUD_KEY_REUSED/.test(e.stderr));
await assert.rejects(sql(`set role authenticated;select public.bud_bonus_redeem('${user}',repeat('a',64),'${op(200)}')`),e=>/permission denied/.test(e.stderr));
await assert.rejects(sql(`set role service_role;update bud_platform.owner_audit set reason='tamper'`),e=>/permission denied/.test(e.stderr));
console.log(JSON.stringify({fixture:'disposable-loopback-postgres',concurrentRedemptions:20,successfulRedemptions:1,concurrentGrantRetries:20,grants:1,totalSlots:3,purchaseRows:0}));
