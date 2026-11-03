import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,X} from 'lucide-react';
import {parsePrizeLines} from '../prize-lines';
import {newHostRequestKey,HostClientError,startMiniHostEvent} from '../host-client';
import type {MiniRun} from './session.ts';
import './mini-games.css';

export function MiniSetupModal({ownerId,onClose,onPlay}:{ownerId:string;onClose:()=>void;onPlay:(run:MiniRun)=>void}){
 const dialog=useRef<HTMLDialogElement>(null),busyRef=useRef(false),pendingKey=useRef<string|null>(null);
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
 const [prizeText,setPrizeText]=useState(''),[error,setError]=useState('');
 const parsed=parsePrizeLines(prizeText);
 useEffect(()=>{
  const node=dialog.current;if(!node)return;
  const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
  node.showModal();document.body.style.overflow='hidden';
  node.querySelector<HTMLElement>('textarea')?.focus({preventScroll:true});
  return()=>{node.close();document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus({preventScroll:true});};
 },[]);
 const close=()=>{if(!busyRef.current&&!pendingKey.current)onClose();};
 const start=async()=>{
  if(busyRef.current||!parsed.valid)return;
  busyRef.current=true;setBusy(true);setError('');
  pendingKey.current??=newHostRequestKey();
  try{
   const run=await startMiniHostEvent(ownerId,pendingKey.current,prizeText);
   pendingKey.current=null;setUncertain(false);onPlay(run);
  }catch(reason){
   const issue=reason instanceof HostClientError?reason:null;
   setUncertain(true);
   setError(issue?.code==='NO_SLOT_CREDIT'?'لا يوجد رصيد كافٍ لبدء الفعالية.':
     issue?.code==='ACTIVE_EVENT_EXISTS'?'هناك فعالية أخرى نشطة. أغلقها قبل بدء فعالية جديدة.':
     issue?.code==='LOCAL_STORAGE_UNAVAILABLE'?'تعذر تفعيل الحفظ المحلي. لا تبدأ الفعالية في هذا المتصفح.':
     'تعذر التأكد من بدء الفعالية. أعد المحاولة بنفس الطلب حتى لا يُخصم مفتاح آخر.');
  }finally{busyRef.current=false;setBusy(false);}
 };
 return <dialog className="mini-dialog mini-setup-dialog" ref={dialog} dir="rtl" lang="ar" aria-label="إعداد ميني قيمز" onCancel={e=>{e.preventDefault();close();}}>
  <div className="mini-dialog-head"><h2>إعداد ميني قيمز</h2><button className="mini-icon-button" aria-label="إغلاق الإعداد" disabled={busy||uncertain} onClick={close}><X size={20}/></button></div>
  <div className="mini-standby"><p>جهّز الجوائز قبل بدء الفعالية. يمكنك تركها فارغة واللعب دون تسجيل فائزين.</p>
   <label htmlFor="mini-host-prizes">الجوائز (كل سطر جائزة مستقلة)</label>
   <textarea id="mini-host-prizes" rows={6} maxLength={6000} disabled={busy||uncertain} value={prizeText} onChange={e=>setPrizeText(e.target.value)} placeholder="جائزة 1\nجائزة 2"/>
   <p>عدد الجوائز: {parsed.count} · عدد الفائزين الأقصى هو عدد الجوائز.</p>
   {!parsed.valid&&<p className="mini-notice" role="alert">الحد الأقصى 50 جائزة، و100 حرف لكل جائزة.</p>}
   {uncertain&&<p className="mini-notice" role="status">سيُعاد إرسال طلب البدء بالمفتاح نفسه لتجنب أي خصم مكرر.</p>}
   {error&&<p className="mini-notice" role="alert">{error}</p>}
   <div className="mini-action-row"><button className="mini-cta mini-secondary" disabled={busy||uncertain} onClick={close}>إلغاء</button><button className="mini-cta mini-primary" disabled={busy||!parsed.valid} onClick={()=>void start()}>{busy?'جارٍ بدء الفعالية…':uncertain?'إعادة المحاولة':'بدء الفعالية'} <ArrowLeft size={17}/></button></div>
  </div>
 </dialog>;
}
