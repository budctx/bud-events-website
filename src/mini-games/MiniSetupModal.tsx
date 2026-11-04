import {useRef,useState} from 'react';
import {ArrowRight} from 'lucide-react';
import {BudNotice,BudSteps} from '../BudUI';
import {ButtonUtility} from '../ButtonUtility';
import {EventPrizeFields} from '../EventPrizeFields';
import {EventSetupDialog} from '../EventSetupDialog';
import {parsePrizeLines} from '../prize-lines';
import {newHostRequestKey,HostClientError,startMiniHostEvent} from '../host-client';
import type {MiniRun} from './session.ts';
import '../host-portal.css';

export function MiniSetupModal({ownerId,onClose,onPlay}:{ownerId:string;onClose:()=>void;onPlay:(run:MiniRun)=>void}){
 const busyRef=useRef(false),pendingKey=useRef<string|null>(null);
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
 const [prizeText,setPrizeText]=useState(''),[error,setError]=useState('');
 const parsed=parsePrizeLines(prizeText);
 const close=()=>{if(!busyRef.current&&!pendingKey.current)onClose();};
 const start=async()=>{
  if(busyRef.current||!parsed.valid)return;
  busyRef.current=true;setBusy(true);setError('');
  pendingKey.current??=newHostRequestKey();
  try{
   const run=await startMiniHostEvent(ownerId,pendingKey.current,prizeText);
   pendingKey.current=null;setUncertain(false);onPlay(run);
  }catch(reason){
   const issue=reason instanceof HostClientError?reason:null;
   const rejected=!!issue&&['NO_SLOT_CREDIT','ACTIVE_EVENT_EXISTS','PRODUCT_UNAVAILABLE','ACCOUNT_RESTRICTED'].includes(issue.code);
   if(rejected)pendingKey.current=null;
   setUncertain(!rejected);
   setError(issue?.code==='NO_SLOT_CREDIT'?'لا يوجد رصيد كافٍ لبدء الفعالية.':
    issue?.code==='ACTIVE_EVENT_EXISTS'?'هناك فعالية أخرى نشطة. أغلقها قبل بدء فعالية جديدة.':
    issue?.code==='LOCAL_STORAGE_UNAVAILABLE'?'تعذر تفعيل الحفظ المحلي. لا تبدأ الفعالية في هذا المتصفح.':
    'تعذر التأكد من بدء الفعالية. أعد المحاولة بنفس الطلب حتى لا يُخصم مفتاح آخر.');
  }finally{busyRef.current=false;setBusy(false);}
 };
 return <EventSetupDialog title="إعداد ميني قيمز" onClose={close} closeDisabled={busy||uncertain}>
  <div className="host-portal host-embedded" dir="rtl" lang="ar">
   <header className="host-header"><ButtonUtility className="host-back" label="عودة" icon={ArrowRight} isDisabled={busy||uncertain} onPress={close}/></header>
   <div className="host-content">
    <div className="host-heading"><div><p className="host-eyebrow">بُعد</p><h1 tabIndex={-1}>فعالية جديدة</h1></div></div>
    <BudNotice tone="danger">{error}</BudNotice>
    <div className="host-single"><section className="host-panel">
     <BudSteps steps={['الإعداد','شاشة الفعالية','الجوائز','الختام']} current={0}/>
     <h2>ميني قيمز</h2>
     <p className="host-local-policy">جهّز الجوائز قبل بدء الفعالية. يمكنك تركها فارغة واللعب دون تسجيل فائزين.</p>
     <form onSubmit={event=>{event.preventDefault();void start();}}>
      {uncertain&&<BudNotice tone="warning" persistent resolveOnUnmount>هناك طلب بدء لم نتأكد من نتيجته. أعد المحاولة بنفس الطلب؛ لن يُخصم مفتاح ثانٍ.</BudNotice>}
      <fieldset disabled={busy||uncertain}>
       <EventPrizeFields id="mini-host-prizes" headingId="mini-setup-prizes-title" value={prizeText} onChange={setPrizeText} parsed={parsed}/>
      </fieldset>
      <div className="host-start-actions">
       <p className="host-start-hint">عدد الجوائز: {parsed.count} · عدد الفائزين الأقصى هو عدد الجوائز.</p>
       <button type="submit" className="host-primary" disabled={busy||!parsed.valid}>{busy?'جارٍ بدء الفعالية…':uncertain?'إعادة المحاولة':'بدء الفعالية'}</button>
      </div>
     </form>
    </section></div>
   </div>
  </div>
 </EventSetupDialog>;
}
