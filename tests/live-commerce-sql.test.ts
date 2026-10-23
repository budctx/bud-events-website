import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migration = '20261023173930_production_commerce_foundation.sql';
test('live commerce SQL preserves Auth and sandbox data, denies public access, binds requests and grants one isolated credit across replay', async () => {
 const db = new PGlite();
 const host='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222';
 const value=async(sql:string,params:unknown[]=[]) => (await db.query<{result:any}>(sql,params)).rows[0].result;
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${host}'),('${other}');`);
  await db.exec(await readFile(new URL('../supabase/migrations/20261022215208_host_persistence_foundation.sql',import.meta.url),'utf8'));
  await db.query('insert into bud_platform.wallets(host_id,credits) values($1,5)',[host]);
  await db.exec(await readFile(new URL('../supabase/migrations/'+migration,import.meta.url),'utf8'));
  assert.equal((await db.query<{n:number}>('select count(*)::int n from auth.users')).rows[0].n,2);
  assert.equal((await value('select public.bud_slot_balance($1) as result',[host])).credits,5);
  assert.equal((await value('select public.bud_live_balance($1) as result',[host])).credits,0);
  const privileges=await db.query<{name:string;rls:boolean;a:boolean;b:boolean}>(`select c.relname name,c.relrowsecurity rls,has_table_privilege('anon',c.oid,'SELECT') a,has_table_privilege('authenticated',c.oid,'SELECT') b from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='bud_platform' and c.relname like 'live_%' and c.relkind='r'`);
  assert.equal(privileges.rows.length,5);for(const row of privileges.rows){assert.equal(row.rls,true);assert.equal(row.a,false);assert.equal(row.b,false);}
  const create='select public.bud_live_create_order($1,$2,$3,$4,$5,$6,$7,$8) as result';
  const args=[host,'live-checkout-request-123','biz_fixture123','prod_fixture123','plan_fixture123','sar',200,'en'];
  await db.exec('set role service_role');
  await assert.rejects(value(create,args),/BUD_LIVE_COMMERCE_DISABLED/);
  await assert.rejects(db.exec('update bud_platform.live_commerce_control set enabled=true'),/permission denied/);
  await db.exec('reset role;update bud_platform.live_commerce_control set enabled=true;set role service_role');
  const first=await value(create,args);assert.equal(first.environment,'production');assert.equal(first.checkoutId,null);assert.equal(first.locale,'en');
  assert.deepEqual(await value(create,args),first);
  for(const bad of [[...args.slice(0,6),1800,'en'],[...args.slice(0,5),'usd',200,'en'],[...args.slice(0,7),'ar'],[...args.slice(0,7),'https://evil.test'],[...args.slice(0,7),null]])await assert.rejects(value(create,bad),/BUD_KEY_REUSED|BUD_INVALID_LIVE_ORDER/);
  const attach='select public.bud_live_attach_checkout($1,$2,$3,$4) as result';
  await assert.rejects(value(attach,[other,first.orderId,'ch_fixture123','https://whop.com/checkout/ch_fixture123/']),/BUD_ORDER_NOT_FOUND/);
  await assert.rejects(value(attach,[host,first.orderId,'ch_fixture123','https://sandbox.whop.com/checkout/ch_fixture123/']),/BUD_INVALID_LIVE_CHECKOUT/);
  const credit='select public.bud_live_credit_purchase($1,$2,$3,$4,$5,$6,$7,$8,$9) as result';
  const purchase=[first.orderId,'biz_fixture123','prod_fixture123','plan_fixture123','sar',200,'ch_fixture123','pay_fixture123','msg_fixture123'];
  await assert.rejects(value(credit,purchase),/BUD_LIVE_PAYMENT_MISMATCH/);
  await value(attach,[host,first.orderId,'ch_fixture123','https://whop.com/checkout/ch_fixture123/']);
  await assert.rejects(value(attach,[host,first.orderId,'ch_other123','https://whop.com/checkout/ch_other123/']),/BUD_CHECKOUT_ALREADY_ATTACHED/);
  await assert.rejects(value(credit,[...purchase.slice(0,5),199,...purchase.slice(6)]),/BUD_LIVE_PAYMENT_MISMATCH/);
  assert.deepEqual(await value(credit,purchase),{credited:true,replayed:false});
  assert.deepEqual(await value(credit,purchase),{credited:false,replayed:true});
  assert.deepEqual(await value(credit,[...purchase.slice(0,8),'msg_another123']),{credited:false,replayed:true});
  assert.equal((await value('select public.bud_live_balance($1) as result',[host])).credits,1);
  assert.equal((await value('select public.bud_slot_balance($1) as result',[host])).credits,5);
  assert.equal((await db.query<{n:number}>('select count(*)::int n from bud_platform.live_credit_ledger')).rows[0].n,1);
  assert.equal((await db.query<{n:number}>('select count(*)::int n from bud_platform.live_deliveries')).rows[0].n,2);
  await assert.rejects(value(credit,[...purchase.slice(0,7),'pay_wrong123','msg_new123']),/BUD_LIVE_ORDER_ALREADY_FULFILLED/);
  const second=await value(create,[other,'live-checkout-request-456',...args.slice(2)]);
  await value(attach,[other,second.orderId,'ch_second123','https://whop.com/checkout/ch_second123/']);
  const secondPurchase=[second.orderId,...purchase.slice(1,6),'ch_second123','pay_second123','msg_fixture123'];
  await assert.rejects(value(credit,secondPurchase),/BUD_LIVE_MESSAGE_REUSED/);
  await assert.rejects(value(credit,[...secondPurchase.slice(0,7),'pay_fixture123','msg_unique123']),/duplicate key/);
  assert.equal((await value('select public.bud_live_balance($1) as result',[other])).credits,0);
  assert.equal((await db.query<{n:number}>("select count(*)::int n from bud_platform.live_deliveries where message_id='msg_unique123'")).rows[0].n,0);
  for(const role of ['anon','authenticated']) {
   await db.exec('reset role;set role '+role);
   await assert.rejects(value(create,args),/permission denied/);
   await assert.rejects(value('select public.bud_live_balance($1) as result',[host]),/permission denied/);
   await assert.rejects(value(credit,purchase),/permission denied/);
  }
  await db.exec('reset role');
  await assert.rejects(db.query('delete from auth.users where id=$1',[host]),/foreign key constraint/);
  assert.equal((await db.query<{n:number}>('select count(*)::int n from auth.users')).rows[0].n,2);
  // A local restore proves fixture/schema recovery, never a remote production backup.
  const snapshot=await db.dumpDataDir(); const restored=new PGlite({loadDataDir:snapshot});
  try {
   assert.equal((await restored.query<{n:number}>('select count(*)::int n from auth.users')).rows[0].n,2);
   assert.equal((await restored.query<{credits:number}>('select credits from bud_platform.live_wallets where host_id=$1',[host])).rows[0].credits,1);
   assert.equal((await restored.query<{credits:number}>('select credits from bud_platform.wallets where host_id=$1',[host])).rows[0].credits,5);
   assert.equal((await restored.query<{n:number}>('select count(*)::int n from bud_platform.live_credit_ledger')).rows[0].n,1);
  } finally { await restored.close(); }
 } finally { await db.close(); }
});
