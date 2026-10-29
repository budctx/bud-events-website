import {useEffect,useRef,useState} from 'react';
import Game from './Game';
import {primePublicOfflineAssets} from './offline-shell';
import {BrowserEventError,browserCards,readBrowserRun,saveBrowserRun,selectBrowserRun,stepBrowserRun} from './browser-event';
import type {BrowserRun} from './browser-event';
import type {ManualAction} from './manual-game';
export default function BrowserGame({initial,onExit,onHome}:{initial:BrowserRun;onExit:()=>void;onHome:()=>void}){
 const [run,setRun]=useState(()=>readBrowserRun(initial.ownerId,initial.eventId)??initial);const current=useRef(run);
 const [access,setAccess]=useState<'checking'|'ready'|'locked'|'unsupported'>('checking'),[storageError,setStorageError]=useState('');
 const [expired,setExpired]=useState(()=>Date.now()>=Date.parse(run.expiresAt)&&run.state.phase!=='closing');
 useEffect(()=>{void primePublicOfflineAssets().catch(()=>{/* In-memory gameplay continues if cache warming fails. */});},[]);
 useEffect(()=>{
  let disposed=false;let release:(()=>void)|undefined;
  if(!navigator.locks){setAccess('unsupported');return;}
  void Promise.resolve().then(()=>{if(disposed)return;return navigator.locks.request(`bud-event:${initial.ownerId}:${initial.eventId}`,{ifAvailable:true},async lock=>{
   if(disposed)return;if(!lock){setAccess('locked');return;}
   const latest=readBrowserRun(initial.ownerId,initial.eventId)??initial;current.current=latest;setRun(latest);selectBrowserRun(latest);setAccess('ready');
   await new Promise<void>(resolve=>{release=resolve;if(disposed)resolve();});
  });}).catch(()=>{if(!disposed)setAccess('unsupported');});
  return()=>{disposed=true;release?.();};
 },[initial.ownerId,initial.eventId]);
 const dispatch=(action:ManualAction)=>{
  if(access!=='ready')return current.current;
  try{
   const next=stepBrowserRun(current.current,action);
   if(next!==current.current){current.current=next;setRun(next);if(!saveBrowserRun(next))setStorageError('تعذر الحفظ في هذا المتصفح. التقدم الحالي مؤقت وقد يُفقد عند إغلاق الصفحة.');else setStorageError('');}
   return next;
  }catch(error){if(error instanceof BrowserEventError&&error.code==='LOCAL_EVENT_EXPIRED')setExpired(true);else setStorageError('تعذر قراءة بيانات الفعالية المحلية. لا توجد نسخة لاستعادتها من الخادم.');return current.current;}
 };
 if(access!=='ready'||expired)return <main className="host-portal" dir="rtl"><section className="host-panel host-access"><h1>{expired?'انتهت مدة التشغيل':access==='checking'?'جارٍ فتح الفعالية…':access==='locked'?'الفعالية مفتوحة في تبويب آخر':'هذا المتصفح لا يدعم تشغيل الفعالية بأمان'}</h1><p>{access==='locked'?'أغلق التبويب الآخر ثم أعد فتح الفعالية.':expired?'نتائجك المحفوظة تبقى ضمن سجل هذا المتصفح.':'تقدم الفعالية محفوظ على جهازك فقط.'}</p><button onClick={onHome}>عودة الى الصفحة الرئيسية</button></section></main>;
 return <Game key={run.eventId} locale="ar" initialState={run.state} cards={browserCards(run)} onBrowserAction={dispatch} localSaveError={storageError} onExit={onExit}/>;
}
