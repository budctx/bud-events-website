import test from 'node:test';
import assert from 'node:assert/strict';
import { handleCheckoutRoute, handleHostRoute, handleWebhookRoute } from '../server/commerce-routing.ts';
import { liveAudience, liveHostAllowed } from '../server/live-access.ts';
import { checkoutDestination } from '../src/checkout-destination.ts';
const host = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
test('server-owned live selection cannot be enabled by browser fields and never falls back to Sandbox', async () => {
  const noNetwork:typeof fetch=async()=>{assert.fail('no disabled route may reach network');};
  const request=()=>new Request('https://bud-events-website.vercel.app/api/checkout?environment=production',{method:'POST',headers:{'x-bud-commerce-mode':'live','content-type':'application/json'},body:JSON.stringify({mode:'live'})});
  for(const handler of [handleCheckoutRoute,handleHostRoute,handleWebhookRoute]) {
    for(const env of [{},{BUD_COMMERCE_MODE:'typo'},{BUD_COMMERCE_MODE:'live',VERCEL_ENV:'preview',WHOP_ENVIRONMENT:'production'},
      {BUD_COMMERCE_MODE:'live',VERCEL_ENV:'production',WHOP_ENVIRONMENT:'sandbox'},
      {BUD_COMMERCE_MODE:'live',VERCEL_ENV:'production',WHOP_ENVIRONMENT:'production'}]) {
      assert.equal((await handler(request(),env,noNetwork)).status,503);
    }
  }
});
test('public scope needs an independent server flag and only accepts verified UUID identities',()=>{
  assert.equal(liveAudience({BUD_WHOP_PRODUCTION_MODE:'public'}),null);
  assert.equal(liveAudience({BUD_WHOP_PRODUCTION_MODE:'public',BUD_PUBLIC_COMMERCE_ENABLED:'true'}),'public');
  assert.equal(liveHostAllowed(other,{BUD_WHOP_PRODUCTION_MODE:'pilot',BUD_WHOP_PILOT_HOST_ID:host}),false);
  assert.equal(liveHostAllowed(host,{BUD_WHOP_PRODUCTION_MODE:'pilot',BUD_WHOP_PILOT_HOST_ID:host}),true);
  assert.equal(liveHostAllowed(other,{BUD_WHOP_PRODUCTION_MODE:'public',BUD_PUBLIC_COMMERCE_ENABLED:'true'}),true);
  assert.equal(liveHostAllowed('anonymous',{BUD_WHOP_PRODUCTION_MODE:'public',BUD_PUBLIC_COMMERCE_ENABLED:'true'}),false);
});
test('checkout navigation requires an exact session URL bound to the server response environment',()=>{
  const live='https://whop.com/checkout/ch_fixture123/',sandbox='https://sandbox.whop.com/checkout/ch_fixture123/';
  assert.equal(checkoutDestination(live,'production'),live);
  assert.equal(checkoutDestination(sandbox,'sandbox'),sandbox);
  assert.equal(checkoutDestination(sandbox,undefined),sandbox);
  for(const [url,mode] of [[live,undefined],[live,'sandbox'],[sandbox,'production'],[live,'public'],
    ['https://whop.com/checkout/plan_fixture123/','production'],['https://whop.com/checkout/ch_fixture123/?price=1','production'],
    ['https://whop.com/checkout/ch_fixture123/#success','production'],['https://secret@whop.com/checkout/ch_fixture123/','production'],
    ['https://evil.test/checkout/ch_fixture123/','production'],['/checkout/ch_fixture123/','production']]) assert.equal(checkoutDestination(url,mode),null);
});
