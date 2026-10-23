import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
test('launch SQL: atomic bounded counters and isolated idempotent sandbox orders',async()=>{
 const db=new PGlite();const host='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
 const value=async(sql:string,params:unknown[]=[]) => (await db.query<{result:any}>(sql,params)).rows[0].result;
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${host}'),('${other}');`);
  for(const name of ['20261022215208_host_persistence_foundation.sql','20261023083912_launch_sandbox_hardening.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  await db.exec('set role service_role');
  const consume='select public.bud_consume_rate_limit($1,$2) as result';const bucket='a'.repeat(64);
  for(let n=0;n<10;n++)assert.equal((await value(consume,['auth-signin',bucket])).allowed,true);
  for(let n=0;n<3;n++){const blocked=await value(consume,['auth-signin',bucket]);assert.equal(blocked.allowed,false);assert.ok(blocked.retryAfter>=1&&blocked.retryAfter<=60);}
  assert.equal((await value(consume,['host',bucket])).allowed,true);
  assert.equal((await value(consume,['auth-signin','b'.repeat(64)])).allowed,true);
  await assert.rejects(value(consume,['unbounded',bucket]),/BUD_INVALID_RATE_BUCKET/);
  await db.query("update bud_platform.rate_limits set resets_at=now()-interval '1 second' where scope='auth-signin' and bucket=$1",[bucket]);
  assert.equal((await value(consume,['auth-signin',bucket])).allowed,true);
  const create='select public.bud_create_sandbox_order($1,$2,$3,$4,$5,$6,$7) as result';
  const params=[host,'checkout-request-key-123','biz_fixture','prod_fixture','plan_fixture','SAR',100];
  const first=await value(create,params);assert.equal(first.environment,'sandbox');assert.equal(first.checkoutId,null);
  assert.deepEqual(await value(create,params),first);
  await assert.rejects(value(create,[...params.slice(0,6),200]),/BUD_KEY_REUSED/);
  const attach='select public.bud_attach_sandbox_checkout($1,$2,$3,$4) as result';
  await assert.rejects(value(attach,[other,first.orderId,'ch_fixture','https://sandbox.whop.com/checkout/ch_fixture/']),/BUD_ORDER_NOT_FOUND/);
  await assert.rejects(value(attach,[host,first.orderId,'ch_fixture','https://whop.com/checkout/ch_fixture/']),/BUD_INVALID_CHECKOUT/);
  const attached=await value(attach,[host,first.orderId,'ch_fixture','https://sandbox.whop.com/checkout/ch_fixture/']);assert.equal(attached.checkoutId,'ch_fixture');
  await assert.rejects(value(attach,[host,first.orderId,'ch_other','https://sandbox.whop.com/checkout/ch_other/']),/BUD_CHECKOUT_ALREADY_ATTACHED/);
  assert.equal((await value('select public.bud_slot_balance($1) as result',[host])).credits,0);
  const privileges=(await db.query("select has_function_privilege('anon','public.bud_consume_rate_limit(text,text)','execute') a,has_function_privilege('authenticated','public.bud_sandbox_order(uuid)','execute') b")).rows[0];assert.deepEqual(privileges,{a:false,b:false});
 }finally{await db.close();}
});
