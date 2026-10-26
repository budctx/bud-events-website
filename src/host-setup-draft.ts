import type { ManualConfig } from './manual-game.ts';

export type HostSetupDraft = {
  schema: 1;
  title: string;
  prizeText: string;
  config: ManualConfig;
  savedAt: number;
};
type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const prefix = 'bud-host-setup-draft:v1:';
const maxAge = 30 * 24 * 60 * 60 * 1000;
const ownerKey = (ownerId: string) => prefix + ownerId;
const validOwner = (ownerId: string) => typeof ownerId === 'string' && ownerId.length > 0 && ownerId.length <= 160 && !ownerId.includes(':');
const validConfig = (v: unknown): v is ManualConfig => {
  if (!v || typeof v !== 'object') return false;
  const config = v as Record<string, unknown>;
  return typeof config.duration === 'number' && Number.isSafeInteger(config.duration) && config.duration >= 3 && config.duration <= 30
    && typeof config.timerEnabled === 'boolean' && [1, 2, 3].includes(Number(config.attempts));
};
export function readHostSetupDraft(ownerId: string, storage: DraftStorage = localStorage, now = Date.now()): HostSetupDraft | null {
  if (!validOwner(ownerId)) return null;
  try {
    const raw = storage.getItem(ownerKey(ownerId));
    if (!raw || raw.length > 12000) return null;
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    const draft = data as Record<string, unknown>;
    return draft.schema === 1
      && typeof draft.title === 'string' && draft.title.length <= 100
      && typeof draft.prizeText === 'string' && draft.prizeText.length <= 10000
      && validConfig(draft.config)
      && typeof draft.savedAt === 'number' && Number.isFinite(draft.savedAt)
      && now - draft.savedAt >= 0 && now - draft.savedAt <= maxAge
      ? draft as HostSetupDraft : null;
  } catch { return null; }
}
export function saveHostSetupDraft(ownerId: string, draft: Pick<HostSetupDraft, 'title' | 'prizeText' | 'config'>, storage: DraftStorage = localStorage, now = Date.now()): boolean {
  if (!validOwner(ownerId) || typeof draft.title !== 'string' || draft.title.length > 100
    || typeof draft.prizeText !== 'string' || draft.prizeText.length > 10000
    || !validConfig(draft.config)) return false;
  try {
    storage.setItem(ownerKey(ownerId), JSON.stringify({schema: 1, ...draft, savedAt: now}));
    return true;
  } catch { return false; }
}
export function clearHostSetupDraft(ownerId: string, storage: DraftStorage = localStorage): void {
  if (!validOwner(ownerId)) return;
  try { storage.removeItem(ownerKey(ownerId)); } catch { /* Never block an event start. */ }
}
