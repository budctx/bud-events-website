import {useEffect,useState} from 'react';
import {Star} from 'lucide-react';
import './reviews.css';
export type PublicReview={id:string;name:string;comment:string;rating:number};
export function PublicReviews(){
 const [rows,setRows]=useState<PublicReview[]>([]);
 useEffect(()=>{const controller=new AbortController();void fetch('/api/owner?public=reviews',{signal:controller.signal,cache:'no-store'}).then(async res=>{if(!res.ok)return;const body=await res.json();if(body.code==='OK'&&Array.isArray(body.data))setRows(body.data);}).catch(()=>{});return()=>controller.abort();},[]);
 if(!rows.length)return <div className="platform-review-empty"><strong>آراء المجتمع قريبًا</strong><p>لم تُنشر آراء معتمدة بعد.</p></div>;
 return <section className="bud-public-reviews" aria-labelledby="bud-reviews-heading"><h2 id="bud-reviews-heading">من تجارب مجتمع بُعد</h2><div>{rows.map(row=><figure key={row.id}><div className="bud-review-rating" aria-label={`${row.rating} من 5`}>{[1,2,3,4,5].map(n=><Star key={n} aria-hidden="true" fill={n<=row.rating?'currentColor':'none'}/>)}</div><blockquote dir="auto">{row.comment}</blockquote><figcaption dir="auto">{row.name}</figcaption></figure>)}</div></section>;
}
