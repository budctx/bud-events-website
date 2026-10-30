import test from 'node:test';
import assert from 'node:assert/strict';
import { enforceRateLimit } from '../server/rate-limit.ts';
import { handleAuth } from '../server/auth.ts';
const env={VERCEL:'1',BUD_RATE_LIMIT_ENABLED:'true',BUD_RATE_LIMIT_SECRET:'test-only-rate-key-at-least-32-bytes',SUPABASE_URL:'https://cepmvqqrjcvhyzszqand.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'private-test-key'};
const request=(ip='192.0.2.1')=>new Request('https://budteam.net/api/host',{headers:{'x-vercel-forwarded-for':ip}});
test('limiter uses fixed server endpoint, keyed pseudonyms and isolated scope',async()=>{
 const buckets:string[]=[];
 const transport:typeof fetch=async(url,init)=>{assert.equal(String(url),env.SUPABASE_URL+'/rest/v1/rpc/bud_consume_rate_limit');const body=JSON.parse(String(init?.body));assert.match(body.p_bucket,/^[a-f0-9]{64}$/);assert.ok(!String(init?.body).includes('192.0.2.1'));assert.equal(init?.redirect,'error');buckets.push(body.p_bucket);return Response.json({allowed:true,retryAfter:0});};
 assert.equal(await enforceRateLimit(request(),env,transport,'host'),null);
 await enforceRateLimit(request(),env,transport,'host');
 await enforceRateLimit(request(),env,transport,'auth-signin');
 await enforceRateLimit(request('2001:db8::1'),env,transport,'host');
 await enforceRateLimit(request('2001:0db8:0:0:0:0:0:1'),env,transport,'host');
 assert.equal(buckets[0],buckets[1]);assert.notEqual(buckets[0],buckets[2]);assert.equal(buckets[3],buckets[4]);
});
test('limiter rejects missing configuration, untrusted proxy chains and unavailable counters',async()=>{
 const never:typeof fetch=async()=>assert.fail('No upstream permitted');
 for(const patch of [{BUD_RATE_LIMIT_ENABLED:'false'},{VERCEL:'0'},{BUD_RATE_LIMIT_SECRET:'short'},{SUPABASE_URL:'https://evil.example'}])assert.equal((await enforceRateLimit(request(),{...env,...patch},never,'host'))?.status,503);
 for(const ip of ['','192.0.2.1, 192.0.2.2','forged'])assert.equal((await enforceRateLimit(request(ip),env,never,'host'))?.status,503);
 for(const transport of [async()=>new Response('private',{status:500}),async()=>Response.json({allowed:'yes',retryAfter:0}),async()=>new Response('x'.repeat(5000)),async()=>{throw Error('secret');}] as (typeof fetch)[]) {
  const result=await enforceRateLimit(request(),env,transport,'host');assert.equal(result?.status,503);assert.equal((await result?.json()).code,'RATE_LIMIT_UNAVAILABLE');
 }
});
test('rate rejection returns Retry-After; logout still clears local cookies',async()=>{
 const blocked:typeof fetch=async()=>Response.json({allowed:false,retryAfter:28});
 const result=await enforceRateLimit(request(),env,blocked,'host');assert.equal(result?.status,429);assert.equal(result?.headers.get('Retry-After'),'28');
 const origin='https://budteam.net';
 const logout=await handleAuth(new Request(origin+'/api/auth?action=logout',{method:'POST',headers:{origin,'x-vercel-forwarded-for':'192.0.2.1'}}),{...env,BUD_AUTH_ENABLED:'true',SUPABASE_PUBLISHABLE_KEY:'test',BUD_APP_ORIGIN:origin,BUD_AUTH_COOKIE_SECRET:'test-cookie-secret-at-least-32-bytes'},blocked);
 assert.equal(logout.status,429);assert.equal(logout.headers.getSetCookie().length,2);
});
