import {useState} from 'react';
import {ReviewIdentity} from './ReviewIdentity';
type Row=Record<string,unknown>;
export function ReviewManager({rows,onNext,onBack,offset,onRefresh}:{rows:Row[];onNext:()=>void;onBack:()=>void;offset:number;onRefresh:()=>void}){
 const [busy,setBusy]=useState<string|null>(null),[error,setError]=useState(''),[copied,setCopied]=useState(false);
 const selected=rows.filter(row=>typeof row.featured_rank==='number').length;
 const change=async(id:string,rank:number|null)=>{
  if(busy)return;setBusy(id);setError('');
  try{
   const res=await fetch('/api/owner?flow=review',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'feature',id,rank,operationId:crypto.randomUUID()})});
   const data=await res.json().catch(()=>null);
   if(!res.ok||data?.code!=='OK')throw Error();
   onRefresh();
  }catch{setError('تعذر تحديث العرض. تحقّق من حالة التقييم ثم أعد المحاولة.');}
  finally{setBusy(null);}
 };
 return <section className="owner-review-management">
  <article className="owner-card"><div className="owner-block-heading"><h3>رابط استقبال الآراء</h3><span>{selected} / 5 معروضة</span></div>
   <p className="owner-subtle">يُرسل لأي شخص. بعد تسجيل الدخول عبر Discord يستطيع كتابة رأيه. اختر حتى خمسة آراء ورتّب ظهورها في الرئيسية.</p>
   <div className="owner-actions"><code dir="ltr">https://budteam.net/review</code>
    <button type="button" className="owner-button primary" onClick={()=>{void navigator.clipboard.writeText('https://budteam.net/review').then(()=>setCopied(true)).catch(()=>setError('تعذر نسخ الرابط. يمكنك تحديده يدويًا.'));}}>{copied?'تم النسخ':'نسخ الرابط'}</button>
    <a className="owner-button" href="/review" target="_blank" rel="noopener noreferrer">معاينة</a>
   </div>
  </article>
  {error&&<p role="alert" className="owner-subtle">{error}</p>}
  {rows.length===0&&<article className="owner-card">لا توجد آراء واردة حتى الآن.</article>}
  {rows.map(row=>{
   const id=String(row.id),rank=typeof row.featured_rank==='number'?row.featured_rank:null;
   return <article className="owner-card" key={id}>
    <div className="owner-block-heading"><h3><ReviewIdentity name={String(row.display_name)} avatarUrl={typeof row.avatar_url==='string'?row.avatar_url:null}/></h3>
     <span>{rank!==null?'معروض بالمركز '+rank:row.status==='pending'?'بانتظار المراجعة':'غير معروض'}</span></div>
    <p dir="auto" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{String(row.comment)}</p>
    <div className="owner-actions"><label htmlFor={'feature-'+id}>موقعه في الرئيسية</label>
     <select id={'feature-'+id} className="owner-button" disabled={busy!==null} value={rank??''} onChange={e=>{void change(id,e.target.value===''?null:Number(e.target.value));}}>
      <option value="">غير معروض</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>المركز {n}</option>)}
     </select><small>اختيار مركز مشغول يستبدل الرأي الموجود فيه، أو يبدّل موقعهما إذا كان الاثنان معروضين.</small>
    </div>
   </article>;
  })}
  <div className="owner-actions"><button className="owner-button" disabled={offset===0||busy!==null} onClick={onBack}>السابق</button><button className="owner-button" disabled={rows.length<50||busy!==null} onClick={onNext}>التالي</button></div>
 </section>;
}
