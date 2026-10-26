import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAuth } from '../server/auth.ts';
import { handleHost,handleLiveHost } from '../server/host.ts';
import { initialManualState, manualGameReducer } from '../src/manual-game.ts';
const origin = 'https://bud-events-website.vercel.app';
const project = 'https://cepmvqqrjcvhyzszqand.supabase.co';
const id = '11111111-1111-4111-8111-111111111111';
const eventId = '22222222-2222-4222-8222-222222222222';
const env = { BUD_AUTH_ENABLED: 'true', BUD_BACKEND_ENABLED: 'true', BUD_APP_ORIGIN: origin, SUPABASE_URL: project,
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_mock', SUPABASE_SERVICE_ROLE_KEY: 'server-only-test-secret', BUD_AUTH_COOKIE_SECRET: 'test-only-secret-not-a-real-secret-0123456789',VERCEL:'1', BUD_RATE_LIMIT_ENABLED:'true',BUD_RATE_LIMIT_SECRET:'test-rate-secret-never-live-0123456789' };
const key = 'test-idempotency-key-12345';
const state = manualGameReducer(initialManualState(), { type: 'start', config: { duration: 5, timerEnabled: true, attempts: 2 }, prizeText: 'Gift\nGift' });
const event = { eventId, title: 'Event', phase: 'active', version: 1, state };
const user = { id, identities: [{ provider: 'discord' }] };
type Call = { name: string; body: Record<string, unknown> };
function mock(handler: (name: string, body: Record<string, unknown>) => Response | Promise<Response> = () => Response.json({}), calls: Call[] = []): typeof fetch {
  return async (input, init) => {
    const url = String(input); assert.ok(url.startsWith(project));
    if(url.endsWith('/rpc/bud_consume_rate_limit'))return Response.json({allowed:true,retryAfter:0});
    if (url.endsWith('/auth/v1/user')) return Response.json(user);
    if (url.includes('/auth/v1/token')) return Response.json({ access_token: 'valid-test-access-token-long-enough', refresh_token: 'valid-test-refresh-token', expires_in: 3600 });
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY);
    assert.equal(init?.redirect, 'error'); assert.ok(init?.signal);
    const name = url.split('/').at(-1)!; const body = JSON.parse(String(init?.body)); calls.push({ name, body });
    return handler(name, body);
  };
}
async function session() {
  const transport = mock();
  const begin = await handleAuth(new Request(origin + '/api/auth?action=signin', { method: 'POST', headers: { origin, 'x-vercel-forwarded-for':'192.0.2.1' } }), env, transport);
  const redirect = new URL(new URL((await begin.json()).data.url).searchParams.get('redirect_to')!); redirect.searchParams.set('code', 'code');
  const callback = await handleAuth(new Request(redirect, { headers: { 'x-vercel-forwarded-for':'192.0.2.1', cookie: begin.headers.getSetCookie()[0].split(';')[0] } }), env, transport);
  return callback.headers.getSetCookie().find(value => value.startsWith('__Host-bud-session='))!.split(';')[0];
}
function request(payload: unknown, cookie?: string, requestOrigin = origin) {
  return new Request(origin + '/api/host', { method: 'POST', headers: { 'x-vercel-forwarded-for':'192.0.2.1', origin: requestOrigin, 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(payload) });
}
test('host APIs fail closed and enforce POST, exact origin, JSON and session', async () => {
  assert.equal((await handleHost(new Request(origin + '/api/host'), env)).status, 405);
  assert.equal((await handleHost(request({ action: 'dashboard' }), { ...env, BUD_BACKEND_ENABLED: 'false' })).status, 503);
  assert.equal((await handleHost(request({ action: 'dashboard' }, undefined, 'https://evil.example'), env)).status, 403);
  assert.equal((await handleHost(new Request(origin + '/api/host', { method: 'POST', headers: { origin, 'x-vercel-forwarded-for':'192.0.2.1' } }), env)).status, 415);
  assert.equal((await handleHost(request({ action: 'dashboard' }), env, mock())).status, 401);
});
test('dashboard and resume derive tenant from verified cookie, reject client authority and extra fields', async () => {
  const cookie = await session(); const calls: Call[] = [];
  const transport = mock((name, body) => { assert.equal(body.p_host, id); return Response.json(name === 'bud_host_dashboard' ? { credits: 2, events: [] } : event); }, calls);
  const dashboard = await handleHost(request({ action: 'dashboard' }, cookie), env, transport);
  assert.equal(dashboard.status, 200); assert.deepEqual((await dashboard.json()).data, { credits: 2, events: [] });
  assert.equal((await handleHost(request({ action: 'resume', eventId }, cookie), env, transport)).status, 200);
  for (const bad of [{ action: 'dashboard', hostId: eventId }, { action: 'start', credits: 100 }, { action: 'resume', eventId, state }, { action: 'resume', eventId: 'bad' }]) {
    assert.equal((await handleHost(request(bad, cookie), env, transport)).status, 400);
  }
  assert.deepEqual(calls.map(call => call.name), ['bud_host_dashboard', 'bud_host_resume']);
});
test('start validates config and prizes, computes initial state and stable normalized fingerprint', async () => {
  const cookie = await session(); const calls: Call[] = [];
  const catalog = { version: 'qc-approved-v1', pairs: [['0','0'], ['1','1'], ['2','2']], questionCount: 3, conditionCount: 3 };
  const transport = mock(name => Response.json(name === 'bud_host_draw_catalog' ? catalog : event), calls);
  const start = { action: 'start', idempotencyKey: key, title: '  Event  ', config: { duration: 5, timerEnabled: true, attempts: 2 }, prizeText: ' Gift\r\n\nGift ' };
  assert.equal((await handleHost(request(start, cookie), env, transport)).status, 200);
  assert.equal(calls[1].body.p_title, 'Event'); assert.deepEqual(calls.slice(0,2).map(c => c.name), ['bud_host_draw_catalog', 'bud_host_start_draw']);
  assert.equal(calls[1].body.p_content_id, catalog.version);
  const persisted = calls[1].body.p_state as typeof state & { activityDraw: { current: { pair: string[] }; draw: { history: unknown[] } } };
  assert.equal(persisted.phase, state.phase);
  assert.equal(persisted.activityDraw.draw.history.length, 1);
  assert.ok(catalog.pairs.some(pair => pair.join(':') === persisted.activityDraw.current.pair.join(':')));
  assert.match(String(calls[1].body.p_fingerprint), /^[0-9a-f]{64}$/);
  await handleHost(request({ ...start, title: 'Event', config: { attempts: 2, timerEnabled: true, duration: 5 }, prizeText: 'Gift\nGift' }, cookie), env, transport);
  assert.equal(calls[1].body.p_fingerprint, calls[3].body.p_fingerprint);
  for (const change of [{ config: { duration: '5', timerEnabled: true, attempts: 2 } }, { config: { duration: 31, timerEnabled: true, attempts: 2 } }, { config: { duration: 5, timerEnabled: true, attempts: 4 } }, { prizeText: Array(51).fill('gift').join('\n') }, { state: initialManualState() }]) {
    assert.equal((await handleHost(request({ ...start, ...change }, cookie), env, transport)).status, 400);
  }
  assert.equal(calls.length, 4);
});
test('dispatch ignores client clock, binds command fingerprint and persists versioned server reduction', async () => {
  const cookie = await session(); const calls: Call[] = [];
  const transport = mock((name, body) => {
    if (name === 'bud_host_receipt') return Response.json(null);
    if (name === 'bud_host_resume') return Response.json({ ...event, state: { ...state, question: true } });
    if (name === 'bud_host_update') return Response.json({ ...event, version: 2, state: body.p_state });
    throw new Error('unexpected');
  }, calls);
  const now = Date.now();
  const result = await handleHost(request({ action: 'dispatch', eventId, version: 1, idempotencyKey: key, command: { type: 'reveal', card: 'condition', now: 1 } }, cookie), env, transport);
  assert.equal(result.status, 200);
  const next = (await result.json()).data.state;
  assert.ok(next.deadline >= now + 5000); assert.ok(next.deadline <= Date.now() + 5000);
  assert.deepEqual(calls.map(call => call.name), ['bud_host_receipt', 'bud_host_resume', 'bud_host_update']);
  assert.equal(calls[2].body.p_expected_version, 1); assert.equal(calls[2].body.p_action, 'reveal');
  assert.equal(calls[0].body.p_fingerprint, calls[2].body.p_fingerprint);
});
test('dispatch retries return original receipt before re-reduction; version and key conflicts remain conflicts', async () => {
  const cookie = await session(); const payload = { action: 'dispatch', eventId, version: 1, idempotencyKey: key, command: { type: 'wrong' } };
  const calls: Call[] = [];
  const retry = await handleHost(request(payload, cookie), env, mock(() => Response.json({ ...event, version: 2 }), calls));
  assert.equal(retry.status, 200); assert.equal(calls.length, 1); assert.equal(calls[0].name, 'bud_host_receipt');
  const conflict = await handleHost(request(payload, cookie), env, mock(name => Response.json(name === 'bud_host_receipt' ? null : { ...event, version: 2 })));
  assert.equal(conflict.status, 409); assert.equal((await conflict.json()).code, 'VERSION_CONFLICT');
  const reused = await handleHost(request(payload, cookie), env, mock(() => Response.json({ message: 'BUD_KEY_REUSED' }, { status: 400 })));
  assert.equal(reused.status, 409); assert.equal((await reused.json()).code, 'IDEMPOTENCY_KEY_REUSED');
});
test('dispatch cannot reset/start/replace state, use unknown command keys or inject invalid names', async () => {
  const cookie = await session(); const calls: Call[] = []; const transport = mock(() => Response.json(null), calls);
  for (const command of [{ type: 'reset' }, { type: 'start', config: state.config, prizeText: '' }, { type: 'correct', hostId: eventId },
    { type: 'save-winner', name: ' ' }, { type: 'award', winnerId: '__proto__', prizeId: 'prize-1' }, { type: 'reveal', card: 'other' }]) {
    assert.equal((await handleHost(request({ action: 'dispatch', eventId, version: 1, idempotencyKey: key, command }, cookie), env, transport)).status, 400);
  }
  assert.equal(calls.length, 0);
});
test('upstream errors are sanitized; content gate and body bounds are explicit', async () => {
  const cookie = await session();
  for (const [message, status, code] of [['BUD_CONTENT_NOT_READY', 503, 'CONTENT_NOT_READY'], ['BUD_EVENT_NOT_FOUND', 404, 'EVENT_NOT_FOUND'], ['private table and secret', 503, 'BACKEND_UNAVAILABLE']] as const) {
    const result = await handleHost(request({ action: 'resume', eventId }, cookie), env, mock(() => Response.json({ message }, { status: 400 })));
    assert.equal(result.status, status); assert.deepEqual(await result.json(), { code });
  }
  assert.equal((await handleHost(request({ action: 'start', title: 'x'.repeat(17000) }, cookie), env, mock())).status, 413);
});

test('live browser runtime keeps only financial receipts server-side and rejects gameplay uploads',async()=>{
 const cookie=await session();const calls:Call[]=[];const live={...env,BUD_LIVE_HOST_ENABLED:'true',WHOP_ENVIRONMENT:'production',BUD_WHOP_PRODUCTION_MODE:'pilot',BUD_WHOP_PILOT_HOST_ID:id,BUD_LOCAL_EVENT_RUNTIME_ENABLED:'true'};
 const transport=mock((name,body)=>Response.json(name==='bud_live_host_draw_catalog'?{version:'v1',pairs:[['0','0']],questionCount:1,conditionCount:1}:name==='bud_live_host_dashboard'?{credits:1,events:[{...event,state:{...state,storage:'browser-v1',winners:[{id:'winner-1',name:'private legacy'}]}}]}:name==='bud_live_host_resume'?{...event,state:{...state,storage:'browser-v1'}}:event),calls);
 const result=await handleLiveHost(request({action:'localStart',idempotencyKey:key,title:'Local'},cookie),live,transport);assert.equal(result.status,200);assert.equal((await result.json()).data.storage,'browser-v1');
 assert.deepEqual(calls.map(c=>c.name),['bud_live_host_draw_catalog','bud_live_host_start_draw']);const body=calls[1].body;assert.equal(body.p_host,id);assert.equal(body.p_prize_text,'');assert.deepEqual((body.p_state as any).winners,[]);assert.equal((body.p_state as any).storage,'browser-v1');
 const count=calls.length;for(const action of ['start','dispatch'])assert.equal((await handleLiveHost(request({action,state},cookie),live,transport)).status,410);
 for(const action of ['localStart','localContent','localAdopt','localFinish'])assert.equal((await handleLiveHost(request({action,eventId,idempotencyKey:key,title:'Local',state,hostId:eventId},cookie),live,transport)).status,400);assert.equal(calls.length,count);
 const dash=await handleLiveHost(request({action:'dashboard'},cookie),live,transport);const data=(await dash.json()).data;assert.equal(data.ownerId,id);assert.equal(data.runtime,'browser-v1');assert.deepEqual(data.events[0].state.winners,[]);assert.doesNotMatch(JSON.stringify(data),/private legacy/);
 assert.equal((await handleLiveHost(request({action:'resume',eventId},cookie),live,transport)).status,410);
 for(const [action,rpc] of [['localContent','bud_live_host_local_content'],['localAdopt','bud_live_host_local_adopt'],['localFinish','bud_live_host_local_finish']]){assert.equal((await handleLiveHost(request({action,eventId},cookie),live,transport)).status,200);assert.deepEqual(calls.at(-1),{name:rpc,body:{p_event:eventId,p_host:id}});}
 assert.equal((await handleLiveHost(request({action:'localContent',eventId},cookie),{...live,BUD_LOCAL_EVENT_RUNTIME_ENABLED:'false'},transport)).status,503);
});
