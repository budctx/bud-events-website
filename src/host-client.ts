import {browserStorageReady,clearBrowserPointer,listBrowserRuns,mergeBrowserDashboard,prepareBrowserRun,readBrowserRun,saveBrowserRun} from './browser-event';
import type {BrowserPackage,BrowserRun} from './browser-event';
import type { ManualAction, ManualConfig, ManualState } from './manual-game';
import { checkoutDestination } from './checkout-destination';
export type Locale = 'ar' | 'en';
export type HostEvent = {storage?:'browser-v1';localMissing?:boolean;ownerId?:string; eventId: string; title: string; phase: string; version: number; state: ManualState; updatedAt?: string; cards?: { question: string; condition: string }; cardsEn?: { question: string; condition: string }; serverNow?: number };
export type HostSession = { id: string; displayName: string; avatarUrl?: string | null };
export type HostDashboard = {runtime?:'browser-v1';ownerId?:string; credits: number; paymentReview?: boolean; events: HostEvent[]; products: { id: string; name: string; available: boolean; slotCost: number }[]; contentVersions: { id: string; questionCount: number; conditionCount: number }[] };
export type StartHostEvent = { action: 'start'; idempotencyKey: string; title: string; config: ManualConfig; prizeText: string };
export class HostClientError extends Error {
  constructor(public code: string, public status: number, public data?: unknown) { super(code); this.name = 'HostClientError'; }
}
async function request<T>(url: string, payload?: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try { response = await fetch(url, { method: payload === undefined ? 'GET' : 'POST', credentials: 'same-origin', headers: payload === undefined ? undefined : { 'Content-Type': 'application/json' }, body: payload === undefined ? undefined : JSON.stringify(payload), signal }); }
  catch (error) { if (error instanceof DOMException && error.name === 'AbortError') throw error; throw new HostClientError('NETWORK_ERROR', 0); }
  const result = await response.json().catch(() => null) as { code?: string; data?: T } | null;
  if (!response.ok || result?.code !== 'OK' || result.data === undefined) throw new HostClientError(result?.code ?? 'SERVICE_UNAVAILABLE', response.status, result?.data);
  return result.data;
}
export const getHostSession = (signal?: AbortSignal) => request<HostSession>('/api/auth?action=session', undefined, signal);
export const getPaymentReceipt = (orderId: string, signal?: AbortSignal) => request<import('./payment-state').PaymentReceipt>('/api/payment-status', { orderId }, signal);
export async function getHostDashboard(signal?:AbortSignal){
 const data=await request<HostDashboard>('/api/host',{action:'dashboard'},signal);
 if(data.runtime!=='browser-v1'||!data.ownerId||signal?.aborted)return data;
 for(const run of listBrowserRuns(data.ownerId).filter(r=>r.adoptionPending)){try{await request('/api/host',{action:'localAdopt',eventId:run.eventId},signal);saveBrowserRun({...run,adoptionPending:false});}catch{/* Adoption acknowledgement retries contain no gameplay. */}}
 for(const run of listBrowserRuns(data.ownerId).filter(r=>r.state.phase==='closing'&&!r.released)){
  try{await request('/api/host',{action:'localFinish',eventId:run.eventId},signal);saveBrowserRun({...run,released:true});}catch{/* Only lifecycle metadata is retried; no gameplay is uploaded. */}
 }
 return mergeBrowserDashboard(data,data.ownerId);
}
export const startHostEvent = (payload: StartHostEvent) => request<HostEvent>('/api/host', payload);
export async function resumeHostEvent(eventId:string,ownerId?:string,browserRuntime=false):Promise<HostEvent>{
 if(ownerId){const local=readBrowserRun(ownerId,eventId);if(local)return local;}
 if(!browserRuntime)return request<HostEvent>('/api/host',{action:'resume',eventId});
 const pkg=await request<BrowserPackage>('/api/host',{action:'localContent',eventId});
 if(ownerId&&pkg.ownerId!==ownerId)throw new HostClientError('LOCAL_CONTENT_INVALID',503);
 const run=prepareBrowserRun(pkg);try{await request('/api/host',{action:'localAdopt',eventId});saveBrowserRun({...run,adoptionPending:false});}catch{/* The verified legacy copy is already saved; retry acknowledgement on the dashboard. */}return run;
}
export async function startBrowserHostEvent(ownerId:string,payload:StartHostEvent):Promise<BrowserRun>{
 if(!browserStorageReady())throw new HostClientError('LOCAL_STORAGE_UNAVAILABLE',409);
 const receipt=await request<HostEvent>('/api/host',{action:'localStart',idempotencyKey:payload.idempotencyKey,title:payload.title});
 const pkg=await request<BrowserPackage>('/api/host',{action:'localContent',eventId:receipt.eventId});
 if(pkg.ownerId!==ownerId||receipt.ownerId!==ownerId||receipt.storage!=='browser-v1')throw new HostClientError('LOCAL_CONTENT_INVALID',503);
 return prepareBrowserRun(pkg,payload);
}
export const closeBrowserHostRun=(eventId:string)=>request('/api/host',{action:'localFinish',eventId});
export const signOutHost = () => {clearBrowserPointer();return request<{ signedOut: boolean }>('/api/auth?action=logout', {});};
export type LoginContext = { page: 'home' | 'events' | 'bots' | 'designs'; locale: Locale };
export async function signInHost(context?: LoginContext) {
  const result = await request<{ url: string }>('/api/auth?action=signin', context ?? {});
  const destination = new URL(result.url, location.origin);
  if (destination.origin !== location.origin && !(destination.origin === 'https://cepmvqqrjcvhyzszqand.supabase.co' && destination.pathname === '/auth/v1/authorize' && destination.searchParams.get('provider') === 'discord') && !(destination.origin === 'https://discord.com' && destination.pathname === '/oauth2/authorize')) throw new HostClientError('INVALID_REDIRECT', 503);
  location.assign(destination.href);
}
export function newHostRequestKey() { return crypto.randomUUID(); }

export async function purchaseEvent(idempotencyKey: string, locale: Locale = 'ar') {
  const result = await request<{ url: string; environment?: string }>('/api/checkout', { idempotencyKey, locale });
  const destination = checkoutDestination(result.url, result.environment);
  if (!destination) throw new HostClientError('INVALID_REDIRECT', 503);
  location.assign(destination);
}

export const dispatchHostAction = (event: HostEvent, command: ManualAction, idempotencyKey: string) => request<HostEvent>('/api/host', { action: 'dispatch', eventId: event.eventId, version: event.version, idempotencyKey, command });
