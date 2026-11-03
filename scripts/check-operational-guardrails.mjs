#!/usr/bin/env node
/**
 * Fail-closed regression guard for deployment/security configuration.
 * No secrets, network calls or production database access.
 */
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const load = path => readFileSync(path, 'utf8');
const config = JSON.parse(load('vercel.json'));
const ci = load('.github/workflows/ci.yml');
const sync = load('.github/workflows/notion-release-evidence.yml');

const headerGroup = config.headers?.find(entry => entry.source === '/(.*)');
const apiHeaderGroup = config.headers?.find(entry => entry.source === '/api/(.*)');
const headers = new Map((headerGroup?.headers || []).map(h => [h.key.toLowerCase(), h.value]));
const apiHeaders = new Map((apiHeaderGroup?.headers || []).map(h => [h.key.toLowerCase(), h.value]));
const required = {
  'content-security-policy': ["default-src 'self'", "script-src 'self'", "object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'"],
  'x-content-type-options': ['nosniff'],
  'x-frame-options': ['DENY'],
  'referrer-policy': ['strict-origin-when-cross-origin']
};
for (const [key, clauses] of Object.entries(required)) {
  assert.ok(headers.has(key), 'Missing security header: ' + key);
  for (const clause of clauses) assert.ok(headers.get(key).includes(clause), 'Missing ' + clause + ' in ' + key);
}
assert.equal(apiHeaders.get('cache-control'), 'no-store', 'API routes must not cache sensitive responses');
assert.equal(apiHeaders.get('x-robots-tag'), 'noindex, nofollow');

const cronPaths = (config.crons || []).map(item => item.path);
assert.equal(cronPaths.length, 2, 'Financial cron count changed: review before deployment');
assert.deepEqual([...cronPaths].sort(), ['/api/payment-reconcile', '/api/payment-worker']);
for (const entry of config.crons) assert.match(entry.schedule, /^([\d*\/,\-]+\s+){4}[\d*\/,\-]+$/);

assert.match(ci, /permissions:\s*\n\s*contents:\s*read\b/, 'CI GITHUB_TOKEN must stay read-only');
assert.doesNotMatch(ci, /\bpull_request_target\b/, 'Untrusted PRs must not get privileged CI context');
assert.match(ci, /persist-credentials:\s*false/g);
assert.match(ci, /node --check scripts\/sync-release-evidence\.mjs/);

assert.match(sync, /permissions:\s*\n\s*contents:\s*read\s*\n\s*actions:\s*read\b/);
assert.doesNotMatch(sync, /\bpull_request_target\b/);
assert.match(sync, /ref:\s*main\b/, 'Evidence workflow must execute trusted main');
assert.match(sync, /persist-credentials:\s*false/);
assert.match(sync, /BUD_NOTION_TOKEN/);
assert.match(sync, /BUD_VERCEL_READ_TOKEN/);

console.log('Operational guardrails: PASS (config invariants only; not a security audit or backup restore).');
