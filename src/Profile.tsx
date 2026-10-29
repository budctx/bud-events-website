import {BudNotice} from './BudUI';
import {ButtonUtility} from './ButtonUtility';
import {ArrowRight} from 'lucide-react';
import {useEffect,useState} from 'react';
import {HostClientError} from './host-client';
import type {HostSession} from './host-client';
import {ownerRequest} from './owner-client';
import './owner.css';
export default function Profile({session,credits,onClose,onOwner}:{session:HostSession;credits:number|null;onClose:()=>void;onOwner:()=>void}){
 const [owner,setOwner]=useState(false);
 const [permission,setPermission]=useState<'loading'|'ready'|'disabled'|'unavailable'>('loading'),[permissionRevision,setPermissionRevision]=useState(0);
 useEffect(()=>{const controller=new AbortController();setOwner(false);setPermission('loading');void ownerRequest<{owner:boolean}>({action:'profile'},controller.signal).then(v=>{if(!controller.signal.aborted){setOwner(v.owner===true);setPermission('ready');}}).catch(reason=>{if(!controller.signal.aborted)setPermission(reason instanceof HostClientError&&reason.code==='OWNER_PANEL_NOT_CONFIGURED'?'disabled':'unavailable');});return()=>controller.abort();},[session.id,permissionRevision]);
 return <section className="owner-profile" aria-labelledby="profile-title" dir="rtl">
  <div className="owner-page-heading"><div><p className="owner-eyebrow">حسابك في بُعد</p><h1 id="profile-title">الملف الشخصي</h1></div><ButtonUtility label="عودة" icon={ArrowRight} onPress={onClose}/></div>
  <article className="owner-card"><h2>{session.displayName}</h2><p>رصيد التشغيل <strong>{credits===null?'غير متاح':credits}</strong></p>
   {owner&&<div className="owner-actions"><button className="owner-button" onClick={onOwner}>لوحة المالك</button></div>}
   {permission==='disabled'&&<BudNotice tone="warning">لوحة المالك غير مفعّلة حاليًا.</BudNotice>}{permission==='loading'&&<p role="status">جارٍ التحقق من صلاحيات الحساب…</p>}{permission==='unavailable'&&<div><BudNotice tone="danger" resolveOnUnmount>تعذر التحقق من صلاحيات الحساب.</BudNotice><button className="owner-button" onClick={()=>setPermissionRevision(v=>v+1)}>إعادة التحقق من الصلاحيات</button></div>}
  </article>

 </section>;
}
