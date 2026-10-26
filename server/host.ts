// Protected host orchestration. The entrypoint selects its wallet only from trusted server configuration.
import { resolveSession } from './auth.ts';
import { enforceRateLimit } from './rate-limit.ts';
import type { AuthEnv } from './auth.ts';
import { liveAudience, liveHostAllowed } from './live-access.ts';
import { initialManualState, manualGameReducer, validDuration } from '../src/manual-game.ts';
import type { ManualAction, ManualConfig, ManualState } from '../src/manual-game.ts';
import { parsePrizeLines } from '../src/prize-lines.ts';
import { validateCatalog } from '../src/draw-engine.ts';
import type { PairCatalog } from '../src/draw-engine.ts';
import { beginQuestionCondition, onQuestionConditionRound, restartQuestionConditionCycle } from './question-condition-activity.ts';
const PROJECT = 'https://cepmvqqrjcvhyzszqand.supabase.co';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const keyPattern = /^[A-Za-z0-9_-]{16,100}$/;
type Transport = typeof fetch;
type HostEvent = { eventId: string; title: string; phase: string; version: number; state: ManualState };
function environment(): AuthEnv { return (globalThis as unknown as { process?: { env?: AuthEnv } }).process?.env ?? {}; }
function configuration(env: AuthEnv) {
  if (env.BUD_BACKEND_ENABLED !== 'true' || env.BUD_AUTH_ENABLED !== 'true' || env.SUPABASE_URL !== PROJECT
    || !env.SUPABASE_SERVICE_ROLE_KEY || !env.SUPABASE_PUBLISHABLE_KEY || !env.BUD_APP_ORIGIN
    || !env.BUD_AUTH_COOKIE_SECRET || new TextEncoder().encode(env.BUD_AUTH_COOKIE_SECRET).length < 32) return null;
  try {
    const url = new URL(env.BUD_APP_ORIGIN);
    return url.protocol === 'https:' && url.origin === env.BUD_APP_ORIGIN ? { origin: url.origin, secret: env.SUPABASE_SERVICE_ROLE_KEY } : null;
  } catch { return null; }
}
function response(status: number, code: string, data?: unknown, refreshed?: Headers): Response {
  const headers = new Headers({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
  if (refreshed) for (const value of refreshed.getSetCookie()) headers.append('Set-Cookie', value);
  return Response.json({ code, ...(data === undefined ? {} : { data }) }, { status, headers });
}
class HostError extends Error {
  status: number; code: string;
  constructor(status: number, code: string) { super(code); this.status = status; this.code = code; }
}
async function boundedText(body: ReadableStream<Uint8Array> | null, limit: number): Promise<string> {
  if (!body) return '';
  const reader = body.getReader(); const decoder = new TextDecoder(); let text = ''; let size = 0;
  while (true) {
    const part = await reader.read(); if (part.done) break;
    size += part.value.length;
    if (size > limit) { await reader.cancel(); throw new HostError(413, 'REQUEST_TOO_LARGE'); }
    text += decoder.decode(part.value, { stream: true });
  }
  return text + decoder.decode();
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).every(key => keys.includes(key));
async function fingerprint(value: unknown) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)))), byte => byte.toString(16).padStart(2, '0')).join('');
}
const errors: Record<string, [number, string]> = {
  BUD_NO_CREDIT: [409, 'NO_SLOT_CREDIT'], BUD_ACTIVE_EVENT: [409, 'ACTIVE_EVENT_EXISTS'], BUD_KEY_REUSED: [409, 'IDEMPOTENCY_KEY_REUSED'],
  BUD_EVENT_NOT_FOUND: [404, 'EVENT_NOT_FOUND'], BUD_VERSION_CONFLICT: [409, 'VERSION_CONFLICT'], BUD_EVENT_CLOSED: [409, 'EVENT_CLOSED'],
  BUD_CONTENT_NOT_READY: [503, 'CONTENT_NOT_READY'], BUD_CONTENT_UNAVAILABLE: [503, 'CONTENT_NOT_READY'], BUD_PRODUCT_UNAVAILABLE: [503, 'PRODUCT_UNAVAILABLE'],
  BUD_LIVE_HOST_DISABLED: [503, 'LIVE_HOST_DISABLED'], BUD_ACCOUNT_RESTRICTED:[403,'ACCOUNT_RESTRICTED'],
  BUD_PAYMENT_REVIEW: [409, 'PAYMENT_UNDER_REVIEW'], BUD_INVALID_EVENT: [400, 'INVALID_EVENT'],
  BUD_INVALID_DRAW_STATE: [409, 'INVALID_DRAW_STATE'], BUD_GAME_CATALOG_INVALID: [503, 'CONTENT_NOT_READY'],
};
function actionFrom(value: unknown): ManualAction | null {
  if (!object(value) || typeof value.type !== 'string') return null;
  switch (value.type) {
    case 'correct': case 'wrong': case 'cancel-winner': case 'restart-cycle': return exact(value, ['type']) ? { type: value.type } : null;
    case 'tick': return exact(value, ['type', 'now']) ? { type: 'tick', now: Date.now() } : null;
    case 'reveal': return exact(value, ['type', 'card', 'now']) && ['question', 'condition'].includes(String(value.card))
      ? { type: 'reveal', card: value.card as 'question' | 'condition', now: Date.now() } : null;
    case 'save-winner': case 'add-winner': return exact(value, ['type', 'name']) && typeof value.name === 'string' && !!value.name.trim() && value.name.trim().length <= 80
      ? { type: value.type, name: value.name.trim() } : null;
    case 'rename-winner': return exact(value, ['type', 'winnerId', 'name']) && validWinner(value.winnerId) && typeof value.name === 'string' && !!value.name.trim() && value.name.trim().length <= 80
      ? { type: value.type, winnerId: value.winnerId as string, name: value.name.trim() } : null;
    case 'delete-winner': return exact(value, ['type', 'winnerId']) && validWinner(value.winnerId) ? { type: value.type, winnerId: value.winnerId as string } : null;
    case 'open-prize': return exact(value, ['type', 'prizeId']) && validPrize(value.prizeId) ? { type: value.type, prizeId: value.prizeId as string } : null;
    case 'award': return exact(value, ['type', 'prizeId', 'winnerId']) && validPrize(value.prizeId) && validWinner(value.winnerId)
      ? { type: value.type, prizeId: value.prizeId as string, winnerId: value.winnerId as string } : null;
    case 'phase': return exact(value, ['type', 'phase']) && ['live', 'prizes', 'closing'].includes(String(value.phase)) ? { type: value.type, phase: value.phase as 'live' | 'prizes' | 'closing' } : null;
    default: return null; // start/reset/client state replacement cannot be dispatched.
  }
}
type DrawCatalog = { version: string; pairs: PairCatalog };
function catalogFrom(value: unknown): DrawCatalog {
  if (!object(value) || typeof value.version !== 'string' || !value.version || value.version.length > 128
    || !Array.isArray(value.pairs) || !Number.isSafeInteger(value.questionCount) || !Number.isSafeInteger(value.conditionCount)) {
    throw new HostError(503, 'CONTENT_NOT_READY');
  }
  const questionCount = Number(value.questionCount), conditionCount = Number(value.conditionCount);
  if (questionCount < 1 || questionCount > 500 || conditionCount < 1 || conditionCount > 500) throw new HostError(503, 'CONTENT_NOT_READY');
  try { validateCatalog(value.pairs as PairCatalog); } catch { throw new HostError(503, 'CONTENT_NOT_READY'); }
  for (const pair of value.pairs as PairCatalog) {
    // Approved catalog IDs are zero-based indexes into the pinned content version.
    if (pair.some(id => !/^(0|[1-9][0-9]{0,2})$/.test(id))
      || Number(pair[0]) >= questionCount || Number(pair[1]) >= conditionCount) {
      throw new HostError(503, 'CONTENT_NOT_READY');
    }
  }
  return { version: value.version, pairs: value.pairs as PairCatalog };
}
function validWinner(value: unknown) { return typeof value === 'string' && /^winner-[1-9][0-9]{0,7}$/.test(value); }
function validPrize(value: unknown) { return typeof value === 'string' && /^prize-[1-9][0-9]?$/.test(value); }
function isEvent(value: unknown, id: string): value is HostEvent {
  if (!object(value) || value.eventId !== id || !Number.isSafeInteger(value.version) || Number(value.version) < 1 || !object(value.state)) return false;
  const state = value.state;
  return ['live', 'prizes', 'closing'].includes(String(state.phase)) && object(state.config) && Array.isArray(state.winners) && Array.isArray(state.prizes)
    && state.prizes.length <= 50 && state.winners.length <= 10000 && Number.isSafeInteger(state.round);
}
export async function handleHost(request: Request, env: AuthEnv = environment(), transport: Transport = fetch): Promise<Response> {
  return handleHostMode(request, env, transport, false);
}
/** Environment and wallet cannot be selected by a browser. */
export async function handleLiveHost(request: Request, env: AuthEnv = environment(), transport: Transport = fetch): Promise<Response> {
  if (env.BUD_LIVE_HOST_ENABLED !== 'true' || env.WHOP_ENVIRONMENT !== 'production' || !liveAudience(env)) return response(503, 'LIVE_HOST_NOT_CONFIGURED');
  return handleHostMode(request, env, transport, true);
}
async function handleHostMode(request: Request, env: AuthEnv, transport: Transport, live: boolean): Promise<Response> {
  if (request.method !== 'POST') return response(405, 'METHOD_NOT_ALLOWED');
  const config = configuration(env); if (!config) return response(503, 'BACKEND_NOT_CONFIGURED');
  if (new URL(request.url).origin !== config.origin || request.headers.get('origin') !== config.origin) return response(403, 'ORIGIN_DENIED');
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return response(415, 'JSON_REQUIRED');
  const limited = await enforceRateLimit(request, env, transport, 'host');
  if (limited) return limited;
  let refreshed: Headers | undefined;
  try {
    const session = await resolveSession(request, env, transport);
    if (!session) return response(401, 'DISCORD_AUTH_REQUIRED');
    refreshed = session.headers;
    if (live && !liveHostAllowed(session.hostId, env)) return response(403, 'PILOT_HOST_REQUIRED', undefined, refreshed);
    let body: unknown;
    try { body = JSON.parse(await boundedText(request.body, 16384)); } catch (error) { if (error instanceof HostError) throw error; throw new HostError(400, 'INVALID_JSON'); }
    if (!object(body) || typeof body.action !== 'string') throw new HostError(400, 'INVALID_REQUEST');
    const rpc = async (name: string, params: Record<string, unknown>) => {
      if (live) name = name.replace(/^bud_host_/, 'bud_live_host_');
      const upstream = await transport(PROJECT + '/rest/v1/rpc/' + name, { method: 'POST',
        headers: { apikey: config.secret, Authorization: 'Bearer ' + config.secret, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...params, p_host: session.hostId }), signal: AbortSignal.timeout(8000), redirect: 'error' });
      let data: unknown;
      try { data = JSON.parse(await boundedText(upstream.body, 1048576)); } catch { throw new HostError(503, 'BACKEND_UNAVAILABLE'); }
      if (!upstream.ok) {
        const mapped = object(data) && typeof data.message === 'string' ? errors[data.message] : undefined;
        throw new HostError(...(mapped ?? [503, 'BACKEND_UNAVAILABLE'] as [number, string]));
      }
      return data;
    };
    const browserRuntime=live&&env.BUD_LOCAL_EVENT_RUNTIME_ENABLED==='true';
    if(browserRuntime&&['start','dispatch'].includes(body.action))throw new HostError(410,'BROWSER_RUNTIME_REQUIRED');
    let output: unknown;
    if(['localStart','localContent','localAdopt','localFinish'].includes(body.action)){
      if(!browserRuntime)throw new HostError(503,'BROWSER_RUNTIME_NOT_CONFIGURED');
      if(body.action==='localStart'){
        if(!exact(body,['action','idempotencyKey','title'])||typeof body.idempotencyKey!=='string'||!keyPattern.test(body.idempotencyKey)||typeof body.title!=='string'||!body.title.trim()||body.title.trim().length>100)throw new HostError(400,'INVALID_EVENT');
        const catalog=catalogFrom(await rpc('bud_host_draw_catalog',{p_event:null}));
        const settings={duration:5,timerEnabled:false,attempts:1} as const;
        const marker={...manualGameReducer(initialManualState(),{type:'start',config:settings,prizeText:''}),activityDraw:beginQuestionCondition(catalog.pairs).activity,storage:'browser-v1'};
        output=await rpc('bud_host_start_draw',{p_key:body.idempotencyKey,p_title:body.title.trim(),p_config:settings,p_prize_text:'',p_state:marker,p_content_id:catalog.version,p_fingerprint:await fingerprint({title:body.title.trim(),storage:'browser-v1'})});
      }else{
        if(!exact(body,['action','eventId'])||typeof body.eventId!=='string'||!uuid.test(body.eventId))throw new HostError(400,'INVALID_EVENT');
        output=await rpc(body.action==='localContent'?'bud_host_local_content':body.action==='localAdopt'?'bud_host_local_adopt':'bud_host_local_finish',{p_event:body.eventId});
      }
    }else if (body.action === 'dashboard') {
      if (!exact(body, ['action'])) throw new HostError(400, 'INVALID_REQUEST');
      output = await rpc('bud_host_dashboard', {});
    } else if (body.action === 'start') {
      if (!exact(body, ['action', 'idempotencyKey', 'title', 'config', 'prizeText']) || typeof body.idempotencyKey !== 'string' || !keyPattern.test(body.idempotencyKey)
        || typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 100 || typeof body.prizeText !== 'string'
        || !parsePrizeLines(body.prizeText).valid || !object(body.config) || !exact(body.config, ['duration', 'timerEnabled', 'attempts'])
        || !validDuration(Number(body.config.duration)) || typeof body.config.duration !== 'number' || typeof body.config.timerEnabled !== 'boolean'
        || ![1, 2, 3].includes(Number(body.config.attempts)) || typeof body.config.attempts !== 'number') throw new HostError(400, 'INVALID_EVENT');
      const settings = body.config as ManualConfig; const title = body.title.trim();
      const prizes = parsePrizeLines(body.prizeText).lines.join('\n');
      const catalog = catalogFrom(await rpc('bud_host_draw_catalog', { p_event: null }));
      const activity = beginQuestionCondition(catalog.pairs);
      const state: ManualState = { ...manualGameReducer(initialManualState(), { type: 'start', config: settings, prizeText: prizes }), activityDraw: activity.activity };
      output = await rpc('bud_host_start_draw', { p_key: body.idempotencyKey, p_title: title, p_config: settings, p_prize_text: prizes, p_state: state, p_content_id: catalog.version,
        p_fingerprint: await fingerprint({ title, config: { duration: settings.duration, timerEnabled: settings.timerEnabled, attempts: settings.attempts }, prizes }) });
    } else if (body.action === 'resume') {
      if (!exact(body, ['action', 'eventId']) || typeof body.eventId !== 'string' || !uuid.test(body.eventId)) throw new HostError(400, 'INVALID_EVENT');
      output = await rpc('bud_host_resume', { p_event: body.eventId });
      if(browserRuntime&&object(output)&&object(output.state)&&output.state.storage==='browser-v1')throw new HostError(410,'LOCAL_EVENT_MISSING');
    } else if (body.action === 'dispatch') {
      if (!exact(body, ['action', 'eventId', 'version', 'idempotencyKey', 'command']) || typeof body.eventId !== 'string' || !uuid.test(body.eventId)
        || !Number.isSafeInteger(body.version) || Number(body.version) < 1 || typeof body.idempotencyKey !== 'string' || !keyPattern.test(body.idempotencyKey)) throw new HostError(400, 'INVALID_EVENT');
      const action = actionFrom(body.command); if (!action) throw new HostError(400, 'INVALID_ACTION');
      const boundAction = { ...action } as Record<string, unknown>; delete boundAction.now;
      const actionFingerprint = await fingerprint({ version: body.version, action: boundAction });
      // A retry returns its original receipt BEFORE applying the action to advanced state.
      const previous = await rpc('bud_host_receipt', { p_event: body.eventId, p_key: body.idempotencyKey, p_fingerprint: actionFingerprint });
      if (previous !== null) output = previous;
      else {
        const current = await rpc('bud_host_resume', { p_event: body.eventId });
        if (!isEvent(current, body.eventId)) throw new HostError(503, 'INVALID_EVENT_STATE');
        if (current.version !== body.version) throw new HostError(409, 'VERSION_CONFLICT');
        let next: ManualState;
        if (action.type === 'restart-cycle') {
          if (current.state.phase !== 'live' || current.state.pendingWinner || current.state.question || current.state.condition
              || !current.state.activityDraw?.exhausted) throw new HostError(409, 'CYCLE_NOT_EXHAUSTED');
          const catalog = catalogFrom(await rpc('bud_host_draw_catalog', { p_event: body.eventId }));
          try { next = { ...current.state, activityDraw: restartQuestionConditionCycle(current.state.activityDraw, catalog.pairs).activity }; }
          catch { throw new HostError(409, 'INVALID_DRAW_STATE'); }
        } else {
          if (current.state.activityDraw?.exhausted && ['reveal', 'correct', 'wrong', 'save-winner'].includes(action.type)) {
            throw new HostError(409, 'CYCLE_EXHAUSTED');
          }
          next = manualGameReducer(current.state, action);
          if (next.round !== current.state.round && current.state.activityDraw) {
            const catalog = catalogFrom(await rpc('bud_host_draw_catalog', { p_event: body.eventId }));
            try { next = { ...next, activityDraw: onQuestionConditionRound(current.state.activityDraw, next.round, catalog.pairs).activity }; }
            catch { throw new HostError(409, 'INVALID_DRAW_STATE'); }
          }
        }
        if (next.winners.length > 1000) throw new HostError(409, 'WINNER_LIMIT_REACHED');
        output = await rpc('bud_host_update', { p_event: body.eventId, p_expected_version: body.version, p_key: body.idempotencyKey, p_state: next,
          p_action: action.type, p_fingerprint: actionFingerprint });
      }
    } else throw new HostError(400, 'UNKNOWN_ACTION');
    // Receipt snapshots retain the original state/version, but the response clock
    // must be fresh so a delayed retry cannot extend a persisted timer.
    if (object(output) && typeof output.eventId === 'string') output = { ...output, serverNow: Date.now() };
    if(browserRuntime&&object(output)){
      if(body.action==='dashboard'){output={...output,runtime:'browser-v1',ownerId:session.hostId,events:Array.isArray(output.events)?output.events.map(e=>object(e)&&object(e.state)&&e.state.storage==='browser-v1'?{eventId:e.eventId,title:e.title,phase:e.phase,version:e.version,updatedAt:e.updatedAt,state:{...initialManualState(),phase:e.phase==='completed'?'closing':'live',storage:'browser-v1'},storage:'browser-v1'}:e):[]};}
      else if(body.action==='localStart')output={...output,storage:'browser-v1',ownerId:session.hostId};
    }
    return response(200, 'OK', output, refreshed);
  } catch (error) {
    return error instanceof HostError ? response(error.status, error.code, undefined, refreshed) : response(503, 'BACKEND_UNAVAILABLE', undefined, refreshed);
  }
}
