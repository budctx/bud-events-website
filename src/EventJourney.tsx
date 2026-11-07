import {useEffect,useRef} from 'react';
import type {ReactNode,Ref} from 'react';
import {ArrowLeft,ArrowRight,Copy,Gift,Trophy} from 'lucide-react';
import {BudSteps} from './BudUI';
import {ButtonUtility} from './ButtonUtility';
import {EventPrizeFields} from './EventPrizeFields';
import type {PrizeLinesResult} from './prize-lines';
import './event-journey.css';

export type EventJourneyPhase='live'|'prizes'|'closing';
const steps=['الإعداد','شاشة الفعالية','الجوائز','الختام'];

export function EventSetupStage({eventName,title,titleId,onTitleChange,prizeId,prizeHeadingId,prizeText,onPrizeChange,parsed,children}:{
 eventName:string;title:string;onTitleChange:(value:string)=>void;
 titleId:string;
 prizeId:string;prizeHeadingId:string;prizeText:string;onPrizeChange:(value:string)=>void;parsed:PrizeLinesResult;
 children?:ReactNode;
}){
 return <>
  <BudSteps steps={steps} current={0}/>
  <h2>{eventName}</h2>
  <div className="host-setup-field-group" aria-labelledby={`${prizeId}-basic-title`}>
   <h3 id={`${prizeId}-basic-title`}>بيانات الفعالية</h3>
   <label htmlFor={titleId}>اسم الفعالية</label>
   <input id={titleId} value={title} maxLength={100} onChange={event=>onTitleChange(event.target.value)} required/>
  </div>
  {children}
  <EventPrizeFields id={prizeId} headingId={prizeHeadingId} value={prizeText} onChange={onPrizeChange} parsed={parsed}/>
 </>;
}

export function EventJourneyHeader({title,phase,winnerCount,prizeCount,onExit,onPrizes,onWinners,disabled=false,headingRef,status}:{
 title:string;phase:EventJourneyPhase;winnerCount:number;prizeCount:number;
 onExit:()=>void;onPrizes:()=>void;onWinners?:()=>void;disabled?:boolean;headingRef?:Ref<HTMLHeadingElement>;status?:ReactNode;
}){
 return <header className="event-journey-header">
  <div className="event-journey-heading"><ButtonUtility className="event-journey-exit" label="العودة إلى بُعد" icon={ArrowRight} isDisabled={disabled} onPress={onExit}/><div><span>فعاليات بُعد</span><h1 ref={headingRef} tabIndex={-1}>{title}</h1></div></div>
  <div className="event-journey-actions">{status}{onWinners?<button type="button" className="event-journey-winners" onClick={onWinners}><Trophy aria-hidden="true" size={17}/> الفائزون <bdi>({winnerCount}{prizeCount>0?`/${prizeCount}`:''})</bdi></button>:<span className="event-journey-winners"><Trophy aria-hidden="true" size={17}/> الفائزون <bdi>{winnerCount} / {prizeCount}</bdi></span>}{phase==='live'&&<button type="button" className="event-journey-prizes" disabled={disabled} onClick={onPrizes}><Gift aria-hidden="true" size={17}/> الجوائز <ArrowLeft aria-hidden="true" size={17}/></button>}</div>
 </header>;
}

export function EventJourneySteps({phase}:{phase:EventJourneyPhase}){
 return <div className="event-journey-steps"><BudSteps steps={steps} current={phase==='live'?1:phase==='prizes'?2:3}/></div>;
}

export function EventFinishDialog({open,onCancel,onConfirm,confirmDisabled=false}:{open:boolean;onCancel:()=>void;onConfirm:()=>void;confirmDisabled?:boolean}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const node=dialog.current;if(!node)return;if(open&&!node.open)node.showModal();else if(!open&&node.open)node.close();return()=>{if(node.open)node.close();};},[open]);
 return <dialog ref={dialog} className="event-finish-dialog" aria-labelledby="event-finish-title" onCancel={event=>{event.preventDefault();onCancel();}}>
  <h2 id="event-finish-title">إنهاء الفعالية؟</h2>
  <p>ستظهر النتائج الحالية. لا يمكن الرجوع أو تعديل الجوائز بعد الإنهاء.</p>
  <div className="event-finish-actions"><button type="button" onClick={onCancel}>إلغاء</button><button type="button" className="event-finish-primary" autoFocus disabled={confirmDisabled} onClick={onConfirm}>إنهاء وعرض النتائج</button></div>
 </dialog>;
}

export function EventClosingStage({summary,onCopy,onExit,notice='',exitDisabled=false}:{summary:string;onCopy:()=>void;onExit:()=>void;notice?:string;exitDisabled?:boolean}){
 return <section className="event-closing-stage" aria-labelledby="event-closing-title">
  <h2 id="event-closing-title">شكرًا لكم على المشاركة</h2>
  <div className="event-closing-panel"><h3>نتائج الفعالية</h3><textarea readOnly aria-label="نتائج الفعالية" value={summary||'لا يوجد فائزون بعد'} rows={Math.max(4,Math.min(12,(summary.match(/\n/g)?.length??0)+2))}/><ButtonUtility label="نسخ النتائج" icon={Copy} onPress={onCopy}/>{notice&&<p role="status">{notice}</p>}</div>
  <button type="button" className="event-closing-exit" disabled={exitDisabled} onClick={onExit}>الختام</button>
 </section>;
}
