import {ComicEventTitle} from './ComicEventTitle';
import './section-controls.css';
import {Gamepad2,Layers3} from 'lucide-react';
import {BudBadge} from './BudUI';
const upcoming=[{id:'mini-games',name:'ميني قيمز',Icon:Gamepad2},{id:'lucky-cards',name:'كروت الحظ',Icon:Layers3}];
export function upcomingEventCards(){return upcoming.map(({id,name,Icon})=><article key={id} className="platform-product-card platform-upcoming-event" data-testid={'event-coming-'+id} aria-labelledby={'event-'+id+'-title'}>
 <div className="platform-product-preview platform-upcoming-preview" aria-hidden="true"><div className="platform-upcoming-face"><Icon size={64}/><span>بُعد</span></div></div>
 <div className="platform-product-information"><p className="platform-product-eyebrow">فعالية من بُعد</p><h2 id={'event-'+id+'-title'}><ComicEventTitle>{name}</ComicEventTitle></h2><p className="platform-product-description">فعالية جديدة من بُعد. ستظهر التفاصيل هنا عند توفرها.</p><div className="platform-features"><BudBadge tone="warning" variant="outline">قريبًا</BudBadge></div><div className="platform-event-actions"><button className="platform-action platform-action-secondary" type="button" disabled>قريبًا</button></div></div>
 </article>);}
