import {useCallback,useEffect,useState} from 'react';
import {Star} from 'lucide-react';
import {ReviewIdentity} from './ReviewIdentity';
import './reviews.css';

type RecentReview={id:string;name:string;comment:string;rating:number;avatarUrl:string|null;publishedAt:string};
type Page={items:RecentReview[];hasMore:boolean};
const PAGE_SIZE=12;
export function LatestReviews({refreshKey=0}:{refreshKey?:number}){
 const [rows,setRows]=useState<RecentReview[]>([]);
 const [hasMore,setHasMore]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [loaded,setLoaded]=useState(false);
 const load=useCallback(async(offset:number,signal?:AbortSignal)=>{
  const response=await fetch('/api/owner?public=latest-reviews&offset='+offset,{signal,cache:'no-store'});
  const body=await response.json();
  if(!response.ok||body.code!=='OK'||!Array.isArray(body.data?.items)||typeof body.data?.hasMore!=='boolean')throw Error('REVIEWS_UNAVAILABLE');
  return body.data as Page;
 },[]);
 useEffect(()=>{
  const controller=new AbortController();
  setBusy(true);setError('');setLoaded(false);
  void load(0,controller.signal).then(result=>{
   if(!controller.signal.aborted){setRows(result.items);setHasMore(result.hasMore);setLoaded(true);}
  }).catch(()=>{if(!controller.signal.aborted)setError('تعذر تحميل آراء المجتمع. حاول مرة أخرى.');})
   .finally(()=>{if(!controller.signal.aborted)setBusy(false);});
  return()=>controller.abort();
 },[load,refreshKey]);
 const more=async()=>{
  if(busy||!hasMore)return;
  setBusy(true);setError('');
  try{
   const result=await load(rows.length);
   setRows(prev=>[...prev,...result.items.filter(item=>!prev.some(row=>row.id===item.id))]);
   setHasMore(result.hasMore);
  }catch{setError('تعذر عرض المزيد من الآراء. حاول مرة أخرى.');}
  finally{setBusy(false);}
 };
 return <section className="bud-latest-reviews" aria-labelledby="bud-latest-reviews-title">
  <div className="bud-latest-reviews-heading"><h2 id="bud-latest-reviews-title">آخر آراء المجتمع</h2></div>
  {loaded&&!rows.length&&<p className="bud-latest-reviews-empty">لا توجد تقييمات منشورة بعد. كن أول من يشارك رأيه.</p>}
  <div className="bud-latest-reviews-grid">
   {rows.map(item=><figure className="bud-review-card" key={item.id}>
    <figcaption><ReviewIdentity name={item.name} avatarUrl={item.avatarUrl}/></figcaption>
    <div className="bud-review-rating" aria-label={`${item.rating} من 5`}>{[1,2,3,4,5].map(value=><Star key={value} aria-hidden="true" fill={value<=item.rating?'currentColor':'none'}/>)}</div>
    <blockquote dir="auto">{item.comment}</blockquote>
   </figure>)}
  </div>
  {error&&<p role="alert" className="bud-latest-reviews-error">{error}</p>}
  {busy&&<p role="status">جارٍ تحميل التقييمات…</p>}
  {hasMore&&<button type="button" className="bud-latest-reviews-more" disabled={busy} onClick={()=>void more()}>عرض المزيد</button>}
 </section>;
}
