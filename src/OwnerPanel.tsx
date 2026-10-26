import {useEffect,useRef,useState} from 'react';
import {HostClientError,signInHost} from './host-client';
import {ownerError,ownerRequest} from './owner-client';
import type {OwnerData,OwnerRow} from './owner-client';
import {clearOwnerPending,readOwnerPending,saveOwnerPending} from './owner-pending';
import type {PendingOwnerOperation} from './owner-pending';
import './owner.css';
const sections=[['overview','نظرة عامة وتنبيهات'],['users','المستخدمون'],['keys','المفاتيح والمنح'],['payments','المدفوعات'],['events','الفعاليات'],['audit','سجل العمليات'],['health','صحة النظام'],['settings','الإعدادات'],['search','البحث الموحد']] as const;
const labels:Record<string,string>={accessEvents:'محاولات الوصول',authentication_failed:'فشل التحقق من الهوية',owner_denied:'وصول إداري مرفوض',issuance_denied:'محاولة إصدار غير مصرح بها',authentication_failures:'تكرار فشل التحقق',code_expiring:'اقتراب انتهاء مفتاح',users:'المستخدمون',started_at:'وقت البدء',worker_telemetry_stale:'غياب بيانات حديثة للمعالج',payment_delivery_delayed:'تأخر تسليم دفعة',payment_review:'دفعة تحتاج مراجعة',history:'الاستردادات والمنح',id:'المرجع',host_id:'الحساب',name:'الاسم',discord_id:'Discord ID',created_at:'تاريخ الإنشاء',updated_at:'آخر تحديث',qty:'المفاتيح',max_uses:'حد الاستخدام',uses:'الاستخدامات',expires_at:'الصلاحية',suspended:'موقوف',amount_minor:'المبلغ بالهللة',currency:'العملة',fulfilled_at:'التسليم',state:'الحالة',phase:'المرحلة',title:'الفعالية',kind:'الإجراء',subject:'المرجع',reason:'السبب',actor:'المنفذ',outcome:'النتيجة',operation_id:'العملية',value:'القيمة',source:'المصدر',severity:'الأولوية',fingerprint:'مرجع التنبيه',active:'نشط',last_seen:'آخر رصد',first_seen:'أول رصد',acknowledged_at:'الإقرار',resolved_at:'المعالجة',notified_at:'الإشعار',acknowledged_by:'صاحب الإقرار',database:'قاعدة البيانات',payments:'معالجة الدفع',discord:'Discord',whop:'Whop',vercel:'Vercel',health:'صحة الخدمات',wallets:'المحافظ',slots:'رصيد التشغيل',orders:'الطلبات',pendingOrders:'طلبات تنتظر التسليم',events:'الفعاليات',codes:'المفاتيح',redemptions:'الاستردادات',credits:'رصيد التشغيل',restriction:'تقييد الحساب',grants:'المنح',user:'المستخدم',queue:'الطابور',workers:'المعالجات',pending:'بانتظار المعالجة',processing:'قيد المعالجة',done:'مكتمل',review:'يحتاج مراجعة',confirmed:'مؤكد',refunded:'مسترجع',disputed:'نزاع',unknown:'غير معروف',ok:'سليم',never:'لم يُرصد',running:'يعمل',attention:'يحتاج متابعة',failed:'فشل',task:'المهمة',status:'الحالة',lastAttemptAt:'آخر محاولة',lastSuccessAt:'آخر نجاح',due:'المهام المستحقة',reconciliationReview:'تسويات للمراجعة',reconciliationStale:'تسويات متأخرة',oldestPendingAt:'أقدم مهمة',completed:'منتهية',live:'الفعالية',prizes:'الجوائز',closing:'الختام',purchase:'شراء',redeem:'استرداد',admin_grant:'منحة إدارية'};
function display(value:unknown):string{if(value===null||value===undefined)return '—';if(typeof value==='boolean')return value?'نعم':'لا';return labels[String(value)]??String(value);}
function DataView({data,onUser}:{data:unknown;onUser?:(id:string)=>void}){
 if(data===null||data===undefined)return <p>لا توجد بيانات.</p>;
 if(Array.isArray(data)){
  if(!data.length)return <p className="owner-empty">لا توجد سجلات مطابقة.</p>;
  return <div className="owner-records">{data.map((row,i)=>typeof row==='object'&&row!==null?<article className="owner-record" key={String((row as OwnerRow).id??i)}><DataView data={row}/>{onUser&&typeof (row as OwnerRow).id==='string'&&<button className="owner-button" onClick={()=>onUser(String((row as OwnerRow).id))}>فتح ملف المستخدم</button>}</article>:<p key={i}>{display(row)}</p>)}</div>;
 }
 if(typeof data==='object')return <dl className="owner-data">{Object.entries(data).filter(([k])=>!['request','offset','pageSize','mayHaveMore'].includes(k)).map(([key,v])=><div key={key}><dt>{labels[key]??key}</dt><dd>{typeof v==='object'&&v!==null?<DataView data={v}/>:<bdi>{display(v)}</bdi>}</dd></div>)}</dl>;
 return <p>{display(data)}</p>;
}
type Action={kind:string;payload:Record<string,unknown>;title:string};
export default function OwnerPanel({onClose,ownerId}:{onClose:()=>void;ownerId:string}){
 const [section,setSection]=useState<string>('overview'),[query,setQuery]=useState(''),[search,setSearch]=useState(''),[offset,setOffset]=useState(0),[revision,setRevision]=useState(0);
 const [data,setData]=useState<OwnerData|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[reauth,setReauth]=useState(false);
 const [action,setAction]=useState<Action|null>(null),[reason,setReason]=useState(''),[checked,setChecked]=useState(false),[notice,setNotice]=useState(''),[secret,setSecret]=useState('');
 const [qty,setQty]=useState('1'),[maxUses,setMaxUses]=useState('1'),[expires,setExpires]=useState(''),[target,setTarget]=useState(''),[note,setNote]=useState('');
 const [recoveryOrder,setRecoveryOrder]=useState(''),[recoveryPayment,setRecoveryPayment]=useState('');
 const [pending,setPending]=useState(()=>readOwnerPending(ownerId));
 const pendingRef=useRef<PendingOwnerOperation|null>(pending);
 const dialog=useRef<HTMLDialogElement>(null),generation=useRef(0),alive=useRef(true),locked=useRef(false),operation=useRef<string|null>(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{const controller=new AbortController();const run=++generation.current;setData(null);setError('');setLoading(true);
  if(section==='search'&&search.trim().length<2){setLoading(false);return()=>controller.abort();}
  void ownerRequest({action:'view',section,search,offset},controller.signal).then(v=>{if(run===generation.current&&!controller.signal.aborted)setData(v);}).catch(e=>{if(!controller.signal.aborted&&run===generation.current)setError(ownerError(e));}).finally(()=>{if(!controller.signal.aborted&&run===generation.current)setLoading(false);});
  return()=>controller.abort();
 },[section,search,offset,revision]);
 const navigate=(next:string)=>{setSection(next);setSearch('');setQuery('');setOffset(0);setNotice('');};
 const restorePending=()=>{
  const saved=pendingRef.current??readOwnerPending(ownerId);if(!saved)return;
  pendingRef.current=saved;setPending(saved);setAction({kind:saved.kind,payload:saved.payload,title:saved.title});setReason(saved.reason);setChecked(true);setSecret('');setReauth(false);
  setNotice('سنتحقق من إيصال العملية السابقة قبل إعادة إرسال الطلب نفسه.');operation.current=saved.operationId;dialog.current?.showModal();
 };
 const open=(next:Action)=>{
  if(pendingRef.current||readOwnerPending(ownerId)){restorePending();return;}
  setAction(next);setReason('');setChecked(false);setNotice('');setSecret('');setReauth(false);operation.current=crypto.randomUUID();dialog.current?.showModal();
 };
 const submit=async()=>{if(locked.current||!action||!checked||reason.trim().length<3)return;locked.current=true;setBusy(true);setNotice('');setReauth(false);
  const previous=pendingRef.current;
  try{
   const saved=previous??{ownerId,operationId:operation.current!,kind:action.kind,payload:action.payload,reason:reason.trim(),title:action.title};
   if(!previous){if(!saveOwnerPending(saved))throw new HostClientError('OWNER_PENDING_NOT_SAVED',0);pendingRef.current=saved;setPending(saved);}
   let result:OwnerData|undefined;
   if(previous){
    const receipt=await ownerRequest<{found:boolean;kind?:string;result?:OwnerData}>({action:'receipt',operationId:saved.operationId});
    if(receipt.found){if(receipt.kind!==saved.kind||!receipt.result)throw new HostClientError('OWNER_RECEIPT_UNCONFIRMED',503);result=receipt.result;}
   }
   result??=await ownerRequest<OwnerData>({action:saved.kind,payload:saved.payload,operationId:saved.operationId,reason:saved.reason,confirmed:true});
   clearOwnerPending(ownerId,saved.operationId);pendingRef.current=null;if(!alive.current)return;setPending(null);
   if(typeof result.code==='string'){setSecret(result.code);setNotice('احفظ المفتاح الآن. يُعرض مرة واحدة فقط.');}
   else{setNotice(saved.kind==='createCode'&&result.replayed===true?`تم تأكيد إنشاء المفتاح السابق دون تكراره. لا يمكن إعادة عرض نصه؛ يمكنك إيقافه من سجل المفاتيح. المرجع: ${String(result.id??'')}`:result.verified===true?'تم التحقق من الدفعة لدى Whop دون إضافة رصيد.':result.replayed===true?'تم تأكيد إيصال العملية السابقة دون تكرارها.':'تمت العملية وسُجلت في سجل العمليات.');}
   setAction(null);setRevision(v=>v+1);
  }catch(e){
   if(!previous&&e instanceof HostClientError&&[400,401,403,429].includes(e.status)){clearOwnerPending(ownerId);pendingRef.current=null;if(alive.current)setPending(null);}
   if(alive.current){setNotice(ownerError(e));setReauth(e instanceof HostClientError&&e.code==='OWNER_REAUTH_REQUIRED');}
  }
  finally{locked.current=false;if(alive.current)setBusy(false);}
 };
 const userOpen=(id:string)=>{setSection('user');setSearch(id);setQuery(id);setOffset(0);setTarget(id);};
 return <section className="owner-shell" dir="rtl" aria-label="لوحة المالك">
  <aside className="owner-sidebar"><p className="owner-eyebrow">بُعد / إدارة المنصة</p><h1>لوحة المالك</h1><nav aria-label="أقسام لوحة المالك">{sections.map(([id,title])=><button key={id} aria-current={section===id?'page':undefined} onClick={()=>navigate(id)}>{title}</button>)}</nav><button className="owner-button" onClick={onClose}>العودة إلى البروفايل</button></aside>
  <div className="owner-content"><header className="owner-page-heading"><div><p className="owner-eyebrow">إدارة بُعد</p><h2>{sections.find(([id])=>id===section)?.[1]??'ملف المستخدم'}</h2></div><button className="owner-button" onClick={()=>setRevision(v=>v+1)} disabled={loading}>تحديث</button></header>
   {pending&&<aside className="owner-card" aria-label="عملية قيد التحقق"><p>هناك عملية سابقة لم تتأكد نتيجتها. تحقق منها قبل إنشاء عملية أخرى.</p><button className="owner-button" onClick={restorePending}>التحقق من العملية السابقة</button></aside>}
   {['users','keys','payments','events','audit','search'].includes(section)&&<form className="owner-search" onSubmit={e=>{e.preventDefault();setSearch(query.trim());setOffset(0);}}><label>بحث<input value={query} onChange={e=>setQuery(e.target.value)} maxLength={80} placeholder={section==='users'?'الاسم أو Discord ID أو معرّف الحساب':'اكتب مرجعًا أو كلمة للبحث'}/></label><button className="owner-button primary">بحث</button></form>}
   {section==='keys'&&<article className="owner-card"><h3>إنشاء مفتاح هدية أو حملة</h3><form className="owner-form" onSubmit={e=>{e.preventDefault();open({kind:'createCode',payload:{qty:Number(qty),maxUses:Number(maxUses),expiresAt:new Date(expires).toISOString()},title:'إنشاء مفتاح'});}}><label>Slots لكل استرداد<input type="number" min="1" max="100" required value={qty} onChange={e=>setQty(e.target.value)}/></label><label>إجمالي مرات الاستخدام<input type="number" min="1" max="10000" required value={maxUses} onChange={e=>setMaxUses(e.target.value)}/></label><label>انتهاء الصلاحية<input type="datetime-local" required value={expires} onChange={e=>setExpires(e.target.value)}/></label><button className="owner-button primary">مراجعة إنشاء المفتاح</button></form></article>}
   {['keys','user'].includes(section)&&<article className="owner-card"><h3>منحة إدارية</h3><p>المنح مستقلة عن المدفوعات؛ لا تستخدمها لتسوية طلب شراء.</p><form className="owner-form" onSubmit={e=>{e.preventDefault();open({kind:'grant',payload:{hostId:target,qty:Number(qty)},title:`منح ${qty} Slots للحساب ${target}`});}}><label>معرّف الحساب الموثق<input dir="ltr" required value={target} onChange={e=>setTarget(e.target.value)} pattern="[a-fA-F0-9-]{36}"/></label><label>عدد Slots<input type="number" min="1" max="100" required value={qty} onChange={e=>setQty(e.target.value)}/></label><button className="owner-button primary">مراجعة المنحة</button></form>{section==='user'&&<div className="owner-actions"><button className="owner-button" onClick={()=>open({kind:'restrict',payload:{hostId:search,suspended:true},title:'تقييد الاستخدام الجديد للحساب'})}>تقييد الاستخدام</button><button className="owner-button" onClick={()=>open({kind:'restrict',payload:{hostId:search,suspended:false},title:'رفع التقييد الإداري عن الحساب'})}>رفع التقييد</button></div>}</article>}
   {section==='settings'&&<article className="owner-card"><h3>ملاحظة تشغيلية داخلية</h3><form onSubmit={e=>{e.preventDefault();open({kind:'setting',payload:{name:'operations_note',value:note},title:'حفظ الملاحظة التشغيلية'});}}><label>الملاحظة<textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={500}/></label><button className="owner-button primary">مراجعة الحفظ</button></form><p>إعدادات الدفع والأسرار تُدار من بيئة الخادم.</p></article>}
   {section==='payments'&&<p className="owner-card">الاستعادة تتحقق من Whop وتستخدم سجل المشتريات الأصلي، مع حفظ إيصال إداري. لا تستخدم المنح لتسوية الدفع.</p>}
   {section==='payments'&&<article className="owner-card"><h3>استعادة دفعة موثقة</h3><p>أدخل مرجع الطلب ومعرّف الدفع الأصلي من Whop. يُعاد التحقق من المزود قبل التسليم، دون إنشاء شراء جديد.</p><form className="owner-form" onSubmit={e=>{e.preventDefault();open({kind:'inspectPayment',payload:{orderId:recoveryOrder,paymentId:recoveryPayment},title:'فحص الدفعة لدى Whop دون إضافة رصيد'});}}><label>مرجع طلب بُعد<input required dir="ltr" value={recoveryOrder} onChange={e=>setRecoveryOrder(e.target.value)} pattern="[a-fA-F0-9-]{36}"/></label><label>معرّف دفع Whop<input required dir="ltr" value={recoveryPayment} onChange={e=>setRecoveryPayment(e.target.value)} pattern="pay_[A-Za-z0-9]{5,80}"/></label><button className="owner-button">فحص الدفعة</button><button type="button" className="owner-button primary" disabled={!/^[a-fA-F0-9-]{36}$/.test(recoveryOrder)||!/^pay_[A-Za-z0-9]{5,80}$/.test(recoveryPayment)} onClick={()=>open({kind:'recoverPayment',payload:{orderId:recoveryOrder,paymentId:recoveryPayment},title:'استعادة استحقاق الدفعة بعد إعادة التحقق من Whop'})}>مراجعة الاستعادة</button></form></article>}
   {section==='health'&&<p>حالة «غير معروف» تعني عدم توفر دليل حديث. اتصال قاعدة البيانات لا يثبت سلامة مزود آخر.</p>}
   {loading&&<p role="status">جارٍ تحميل البيانات…</p>}{error&&<p role="alert" className="owner-error">{error}</p>}
   {!loading&&data&&<article className="owner-card"><DataView data={data.rows??data} onUser={section==='users'?userOpen:undefined}/>
    {section==='audit'&&data.accessEvents!==undefined&&<><h3>محاولات الوصول</h3><DataView data={data.accessEvents}/></>}{section==='keys'&&data.history!==undefined&&<><h3>سجل الاستردادات والمنح</h3><DataView data={data.history}/></>}{section==='keys'&&data.rows?.map(row=><div className="owner-actions" key={String(row.id)}><span dir="ltr">{String(row.id)}</span><button className="owner-button" disabled={row.suspended===true} onClick={()=>open({kind:'suspendCode',payload:{id:row.id},title:'إيقاف الاستخدامات المستقبلية للمفتاح'})}>إيقاف المفتاح</button></div>)}
    {section==='overview'&&Array.isArray(data.alerts)&&data.alerts.map((a:OwnerRow)=><button key={String(a.fingerprint)} className="owner-button" onClick={()=>open({kind:'ack',payload:{fingerprint:a.fingerprint},title:'إقرار الاطلاع على التنبيه'})}>إقرار التنبيه {String(a.subject)}</button>)}
   </article>}
   {section==='search'&&!search&&<p>ابحث في المستخدمين والطلبات والفعاليات والمفاتيح بمعرّفاتها الآمنة.</p>}
   {data&&['users','keys','payments','events','audit'].includes(section)&&<div className="owner-actions"><button className="owner-button" disabled={offset===0} onClick={()=>setOffset(v=>Math.max(0,v-50))}>السابق</button><span>صفحة {offset/50+1}</span><button className="owner-button" disabled={data.mayHaveMore!==true&&!(section==='users'&&data.rows?.length===50)} onClick={()=>setOffset(v=>v+50)}>التالي</button></div>}
  </div>
  <dialog ref={dialog} className="owner-modal" onClose={() => setSecret('')} aria-labelledby="owner-confirm-title" onCancel={e=>{if(busy)e.preventDefault();}}><form onSubmit={e=>{e.preventDefault();void submit();}}><h2 id="owner-confirm-title">{action?.title??'إيصال العملية'}</h2>
   {action&&<><label>سبب الإجراء<textarea required minLength={3} maxLength={300} value={reason} disabled={busy||!!pending} onChange={e=>setReason(e.target.value)}/></label><p>لا تُدخل كلمات مرور أو مفاتيح سرية في السبب.</p><label className="owner-check"><input type="checkbox" checked={checked} disabled={busy||!!pending} onChange={e=>setChecked(e.target.checked)}/>راجعت الإجراء والحساب المستهدف وأؤكد تنفيذه.</label></>}
   {notice&&<p role="status">{notice}</p>}{secret&&<><output className="owner-secret" dir="ltr">{secret}</output><button className="owner-button" type="button" onClick={()=>{void navigator.clipboard.writeText(secret).then(()=>setNotice('نُسخ المفتاح. احفظه في مكان آمن.')).catch(()=>setNotice('تعذر النسخ. انسخ المفتاح الظاهر يدويًا.'));}}>نسخ المفتاح</button></>}
   {reauth&&<button className="owner-button" type="button" onClick={()=>void signInHost({page:'home',locale:'ar'})}>تأكيد الهوية عبر Discord</button>}
   <div className="owner-actions">{action&&<button className="owner-button primary" disabled={busy||!checked||reason.trim().length<3}>{busy?'جارٍ التحقق…':'تأكيد التنفيذ'}</button>}<button className="owner-button" type="button" disabled={busy} onClick={()=>{dialog.current?.close();setSecret('');}}>إغلاق</button></div>
  </form></dialog>
 </section>;
}
