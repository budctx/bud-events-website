import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore JavaScript operational script deliberately consumed by Node.
import { REQUIRED_GATES, safeEvidenceUrl, validateLaunchReadiness } from '../scripts/launch-readiness.mjs';
// @ts-ignore JavaScript operational script deliberately consumed by Node.
import { CANONICAL_ORIGIN, runLaunchSmoke } from '../scripts/launch-smoke.mjs';
const sha = 'a'.repeat(40);
const now = new Date('2026-10-23T12:00:00Z');
const complete = () => ({ schemaVersion: 1, releaseSha: sha, environment: 'production', gates: REQUIRED_GATES.map((gate: { id: string; kind: string }) => ({ id: gate.id, status: 'passed', evidence: [{ url: 'https://github.com/budctx/bud-events-website/actions/runs/123', kind: gate.kind, sha, recordedAt: '2026-10-23T11:00:00Z', environment: gate.id === 'ci' ? 'ci' : 'production' }] })) });
test('commercial readiness fails closed for absent evidence and never echoes input secrets', () => {
  const report = validateLaunchReadiness({ secret: 'do-not-echo-this', gates: [] }, { expectedSha: sha, now });
  assert.equal(report.commercialReady, false); assert.ok(report.blockers.length >= REQUIRED_GATES.length);
  assert.ok(!JSON.stringify(report).includes('do-not-echo-this'));
  assert.equal(validateLaunchReadiness(complete(), { now }).commercialReady, false);
});
test('all exact-version attestations are required, with explicit independent-review boundary', () => {
  const report = validateLaunchReadiness(complete(), { expectedSha: sha, now });
  assert.equal(report.commercialReady, true); assert.equal(report.scope, 'manifest-attestations-only'); assert.equal(report.independentEvidenceReviewRequired, true);
  const data = complete(); data.gates.pop(); assert.equal(validateLaunchReadiness(data, { expectedSha: sha, now }).commercialReady, false);
});
test('local tests cannot stand in for live provider, concurrency, or remote restore proof', () => {
  for (const id of ['auth-provider', 'payment-provider', 'concurrency', 'restore']) {
    const data = complete(); const gate = data.gates.find((item: { id: string }) => item.id === id)!;
    gate.evidence[0].kind = 'local-unit-test'; gate.evidence[0].environment = 'local';
    const report = validateLaunchReadiness(data, { expectedSha: sha, now }); assert.equal(report.commercialReady, false); assert.ok(report.blockers.some((item: { code: string }) => item.code === 'PROOF_KIND_MISMATCH'));
  }
});
test('rejects stale, future, wrong-version, duplicate and malformed evidence', () => {
  for (const mutate of [(data: ReturnType<typeof complete>) => { data.gates[0].evidence[0].sha = 'b'.repeat(40); }, (data: ReturnType<typeof complete>) => { data.gates[0].evidence[0].recordedAt = '2025-10-23T11:00:00Z'; }, (data: ReturnType<typeof complete>) => { data.gates[0].evidence[0].recordedAt = '2027-10-23T11:00:00Z'; }, (data: ReturnType<typeof complete>) => { data.gates.push(data.gates[0]); }, (data: ReturnType<typeof complete>) => { data.gates[0].status = 'not-applicable'; }]) { const data = complete(); mutate(data); assert.equal(validateLaunchReadiness(data, { expectedSha: sha, now }).commercialReady, false); }
  assert.equal(validateLaunchReadiness(null, { expectedSha: sha, now }).commercialReady, false);
});
test('evidence links reject insecure, credential-bearing, local and secret-query URLs', () => {
  for (const url of ['http://example.com/proof', 'https://user:pass@example.com/proof', 'https://example.com/proof?token=abc', 'https://127.0.0.1/proof', 'https://localhost/proof', 'https://example.com/secret/abc', 'https://[::1]/proof']) assert.equal(safeEvidenceUrl(url), false);
  assert.equal(safeEvidenceUrl('https://app.notion.com/p/401b475e25f18133bdedc0fab9ee1287'), true);
});
test('smoke limits targets, omits credentials and distinguishes disabled maintenance from readiness', async () => {
  const calls: { url: string; options: RequestInit }[] = [];
  const transport = async (url: string, options: RequestInit) => { calls.push({ url, options }); if (url.includes('/api/')) return Response.json({ code: url.includes('/auth') ? 'AUTH_NOT_CONFIGURED' : 'BACKEND_NOT_CONFIGURED' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); if (url.endsWith('robots.txt')) return new Response('Disallow: /api/'); return new Response('<div id="root"></div>', { headers: { 'Content-Type': 'text/html' } }); };
  const maintenance = await runLaunchSmoke({ transport }); assert.equal(maintenance.smokePassed, true); assert.equal(maintenance.commercialReady, false);
  assert.ok(calls.every(call => call.url.startsWith(CANONICAL_ORIGIN) && call.options.credentials === 'omit' && call.options.redirect === 'error'));
  assert.equal((await runLaunchSmoke({ mode: 'commercial', transport })).smokePassed, false);
  assert.equal((await runLaunchSmoke({ baseUrl: 'https://example.com', transport })).smokePassed, false);
});
