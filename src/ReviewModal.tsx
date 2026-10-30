import {useEffect,useRef,useState} from 'react';
import {Star,X} from 'lucide-react';
import {ownerRequest} from './owner-client';
import './reviews.css';
export function ReviewModal({eventId,onExit}:{eventId:string;onExit:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),locked=useRef(false);
 const [rating,setRating]=useState(0),[comment,setComment]=useState(''),[name,setName]=useState(''),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const el=dialog.current;el?.showModal();return()=>{el?.close();};},[]);
 const send=async()=>{if(locked.current||!rating)return;locked.current=true;setBusy(true);setError('');
  try{const res=await ownerRequest<{received:boolean}>({action:'reviewSubmit',eventId,rating,comment,displayName:name.trim()||'أحد مستخدمي بُعد',publishConsent:consent});
   if(!res.received)throw Error();onExit();
  }catch{setError('تعذر إرسال التقييم. تقدر تعيد المحاولة أو تتخطاه وتكمل.');locked.current=false;setBusy(false);}
 };
 return <dialog ref={dialog} className="mg-dialog bud-review-dialog" aria-labelledby="bud-review-title" dir="rtl" onCancel={e=>{e.preventDefault();if(!busy)onExit();}}>
 <button type="button" className="bud-review-close" aria-label="تخطي التقييم" disabled={busy} onClick={onExit}><X aria-hidden="true"/></button>
 <h2 id="bud-review-title">كيف كانت تجربتك؟</h2><p>تقييمك يشرّفنا، ويسعدنا نعرضه في واجهتنا الرئيسية.</p>
 <form onSubmit={e=>{e.preventDefault();void send();}}><fieldset disabled={busy}><legend>تقييم الفعالية</legend><div className="bud-review-stars">{[1,2,3,4,5].map(n=><label key={n}><input required type="radio" name="rating" value={n} checked={rating===n} onChange={()=>setRating(n)}/><Star aria-hidden="true" fill={rating>=n?'currentColor':'none'}/><span>{n} من 5</span></label>)}</div></fieldset>
 <label>وش حبيت في التجربة؟<textarea maxLength={500} minLength={consent?3:undefined} required={consent} value={comment} disabled={busy} onChange={e=>setComment(e.target.value)} placeholder="شاركنا رأيك…"/></label>
 <label className="bud-review-consent"><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/>أوافق على عرض تقييمي والاسم الذي أختاره في موقع بُعد بعد المراجعة.</label>
 {consent&&<label>الاسم الظاهر — اختياري<input maxLength={60} value={name} disabled={busy} onChange={e=>setName(e.target.value)} placeholder="أحد مستخدمي بُعد"/></label>}
 <small>التقييم اختياري. لا ننشره بدون موافقتك.</small>{error&&<p role="alert">{error}</p>}
 <div className="mg-actions"><button className="mg-button mg-primary" disabled={busy||!rating}>{busy?'جارٍ إرسال تقييمك…':'إرسال التقييم والختام'}</button><button className="mg-button" type="button" disabled={busy} onClick={onExit}>تخطي والختام</button></div></form></dialog>;
}
