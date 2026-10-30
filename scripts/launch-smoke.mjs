import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
export const CANONICAL_ORIGIN = 'https://budteam.net';
/** Non-authenticated probes only. Never signs in, starts an event, charges, or sends cookies. */
export async function runLaunchSmoke({ mode = 'maintenance', baseUrl = CANONICAL_ORIGIN, transport = fetch } = {}) {
  if (!['maintenance', 'commercial'].includes(mode) || baseUrl !== CANONICAL_ORIGIN) return { schemaVersion: 1, mode: 'invalid', smokePassed: false, commercialReady: false, checks: [], blockers: ['INVALID_SMOKE_CONFIGURATION'] };
  const checks = [];
  const probe = async (id, path, options, verify) => {
    try {
      const response = await transport(CANONICAL_ORIGIN + path, { redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(10000), ...options });
      const content = (await response.text()).slice(0, 1048576);
      checks.push({ id, passed: verify(response, content), status: response.status });
    } catch { checks.push({ id, passed: false, status: null }); }
  };
  for (const [id, path] of [['home', '/?lang=ar'], ['events', '/?screen=events&lang=ar'], ['host-shell', '/?screen=host&lang=ar']]) await probe(id, path, {}, (response, body) => response.status === 200 && response.headers.get('content-type')?.includes('text/html') && body.includes('id="root"'));
  await probe('robots', '/robots.txt', {}, (response, body) => response.status === 200 && body.includes('Disallow: /api/'));
  await probe('session-boundary', '/api/auth?action=session', {}, (response, body) => {
    try { const result = JSON.parse(body); return response.status === (mode === 'maintenance' ? 503 : 401) && result.code === (mode === 'maintenance' ? 'AUTH_NOT_CONFIGURED' : 'DISCORD_AUTH_REQUIRED') && result.data === undefined && response.headers.get('cache-control')?.includes('no-store'); } catch { return false; }
  });
  await probe('host-boundary', '/api/host', { method: 'POST', headers: { Origin: CANONICAL_ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'dashboard' }) }, (response, body) => {
    try { const result = JSON.parse(body); return response.status === (mode === 'maintenance' ? 503 : 401) && result.code === (mode === 'maintenance' ? 'BACKEND_NOT_CONFIGURED' : 'DISCORD_AUTH_REQUIRED') && result.data === undefined && response.headers.get('cache-control')?.includes('no-store'); } catch { return false; }
  });
  return { schemaVersion: 1, mode, smokePassed: checks.every(check => check.passed), commercialReady: false, scope: 'public-and-unauthenticated-boundaries-only', checks, blockers: checks.filter(check => !check.passed).map(check => check.id) };
}
export async function smokeCli(args = process.argv.slice(2)) {
  const get = name => { const index = args.indexOf(name); return index === -1 ? undefined : args[index + 1]; };
  const report = await runLaunchSmoke({ mode: get('--mode') ?? 'maintenance' });
  const output = JSON.stringify(report, null, 2) + '\n';
  if (get('--out')) await writeFile(get('--out'), output); else process.stdout.write(output);
  return report.smokePassed ? 0 : 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await smokeCli();
