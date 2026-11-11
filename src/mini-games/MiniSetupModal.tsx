import {useRef,useState} from 'react';
import {ArrowRight} from 'lucide-react';
import {BudNotice} from '../BudUI';
import {ButtonUtility} from '../ButtonUtility';
import {EventSetupStage} from '../EventJourney';
import {EventSetupDialog} from '../EventSetupDialog';
import {EventStartLoader} from '../EventStartLoader';
import {parsePrizeLines} from '../prize-lines';
import {newHostRequestKey,HostClientError,startMiniHostEvent} from '../host-client';
import type {MiniRun} from './session.ts';
import '../host-portal.css';

export function MiniSetupModal({ownerId,onClose,onPlay}:{ownerId:string;onClose:()=>void;onPlay:(run:MiniRun)=>void}){
 const busyRef=useRef(false),pendingKey=useRef<string|null>(null);
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
 const [title,setTitle]=useState('ميني قيمز'),[startStep,setStartStep]=useState<number|null>(null);
 const [prizeText,setPrizeText]=useState(''),[error,setError]=useState('');
 const parsed=parsePrizeLines(prizeText);
 const close=()=>{if(!busyRef.current&&!pendingKey.current)onClose();};
 const start=async()=>{
  if(busyRef.current)return;
  if(!title.trim()||title.trim().length>100){setError('اكتب اسمًا للفعالية لا يتجاوز 100 حرف.');return;}
  if(!parsed.valid)return;
  busyRef.current=true;setBusy(true);setError('');
  pendingKey.current??=newHostRequestKey();
  try{
   const run=await startMiniHostEvent(ownerId,pendingKey.current,title.trim(),prizeText,setStartStep);
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
  }finally{busyRef.current=false;setBusy(false);setStartStep(null);}
 };
 return <EventSetupDialog title="إعداد ميني قيمز" onClose={close} closeDisabled={busy||uncertain}>
  <EventStartLoader step={startStep}/>
  <div className="host-portal host-embedded" dir="rtl" lang="ar">
   <header className="host-header"><ButtonUtility className="host-back" label="عودة" icon={ArrowRight} isDisabled={busy||uncertain} onPress={close}/></header>
   <div className="host-content">
    <div className="host-heading"><div><p className="host-eyebrow">بُعد</p><h1 tabIndex={-1}>فعالية جديدة</h1></div></div>
    <BudNotice tone="danger">{error}</BudNotice>
    <div className="host-single"><section className="host-panel">
     <form onSubmit={event=>{event.preventDefault();void start();}}>
      {uncertain&&<BudNotice tone="warning" persistent resolveOnUnmount>هناك طلب بدء لم نتأكد من نتيجته. أعد المحاولة بنفس الطلب؛ لن يُخصم مفتاح ثانٍ.</BudNotice>}
      <fieldset disabled={busy||uncertain}>
       <EventSetupStage eventName="ميني قيمز" title={title} titleId="mini-host-title" onTitleChange={setTitle} prizeId="mini-host-prizes" prizeHeadingId="mini-setup-prizes-title" prizeText={prizeText} onPrizeChange={setPrizeText} parsed={parsed}/>
       <p className="host-setup-summary" role="status">{parsed.count>0?`${parsed.count} جوائز · حتى ${parsed.count} سجلات فائزين`:'دون جوائز · تسجيل الفائزين غير متاح'} · بدء الفعالية يستهلك مفتاحًا واحدًا.</p>
      </fieldset>
      <div className="host-start-actions">
       <button type="submit" className="host-primary" disabled={busy||!parsed.valid||!title.trim()||title.trim().length>100}>{busy?'جارٍ بدء الفعالية…':uncertain?'إعادة المحاولة':'بدء الفعالية'}</button>
      </div>
     </form>
    </section></div>
   </div>
  </div>
 </EventSetupDialog>;
}
