import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
import {handleAuth} from '../server/auth.ts';import {handleCheckout,handleSandboxWhopWebhook} from '../server/checkout.ts';
test('isolated API-to-SQL checkout and signed webhook grant one run across replay',async()=>{
 const db=new PGlite(),origin='https://bud-events-website.vercel.app',host='11111111-1111-4111-8111-111111111111';
 const env={VERCEL:'1',BUD_AUTH_ENABLED:'true',BUD_BACKEND_ENABLED:'true',BUD_RATE_LIMIT_ENABLED:'true',BUD_RATE_LIMIT_SECRET:'test-rate-only-secret-over-32-bytes',BUD_AUTH_COOKIE_SECRET:'test-cookie-only-secret-over-32-bytes',BUD_APP_ORIGIN:origin,SUPABASE_URL:'https://cepmvqqrjcvhyzszqand.supabase.co',SUPABASE_PUBLISHABLE_KEY:'test',SUPABASE_SERVICE_ROLE_KEY:'test-service',BUD_WHOP_SANDBOX_ENABLED:'true',WHOP_ENVIRONMENT:'sandbox',WHOP_SANDBOX_API_KEY:'test-whop',WHOP_SANDBOX_WEBHOOK_SECRET:'ws_0123456789abcdef0123456789abcdef0123456789abcdef',WHOP_SANDBOX_COMPANY_ID:'biz_fixture123',WHOP_SANDBOX_PRODUCT_ID:'prod_fixture123',WHOP_SANDBOX_PLAN_ID:'plan_fixture123',WHOP_SANDBOX_CURRENCY:'sar',WHOP_SANDBOX_AMOUNT_MINOR:'2500'};
 let orderId='',amount=25,checkouts=0;
 const edge={'x-vercel-forwarded-for':'192.0.2.1'};
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${host}');`);
  for(const name of ['20261022215208_host_persistence_foundation.sql','20261023083912_launch_sandbox_hardening.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  await db.exec('set role service_role');
  const transport:typeof fetch=async(input,init)=>{
   const url=new URL(String(input));
   if(url.pathname.endsWith('/user'))return Response.json({id:host,identities:[{provider:'discord'}]});
   if(url.pathname.includes('/auth/v1/token'))return Response.json({access_token:'test-access-token-long-enough',refresh_token:'test-refresh-token-long-enough',expires_in:3600});
   if(url.pathname.includes('/rest/v1/rpc/')){
    const name=url.pathname.split('/').at(-1)!;assert.match(name,/^bud_[a-z_]+$/);const body=JSON.parse(String(init?.body));const entries=Object.entries(body);
    try{const result=await db.query<{result:any}>(`select public.${name}(${entries.map(([key],i)=>{assert.match(key,/^p_[a-z_]+$/);return key+' => $'+(i+1);}).join(',')}) as result`,entries.map(([,v])=>v));return Response.json(result.rows[0].result);}catch(e){return Response.json({message:(e as Error).message},{status:400});}
   }
   assert.equal(url.origin,'https://sandbox-api.whop.com');assert.equal(new Headers(init?.headers).get('Api-Version-Date'),'2025-01-01');
   if(url.pathname.includes('/plans/'))return Response.json({id:env.WHOP_SANDBOX_PLAN_ID,company:{id:env.WHOP_SANDBOX_COMPANY_ID},product:{id:env.WHOP_SANDBOX_PRODUCT_ID},plan_type:'one_time',currency:'sar',initial_price:25,renewal_price:0,adaptive_pricing_enabled:false,collect_tax:false});
   if(url.pathname.endsWith('/checkout_configurations')){checkouts++;orderId=JSON.parse(String(init?.body)).metadata.bud_order_id;return Response.json({id:'ch_fixture123',company_id:env.WHOP_SANDBOX_COMPANY_ID,plan:{id:env.WHOP_SANDBOX_PLAN_ID,currency:'sar'},mode:'payment',currency:null,metadata:{bud_order_id:orderId},purchase_url:'https://sandbox.whop.com/checkout/ch_fixture123/'});}
   return Response.json({id:'pay_fixture123',company:{id:env.WHOP_SANDBOX_COMPANY_ID},product:{id:env.WHOP_SANDBOX_PRODUCT_ID},plan:{id:env.WHOP_SANDBOX_PLAN_ID,currency:'sar'},currency:'sar',status:'paid',substatus:'succeeded',paid_at:new Date().toISOString(),total:amount,refunded_amount:0,refunded_at:null,auto_refunded:false,disputes:[],checkout_configuration_id:'ch_fixture123',metadata:{bud_order_id:orderId}});
  };
  const begin=await handleAuth(new Request(origin+'/api/auth?action=signin',{method:'POST',headers:{origin,...edge}}),env,transport);
  const callback=new URL(new URL((await begin.json()).data.url).searchParams.get('redirect_to')!);callback.searchParams.set('code','fixture-code');
  const signedIn=await handleAuth(new Request(callback,{headers:{...edge,cookie:begin.headers.getSetCookie()[0].split(';')[0]}}),env,transport);
  const cookie=signedIn.headers.getSetCookie().find(v=>v.startsWith('__Host-bud-session='))!.split(';')[0];
  const checkout=()=>handleCheckout(new Request(origin+'/api/checkout',{method:'POST',headers:{origin,...edge,cookie,'content-type':'application/json'},body:JSON.stringify({idempotencyKey:'fixture-checkout-key-1234'})}),env,transport);
  assert.equal((await checkout()).status,200);assert.equal((await checkout()).status,200);assert.equal(checkouts,1);
  const webhook=async()=>{const id='msg_fixture123',stamp=String(Math.floor(Date.now()/1000));const body=JSON.stringify({id,type:'payment.succeeded',api_version:'v1',api_version_date:'2026-08-14',account_id:env.WHOP_SANDBOX_COMPANY_ID,data:{id:'pay_fixture123'}});const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.WHOP_SANDBOX_WEBHOOK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(id+'.'+stamp+'.'+body)));return handleSandboxWhopWebhook(new Request(origin+'/api/sandbox-webhook',{method:'POST',headers:{...edge,'content-type':'application/json','webhook-id':id,'webhook-timestamp':stamp,'webhook-signature':'v1,'+btoa(String.fromCharCode(...bytes))},body}),env,transport);};
  assert.equal((await webhook()).status,200);assert.equal((await webhook()).status,200);
  const wallet=await db.query<{credits:number}>('select credits from bud_platform.wallets where host_id=$1',[host]);assert.equal(wallet.rows[0].credits,1);
  amount=24.99;assert.equal((await webhook()).status,409);
  assert.equal((await db.query<{n:number}>('select count(*)::int n from bud_platform.credit_ledger')).rows[0].n,1);
 }finally{await db.close();}
});
