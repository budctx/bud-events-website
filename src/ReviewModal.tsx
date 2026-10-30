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
export type PublicReview={id:string;name:string;comment:string;rating:number};
export function PublicReviews(){
 const [rows,setRows]=useState<PublicReview[]>([]);
 useEffect(()=>{const controller=new AbortController();void fetch('/api/owner?public=reviews',{signal:controller.signal,cache:'no-store'}).then(async res=>{if(!res.ok)return;const body=await res.json();if(body.code==='OK'&&Array.isArray(body.data))setRows(body.data);}).catch(()=>{});return()=>controller.abort();},[]);
 if(!rows.length)return <div className="platform-review-empty"><strong>آراء المجتمع قريبًا</strong><p>لم تُنشر آراء معتمدة بعد.</p></div>;
 return <section className="bud-public-reviews" aria-labelledby="bud-reviews-heading"><h2 id="bud-reviews-heading">من تجارب مجتمع بُعد</h2><div>{rows.map(row=><figure key={row.id}><div className="bud-review-rating" aria-label={`${row.rating} من 5`}>{[1,2,3,4,5].map(n=><Star key={n} aria-hidden="true" fill={n<=row.rating?'currentColor':'none'}/>)}</div><blockquote dir="auto">{row.comment}</blockquote><figcaption dir="auto">{row.name}</figcaption></figure>)}</div></section>;
}
export function ReviewManager({rows,onConfirm,onNext,onBack,offset}:{rows:Record<string,unknown>[];onConfirm:(a:{kind:string;payload:Record<string,unknown>;title:string})=>void;onNext:()=>void;onBack:()=>void;offset:number}){
 return <><p className="owner-subtle">التقييمات لا تظهر في الرئيسية إلا بموافقة صاحبها وبعد نشرها هنا. النص والتقييم يبقيان كما كتبهما المستخدم.</p>{rows.length===0&&<article className="owner-card">لا توجد تقييمات في هذه الصفحة.</article>}{rows.map(row=><article className="owner-card" key={String(row.id)}><div className="owner-block-heading"><h3>{String(row.display_name)} · {String(row.rating)} / 5</h3><span>{{pending:'بانتظار المراجعة',published:'منشور',hidden:'مخفي'}[String(row.status)]}</span></div><p dir="auto">{String(row.comment)||'بدون تعليق'}</p><small>{row.publish_consent?'وافق على العرض العام':'للمراجعة الداخلية — لم يوافق على العرض'}</small><div className="owner-actions"><button className="owner-button primary" disabled={!row.publish_consent||String(row.comment).trim().length<3||row.status==='published'} onClick={()=>onConfirm({kind:'reviewModerate',title:'نشر تقييم في الصفحة الرئيسية',payload:{id:row.id,status:'published'}})}>نشر في الرئيسية</button><button className="owner-button" disabled={row.status==='hidden'} onClick={()=>onConfirm({kind:'reviewModerate',title:'إخفاء التقييم من الصفحة الرئيسية',payload:{id:row.id,status:'hidden'}})}>إخفاء</button></div></article>)}<div className="owner-actions"><button className="owner-button" disabled={offset===0} onClick={onBack}>السابق</button><button className="owner-button" disabled={rows.length<50} onClick={onNext}>التالي</button></div></>;
}
