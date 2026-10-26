import test from 'node:test';
import assert from 'node:assert/strict';
import {handleAuth} from '../server/auth.ts';
import {handleOwner} from '../server/owner.ts';
const origin='https://bud-events-website.vercel.app',project='https://cepmvqqrjcvhyzszqand.supabase.co',host='11111111-1111-4111-8111-111111111111',discord='123456789012345678';
const env={BUD_AUTH_ENABLED:'true',BUD_BACKEND_ENABLED:'true',BUD_OWNER_PANEL_ENABLED:'true',BUD_REDEEM_ENABLED:'true',BUD_APP_ORIGIN:origin,SUPABASE_URL:project,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_mock',SUPABASE_SERVICE_ROLE_KEY:'fixture-service-only-key',BUD_AUTH_COOKIE_SECRET:'fixture-cookie-012345678901234567890123456789',BUD_REDEEM_HASH_SECRET:'fixture-hash-012345678901234567890123456789',BUD_RATE_LIMIT_ENABLED:'true',BUD_RATE_LIMIT_SECRET:'fixture-rate-012345678901234567890123456789',VERCEL:'1',BUD_OWNER_MAX_GRANT_SLOTS:'10',BUD_OWNER_MAX_CODE_USES:'20'};
type Handler=(name:string,body:any)=>Response;
function mock(handler:Handler=()=>Response.json({replayed:false,id:host}),owner=true,identity=discord):typeof fetch{return async(input,init)=>{
 const url=String(input);assert.ok(url.startsWith(project));
 if(url.endsWith('/auth/v1/user'))return Response.json({id:host,identities:[{provider:'discord',provider_id:identity,identity_data:{sub:identity,full_name:'المالك'}}],user_metadata:{owner:true}});
 if(url.includes('/auth/v1/token'))return Response.json({access_token:'fixture-access-token-long-enough',refresh_token:'fixture-refresh-token',expires_in:3600});
 const name=url.split('/').at(-1)!;const body=JSON.parse(String(init?.body));
 if(name==='bud_consume_rate_limit')return Response.json({allowed:true,retryAfter:0});
 if(name==='bud_owner_check'){assert.equal(body.p_actor,host);assert.equal(body.p_discord,identity);return Response.json(owner);}
 return handler(name,body);
};}
const cookie=(r:Response)=>r.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
async function login(transport:typeof fetch){
 const begin=await handleAuth(new Request(origin+'/api/auth?action=signin',{method:'POST',headers:{origin,'x-vercel-forwarded-for':'192.0.2.1'}}),env,transport);
 const url=new URL(new URL((await begin.json()).data.url).searchParams.get('redirect_to')!);url.searchParams.set('code','fixture-code');
 return cookie(await handleAuth(new Request(url,{headers:{cookie:cookie(begin),'x-vercel-forwarded-for':'192.0.2.1'}}),env,transport));
}
function req(body:unknown,cookie='',requestOrigin=origin){return new Request(origin+'/api/owner',{method:'POST',headers:{origin:requestOrigin,cookie,'content-type':'application/json','x-vercel-forwarded-for':'192.0.2.1'},body:JSON.stringify(body)});}
const id='22222222-2222-4222-8222-222222222222';
const grant={action:'grant',operationId:id,confirmed:true,reason:'هدية تجريبية',payload:{hostId:id,qty:1}};
test('owner endpoint denies anonymous, cross-origin, disabled, non-owner and client ownership overrides',async()=>{
 const transport=mock();const c=await login(transport);
 assert.equal((await handleOwner(req({action:'profile'}),env,transport)).status,401);
 assert.equal((await handleOwner(req(grant,c,'https://evil.test'),env,transport)).status,403);
 assert.equal((await handleOwner(req(grant,c),{...env,BUD_OWNER_PANEL_ENABLED:'false'},transport)).status,503);
 assert.equal((await handleOwner(req(grant,c),env,mock(undefined,false))).status,403);
 assert.equal((await handleOwner(req({...grant,owner:true},c),env,transport)).status,400);
 assert.equal((await handleOwner(req({...grant,confirmed:false},c),env,transport)).status,400);
 assert.equal((await handleOwner(req({...grant,payload:{...grant.payload,qty:11}},c),env,transport)).status,400);
});
test('issued plaintext appears only for fresh creation; redemption binds recipient to verified session and hashes code',async()=>{
 let replay=false;const calls:any[]=[];
 const transport=mock((name,body)=>{calls.push({name,body});return name==='bud_bonus_redeem'?Response.json({receipt:id,credits:1}):Response.json({id,replayed:replay});});
 const c=await login(transport),request={action:'createCode',operationId:id,confirmed:true,reason:'هدية اختبار',payload:{qty:1,maxUses:1,expiresAt:new Date(Date.now()+3600000).toISOString()}};
 const first=await handleOwner(req(request,c),env,transport);const result=await first.json();assert.equal(first.status,200);assert.match(result.data.code,/^BUD-[A-Z2-7]{32}$/);
 assert.equal(first.headers.get('cache-control'),'no-store');assert.doesNotMatch(JSON.stringify(calls),/BUD-[A-Z2-7]{32}/);
 replay=true;const next=await(await handleOwner(req(request,c),env,transport)).json();assert.equal(next.data.code,undefined);
 const redemption=await handleOwner(req({action:'redeem',code:result.data.code,operationId:id},c),env,transport);assert.equal(redemption.status,200);
 const body=calls.at(-1).body;assert.equal(body.p_host,host);assert.match(body.p_digest,/^[a-f0-9]{64}$/);
 assert.equal((await handleOwner(req({action:'redeem',code:result.data.code,operationId:id,hostId:id},c),env,transport)).status,400);
});
test('old authentication cannot mutate and refreshing tokens cannot silently renew owner authentication',async t=>{
 const transport=mock(),c=await login(transport),now=Date.now();
 t.mock.method(Date,'now',()=>now+301000);
 const res=await handleOwner(req(grant,c),env,transport);assert.equal(res.status,403);assert.equal((await res.json()).code,'OWNER_REAUTH_REQUIRED');
});
test('owner view allowlist bounds search/pagination and sanitizes backend failures',async()=>{
 const calls:any[]=[];const transport=mock((name,body)=>{calls.push({name,body});return Response.json({message:'private-sql-and-secret'},{status:500});}),c=await login(transport);
 assert.equal((await handleOwner(req({action:'view',section:'auth.users',search:'',offset:0},c),env,transport)).status,400);
 const result=await handleOwner(req({action:'view',section:'users',search:'',offset:0},c),env,transport);
 assert.equal(result.status,503);assert.doesNotMatch(await result.text(),/private-sql|secret/);assert.equal(calls[0].body.p_actor,host);
});
test('receipt lookup uses the verified owner and remains available after recent-auth mutation window expires',async t=>{
 const calls:any[]=[];const transport=mock((name,body)=>{calls.push({name,body});return Response.json({found:true,kind:'grant',result:{id,replayed:true}});});
 const c=await login(transport),now=Date.now();t.mock.method(Date,'now',()=>now+301000);
 const response=await handleOwner(req({action:'receipt',operationId:id},c),env,transport);assert.equal(response.status,200);
 assert.deepEqual(calls,[{name:'bud_owner_receipt',body:{p_actor:host,p_discord:discord,p_operation:id}}]);
 assert.equal((await handleOwner(req({action:'receipt',operationId:id,actor:id},c),env,transport)).status,400);
 assert.equal((await handleOwner(req({action:'receipt',operationId:id},c),env,mock(undefined,false))).status,403);
});
test('reading owner sections preserves the strict purchase and redemption rate budget',async()=>{
 const scopes:string[]=[];const base=mock();const transport:typeof fetch=async(input,init)=>{
  if(String(input).endsWith('/bud_consume_rate_limit'))scopes.push(JSON.parse(String(init?.body)).p_scope);
  return base(input,init);
 };
 const c=await login(transport);scopes.length=0;
 for(let i=0;i<12;i++)assert.equal((await handleOwner(req({action:'view',section:'users',search:'',offset:0},c),env,transport)).status,200);
 assert.equal(scopes.length,24);assert.ok(scopes.every(scope=>scope==='host'));scopes.length=0;
 assert.equal((await handleOwner(req(grant,c),env,transport)).status,200);assert.deepEqual(scopes,['checkout','checkout']);
});
test('payment recovery re-reads Whop and binds stored order before allowing the atomic purchase transaction',async()=>{
 const configured={...env,BUD_PAYMENT_RECOVERY_ENABLED:'true',WHOP_ENVIRONMENT:'production',BUD_WHOP_PRODUCTION_ENABLED:'false',BUD_WHOP_PRODUCTION_PROCESSING_ENABLED:'true',BUD_WHOP_PRODUCTION_MODE:'pilot',BUD_WHOP_PILOT_HOST_ID:host,
  WHOP_PRODUCTION_API_KEY:'fixture-whop-key',WHOP_PRODUCTION_COMPANY_ID:'biz_fixture123',WHOP_PRODUCTION_PRODUCT_ID:'prod_fixture123',WHOP_PRODUCTION_PLAN_ID:'plan_fixture123',WHOP_PRODUCTION_CURRENCY:'sar',WHOP_PRODUCTION_AMOUNT_MINOR:'300',WHOP_PRODUCTION_WEBHOOK_SECRET:'ws_'+'x'.repeat(48),WHOP_PRODUCTION_WEBHOOK_API_VERSION:'2026-10-15-1'};
 const order={orderId:id,hostId:host,environment:'production',companyId:configured.WHOP_PRODUCTION_COMPANY_ID,productId:configured.WHOP_PRODUCTION_PRODUCT_ID,planId:configured.WHOP_PRODUCTION_PLAN_ID,currency:'sar',amountMinor:300,locale:'ar',checkoutId:'ch_fixture123',checkoutUrl:'https://whop.com/checkout/ch_fixture123/',fulfilled:false};
 const payment={id:'pay_fixture123',status:'paid',substatus:'succeeded',paid_at:'2026-10-25T20:00:00Z',company:{id:order.companyId},product:{id:order.productId},plan:{id:order.planId},total:3,currency:'sar',refunded_amount:0,auto_refunded:false,refunded_at:null,disputes:[],checkout_configuration_id:order.checkoutId,metadata:{bud_order_id:id,bud_environment:'production'}};
 let calls:string[]=[],alter:Record<string,unknown>={};
 const base=mock((name,body)=>{calls.push(name);if(name==='bud_live_order')return Response.json(order);assert.equal(name,'bud_owner_recover_payment');assert.equal(body.p_order,id);assert.equal(body.p_payment,payment.id);assert.deepEqual(body.p_expected,order);return Response.json({credited:true,replayed:false});});
 const transport:typeof fetch=async(input,init)=>{if(String(input).startsWith('https://api.whop.com/')){assert.equal(init?.method??'GET','GET');return Response.json({...payment,...alter});}return base(input,init);};
 const c=await login(transport),body={...grant,action:'inspectPayment',payload:{orderId:id,paymentId:payment.id}};
 const inspect=await handleOwner(req(body,c),configured,transport);assert.equal(inspect.status,200);assert.equal((await inspect.json()).data.credited,false);assert.deepEqual(calls,['bud_live_order']);
 calls=[];assert.equal((await handleOwner(req({...body,action:'recoverPayment'},c),configured,transport)).status,200);assert.deepEqual(calls,['bud_live_order','bud_owner_recover_payment']);
 for(const change of [{total:4},{checkout_configuration_id:'ch_wrong123'},{status:'failed'},{disputes:[{}]}]){alter=change;calls=[];assert.equal((await handleOwner(req({...body,action:'recoverPayment'},c),configured,transport)).status,409);assert.ok(!calls.includes('bud_owner_recover_payment'));}
});
