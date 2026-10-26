import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const discord='123456789012345678';
const op=(n:number)=>'44444444-4444-4444-8444-'+String(n).padStart(12,'0');
const sql=(name:string)=>readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
test('owner partners stay private until approved, with replay and audit',async()=>{
 const db=new PGlite();
 try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema auth;'+
  'create table auth.users(id uuid primary key,created_at timestamptz default now());'+
  'create table auth.identities(user_id uuid,provider text,identity_data jsonb);'+
  "insert into auth.users(id) values('"+owner+"'),('"+other+"');");
  await db.query('insert into auth.identities values($1,$2,$3::jsonb)',[owner,'discord',JSON.stringify({full_name:'Owner',sub:discord})]);
  for(const name of ['20261022215208_host_persistence_foundation.sql','20261023173930_production_commerce_foundation.sql',
   '20261023193330_live_payment_queue_and_event_consumption.sql','20261023202259_live_payment_operations_and_receipts.sql',
   '20261026042029_owner_panel_and_bonus_ledger.sql','20261026122000_site_partners_owner_managed.sql'])await db.exec(await sql(name));
  await db.query('insert into bud_platform.platform_owners values($1,$2)',[owner,discord]);
  await db.exec('set role service_role');
  const value=async(query:string,params:unknown[]=[]) =>(await db.query<{v:unknown}>(query,params)).rows[0]?.v;
  const list=()=>value('select public.bud_site_partners_public() v');
  const ownerList=()=>value('select public.bud_site_partners_owner($1,$2) v',[owner,discord]);
  const command=(id:number,kind:string,body:object)=>value('select public.bud_site_partner_command($1,$2,$3,$4,$5::jsonb) v',[owner,discord,op(id),kind,JSON.stringify(body)]);
  assert.deepEqual(await list(),[]);
  await assert.rejects(value('select public.bud_site_partners_owner($1,$2) v',[other,discord]),/BUD_OWNER_REQUIRED/);
  await assert.rejects(value('select public.bud_site_partner_command($1,$2,$3,$4,$5::jsonb) v',[other,discord,op(11),'partnerSave',JSON.stringify({})]),/BUD_OWNER_REQUIRED/);
  const body={name:'شريك معتمد',logoUrl:'https://example.com/logo.png',websiteUrl:'https://example.com',sortOrder:4,visible:false,reason:'قرار المالك'};
  const first=await command(1,'partnerSave',body) as {id:string;saved:boolean;replayed:boolean};
  assert.equal(first.saved,true);assert.equal(first.replayed,false);
  assert.deepEqual(await list(),[]);
  assert.equal((await ownerList() as unknown[]).length,1);
  const replay=await command(1,'partnerSave',body) as {id:string;replayed:boolean};
  assert.equal(replay.id,first.id);assert.equal(replay.replayed,true);
  await assert.rejects(command(1,'partnerSave',{...body,visible:true}),/BUD_KEY_REUSED/);
  await command(2,'partnerSave',{...body,id:first.id,visible:true,sortOrder:0});
  assert.equal((await list() as unknown[]).length,1);
  await assert.rejects(command(3,'partnerSave',{...body,logoUrl:'javascript:alert(1)',visible:true}),/BUD_INVALID_REQUEST/);
  const receipt=await value('select public.bud_owner_receipt($1,$2,$3) v',[owner,discord,op(2)]) as {found:boolean;result:object};
  assert.equal(receipt.found,true);assert.doesNotMatch(JSON.stringify(receipt),/"request"/);
  await command(4,'partnerDelete',{id:first.id,reason:'إزالة الشريك'});
  assert.deepEqual(await list(),[]);assert.deepEqual(await ownerList(),[]);
  assert.equal(await value("select has_function_privilege('anon','public.bud_site_partners_public()','execute') v"),false);
  assert.equal(await value("select has_table_privilege('anon','bud_platform.site_partners','select') v"),false);
 }finally{await db.close();}
});
