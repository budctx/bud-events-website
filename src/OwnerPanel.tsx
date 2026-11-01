import {ReviewManager} from './ReviewManager';
import {PromoManager} from './PromoManager';
import {BudNotice} from './BudUI';
import {saveOwnerReturn,clearOwnerReturn} from './owner-return';
import type {OwnerReturn} from './owner-return';
import {useEffect,useRef,useState} from 'react';
import {HostClientError,signInHost} from './host-client';
import {ownerError,ownerRequest} from './owner-client';
import type {OwnerData} from './owner-client';
import {clearOwnerPending,readOwnerPending,saveOwnerPending} from './owner-pending';
import type {PendingOwnerOperation} from './owner-pending';
import {clearPublicPartnersCache} from './partners-client';
import {Activity,ArrowRight,CalendarDays,ChevronLeft,FileClock,Gift,Handshake,KeyRound,LayoutDashboard,Plus,Receipt,RefreshCw,Search,Settings2,ShieldCheck,Users,X} from 'lucide-react';
import {Empty,Health,Overview,OwnerTable,SearchResults,UserSummary,rowsOf} from './OwnerViews';
import {PartnerManager} from './PartnerManager';
import {BudSkeleton} from './BudUI';
import './owner.css';
const sections=[
 ['overview','نظرة عامة وتنبيهات',LayoutDashboard,'ملخص المنصة وما يحتاج انتباهك.'],
 ['users','المستخدمون',Users,'الحسابات والأرصدة في مكان واحد.'],
 ['keys','المفاتيح والمنح',KeyRound,'أصدر المفاتيح وتابع استخدامها.'],
 ['reviews','التقييمات',Gift,'راجع آراء المستخدمين وانشرها في الرئيسية.'],
 ['promos','كوبونات الخصم',Gift,'أنشئ الخصومات وأدر روابطها من Whop.'],
 ['payments','المدفوعات',Receipt,'تابع الطلبات وحالة تسليمها.'],
 ['events','الفعاليات',CalendarDays,'تابع الفعاليات ومراحل تشغيلها.'],
 ['audit','سجل العمليات',FileClock,'سجل الإجراءات ومحاولات الوصول.'],
 ['health','صحة النظام',Activity,'آخر حالة معروفة للخدمات والمعالجات.'],
 ['settings','الإعدادات',Settings2,'ملاحظاتك التشغيلية الداخلية.'],
 ['partners','الشركاء',Handshake,'أسماء الشركاء وشعاراتهم وروابطهم وظهورهم في الموقع.'],
 ['search','البحث الموحد',Search,'ابحث في الحسابات والطلبات والفعاليات والمفاتيح.']
] as const;
function tabKeys(event:React.KeyboardEvent<HTMLDivElement>){if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const tabs=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=tab]'));const index=tabs.indexOf(document.activeElement as HTMLButtonElement);if(index<0)return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:event.key==='ArrowLeft'?(index+1)%tabs.length:(index-1+tabs.length)%tabs.length;tabs[next]?.click();tabs[next]?.focus();}
type Action={kind:string;payload:Record<string,unknown>;title:string};
export default function OwnerPanel({onClose,ownerId,ownerName="المالك",initialReturn}:{onClose:()=>void;ownerId:string;ownerName?:string;initialReturn?:OwnerReturn|null}){
 const [section,setSection]=useState<string>(initialReturn?.section??'overview'),[query,setQuery]=useState(initialReturn?.search??''),[search,setSearch]=useState(initialReturn?.search??''),[offset,setOffset]=useState(initialReturn?.offset??0),[revision,setRevision]=useState(0);
 const [data,setData]=useState<OwnerData|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[reauth,setReauth]=useState(false);
 const [action,setAction]=useState<Action|null>(null),[reason,setReason]=useState(''),[checked,setChecked]=useState(false),[notice,setNoticeText]=useState(''),[secret,setSecret]=useState('');
 const [noticeTone,setNoticeTone]=useState<'info'|'success'|'warning'|'danger'>('info');
 const setNotice=(text:string,tone:typeof noticeTone='info')=>{setNoticeText(text);setNoticeTone(tone);};
 const [qty,setQty]=useState('1'),[maxUses,setMaxUses]=useState('1'),[target,setTarget]=useState(''),[note,setNote]=useState('');
 const [recoveryOrder,setRecoveryOrder]=useState(''),[recoveryPayment,setRecoveryPayment]=useState('');
 const [composer,setComposer]=useState<'code'|'grant'|'recovery'|null>(null),[listTab,setListTab]=useState('primary'),[userTab,setUserTab]=useState<'payments'|'history'|'events'>('payments');
 const [promoCursor,setPromoCursor]=useState<string|null>(null);
 const [pending,setPending]=useState(()=>readOwnerPending(ownerId));
 const pendingRef=useRef<PendingOwnerOperation|null>(pending);
 const dialog=useRef<HTMLDialogElement>(null),generation=useRef(0),alive=useRef(true),locked=useRef(false),operation=useRef<string|null>(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{const controller=new AbortController();const run=++generation.current;setData(null);setError('');setLoading(true);
  if(section==='search'&&search.trim().length<2){setLoading(false);return()=>controller.abort();}
  void (section==='reviews'?ownerRequest<OwnerData>({action:'reviews',offset},controller.signal):section==='promos'?ownerRequest<OwnerData>({action:'promos',after:promoCursor},controller.signal):section==='partners'?ownerRequest<import('./PartnerManager').OwnerPartner[]>({action:'partners'},controller.signal).then(rows=>({rows} as unknown as OwnerData)):ownerRequest<OwnerData>({action:'view',section,search,offset},controller.signal)).then(v=>{if(run===generation.current&&!controller.signal.aborted){setData(v);if(section==='settings')setNote(String(v.rows?.find(r=>r.name==='operations_note')?.value??''));}}).catch(e=>{if(!controller.signal.aborted&&run===generation.current)setError(ownerError(e));}).finally(()=>{if(!controller.signal.aborted&&run===generation.current)setLoading(false);});
  return()=>controller.abort();
 },[section,search,offset,revision,promoCursor]);
 const navigate=(next:string)=>{setSection(next);setPromoCursor(null);setSearch('');setQuery('');setOffset(0);setNotice('');setComposer(null);setListTab('primary');};
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
   if(saved.kind==='partnerSave'||saved.kind==='partnerDelete')clearPublicPartnersCache();
   if(typeof result.code==='string'){setSecret(result.code);setNotice('احفظ المفتاح الآن. يُعرض مرة واحدة فقط.','warning');}
   else{setNotice(saved.kind==='createCode'&&result.replayed===true?`تم تأكيد إنشاء المفتاح السابق دون تكراره. لا يمكن إعادة عرض نصه؛ يمكنك إيقافه من سجل المفاتيح. المرجع: ${String(result.id??'')}`:result.verified===true?'تم التحقق من الدفعة لدى Whop دون إضافة رصيد.':result.replayed===true?'تم تأكيد إيصال العملية السابقة دون تكرارها.':'تمت العملية وسُجلت في سجل العمليات.','success');}
   setAction(null);setRevision(v=>v+1);
  }catch(e){
   if(!previous&&e instanceof HostClientError&&!['OWNER_REAUTH_REQUIRED','DISCORD_AUTH_REQUIRED'].includes(e.code)&&[400,401,403,429].includes(e.status)){clearOwnerPending(ownerId);pendingRef.current=null;if(alive.current)setPending(null);}
   if(alive.current){setNotice(ownerError(e),'danger');setReauth(e instanceof HostClientError&&['OWNER_REAUTH_REQUIRED','DISCORD_AUTH_REQUIRED'].includes(e.code));}
  }
  finally{locked.current=false;if(alive.current)setBusy(false);}
 };
 const userOpen=(id:string)=>{setSection('user');setSearch(id);setQuery(id);setOffset(0);setTarget(id);setComposer(null);setUserTab('payments');};
 const current=sections.find(([id])=>id===section);
 const heading=section==='overview'?'نظرة عامة':current?.[1]??'ملف المستخدم';
 const selectComposer=(next:typeof composer)=>setComposer(v=>v===next?null:next);
 return <section className="owner-shell" dir="rtl" aria-label="لوحة المالك">
  <a className="owner-skip" href="#owner-workspace">تجاوز إلى محتوى اللوحة</a>
  <aside className="owner-sidebar">
   <div className="owner-brand"><span><img src="/assets/bud-emblem.svg" alt="" width="27" height="22"/></span><div><h1>لوحة المالك</h1><p>إدارة بُعد</p></div><span className="owner-admin-tag">إدارة</span></div>
   <nav aria-label="أقسام لوحة المالك">{sections.map(([id,title,Icon])=><div key={id}>{(id==='overview'||id==='audit')&&<p className="owner-nav-group">{id==='overview'?'المنصة':'الإدارة'}</p>}<button aria-current={section===id||id==='users'&&section==='user'?'page':undefined} onClick={()=>navigate(id)}><Icon aria-hidden="true"/><span>{id==='overview'?'نظرة عامة':title}</span>{id==='overview'&&<span className="owner-nav-active-dot" aria-hidden="true"/>}</button></div>)}</nav>
   <div className="owner-sidebar-account"><span className="owner-avatar">{ownerName.slice(0,1)}</span><div><strong>{ownerName}</strong><small>مالك المنصة</small></div><ShieldCheck aria-hidden="true"/></div>
  </aside>
  <div className="owner-workspace" id="owner-workspace" tabIndex={-1}>
   <div className="owner-topbar"><div><span>إدارة بُعد</span><ChevronLeft aria-hidden="true"/><strong>{heading}</strong></div><button className="owner-button" onClick={onClose}><ArrowRight aria-hidden="true"/>العودة إلى البروفايل</button></div>
   <div className="owner-content">
   <header className="owner-page-heading"><div><h2 aria-label={section==='overview'?'نظرة عامة وتنبيهات':heading}>{heading}</h2><p>{current?.[3]??'بيانات الحساب وسجل نشاطه.'}</p></div><div className="owner-heading-actions"><button className="owner-icon-button" aria-label="تحديث" title="تحديث" onClick={()=>setRevision(v=>v+1)} disabled={loading}><RefreshCw aria-hidden="true" className={loading?'owner-spinning':''}/></button>{section==='overview'&&<button className="owner-button primary" onClick={()=>navigate('keys')}><Plus aria-hidden="true"/>إدارة المفاتيح</button>}{section==='keys'&&<><button className="owner-button" aria-expanded={composer==='grant'} onClick={()=>selectComposer('grant')}><Gift aria-hidden="true"/>منحة إدارية</button><button className="owner-button primary" aria-expanded={composer==='code'} onClick={()=>selectComposer('code')}><Plus aria-hidden="true"/>مفتاح جديد</button></>}{section==='user'&&<button className="owner-button primary" aria-expanded={composer==='grant'} onClick={()=>selectComposer('grant')}><Gift aria-hidden="true"/>منحة إدارية</button>}</div></header>
   {pending&&<div className="owner-heading-actions"><BudNotice tone="warning" persistent resolveOnUnmount>عملية بانتظار التأكيد. تحقق من نتيجتها قبل إنشاء عملية أخرى.</BudNotice><button className="owner-button" onClick={restorePending}>التحقق من العملية السابقة</button></div>}
   {['users','keys','payments','events','audit','search'].includes(section)&&<form className="owner-search" onSubmit={e=>{e.preventDefault();setSearch(query.trim());setOffset(0);}}><label><span className="owner-sr-only">بحث</span><Search aria-hidden="true"/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} maxLength={80} minLength={section==='search'?2:undefined} placeholder={section==='users'?'ابحث بالاسم أو Discord ID أو معرّف الحساب…':'ابحث بمرجع أو كلمة…'}/></label>{search&&<button type="button" className="owner-icon-button" aria-label="مسح البحث" onClick={()=>{setSearch('');setQuery('');setOffset(0);}}><X aria-hidden="true"/></button>}<button className="owner-button">بحث</button>{section==='payments'&&<button type="button" className="owner-button" aria-expanded={composer==='recovery'} onClick={()=>selectComposer('recovery')}><Receipt aria-hidden="true"/>استعادة دفعة</button>}</form>}
   {section==='keys'&&composer==='code'&&<article className="owner-card owner-composer"><div className="owner-block-heading"><h3><KeyRound aria-hidden="true"/>إنشاء مفتاح هدية أو حملة</h3><button className="owner-icon-button" aria-label="إغلاق نموذج المفتاح" onClick={()=>setComposer(null)}><X aria-hidden="true"/></button></div><form className="owner-form" onSubmit={e=>{e.preventDefault();open({kind:'createCode',payload:{qty:Number(qty),maxUses:Number(maxUses)},title:'إنشاء مفتاح'});}}><label>Slots لكل استرداد<input type="number" min="1" max="100" required value={qty} onChange={e=>setQty(e.target.value)}/></label><label>إجمالي مرات الاستخدام<input type="number" min="1" max="10000" required value={maxUses} onChange={e=>setMaxUses(e.target.value)}/></label><p className="owner-subtle">صلاحية المفتاح 3 أشهر من تاريخ إنشائه، وتُحدد تلقائيًا.</p><button className="owner-button primary">مراجعة إنشاء المفتاح</button></form></article>}
   {['keys','user'].includes(section)&&composer==='grant'&&<article className="owner-card owner-composer"><div className="owner-block-heading"><h3><Gift aria-hidden="true"/>منحة إدارية</h3><button className="owner-icon-button" aria-label="إغلاق نموذج المنحة" onClick={()=>setComposer(null)}><X aria-hidden="true"/></button></div><p className="owner-subtle">رصيد مستقل عن الشراء. لا يُستخدم لتسوية دفعة.</p><form className="owner-form" onSubmit={e=>{e.preventDefault();open({kind:'grant',payload:{hostId:target,qty:Number(qty)},title:`منح ${qty} Slots للحساب ${target}`});}}><label>معرّف الحساب الموثق<input dir="ltr" required value={target} onChange={e=>setTarget(e.target.value)} pattern="[a-fA-F0-9-]{36}"/></label><label>عدد Slots<input type="number" min="1" max="100" required value={qty} onChange={e=>setQty(e.target.value)}/></label><button className="owner-button primary">مراجعة المنحة</button></form></article>}
   {section==='settings'&&<article className="owner-card"><div className="owner-block-heading"><h3><Settings2 aria-hidden="true"/>ملاحظة تشغيلية داخلية</h3></div><form className="owner-settings-form" onSubmit={e=>{e.preventDefault();open({kind:'setting',payload:{name:'operations_note',value:note},title:'حفظ الملاحظة التشغيلية'});}}><label>الملاحظة<textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={500} placeholder="اكتب ملاحظة لفريق الإدارة…"/></label><div><small>{note.length} / 500</small><button className="owner-button primary">مراجعة الحفظ</button></div></form></article>}
   {section==='payments'&&composer==='recovery'&&<article className="owner-card owner-composer"><div className="owner-block-heading"><h3>استعادة دفعة موثقة</h3><button className="owner-icon-button" aria-label="إغلاق نموذج الاستعادة" onClick={()=>setComposer(null)}><X aria-hidden="true"/></button></div><p className="owner-subtle">تتحقق من Whop قبل التسليم. تفعيل الاستعادة مستقل عن المنح.</p><form className="owner-form" onSubmit={e=>{e.preventDefault();open({kind:'inspectPayment',payload:{orderId:recoveryOrder,paymentId:recoveryPayment},title:'فحص الدفعة لدى Whop دون إضافة رصيد'});}}><label>مرجع طلب بُعد<input required dir="ltr" value={recoveryOrder} onChange={e=>setRecoveryOrder(e.target.value)} pattern="[a-fA-F0-9-]{36}"/></label><label>معرّف دفع Whop<input required dir="ltr" value={recoveryPayment} onChange={e=>setRecoveryPayment(e.target.value)} pattern="pay_[A-Za-z0-9]{5,80}"/></label><button className="owner-button">فحص الدفعة</button><button type="button" className="owner-button primary" disabled={!/^[a-fA-F0-9-]{36}$/.test(recoveryOrder)||!/^pay_[A-Za-z0-9]{5,80}$/.test(recoveryPayment)} onClick={()=>open({kind:'recoverPayment',payload:{orderId:recoveryOrder,paymentId:recoveryPayment},title:'استعادة استحقاق الدفعة بعد إعادة التحقق من Whop'})}>مراجعة الاستعادة</button></form></article>}
   {loading&&<BudSkeleton label="جارٍ تحميل بيانات لوحة المالك" lines={3}/>}{error&&<div className="owner-error"><BudNotice tone="danger">{error}</BudNotice><button className="owner-text-button" onClick={()=>setRevision(v=>v+1)}>إعادة المحاولة</button></div>}
   {!loading&&data&&<>
    {section==='overview'&&<Overview data={data} onNavigate={navigate} onAck={a=>open({kind:'ack',payload:{fingerprint:a.fingerprint},title:'إقرار الاطلاع على التنبيه'})}/>}
    {section==='users'&&<OwnerTable kind="users" title="المستخدمون" rows={rowsOf(data.rows)} onUser={userOpen}/>}
    {section==='keys'&&<><div className="owner-tabs" role="tablist" onKeyDown={tabKeys} aria-label="سجلات المفاتيح"><button role="tab" id="owner-keys-tab" aria-controls="owner-key-records" aria-selected={listTab==='primary'} tabIndex={listTab==='primary'?0:-1} onClick={()=>setListTab('primary')}>المفاتيح</button><button role="tab" id="owner-history-tab" aria-controls="owner-key-records" aria-selected={listTab==='history'} tabIndex={listTab==='history'?0:-1} onClick={()=>setListTab('history')}>سجل الاستردادات والمنح</button></div><div id="owner-key-records" role="tabpanel" aria-labelledby={listTab==='primary'?'owner-keys-tab':'owner-history-tab'}><OwnerTable key={listTab} kind={listTab==='primary'?'keys':'history'} title={listTab==='primary'?'المفاتيح':'سجل الاستردادات والمنح'} rows={rowsOf(listTab==='primary'?data.rows:data.history)} onSuspend={listTab==='primary'?id=>open({kind:'suspendCode',payload:{id},title:'إيقاف الاستخدامات المستقبلية للمفتاح'}):undefined}/></div></>}
    {section==='reviews'&&<ReviewManager rows={data.rows??[]} offset={offset} onNext={()=>setOffset(v=>v+50)} onBack={()=>setOffset(v=>Math.max(0,v-50))} onConfirm={open}/>}
    {section==='promos'&&<PromoManager checkoutEnabled={data.checkoutEnabled===true} baseAmountMinor={typeof data.baseAmountMinor==='number'?data.baseAmountMinor:0} rows={(data.rows??[]) as import('./PromoManager').OwnerPromo[]} after={typeof data.after==='string'?data.after:null} onNext={()=>setPromoCursor(typeof data.after==='string'?data.after:null)} onConfirm={open}/>}
    {section==='payments'&&<OwnerTable kind="payments" title="طلبات الدفع" rows={rowsOf(data.rows)}/>}
    {section==='events'&&<OwnerTable kind="events" title="الفعاليات" rows={rowsOf(data.rows)}/>}
    {section==='audit'&&<><div className="owner-tabs" role="tablist" onKeyDown={tabKeys} aria-label="سجلات الإدارة"><button role="tab" id="owner-audit-tab" aria-controls="owner-audit-records" aria-selected={listTab==='primary'} tabIndex={listTab==='primary'?0:-1} onClick={()=>setListTab('primary')}>العمليات الإدارية</button><button role="tab" id="owner-access-tab" aria-controls="owner-audit-records" aria-selected={listTab==='access'} tabIndex={listTab==='access'?0:-1} onClick={()=>setListTab('access')}>محاولات الوصول</button></div><div id="owner-audit-records" role="tabpanel" aria-labelledby={listTab==='primary'?'owner-audit-tab':'owner-access-tab'}><OwnerTable key={listTab} kind={listTab==='primary'?'audit':'accessEvents'} title={listTab==='primary'?'العمليات الإدارية':'محاولات الوصول'} rows={rowsOf(listTab==='primary'?data.rows:data.accessEvents)}/></div></>}
    {section==='health'&&<Health data={data}/>}
    {section==='partners'&&<PartnerManager partners={(data.rows??[]) as import('./PartnerManager').OwnerPartner[]} onConfirm={open}/>}
    {section==='search'&&<SearchResults data={data} onUser={userOpen}/>}
    {section==='user'&&<><UserSummary data={data}/><div className="owner-user-tools"><button className="owner-text-button" onClick={()=>navigate('users')}><ArrowRight aria-hidden="true"/>كل المستخدمين</button><div><button className="owner-text-button danger" onClick={()=>open({kind:'restrict',payload:{hostId:search,suspended:true},title:'تقييد الاستخدام الجديد للحساب'})}>تقييد الاستخدام</button><button className="owner-text-button" onClick={()=>open({kind:'restrict',payload:{hostId:search,suspended:false},title:'رفع التقييد الإداري عن الحساب'})}>رفع التقييد</button></div></div><div className="owner-tabs" role="group" aria-label="نشاط المستخدم">{(['payments','history','events'] as const).map(tab=><button key={tab} aria-pressed={userTab===tab} onClick={()=>setUserTab(tab)}>{{payments:'المدفوعات',history:'المنح والاستردادات',events:'الفعاليات'}[tab]}</button>)}</div><OwnerTable key={userTab} kind={userTab} title={{payments:'مدفوعات المستخدم',history:'المنح والاستردادات',events:'فعاليات المستخدم'}[userTab]} rows={rowsOf(data[{payments:'orders',history:'grants',events:'events'}[userTab]])}/></>}
   </>}
   {section==='search'&&!search&&<Empty icon={<Search/>} title="ابحث في بُعد" description="أدخل حرفين أو أكثر للوصول إلى الحساب أو السجل المطلوب."/>}
   {data&&['users','keys','payments','events','audit'].includes(section)&&<div className="owner-pagination"><span>صفحة {offset/50+1}</span><div><button className="owner-button" disabled={offset===0} onClick={()=>setOffset(v=>Math.max(0,v-50))}><ArrowRight aria-hidden="true"/>السابق</button><button className="owner-button" disabled={data.mayHaveMore!==true} onClick={()=>setOffset(v=>v+50)}>التالي<ChevronLeft aria-hidden="true"/></button></div></div>}
   <footer className="owner-panel-footer"><span>بُعد · لوحة المالك</span><span><ShieldCheck aria-hidden="true"/>الإجراءات الحساسة تتطلب تأكيدك</span></footer>
   </div>
  </div>
  <dialog ref={dialog} className="owner-modal" onClose={() => setSecret('')} aria-labelledby="owner-confirm-title" onCancel={e=>{if(busy)e.preventDefault();}}><form onSubmit={e=>{e.preventDefault();void submit();}}><h2 id="owner-confirm-title">{action?.title??'إيصال العملية'}</h2>
   {action&&<><label>سبب الإجراء<textarea required minLength={3} maxLength={300} value={reason} disabled={busy||!!pending} onChange={e=>setReason(e.target.value)}/></label><p>لا تُدخل كلمات مرور أو مفاتيح سرية في السبب.</p><label className="owner-check"><input type="checkbox" checked={checked} disabled={busy||!!pending} onChange={e=>setChecked(e.target.checked)}/>راجعت الإجراء والحساب المستهدف وأؤكد تنفيذه.</label></>}
   <BudNotice tone={reauth?'warning':noticeTone} persistent={!!pending||!!secret||reauth}>{notice}</BudNotice>{secret&&<><output className="owner-secret" dir="ltr">{secret}</output><button className="owner-button" type="button" onClick={()=>{void navigator.clipboard.writeText(secret).then(()=>setNotice('نُسخ المفتاح. احفظه في مكان آمن.','success')).catch(()=>setNotice('تعذر النسخ. انسخ المفتاح الظاهر يدويًا.','danger'));}}>نسخ المفتاح</button></>}
   {reauth&&<button className="owner-button" type="button" disabled={busy} onClick={()=>{if(!saveOwnerReturn({ownerId,section,search,offset})){setNotice('تعذر حفظ مسار العودة في هذا التبويب. لم يبدأ التحقق.','danger');return;}setBusy(true);void signInHost({page:'home',locale:'ar'}).catch(e=>{clearOwnerReturn();setBusy(false);setNotice(ownerError(e),'danger');});}}>تأكيد الهوية عبر Discord</button>}
   <div className="owner-actions">{action&&<button className="owner-button primary" disabled={busy||!checked||reason.trim().length<3}>{busy?'جارٍ التحقق…':'تأكيد التنفيذ'}</button>}<button className="owner-button" type="button" disabled={busy} onClick={()=>{dialog.current?.close();setSecret('');}}>إغلاق</button></div>
  </form></dialog>
 </section>;
}
