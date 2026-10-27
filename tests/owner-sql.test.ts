import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const owner='11111111-1111-4111-8111-111111111111',user='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333',discord='123456789012345678';
const op=(n:number)=>`44444444-4444-4444-8444-${String(n).padStart(12,'0')}`;
export async function ownerFixture(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
  create table auth.users(id uuid primary key,created_at timestamptz default now());
  create table auth.identities(user_id uuid,provider text,identity_data jsonb);
  insert into auth.users(id) values('${owner}'),('${user}'),('${other}');
  insert into auth.identities values('${owner}','discord','{"full_name":"المالك","sub":"${discord}"}'),('${user}','discord','{"full_name":"مستخدم","sub":"223456789012345678"}'),('${other}','discord','{"full_name":"آخر","sub":"323456789012345678"}');`);
 for(const name of ['20261022215208_host_persistence_foundation.sql','20261023173930_production_commerce_foundation.sql','20261023193330_live_payment_queue_and_event_consumption.sql','20261023202259_live_payment_operations_and_receipts.sql','20261026042029_owner_panel_and_bonus_ledger.sql','20261027123500_owner_payment_states.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
 await db.query('insert into bud_platform.platform_owners values($1,$2)',[owner,discord]);
 await db.exec('set role service_role');
 return db;
}
test('owner-only views, atomic source ledger and redemption receipts preserve purchase tables',async()=>{
 const db=await ownerFixture();
 const value=async(sql:string,args:unknown[]=[])=> (await db.query<{v:any}>(sql,args)).rows[0].v;
 const command=(id:number,kind:string,body:object)=>value('select public.bud_owner_command($1,$2,$3,$4,$5) v',[owner,discord,op(id),kind,body]);
 const redeem=(host:string,id:number,digest='a'.repeat(64))=>value('select public.bud_bonus_redeem($1,$2,$3) v',[host,digest,op(id)]);
 try{
  assert.equal(await value('select public.bud_owner_check($1,$2) v',[owner,discord]),true);
  for(const [host,identity] of [[user,discord],[owner,'923456789012345678']])await assert.rejects(value('select public.bud_owner_view($1,$2,$3) v',[host,identity,'users']),/BUD_OWNER_REQUIRED/);
  const users=await value('select public.bud_owner_view($1,$2,$3) v',[owner,discord,'users']);assert.equal(users.rows.length,3);assert.ok(users.rows.every((r:any)=>!('email' in r)));
  const body={digest:'a'.repeat(64),qty:2,maxUses:1,expiresAt:new Date(Date.now()+3600000).toISOString(),reason:'هدية تجريبية'};
  const key=await command(1,'createCode',body);assert.equal(key.created,true);assert.equal((await command(1,'createCode',body)).replayed,true);
  await assert.rejects(command(1,'createCode',{...body,qty:3}),/BUD_KEY_REUSED/);
  const receipt=await redeem(user,2);assert.equal(receipt.credits,2);assert.equal(receipt.replayed,false);
  assert.equal((await redeem(user,2)).receipt,receipt.receipt);
  await assert.rejects(redeem(user,3),/BUD_INVALID_CODE/);await assert.rejects(redeem(other,4),/BUD_INVALID_CODE/);
  await assert.rejects(redeem(user,2,'b'.repeat(64)),/BUD_KEY_REUSED/);
  const grant=await command(5,'grant',{hostId:user,qty:3,reason:'منحة اختبار'});assert.ok(grant.id);
  const recorded=await value('select public.bud_owner_receipt($1,$2,$3) v',[owner,discord,op(5)]);assert.equal(recorded.found,true);assert.equal(recorded.result.id,grant.id);assert.equal(recorded.result.replayed,true);
  assert.doesNotMatch(JSON.stringify(recorded),/"request"|digest/);
  assert.equal((await value('select public.bud_owner_receipt($1,$2,$3) v',[owner,discord,op(999)])).found,false);
  await assert.rejects(value('select public.bud_owner_receipt($1,$2,$3) v',[user,discord,op(5)]),/BUD_OWNER_REQUIRED/);
  await command(5,'grant',{hostId:user,qty:3,reason:'منحة اختبار'});
  assert.equal((await value('select public.bud_live_balance($1) v',[user])).credits,5);
  assert.equal(await value('select count(*)::int v from bud_platform.live_orders'),0);
  assert.equal(await value('select count(*)::int v from bud_platform.live_credit_ledger'),0);
  assert.equal(await value('select count(*)::int v from bud_platform.live_payment_jobs'),0);
  assert.equal(await value('select count(*)::int v from bud_platform.bonus_ledger'),2);
  await command(6,'restrict',{hostId:user,suspended:true,reason:'تقييد تجريبي'});
  await assert.rejects(command(7,'grant',{hostId:user,qty:1,reason:'منحة محظورة'}),/BUD_ACCOUNT_RESTRICTED/);
  await command(8,'restrict',{hostId:user,suspended:false,reason:'رفع التقييد'});
  const key2=await command(9,'createCode',{...body,digest:'c'.repeat(64),maxUses:5});
  await command(10,'suspendCode',{id:key2.id,reason:'إيقاف التجربة'});
  await assert.rejects(redeem(other,11,'c'.repeat(64)),/BUD_INVALID_CODE/);
  await assert.rejects(command(12,'createCode',{...body,digest:'d'.repeat(64),expiresAt:'2020-01-01'}),/BUD_INVALID_REQUEST/);
  const keys=await value('select public.bud_owner_view($1,$2,$3) v',[owner,discord,'keys']);assert.doesNotMatch(JSON.stringify(keys),/digest|aaaaaaaa/);
  for(const section of ['overview','payments','events','audit','health','settings','search','user']){
   const view=await value('select public.bud_owner_view($1,$2,$3,$4,0) v',[owner,discord,section,section==='search'?'مستخدم':section==='user'?user:'']);assert.ok(view);
  }
  await value('select public.bud_owner_sync_alerts($1,$2,300) v',[owner,discord]);
  const overview=await value('select public.bud_owner_view($1,$2,$3) v',[owner,discord,'overview']);assert.equal(overview.alerts.length,2);
  const claim='select public.bud_owner_claim_notification($1,$2,$3,900) v';
  const notification=await value(claim,[owner,discord,'a'.repeat(64)]);assert.ok(notification.id);
  const another=await value(claim,[owner,discord,'a'.repeat(64)]);assert.notEqual(another.id,notification.id);
  assert.equal(await value(claim,[owner,discord,'a'.repeat(64)]),null);
  await assert.rejects(value('select public.bud_owner_finish_notification($1,$2,$3,$4,$5,false) v',[owner,discord,notification.id,op(400),op(401)]),/BUD_NOTIFICATION_LEASE_LOST/);
  await value('select public.bud_owner_finish_notification($1,$2,$3,$4,$5,false) v',[owner,discord,notification.id,notification.lease,op(401)]);
  assert.equal(await value(claim,[owner,discord,'a'.repeat(64)]),null);
  await command(100,'ack',{fingerprint:overview.alerts[0].fingerprint,reason:'تم الاطلاع'});
  await db.exec('reset role;update bud_platform.live_worker_health set succeeded_at=clock_timestamp(),status=\'ok\';set role service_role;');
  await value('select public.bud_owner_sync_alerts($1,$2,300) v',[owner,discord]);
  assert.equal((await value('select public.bud_owner_view($1,$2,$3) v',[owner,discord,'overview'])).alerts.length,0);
  await assert.rejects(db.exec('update bud_platform.owner_audit set reason=\'tamper\''),/permission denied/);
  await assert.rejects(db.exec('delete from bud_platform.bonus_ledger'),/permission denied/);
  await assert.rejects(db.exec(`insert into bud_platform.platform_owners values('${other}','923456789012345678')`),/permission denied/);
  for(const role of ['anon','authenticated']){
   await db.exec('reset role;set role '+role);
   await assert.rejects(redeem(other,15),/permission denied/);
   await assert.rejects(value('select public.bud_owner_check($1,$2) v',[owner,discord]),/permission denied/);
   await assert.rejects(value('select public.bud_owner_receipt($1,$2,$3) v',[owner,discord,op(5)]),/permission denied/);
   await assert.rejects(db.exec('select * from bud_platform.redeem_codes'),/permission denied/);
  }
 }finally{await db.close();}
});
test('owner payments separate never-started checkouts from unverified payment without implying a charge',async()=>{
 const db=await ownerFixture();
 const value=async(sql:string,args:unknown[]=[])=> (await db.query<{v:any}>(sql,args)).rows[0].v;
 try{
  await db.exec('reset role;update bud_platform.live_commerce_control set enabled=true;set role service_role;');
  const create='select public.bud_live_create_order($1,$2,$3,$4,$5,$6,$7,$8) v';
  const args=[user,'w03-payment-state-a','biz_fixture123','prod_fixture123','plan_fixture123','sar',300,'ar'];
  const unstarted=await value(create,args);
  const checkout=await value(create,[...args.slice(0,1),'w03-payment-state-b',...args.slice(2)]);
  await value('select public.bud_live_attach_checkout($1,$2,$3,$4) v',[user,checkout.orderId,'ch_fixture123','https://whop.com/checkout/ch_fixture123/']);
  const view=await value('select public.bud_owner_view($1,$2,$3) v',[owner,discord,'payments']);
  const state=(id:string)=>view.rows.find((r:any)=>r.id===id)?.state;
  assert.equal(state(unstarted.orderId),'checkout_not_started');
  assert.equal(state(checkout.orderId),'checkout_unverified');
  assert.ok(view.rows.every((r:any)=>r.state!=='pending'));
  const overview=await value('select public.bud_owner_view($1,$2,$3) v',[owner,discord,'overview']);
  assert.equal(overview.pendingOrders,2);
  assert.equal(overview.checkoutNotStarted,1);
  assert.equal(overview.checkoutUnverified,1);
  assert.equal(await value('select count(*)::int v from bud_platform.live_credit_ledger'),0);
 }finally{await db.close();}
});

test('operator recovery calls the existing purchase ledger transaction exactly once and retains audit',async()=>{
 const db=await ownerFixture();
 const value=async(sql:string,args:unknown[]=[])=> (await db.query<{v:any}>(sql,args)).rows[0].v;
 try{
  await db.exec('reset role;update bud_platform.live_commerce_control set enabled=true,fulfillment_enabled=true;set role service_role;');
  const order=await value('select public.bud_live_create_order($1,$2,$3,$4,$5,$6,$7,$8) v',[user,'fixture-checkout-12345','biz_fixture123','prod_fixture123','plan_fixture123','sar',300,'ar']);
  await value('select public.bud_live_attach_checkout($1,$2,$3,$4) v',[user,order.orderId,'ch_fixture123','https://whop.com/checkout/ch_fixture123/']);
  const expected=await value('select public.bud_live_order($1) v',[order.orderId]);
  const args=[owner,discord,op(80),order.orderId,'pay_fixture123',expected,'استعادة دفعة موثقة'];
  const sql='select public.bud_owner_recover_payment($1,$2,$3,$4,$5,$6,$7) v';
  const result=await value(sql,args);assert.equal(result.credited,true);assert.equal((await value(sql,args)).replayed,true);
  assert.equal((await value('select public.bud_live_balance($1) v',[user])).credits,1);
  assert.equal(await value('select count(*)::int v from bud_platform.live_credit_ledger'),1);
  assert.equal(await value('select count(*)::int v from bud_platform.owner_audit'),1);
  await assert.rejects(value(sql,[...args.slice(0,4),'pay_wrong123',...args.slice(5)]),/BUD_KEY_REUSED/);
  assert.equal(await value('select count(*)::int v from bud_platform.bonus_ledger'),0);
 }finally{await db.close();}
});
test('SQL rolls back code usage and wallet when ledger fails; twenty competing redemptions cannot exceed cap',async()=>{
 const db=await ownerFixture();
 try{
  await db.query('select public.bud_owner_command($1,$2,$3,$4,$5)',[owner,discord,op(30),'createCode',{digest:'e'.repeat(64),qty:1,maxUses:1,expiresAt:new Date(Date.now()+3600000).toISOString(),reason:'اختبار متزامن'}]);
  const calls=Array.from({length:20},(_,i)=>db.query('select public.bud_bonus_redeem($1,$2,$3)',[i%2?user:other,'e'.repeat(64),op(31+i)]));
  const results=await Promise.allSettled(calls);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await db.query<{n:number}>('select sum(credits)::int n from bud_platform.live_wallets')).rows[0].n,1);
  // Deliberate database error in a disposable fixture must roll back the entire transaction.
  await db.exec('reset role;create function bud_platform.test_fail_ledger() returns trigger language plpgsql as $$begin raise exception \'fixture failure\';end$$;create trigger test_fail before insert on bud_platform.bonus_ledger for each row execute function bud_platform.test_fail_ledger();set role service_role;');
  await db.query('select public.bud_owner_command($1,$2,$3,$4,$5)',[owner,discord,op(60),'createCode',{digest:'f'.repeat(64),qty:1,maxUses:1,expiresAt:new Date(Date.now()+3600000).toISOString(),reason:'اختبار التراجع'}]);
  await assert.rejects(db.query('select public.bud_bonus_redeem($1,$2,$3)',[user,'f'.repeat(64),op(61)]),/fixture failure/);
  assert.equal((await db.query<{n:number}>("select uses n from bud_platform.redeem_codes where digest=repeat('f',64)")).rows[0].n,0);
 }finally{await db.close();}
});
test('secondary grant and access-event histories paginate even when the primary list is empty',async()=>{
 const db=await ownerFixture();
 try{
  await db.query(`insert into bud_platform.bonus_ledger(host_id,source,actor,operation_id,qty,reason)
    select $1,'admin_grant',$2,gen_random_uuid(),1,'fixture history' from generate_series(1,51)`,[user,owner]);
  await db.exec("insert into bud_platform.owner_access_events(kind) select 'authentication_failed' from generate_series(1,51)");
  const view=async(section:string,offset=0,search='')=>(await db.query<{v:any}>('select public.bud_owner_view($1,$2,$3,$4,$5) v',[owner,discord,section,search,offset])).rows[0].v;
  const keys=await view('keys');assert.equal(keys.rows.length,0);assert.equal(keys.history.length,50);assert.equal(keys.mayHaveMore,true);
  assert.equal((await view('keys',50)).history.length,1);
  const audit=await view('audit');assert.equal(audit.rows.length,0);assert.equal(audit.mayHaveMore,true);assert.equal((await view('audit',50)).accessEvents.length,1);
  assert.equal((await view('keys',0,'unmatched-reference')).history.length,0);
  assert.equal((await view('audit',0,'unmatched-reference')).accessEvents.length,0);
 }finally{await db.close();}
});
