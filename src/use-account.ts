import { useCallback, useEffect, useRef, useState } from 'react';
import { getHostDashboard, getHostSession, HostClientError, signOutHost } from './host-client';
import type { HostDashboard, HostSession } from './host-client';
import { clearOwnerPending } from './owner-pending';

type AccountStatus='loading'|'guest'|'ready'|'unavailable';
type AccountSnapshot={session:HostSession|null;dashboard:HostDashboard|null;status:Exclude<AccountStatus,'loading'>};

export function useAccount() {
  const [session, setSession] = useState<HostSession | null>(null);
  const [dashboard, setDashboard] = useState<HostDashboard | null>(null);
  const [status, setStatus] = useState<AccountStatus>('loading');
  const [keysLoading, setKeysLoading] = useState(false);
  const [keysError, setKeysError] = useState(false);
  const active = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const loggingOut = useRef(false);
  const latest = useRef<AccountSnapshot>({session:null,dashboard:null,status:'guest'});
  const pending = useRef<Promise<AccountSnapshot>|null>(null);
  const refresh = useCallback(():Promise<AccountSnapshot> => {
    if (loggingOut.current) return Promise.resolve(latest.current);
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    const version = ++generation.current;
    const task=(async()=>{
      try {
        const user = await getHostSession(controller.signal);
        if (controller.signal.aborted || version !== generation.current) return latest.current;
        setSession(user); setStatus('ready'); setKeysLoading(true); setKeysError(false);
        try {
          const data = await getHostDashboard(controller.signal);
          if (!controller.signal.aborted && version === generation.current) {const next:AccountSnapshot={session:user,dashboard:data,status:'ready'};latest.current=next;setDashboard(data);return next;}
        } catch (reason) {
          if (controller.signal.aborted || version !== generation.current) return latest.current;
          setDashboard(null); setKeysError(true);
          if (reason instanceof HostClientError && reason.status === 401) {const next:AccountSnapshot={session:null,dashboard:null,status:'guest'};latest.current=next;setSession(null);setStatus('guest');return next;}
        }
        const next:AccountSnapshot={session:user,dashboard:null,status:'ready'};latest.current=next;return next;
      } catch (reason) {
        if (controller.signal.aborted || version !== generation.current) return latest.current;
        const next:AccountSnapshot={session:null,dashboard:null,status:reason instanceof HostClientError && reason.status === 401 ? 'guest' : 'unavailable'};
        latest.current=next;setSession(null);setDashboard(null);setKeysError(false);setStatus(next.status);return next;
      } finally { if (!controller.signal.aborted && version === generation.current) setKeysLoading(false); }
    })();
    pending.current=task;
    void task.finally(()=>{if(pending.current===task)pending.current=null;});
    return task;
  }, []);
  const whenReady=useCallback(()=>pending.current??Promise.resolve(latest.current),[]);
  useEffect(() => {
    void refresh();
    const focus = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', focus);
    return () => { active.current?.abort(); ++generation.current; window.removeEventListener('focus', focus); };
  }, [refresh]);
  const expire = useCallback(() => {
    active.current?.abort(); ++generation.current;
    const next:AccountSnapshot={session:null,dashboard:null,status:'guest'};latest.current=next;pending.current=null;
    setSession(null); setDashboard(null); setKeysError(false); setKeysLoading(false); setStatus('guest');
  }, []);
  const logout = async () => {
    if(session) clearOwnerPending(session.id);
    loggingOut.current = true;
    active.current?.abort(); ++generation.current;
    try { await signOutHost(); }
    finally { active.current?.abort(); ++generation.current; const next:AccountSnapshot={session:null,dashboard:null,status:'guest'};latest.current=next;pending.current=null;setSession(null);setDashboard(null);setKeysError(false);setKeysLoading(false);setStatus('guest');loggingOut.current = false; }
  };
  return {session, dashboard, status, keysLoading, keysError, refresh, whenReady, logout, expire};
}
