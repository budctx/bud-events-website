import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
export const REQUIRED_GATES = Object.freeze([
  ['scope-approval', 'owner-approval', 30], ['policy-approval', 'owner-approval', 30],
  ['auth-provider', 'live-provider', 7], ['payment-provider', 'live-provider', 7],
  ['provider-config', 'config-readback', 7], ['schema-security', 'remote-database', 7],
  ['concurrency', 'remote-multi-connection', 7], ['restore', 'remote-restore', 30],
  ['monitoring', 'live-alert', 7], ['content', 'content-approval', 30],
  ['integration', 'live-end-to-end', 7], ['field-trial', 'live-field-trial', 30],
  ['ci', 'ci-run', 7], ['release', 'deploy-readback', 1],
  ['smoke', 'live-smoke', 1], ['commercial-approval', 'owner-approval', 7],
].map(([id, kind, maxAgeDays]) => Object.freeze({ id, kind, maxAgeDays })));
const shaPattern = /^[a-f0-9]{40}$/;
const allowed = (object, keys) => object && typeof object === 'object' && !Array.isArray(object) && Object.keys(object).every(key => keys.includes(key));
export function safeEvidenceUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash) return false;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || !host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':')) return false;
    if (/(?:token|secret|password|access[_-]?key|authorization|credential|eyJ[a-zA-Z0-9_-]{12})/i.test(url.pathname)) return false;
    return true;
  } catch { return false; }
}
/** Structural attestation validation only: does not fetch evidence or certify its truth. */
export function validateLaunchReadiness(manifest, { expectedSha, now = new Date() } = {}) {
  const blockers = [];
  const fail = (gate, code) => blockers.push({ gate, code });
  if (!shaPattern.test(expectedSha ?? '')) fail('manifest', 'EXACT_EXPECTED_SHA_REQUIRED');
  if (!allowed(manifest, ['schemaVersion', 'releaseSha', 'environment', 'gates']) || manifest.schemaVersion !== 1 || manifest.environment !== 'production' || !Array.isArray(manifest.gates)) fail('manifest', 'INVALID_MANIFEST');
  if (!shaPattern.test(manifest?.releaseSha ?? '') || manifest.releaseSha !== expectedSha) fail('manifest', 'RELEASE_SHA_MISMATCH');
  const nowMs = new Date(now).getTime();
  if (!Number.isFinite(nowMs)) fail('manifest', 'INVALID_VALIDATION_TIME');
  const entries = Array.isArray(manifest?.gates) ? manifest.gates : [];
  const known = new Set(REQUIRED_GATES.map(gate => gate.id));
  if (entries.some(entry => !entry || !known.has(entry.id))) fail('manifest', 'UNKNOWN_GATE');
  const gates = REQUIRED_GATES.map(definition => {
    const matches = entries.filter(entry => entry?.id === definition.id);
    if (matches.length !== 1) { fail(definition.id, matches.length ? 'DUPLICATE_GATE' : 'MISSING_GATE'); return { id: definition.id, passed: false }; }
    const gate = matches[0];
    const before = blockers.length;
    if (!allowed(gate, ['id', 'status', 'evidence']) || !['passed', 'pending', 'blocked'].includes(gate.status)) fail(definition.id, 'INVALID_GATE');
    if (gate.status !== 'passed') fail(definition.id, 'GATE_NOT_PASSED');
    const evidence = gate.evidence;
    if (!Array.isArray(evidence) || evidence.length === 0 || evidence.length > 20) fail(definition.id, 'EVIDENCE_REQUIRED');
    else for (const item of evidence) {
      if (!allowed(item, ['url', 'kind', 'sha', 'recordedAt', 'environment'])) { fail(definition.id, 'INVALID_EVIDENCE'); continue; }
      if (!safeEvidenceUrl(item.url)) fail(definition.id, 'UNSAFE_EVIDENCE_URL');
      if (item.kind !== definition.kind) fail(definition.id, 'PROOF_KIND_MISMATCH');
      if (item.sha !== expectedSha || !shaPattern.test(item.sha ?? '')) fail(definition.id, 'EVIDENCE_SHA_MISMATCH');
      if (item.environment !== (definition.id === 'ci' ? 'ci' : 'production')) fail(definition.id, 'PRODUCTION_PROOF_REQUIRED');
      const at = typeof item.recordedAt === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(item.recordedAt) ? Date.parse(item.recordedAt) : NaN;
      if (!Number.isFinite(at) || !Number.isFinite(nowMs)) fail(definition.id, 'INVALID_EVIDENCE_TIME');
      else if (at > nowMs + 60000) fail(definition.id, 'FUTURE_EVIDENCE');
      else if (nowMs - at > definition.maxAgeDays * 86400000) fail(definition.id, 'STALE_EVIDENCE');
    }
    return { id: definition.id, passed: before === blockers.length };
  });
  return { schemaVersion: 1, releaseSha: shaPattern.test(expectedSha ?? '') ? expectedSha : null, checkedAt: Number.isFinite(nowMs) ? new Date(nowMs).toISOString() : null, commercialReady: blockers.length === 0, scope: 'manifest-attestations-only', independentEvidenceReviewRequired: true, gates, blockers };
}
export async function readinessCli(args = process.argv.slice(2)) {
  const get = name => { const index = args.indexOf(name); return index === -1 ? undefined : args[index + 1]; };
  let report;
  try { const raw = await readFile(get('--manifest') ?? 'config/launch-readiness.example.json', 'utf8'); if (raw.length > 262144) throw new Error(); report = validateLaunchReadiness(JSON.parse(raw), { expectedSha: get('--sha') }); }
  catch { report = { schemaVersion: 1, commercialReady: false, scope: 'manifest-attestations-only', independentEvidenceReviewRequired: true, gates: [], blockers: [{ gate: 'manifest', code: 'MANIFEST_UNREADABLE' }] }; }
  const output = JSON.stringify(report, null, 2) + '\n';
  if (get('--out')) await writeFile(get('--out'), output); else process.stdout.write(output);
  return report.commercialReady ? 0 : 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await readinessCli();
