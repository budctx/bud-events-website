import {Plus} from 'lucide-react';
import type {ManualPrize,ManualWinner} from './manual-game';
import {ButtonUtility} from './ButtonUtility';
import {WinnerIcon,WinnerList,WinnerNumber} from './WinnerList';

type Props={
 winners:ManualWinner[];prizes:ManualPrize[];selectedWinnerId:string;
 onSelectWinner:(id:string)=>void;onDeleteWinner:(winner:ManualWinner)=>void;
 onAddWinner?:()=>void;addDisabled?:boolean;readOnly?:boolean;
 onOpenPrize:(prize:ManualPrize)=>void;onBack:()=>void;backDisabled:boolean;onFinish:()=>void;
};

/** Shared prize stage for every BU'D event. Activity screens stay independent. */
export function EventPrizeStage({winners,prizes,selectedWinnerId,onSelectWinner,onDeleteWinner,onAddWinner,addDisabled=false,readOnly=false,onOpenPrize,onBack,backDisabled,onFinish}:Props){
 const selectedWinner=winners.find(w=>w.id===selectedWinnerId&&!prizes.some(p=>p.winnerId===w.id));
 const manualOpen=!selectedWinner&&prizes.some(p=>!p.revealed)&&winners.every(w=>prizes.some(p=>p.winnerId===w.id));
 const full=prizes.length>0&&winners.length>=prizes.length;
 return <section className="mg-prizes-screen" aria-label="الجوائز" data-event-section="shared-prizes">
  <aside className="mg-panel mg-winners-sidebar" aria-labelledby="mg-sidebar-title">
   <div className="mg-winners-heading"><h2 id="mg-sidebar-title"><WinnerIcon kind="people"/>قائمة الفائزين</h2>{onAddWinner&&<ButtonUtility className="mg-add-winner" label="إضافة فائز" icon={Plus} isDisabled={readOnly||addDisabled||full} onPress={onAddWinner}/>}</div>
   <WinnerList winners={winners} prizes={prizes} locale="ar" selectedId={selectedWinnerId||undefined} onSelect={onSelectWinner} readOnly={readOnly} onDelete={onDeleteWinner}/>
   {!winners.length&&<p className="mg-help">{onAddWinner?'يمكنك إضافة فائز من زر +، أو فتح بطاقات الجوائز مباشرة.':'يمكنك فتح بطاقات الجوائز مباشرة.'}</p>}
   {full&&<p className="mg-help">اكتمل العدد؛ احذف سجلًا من الفائزين لإضافة بديل.</p>}
  </aside>
  <div className="mg-prize-stage">
   <div className="mg-draw-status" role="status">{manualOpen?<span>يمكنك فتح بطاقات الجوائز المتبقية مباشرةً</span>:selectedWinner?<><span>السحب الآن لـ</span><strong dir="auto">{selectedWinner.name}</strong><WinnerNumber id={selectedWinner.id}/><small>اختر بطاقة لفتح جائزته</small></>:<span>{winners.length&&winners.every(w=>prizes.some(p=>p.winnerId===w.id))?'حصل جميع الفائزين على جوائزهم':'اختر فائزًا من القائمة ثم اختر بطاقة جائزة'}</span>}</div>
   <div className="mg-panel mg-prize-board">{prizes.length===0?<p>لا توجد جوائز مسجلة.</p>:<div className="mg-prize-grid">{prizes.map((prize,index)=>{
    const recipient=winners.find(w=>w.id===prize.winnerId);
    return <button type="button" className="mg-prize-card" data-revealed={prize.revealed} key={prize.id} disabled={readOnly||prize.revealed||(!selectedWinner&&!manualOpen)} aria-label={prize.revealed?['جائزة',index+1,prize.name,recipient?.name??'دون اسم'].join(' '):['فتح الجائزة',index+1].join(' ')} onClick={()=>onOpenPrize(prize)}>
     {prize.revealed?<><span className="mg-prize-recipient"><strong dir="auto">{recipient?.name??'دون اسم'}</strong>{recipient&&<WinnerNumber id={recipient.id}/>}</span><span className="mg-prize-ribbon" dir="auto">{prize.name}</span><small>تم فتح الجائزة</small></>:<><WinnerIcon kind="gift"/><bdi className="mg-prize-index">{index+1}</bdi></>}
    </button>;
   })}</div>}</div>
   <div className="mg-draw-footer">{backDisabled&&!readOnly&&<p className="mg-help">بدأ فتح الجوائز؛ لا يمكن العودة إلى الألعاب.</p>}<div className="mg-actions"><button className="mg-button" disabled={readOnly||backDisabled} onClick={onBack}>عودة</button><button className="mg-button mg-primary" disabled={readOnly} onClick={onFinish}>انهاء</button></div></div>
  </div>
 </section>;
}
