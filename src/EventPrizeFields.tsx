import {HelpTip} from './InterfaceControls';
import {BudNotice} from './BudUI';
import type {PrizeLinesResult} from './prize-lines';

/** Shared prize editor used by both Question & Condition and Mini Games. */
export function EventPrizeFields({id,headingId,value,onChange,parsed}:{id:string;headingId:string;value:string;onChange:(value:string)=>void;parsed:PrizeLinesResult}){
 return <div className="host-setup-field-group" aria-labelledby={headingId} data-event-prize-editor="shared">
  <h3 id={headingId}>تجهيز الجوائز</h3>
  <div className="host-field-label"><label htmlFor={id}>الجوائز</label><HelpTip label="توضيح الجوائز">كل سطر غير فارغ جائزة مستقلة، وهو الحد الأقصى للفائزين. حتى 50 جائزة، و100 حرف لكل جائزة.</HelpTip></div>
  <textarea id={id} rows={5} value={value} onChange={event=>onChange(event.target.value)} aria-invalid={!parsed.valid} autoComplete="off" spellCheck={false}/>
  {!parsed.valid&&<BudNotice tone="danger" resolveOnUnmount>أدخل حتى 50 جائزة، بحد أقصى 100 حرف لكل سطر.</BudNotice>}
 </div>;
}
