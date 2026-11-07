import {useEffect,useRef,useState} from 'react';
import {MiniGames} from './MiniGames';
import {readMiniRun,saveMiniRun,selectMiniRun} from './session.ts';
import type {MiniRun} from './session.ts';
import type {MiniSession} from './engine.ts';
import {closeMiniHostEvent} from '../host-client';
import {BudNotice} from '../BudUI';

export default function MiniGamesHost({initial,onExit,onHome}:{initial:MiniRun;onExit:()=>void;onHome:()=>void}){
 const [run,setRun]=useState(()=>readMiniRun(initial.ownerId,initial.eventId)??initial),current=useRef(run);
 const [access,setAccess]=useState<'checking'|'ready'|'locked'|'unsupported'>('checking');
 const [expired,setExpired]=useState(()=>Date.now()>=Date.parse(run.expiresAt)&&run.state.phase!=='closing');
 const [storageError,setStorageError]=useState('');
 useEffect(()=>{
  let disposed=false,release:(()=>void)|undefined;
  if(!navigator.locks){setAccess('unsupported');return;}
  void Promise.resolve().then(()=>{
   if(disposed)return;
   return navigator.locks.request('bud-event:'+initial.ownerId+':'+initial.eventId,{ifAvailable:true},async lock=>{
    if(disposed)return;
    if(!lock){setAccess('locked');return;}
    const latest=readMiniRun(initial.ownerId,initial.eventId)??initial;
    current.current=latest;setRun(latest);selectMiniRun(latest);setAccess('ready');
    await new Promise<void>(resolve=>{release=resolve;if(disposed)resolve();});
   });
  }).catch(()=>{if(!disposed)setAccess('unsupported');});
  return()=>{disposed=true;release?.();};
 },[initial.ownerId,initial.eventId]);
 useEffect(()=>{
  const tick=()=>{if(Date.now()>=Date.parse(current.current.expiresAt)&&current.current.state.phase!=='closing')setExpired(true);};
  const interval=window.setInterval(tick,1000);
  return()=>window.clearInterval(interval);
 },[]);
 const save=(state:MiniSession)=>{
  if(access!=='ready')return;
  // Only local storage receives gameplay, winner names and the prize mapping.
  const next:MiniRun={...current.current,state,version:current.current.version+1,updatedAt:new Date().toISOString()};
  current.current=next;
  setRun(next);
  if(!saveMiniRun(next))setStorageError('تعذر الحفظ المحلي؛ قد تفقد التقدم عند إغلاق المتصفح.');
  else setStorageError('');
  if(state.phase==='closing'&&!next.released){
   void closeMiniHostEvent(next.eventId).then(()=>{
    if(current.current.eventId!==next.eventId)return;
    const confirmed:MiniRun={...current.current,released:true};
    current.current=confirmed;setRun(confirmed);saveMiniRun(confirmed);
   }).catch(()=>{/* A later dashboard refresh retries lifecycle acknowledgement, never uploads results. */});
  }
 };
 const exit=()=>{if(current.current.state.phase==='closing')location.assign('/review');else onExit();};
 if(access!=='ready'||expired)return <main className="host-portal" dir="rtl"><section className="host-panel host-access">
  <BudNotice tone="warning" persistent>{expired?'انتهت مدة تشغيل الفعالية (4 ساعات).':access==='checking'?'':access==='locked'?'الفعالية مفتوحة في تبويب آخر. أغلق التبويب الآخر أولًا.':'متصفحك لا يدعم الحفظ المحلي والقفل اللازمين لهذه الفعالية.'}</BudNotice>
  <h1>{access==='checking'&&!expired?'جارٍ فتح ميني قيمز…':'تعذر فتح الفعالية'}</h1>
  <button onClick={onHome}>العودة إلى بُعد</button>
 </section></main>;
 return <><MiniGames key={run.eventId} initial={run.state} onChange={save} onExit={exit} sessionName="ميني قيمز"/>
  {storageError&&<div className="mini-save-warning" role="alert">{storageError}</div>}</>;
}
