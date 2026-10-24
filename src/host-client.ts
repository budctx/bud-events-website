import type { ManualAction, ManualConfig, ManualState } from './manual-game';
export type Locale = 'ar' | 'en';
export type HostEvent = { eventId: string; title: string; phase: string; version: number; state: ManualState; updatedAt?: string; cards?: { question: string; condition: string }; cardsEn?: { question: string; condition: string }; serverNow?: number };
export type HostSession = { id: string; displayName: string; avatarUrl?: string | null };
export type HostDashboard = { credits: number; paymentReview?: boolean; events: HostEvent[]; products: { id: string; name: string; available: boolean; slotCost: number }[]; contentVersions: { id: string; questionCount: number; conditionCount: number }[] };
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
export const getHostDashboard = (signal?: AbortSignal) => request<HostDashboard>('/api/host', { action: 'dashboard' }, signal);
export const startHostEvent = (payload: StartHostEvent) => request<HostEvent>('/api/host', payload);
export const resumeHostEvent = (eventId: string) => request<HostEvent>('/api/host', { action: 'resume', eventId });
export const signOutHost = () => request<{ signedOut: boolean }>('/api/auth?action=logout', {});
export type LoginContext = { page: 'home' | 'events' | 'bots' | 'designs'; locale: Locale };
export async function signInHost(context?: LoginContext) {
  const result = await request<{ url: string }>('/api/auth?action=signin', context ?? {});
  const destination = new URL(result.url, location.origin);
  if (destination.origin !== location.origin && !(destination.origin === 'https://cepmvqqrjcvhyzszqand.supabase.co' && destination.pathname === '/auth/v1/authorize' && destination.searchParams.get('provider') === 'discord') && !(destination.origin === 'https://discord.com' && destination.pathname === '/oauth2/authorize')) throw new HostClientError('INVALID_REDIRECT', 503);
  location.assign(destination.href);
}
export function newHostRequestKey() { return crypto.randomUUID(); }

export async function purchaseEvent(idempotencyKey: string) {
  const result = await request<{ url: string }>('/api/checkout', { idempotencyKey });
  const destination = new URL(result.url);
  if (destination.origin !== 'https://sandbox.whop.com' || destination.username || destination.password || !/^\/checkout\/ch_[A-Za-z0-9]+\/?$/.test(destination.pathname) || destination.search || destination.hash) throw new HostClientError('INVALID_REDIRECT', 503);
  location.assign(destination.href);
}

export const dispatchHostAction = (event: HostEvent, command: ManualAction, idempotencyKey: string) => request<HostEvent>('/api/host', { action: 'dispatch', eventId: event.eventId, version: event.version, idempotencyKey, command });
