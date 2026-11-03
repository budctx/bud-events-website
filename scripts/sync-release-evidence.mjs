#!/usr/bin/env node
/**
 * BU'D: evidence-only GitHub CI -> Vercel -> Notion reconciliation.
 * Never mutates Stages, Gates, Tests, Approvals, payments, or user records.
 * Uses the trusted default-branch script only. No PR checkout or run artifacts.
 */
const REPO = 'budctx/bud-events-website';
const WORKFLOW = 'Website checks';
const NOTION_VERSION = '2025-09-03';
const DS = '09afce51-e031-41f3-9cd3-7b633be79cf6';
const PROJECT = 'prj_yYO1QeZoU8LSs6B56KcrVplxYa0u';
const TEAM = 'team_NMhh6HF2W1chpKCzE1qldNGx';
const limit = 10;
const dry = process.argv.includes('--dry-run');
const env = process.env;
const token = env.NOTION_TOKEN?.trim();
const vercelToken = env.VERCEL_TOKEN?.trim();
const githubToken = env.GITHUB_TOKEN?.trim();
const runOverride = env.SOURCE_WORKFLOW_RUN_ID?.trim();

function required(value, name) {
  if (!value) throw new Error('Missing required configuration: ' + name);
  return value;
}
function text(value) { return [{ type: 'text', text: { content: String(value).slice(0, 1800) } }]; }
function onlyHttp(value) {
  return typeof value === 'string' && /^https:\/\//.test(value) ? value : null;
}
async function request(url, auth, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { authorization: 'Bearer ' + auth,
      accept: 'application/json',
      ...(options.headers || {}) }
  });
  if (!response.ok) {
    // Never log error response bodies; external APIs can echo secrets or user data.
    throw new Error(new URL(url).host + ' request failed: HTTP ' + response.status);
  }
  return response.json();
}
const gh = (path) => request('https://api.github.com' + path, required(githubToken, 'GITHUB_TOKEN'),
  { headers: { 'x-github-api-version': '2022-11-28', accept: 'application/vnd.github+json' } });
const notion = (path, method = 'GET', body) => request('https://api.notion.com/v1' + path,
  required(token, 'NOTION_TOKEN'), {
    method,
    headers: { 'Notion-Version': NOTION_VERSION, 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
const isTrustedRun = (run) => run?.name === WORKFLOW && run?.event === 'push'
  && run?.head_branch === 'main' && run?.status === 'completed'
  && /^[a-f0-9]{40}$/.test(run?.head_sha || '');

async function recentRuns() {
  if (runOverride) {
    if (!/^\d+$/.test(runOverride)) throw new Error('Invalid workflow run ID');
    const run = await gh('/repos/' + REPO + '/actions/runs/' + runOverride);
    return isTrustedRun(run) ? [run] : [];
  }
  const data = await gh('/repos/' + REPO +
    '/actions/workflows/ci.yml/runs?branch=main&event=push&status=completed&per_page=30');
  return (data.workflow_runs || []).filter(isTrustedRun).slice(0, limit);
}
async function deployments() {
  if (!vercelToken) return null;
  const params = new URLSearchParams({ projectId: PROJECT, teamId: TEAM,
    target: 'production', limit: '100' });
  const response = await request('https://api.vercel.com/v7/deployments?' + params,
    vercelToken);
  return response.deployments || [];
}
function deploymentFor(sha, list) {
  if (list === null) return { status: 'NOT_CONFIGURED', url: null,
    note: 'VERCEL_TOKEN is not configured.' };
  const found = list.find(d => d?.meta?.githubCommitSha === sha &&
    d?.meta?.githubCommitRef === 'main' && d?.target === 'production');
  if (!found) return { status: 'NOT_FOUND', url: null,
    note: 'No same-SHA production deployment in the latest 100 deployments; not proof of non-deployment.' };
  const status = found.state === 'READY' ? 'READY'
    : found.state === 'ERROR' ? 'ERROR' : 'BUILDING';
  return { status, url: found.url ? onlyHttp('https://' + found.url) : null,
    note: 'Vercel deployment ' + (found.id || 'unknown') + ' (metadata SHA matched).' };
}
function properties(run, deploy) {
  const outcome = ['success', 'failure', 'cancelled'].includes(run.conclusion)
    ? run.conclusion : 'other';
  const label = 'CI #' + run.id + ' / ' + run.head_sha.slice(0, 8);
  return {
    Name: { title: text(label) },
    'Run ID': { rich_text: text(run.id) },
    'Commit SHA': { rich_text: text(run.head_sha) },
    CI: { select: { name: outcome } },
    Deploy: { select: { name: deploy.status } },
    'GitHub Run': { url: onlyHttp(run.html_url) },
    'Deployment URL': { url: deploy.url },
    Environment: { select: { name: 'production' } },
    'Observed At': { date: { start: new Date().toISOString() } },
    Notes: { rich_text: text('Automated evidence only; no Stage/Gate approval. ' + deploy.note) }
  };
}
async function findExisting(id) {
  const result = await notion('/data_sources/' + DS + '/query', 'POST', {
    filter: { property: 'Run ID', rich_text: { equals: String(id) } },
    page_size: 2
  });
  if ((result.results || []).length > 1) throw new Error('Duplicate Notion run ID: ' + id);
  return result.results?.[0]?.id || null;
}
async function upsert(run, deploy) {
  const data = properties(run, deploy);
  if (dry) { console.log(JSON.stringify({ run: run.id, sha: run.head_sha,
    ci: run.conclusion, deployment: deploy.status, url: deploy.url })); return; }
  const existing = await findExisting(run.id);
  if (existing) {
    await notion('/pages/' + existing, 'PATCH', { properties: data });
  } else {
    await notion('/pages', 'POST', {
      parent: { type: 'data_source_id', data_source_id: DS },
      properties: { ...data, 'Manual Review': { checkbox: false } }
    });
  }
  console.log('Evidence ' + (existing ? 'updated' : 'created') + ' for run #' + run.id +
    ', CI=' + run.conclusion + ', deployment=' + deploy.status);
}
async function main() {
  required(githubToken, 'GITHUB_TOKEN');
  if (!dry) required(token, 'NOTION_TOKEN');
  const runs = await recentRuns();
  const list = await deployments();
  for (const run of runs) await upsert(run, deploymentFor(run.head_sha, list));
  console.log('Reconciled ' + runs.length + ' trusted main/push runs.');
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
