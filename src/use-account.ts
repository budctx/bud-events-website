import { useCallback, useEffect, useRef, useState } from 'react';
import { getHostDashboard, getHostSession, HostClientError, signOutHost } from './host-client';
import type { HostDashboard, HostSession } from './host-client';
import { clearOwnerPending } from './owner-pending';

export function useAccount() {
  const [session, setSession] = useState<HostSession | null>(null);
  const [dashboard, setDashboard] = useState<HostDashboard | null>(null);
  const [status, setStatus] = useState<'loading' | 'guest' | 'ready' | 'unavailable'>('loading');
  const [keysLoading, setKeysLoading] = useState(false);
  const [keysError, setKeysError] = useState(false);
  const active = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const loggingOut = useRef(false);
  const refresh = useCallback(async () => {
    if (loggingOut.current) return;
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    const version = ++generation.current;
    try {
      const user = await getHostSession(controller.signal);
      if (controller.signal.aborted || version !== generation.current) return;
      setSession(user); setStatus('ready'); setKeysLoading(true); setKeysError(false);
      try {
        const data = await getHostDashboard(controller.signal);
        if (!controller.signal.aborted && version === generation.current) setDashboard(data);
      } catch (reason) {
        if (controller.signal.aborted || version !== generation.current) return;
        setDashboard(null); setKeysError(true);
        if (reason instanceof HostClientError && reason.status === 401) { setSession(null); setStatus('guest'); }
      }
    } catch (reason) {
      if (controller.signal.aborted || version !== generation.current) return;
      setSession(null); setDashboard(null); setKeysError(false);
      setStatus(reason instanceof HostClientError && reason.status === 401 ? 'guest' : 'unavailable');
    } finally { if (!controller.signal.aborted && version === generation.current) setKeysLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const focus = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', focus);
    return () => { active.current?.abort(); ++generation.current; window.removeEventListener('focus', focus); };
  }, [refresh]);
  const expire = useCallback(() => {
    active.current?.abort(); ++generation.current;
    setSession(null); setDashboard(null); setKeysError(false); setKeysLoading(false); setStatus('guest');
  }, []);
  const logout = async () => {
    if(session) clearOwnerPending(session.id);
    loggingOut.current = true;
    active.current?.abort(); ++generation.current;
    try { await signOutHost(); }
    finally { active.current?.abort(); ++generation.current; setSession(null); setDashboard(null); setKeysError(false); setKeysLoading(false); setStatus('guest'); loggingOut.current = false; }
  };
  return {session, dashboard, status, keysLoading, keysError, refresh, logout, expire};
}
