import {useEffect,useState} from 'react';
import {MessageSquareHeart,Star} from 'lucide-react';
import {Seo} from './Seo';
import {ReviewIdentity} from './ReviewIdentity';
import {LatestReviews} from './LatestReviews';
import {getHostSession,signInHost} from './host-client';
import type {HostSession} from './host-client';
import './review-page.css';

type Stage='loading'|'login'|'editing'|'thanks'|'error';
type ReviewResponse={code:string;data?:{comment?:string;rating?:number;publishConsent?:boolean;status?:string;received?:boolean}};
async function reviewRequest(action:Record<string,unknown>):Promise<ReviewResponse>{
 const response=await fetch('/api/owner?flow=review',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(action)});
 const data=await response.json().catch(()=>null);
 if(!response.ok||!data||data.code!=='OK')throw Error(data?.code??'SERVICE_UNAVAILABLE');
 return data;
}
export default function ReviewPage(){
 const [stage,setStage]=useState<Stage>('loading'),[user,setUser]=useState<HostSession|null>(null);
 const [rating,setRating]=useState(0),[comment,setComment]=useState(''),[publishConsent,setPublishConsent]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [previousStatus,setPreviousStatus]=useState<string|null>(null);
 const [reviewRefresh,setReviewRefresh]=useState(0);
 useEffect(()=>{
  let active=true;
  void getHostSession().then(async session=>{
   if(!active)return;
   setUser(session);
   try{const result=await reviewRequest({action:'mine'});if(active&&result.data?.comment){
    setComment(result.data.comment);setRating(Number(result.data.rating)||0);setPublishConsent(result.data.publishConsent===true);
    setPreviousStatus(result.data.status??'pending');
   }}
   catch{if(active)setError('تعذر تحميل رأيك السابق. تأكد من اتصالك قبل الإرسال.');}
   if(active)setStage('editing');
  }).catch(e=>{if(active)setStage(e?.status===401?'login':'error');});
  return()=>{active=false;};
 },[]);
 const submit=async()=>{
  if(busy||!user||rating<1||rating>5||comment.trim().length<3)return;
  setBusy(true);setError('');
  try{await reviewRequest({action:'submit',rating,comment:comment.trim(),publishConsent});setPreviousStatus(publishConsent?'published':'pending');setReviewRefresh(v=>v+1);setStage('thanks');}
  catch{setError('تعذر إرسال الرأي. تحقق من اتصالك ثم أعد المحاولة.');}
  finally{setBusy(false);}
 };
 return <div className="bud-review-page" dir="rtl">
  <Seo locale="ar" screen="review"/>
  <header className="bud-review-page-header"><a href="/" aria-label="بُعد — الرئيسية"><img src="/assets/bud-emblem.svg" width="38" height="30" alt=""/> <span>بُعد</span></a></header>
  <main className="bud-review-page-main">
   {stage==='thanks'?<section className="bud-review-page-card bud-review-thanks" aria-live="polite">
    <span className="bud-review-thanks-icon" aria-hidden="true">✓</span><h1>شكرًا لك!</h1><p>{previousStatus==='published'?'تم نشر تقييمك في آراء المجتمع.':'تم حفظ تقييمك دون نشره للعموم.'}</p><a className="bud-review-action" href="/">العودة للرئيسية</a>
   </section>:<section className="bud-review-page-card">
    <div className="bud-review-page-heading"><MessageSquareHeart size={32} aria-hidden="true"/><h1>شاركنا رأيك</h1><p>رأيك يهمنا ويساعدنا نطوّر تجربتك.</p></div>
    {stage==='loading'&&<p role="status">جارٍ تحميل حسابك…</p>}
    {stage==='error'&&<><p role="alert">تعذر التحقق من الجلسة حاليًا.</p><button className="bud-review-action" onClick={()=>location.reload()}>إعادة المحاولة</button></>}
    {stage==='login'&&<button className="bud-review-action" type="button" onClick={()=>{setStage('loading');void signInHost({page:'review',locale:'ar'}).catch(()=>setStage('error'));}}>تسجيل الدخول عبر Discord</button>}
    {stage==='editing'&&<form onSubmit={e=>{e.preventDefault();void submit();}}>
     {user&&<div className="bud-review-identity"><ReviewIdentity name={user.displayName.trim().slice(0,60)} avatarUrl={user.avatarUrl}/></div>}
     <fieldset className="bud-review-rating-field"><legend>تقييم التجربة من 5</legend><div className="bud-review-stars">
      {[1,2,3,4,5].map(value=><label key={value}><input type="radio" name="rating" value={value} required checked={rating===value} disabled={busy} onChange={()=>setRating(value)}/><Star aria-hidden="true" fill={rating>=value?'currentColor':'none'}/><span>{value} من 5</span></label>)}
     </div></fieldset>
     <label htmlFor="bud-review-input">تعليقك</label>
     <textarea id="bud-review-input" maxLength={500} minLength={3} required value={comment} disabled={busy} onChange={e=>setComment(e.target.value)} placeholder="اكتب رأيك هنا…" aria-describedby="bud-review-count"/>
     <small id="bud-review-count" className="bud-review-count" aria-live="off"><bdi>{new Intl.NumberFormat('ar-SA-u-nu-latn').format(comment.length)}</bdi> / 500</small>
     <label className="bud-review-publish-consent"><input type="checkbox" checked={publishConsent} disabled={busy} onChange={e=>setPublishConsent(e.target.checked)}/><span>أوافق على نشر النجوم وتعليقي مع اسمي وصورتي العامة من Discord في موقع بُعد. إذا لم أوافق، سيُحفظ التقييم دون عرضه للعموم.</span></label>
     {error&&<div className="bud-review-inline-error" role="alert"><span>{error}</span><button type="button" onClick={()=>location.reload()}>إعادة المحاولة</button></div>}
     <button className="bud-review-action" disabled={busy||rating<1||comment.trim().length<3} type="submit">{busy?'جارٍ الإرسال…':'إرسال التقييم'}</button>
    </form>}
   </section>}
   <LatestReviews refreshKey={reviewRefresh}/>
  </main>
  <footer className="bud-review-page-footer"><a href="/policies#privacy">السياسات والخصوصية</a><span>© بُعد 2026</span></footer>
 </div>;
}
