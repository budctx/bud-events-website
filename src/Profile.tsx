import {useEffect,useRef,useState} from 'react';
import {HostClientError} from './host-client';
import type {HostSession} from './host-client';
import {ownerError,ownerRequest} from './owner-client';
import './owner.css';
export default function Profile({session,credits,onClose,onOwner,onBuy,onRefresh}:{session:HostSession;credits:number|null;onClose:()=>void;onOwner:()=>void;onBuy:()=>void;onRefresh:()=>void}){
 const [owner,setOwner]=useState(false),[code,setCode]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[success,setSuccess]=useState(false);
 const [permission,setPermission]=useState<'loading'|'ready'|'unavailable'>('loading'),[permissionRevision,setPermissionRevision]=useState(0);
 const attempt=useRef<{code:string;id:string}|null>(null),active=useRef(true),lock=useRef(false);
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 useEffect(()=>{const controller=new AbortController();setOwner(false);setPermission('loading');void ownerRequest<{owner:boolean}>({action:'profile'},controller.signal).then(v=>{if(!controller.signal.aborted){setOwner(v.owner===true);setPermission('ready');}}).catch(()=>{if(!controller.signal.aborted)setPermission('unavailable');});return()=>controller.abort();},[session.id,permissionRevision]);
 const submit=async()=>{
  if(lock.current)return;lock.current=true;setBusy(true);setMessage('');setSuccess(false);
  attempt.current??={code:code.trim().toUpperCase().replace(/\s/g,''),id:crypto.randomUUID()};
  try{const result=await ownerRequest<{receipt:string;credits:number}>({action:'redeem',code:attempt.current.code,operationId:attempt.current.id});
   if(active.current){setMessage(`تم استرداد المفتاح. رصيدك الآن ${result.credits} — الإيصال ${result.receipt}`);setSuccess(true);setCode('');attempt.current=null;onRefresh();}
  }catch(reason){if(active.current){if(reason instanceof HostClientError&&[400,401,403,429].includes(reason.status))attempt.current=null;setMessage(ownerError(reason));}}
  finally{lock.current=false;if(active.current)setBusy(false);}
 };
 return <section className="owner-profile" aria-labelledby="profile-title" dir="rtl">
  <div className="owner-page-heading"><div><p className="owner-eyebrow">حسابك في بُعد</p><h1 id="profile-title">الملف الشخصي</h1></div><button className="owner-button" onClick={onClose}>العودة للموقع</button></div>
  <article className="owner-card"><h2>{session.displayName}</h2><p>رصيد التشغيل <strong>{credits===null?'غير متاح':credits}</strong></p>
   <div className="owner-actions"><button className="owner-button primary" onClick={onBuy}>شراء مفاتيح</button><button className="owner-button" onClick={()=>{setMessage('');setSuccess(false);dialog.current?.showModal();}}>استرداد مفتاح</button>{owner&&<button className="owner-button" onClick={onOwner}>لوحة المالك</button>}</div>
   {permission==='loading'&&<p role="status">جارٍ التحقق من صلاحيات الحساب…</p>}{permission==='unavailable'&&<div><p role="alert">تعذر التحقق من صلاحيات الحساب.</p><button className="owner-button" onClick={()=>setPermissionRevision(v=>v+1)}>إعادة التحقق من الصلاحيات</button></div>}
  </article>
  <dialog className="owner-modal" ref={dialog} aria-labelledby="redeem-title" onCancel={e=>{if(busy)e.preventDefault();}}><form onSubmit={e=>{e.preventDefault();void submit();}}>
   <h2 id="redeem-title">استرداد مفتاح</h2><p>أدخل مفتاح الهدية لإضافته إلى رصيد تشغيلك.</p><label>المفتاح<input autoFocus dir="ltr" autoComplete="off" spellCheck={false} value={code} disabled={busy||!!attempt.current} onChange={e=>setCode(e.target.value)} maxLength={64} required={!attempt.current}/></label>
   {message&&<p role={success?'status':'alert'} className={success?'owner-success':'owner-error'}>{message}</p>}
   <div className="owner-actions"><button className="owner-button primary" type="submit" disabled={busy||success}>{busy?'جارٍ التحقق…':attempt.current?'التحقق من الطلب السابق':'استرداد'}</button><button className="owner-button" type="button" disabled={busy} onClick={()=>dialog.current?.close()}>إغلاق</button></div>
  </form></dialog>
 </section>;
}
