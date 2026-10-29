import {ButtonUtility} from './ButtonUtility';
import {X} from 'lucide-react';
import {useBudToast} from './BudUI';
import {useEffect,useRef,useState} from 'react';
import {HostClientError} from './host-client';
import {ownerError,ownerRequest} from './owner-client';
import './owner.css';
export default function RedeemDialog({open,onClose,onRefresh}:{open:boolean;onClose:()=>void;onRefresh:()=>void}){
 const toast=useBudToast();
 const [code,setCode]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[success,setSuccess]=useState(false);
 const attempt=useRef<{code:string;id:string}|null>(null),active=useRef(true),lock=useRef(false);
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 useEffect(()=>{if(open){if(!attempt.current){setMessage('');setSuccess(false);}dialog.current?.showModal();}else dialog.current?.close();},[open]);
 const submit=async()=>{
  if(lock.current)return;lock.current=true;setBusy(true);setMessage('');setSuccess(false);
  attempt.current??={code:code.trim().toUpperCase().replace(/\s/g,''),id:crypto.randomUUID()};
  try{const result=await ownerRequest<{receipt:string;credits:number}>({action:'redeem',code:attempt.current.code,operationId:attempt.current.id});
   if(active.current){setMessage(`تم استرداد المفتاح. رصيدك الآن ${result.credits} — الإيصال ${result.receipt}`);setSuccess(true);toast('تم استرداد المفتاح وإضافة رصيده.','success');setCode('');attempt.current=null;onRefresh();}
  }catch(reason){if(active.current){if(reason instanceof HostClientError&&[400,401,403,429].includes(reason.status))attempt.current=null;setMessage(ownerError(reason));}}
  finally{lock.current=false;if(active.current)setBusy(false);}
 };
 return <dialog dir="rtl" className="owner-modal" ref={dialog} aria-labelledby="redeem-title" onClose={onClose} onCancel={e=>{if(busy)e.preventDefault();}}><form onSubmit={e=>{e.preventDefault();void submit();}}>
   <h2 id="redeem-title">استرداد مفتاح</h2><p>أدخل مفتاح الهدية لإضافته إلى رصيد تشغيلك.</p><label>المفتاح<input autoFocus dir="ltr" autoComplete="off" spellCheck={false} value={code} disabled={busy||!!attempt.current} onChange={e=>setCode(e.target.value)} maxLength={64} required={!attempt.current}/></label>
   {message&&<p role={success?'status':'alert'} className={success?'owner-success':'owner-error'}>{message}</p>}
   <div className="owner-actions"><button className="owner-button primary" type="submit" disabled={busy||success}>{busy?'جارٍ التحقق…':attempt.current?'تحقق':'تأكيد'}</button><ButtonUtility label="إغلاق" icon={X} isDisabled={busy} onPress={()=>dialog.current?.close()}/></div>
  </form></dialog>;
}
