import test from 'node:test';
import assert from 'node:assert/strict';
import { checkoutDestination } from '../src/checkout-destination.ts';
import { assertProductionCheckoutUrl } from '../server/whop-production.ts';

const session = 'ch_production123';
const plan = 'plan_production123';
const official = 'https://whop.com/checkout/' + plan + '?session=' + session;

test('Whop documented plan/session purchase URL remains bound to its session and expected plan', () => {
  assert.equal(checkoutDestination(official, 'production'), official);
  assert.doesNotThrow(() => assertProductionCheckoutUrl(session, official, plan));
  assert.equal(checkoutDestination(official, 'sandbox'), null);
});

test('direct plans and unrelated sessions cannot bypass Whop destination verification', () => {
  for (const url of [
    'https://whop.com/checkout/' + plan,
    official + '&return=https://other.example',
    'https://whop.com/checkout/' + plan + '?session=ch_unrelated123',
    'https://whop.com.evil.example/checkout/' + plan + '?session=' + session,
    official + '#success',
  ]) {
    if (url.includes('ch_unrelated123')) {
      assert.equal(checkoutDestination(url, 'production'), url);
      assert.throws(() => assertProductionCheckoutUrl(session, url, plan));
    } else {
      assert.equal(checkoutDestination(url, 'production'), null);
      assert.throws(() => assertProductionCheckoutUrl(session, url, plan));
    }
  }
  assert.throws(() => assertProductionCheckoutUrl(session, official, 'plan_different123'));
});

test('existing Whop session links remain supported for persisted checkout orders', () => {
  const legacy = 'https://whop.com/checkout/' + session + '/';
  assert.equal(checkoutDestination(legacy, 'production'), legacy);
  assert.doesNotThrow(() => assertProductionCheckoutUrl(session, legacy, plan));
});
