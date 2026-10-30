import test from 'node:test';
import assert from 'node:assert/strict';
import {handleOwnerMonitor} from '../server/owner-monitor.ts';
const origin='https://budteam.net',id='11111111-1111-4111-8111-111111111111',lease='22222222-2222-4222-8222-222222222222';
const env={BUD_OWNER_MONITOR_ENABLED:'true',BUD_BACKEND_ENABLED:'true',SUPABASE_URL:'https://cepmvqqrjcvhyzszqand.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture-service',VERCEL_ENV:'production',CRON_SECRET:'fixture_cron_token_01234567890123456789',BUD_APP_ORIGIN:origin,BUD_OWNER_HOST_ID:id,BUD_OWNER_DISCORD_ID:'123456789012345678',BUD_OWNER_ALERT_STALE_SECONDS:'300',BUD_OWNER_ALERT_ESCALATION_SECONDS:'900',RESEND_API_KEY:'fixture-resend-secret',BUD_OWNER_ALERT_FROM:'alerts@example.test',BUD_OWNER_ALERT_TO:'owner@example.test'};
const request=(token=env.CRON_SECRET)=>new Request(origin+'/api/owner-monitor',{headers:{authorization:'Bearer '+token}});
test('monitor never contacts providers without operator authorization and explicit configured channel',async()=>{
 const none:typeof fetch=async()=>{throw new Error('unexpected network');};
 assert.equal((await handleOwnerMonitor(request('bad'),env,none)).status,401);
 assert.equal((await handleOwnerMonitor(request(),{...env,BUD_OWNER_MONITOR_ENABLED:'false'},none)).status,200);
 assert.equal((await handleOwnerMonitor(request(),{...env,BUD_OWNER_ALERT_TO:''},none)).status,503);
});
test('monitor uses a durable provider idempotency key and reports acceptance separately from delivery',async()=>{
 const keys:string[]=[],outcomes:any[]=[];let fail=false;
 const transport:typeof fetch=async(input,init)=>{
  const url=String(input),body=JSON.parse(String(init?.body));
  if(url==='https://api.resend.com/emails'){
   const headers=new Headers(init?.headers);keys.push(headers.get('idempotency-key')!);assert.equal(headers.get('authorization'),'Bearer '+env.RESEND_API_KEY);
   assert.doesNotMatch(body.text,/fixture-service|fixture-resend|BUD-[A-Z2-7]{32}/);assert.deepEqual(body.to,[env.BUD_OWNER_ALERT_TO]);
   return fail?Response.json({message:'provider-private-body'},{status:500}):Response.json({id});
  }
  if(url.endsWith('/bud_owner_sync_alerts'))return Response.json({refreshed:true});
  if(url.endsWith('/bud_owner_claim_notification'))return Response.json({id,lease,severity:'P0',kind:'payment_delivery_delayed',subject:'msg_fixture123',cycle:'2026-10-25T20:00:00Z',generation:1});
  assert.ok(url.endsWith('/bud_owner_finish_notification'));outcomes.push(body);return Response.json({recorded:true});
 };
 const res=await handleOwnerMonitor(request(),env,transport);assert.equal(res.status,200);assert.deepEqual((await res.json()).data,{processed:1,accepted:true,delivered:false});
 fail=true;const retry=await handleOwnerMonitor(request(),env,transport);assert.equal(retry.status,503);assert.doesNotMatch(await retry.text(),/provider-private-body/);
 assert.equal(keys[0],keys[1]);assert.equal(outcomes[1].p_provider,null);assert.equal(outcomes[1].p_retry,true);
});
