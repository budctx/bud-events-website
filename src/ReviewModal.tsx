import {useEffect,useRef,useState} from 'react';
import {X} from 'lucide-react';
import {getHostSession} from './host-client';
import type {HostSession} from './host-client';
import {ownerRequest} from './owner-client';
import {ReviewIdentity} from './ReviewIdentity';
import './reviews.css';
export function ReviewModal({eventId,onExit}:{eventId:string;onExit:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),locked=useRef(false);
 const [session,setSession]=useState<HostSession|null>(null),[comment,setComment]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[identityError,setIdentityError]=useState('');
 useEffect(()=>{
  const controller=new AbortController();const el=dialog.current;el?.showModal();
  void getHostSession(controller.signal).then(setSession).catch(()=>{if(!controller.signal.aborted)setIdentityError('تعذر تحميل حساب Discord. أغلق النافذة وأعد المحاولة لاحقًا.');});
  return()=>{controller.abort();el?.close();};
 },[]);
 const send=async()=>{
  if(locked.current||!session||comment.trim().length<3)return;
  locked.current=true;setBusy(true);setError('');
  try{const res=await ownerRequest<{received:boolean}>({action:'reviewSubmit',eventId,comment:comment.trim()});
   if(!res.received)throw Error();onExit();
  }catch{setError('تعذر إرسال رأيك. تقدر تعيد المحاولة أو تتخطاه وتكمل.');locked.current=false;setBusy(false);}
 };
 return <dialog ref={dialog} className="mg-dialog bud-review-dialog" aria-labelledby="bud-review-title" dir="rtl" onCancel={e=>{e.preventDefault();if(!busy)onExit();}}>
 <button type="button" className="bud-review-close" aria-label="تخطي التقييم" disabled={busy} onClick={onExit}><X aria-hidden="true"/></button>
 <h2 id="bud-review-title">كيف كانت تجربتك؟</h2><p>شاركنا رأيك في التجربة بكلماتك.</p>
 <form onSubmit={e=>{e.preventDefault();void send();}}>
  <div className="bud-review-identity" aria-label="حسابك الظاهر مع الرأي">
   {session?<><ReviewIdentity name={session.displayName.trim().slice(0,60)} avatarUrl={session.avatarUrl}/><small>اسمك وصورتك من Discord · للعرض فقط</small></>:<p role="status">{identityError||'جارٍ تحميل حساب Discord…'}</p>}
  </div>
  <label>رأيك في التجربة<textarea maxLength={500} minLength={3} required value={comment} disabled={busy} onChange={e=>setComment(e.target.value)} placeholder="اكتب رأيك هنا…"/></label>
  <small>إرسال الرأي اختياري. عند إرساله، قد يُعرض النص مع اسمك وصورتك العامة من Discord في موقع بُعد بعد مراجعة الإدارة.</small>
  {error&&<p role="alert">{error}</p>}
  <div className="mg-actions"><button className="mg-button mg-primary" disabled={busy||!session||comment.trim().length<3}>{busy?'جارٍ إرسال رأيك…':'إرسال الرأي والختام'}</button><button className="mg-button" type="button" disabled={busy} onClick={onExit}>تخطي والختام</button></div>
 </form></dialog>;
}
