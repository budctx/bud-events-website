import {normalizePartnerUrl,partnerUrlError} from './partner-validation';
import {BudNotice} from './BudUI';
import {useEffect,useState} from 'react';
import {ExternalLink,Eye,EyeOff,Plus,Save,Trash2} from 'lucide-react';
import {BudBadge,BudStatus,BudFlipGrid,BudTooltip,BudPopover,BudDialog} from './BudUI';
import type {PartnerLogo} from './BudUI';

export type OwnerPartner=PartnerLogo&{sortOrder:number;visible:boolean};
type Payload={id:string|null;name:string;logoUrl:string;websiteUrl:string;sortOrder:number;visible:boolean};
const blank:Payload={id:null,name:'',logoUrl:'',websiteUrl:'',sortOrder:0,visible:false};
const valid=(value:string,logo:boolean)=>!!value&&!partnerUrlError(value,logo);
export function PartnerManager({partners,onConfirm}:{partners:OwnerPartner[];onConfirm:(action:{kind:'partnerSave'|'partnerDelete';payload:Record<string,unknown>;title:string})=>void}){
 const [editor,setEditor]=useState<Payload>(blank);
 const [previewFailed,setPreviewFailed]=useState(false);
 const [zoom,setZoom]=useState(false);
 const [submitted,setSubmitted]=useState(false);
 const errors={name:editor.name.trim().length<2||editor.name.trim().length>80?'أدخل اسم الشريك من حرفين إلى 80 حرفًا.':'',logoUrl:partnerUrlError(editor.logoUrl,true)||(previewFailed?'تعذر تحميل صورة الشعار من هذا الرابط. تأكد أنها عامة ومتاحة أو أعد محاولة المعاينة.':''),websiteUrl:partnerUrlError(editor.websiteUrl,false),sortOrder:!Number.isInteger(editor.sortOrder)||editor.sortOrder<0||editor.sortOrder>999?'أدخل عددًا صحيحًا بين 0 و999.':''};
 const showError=(key:keyof typeof errors)=>!!errors[key]&&(submitted||!!editor[key]);
 const errorText=(key:keyof typeof errors)=>showError(key)?<small id={'partner-error-'+key} className="owner-field-error">{errors[key]}</small>:null;
 const edit=(value:OwnerPartner)=>{setEditor({id:value.id,name:value.name,logoUrl:value.logoUrl,websiteUrl:value.websiteUrl,sortOrder:value.sortOrder,visible:value.visible});setPreviewFailed(false);setSubmitted(false);};
 const change=<K extends keyof Payload>(key:K,value:Payload[K])=>setEditor(previous=>({...previous,[key]:value}));
 const ready=Object.values(errors).every(value=>!value);
 useEffect(()=>{if(editor.id&&!partners.some(p=>p.id===editor.id))setEditor(blank);},[partners,editor.id]);
 return <section className="owner-partners" aria-label="إدارة شركاء بُعد">
 <header className="owner-block-heading"><h3>الشركاء المنشورون</h3><BudBadge variant="outline">{partners.filter(x=>x.visible).length} منشور</BudBadge></header>
 <p className="owner-subtle">تتحكم هنا بشعار الشريك واسمه ورابطه وترتيبه. إضافة الشريك تبدأ مخفية، ولن يظهر في الواجهة حتى تفعّل «إظهار الشريك» وتحفظ.</p>
 <div className="owner-partners-grid">
 <div className="owner-card owner-partners-form"><div className="owner-block-heading"><h3>{editor.id?'تعديل شريك':'إضافة شريك'}</h3><button className="owner-icon-button" type="button" aria-label="إضافة شريك جديد" onClick={()=>{setEditor(blank);setPreviewFailed(false);setSubmitted(false);}}><Plus aria-hidden="true"/></button></div>
 <form noValidate className="owner-partner-fields" onSubmit={event=>{event.preventDefault();setSubmitted(true);if(!ready){const key=Object.keys(errors).find(key=>errors[key as keyof typeof errors]);document.getElementById('owner-partner-'+key)?.focus();return;}if(ready)onConfirm({kind:'partnerSave',payload:{...editor,name:editor.name.trim()},title:editor.id?'تعديل بيانات الشريك':'إضافة شريك جديد'});}}>
 <label>اسم الشريك<input id="owner-partner-name" aria-invalid={showError('name')} aria-describedby="partner-error-name" required maxLength={80} value={editor.name} onChange={event=>change('name',event.target.value)} placeholder="الاسم الظاهر للشريك" />{errorText('name')}</label>
 <div className="owner-partner-field"><div className="owner-partner-input-heading"><label htmlFor="owner-partner-logoUrl">رابط الشعار (PNG / JPG / WebP عبر HTTPS)</label><BudTooltip label="متطلبات الصورة">رابط صورة عام وآمن عبر HTTPS، دون ملفات SVG أو روابط محلية، ويُفضّل صورة شفافة عالية الجودة.</BudTooltip></div><input id="owner-partner-logoUrl" aria-invalid={showError('logoUrl')} aria-describedby="partner-logo-help partner-error-logoUrl" dir="ltr" type="url" required value={editor.logoUrl} onChange={event=>{change('logoUrl',normalizePartnerUrl(event.target.value));setPreviewFailed(false);}} placeholder="https://example.com/logo.png" /><small id="partner-logo-help">رابط مباشر عبر HTTPS ينتهي بـ .png أو .jpg أو .jpeg أو .webp. يمكنك لصق الرابط المنسوخ من المحادثة مباشرة.</small>{errorText('logoUrl')}</div>
 <label>رابط موقع الشريك (اختياري)<input id="owner-partner-websiteUrl" aria-invalid={showError('websiteUrl')} aria-describedby="partner-error-websiteUrl" dir="ltr" type="url" value={editor.websiteUrl} onChange={event=>change('websiteUrl',normalizePartnerUrl(event.target.value))} placeholder="https://example.com" />{errorText('websiteUrl')}</label>
 <label>الترتيب<input id="owner-partner-sortOrder" aria-invalid={showError('sortOrder')} aria-describedby="partner-error-sortOrder" type="number" min={0} max={999} value={Number.isNaN(editor.sortOrder)?'':editor.sortOrder} onChange={event=>change('sortOrder',event.target.value===''?NaN:Number(event.target.value))}/>{errorText('sortOrder')}</label>
 <div className="owner-partner-note"><BudPopover label="كيف يظهر الشريك؟">الشريك الجديد مخفي افتراضيًا. بعد تفعيل الظهور والحفظ، يظهر شعاره في شريط الشركاء بالواجهة. الترتيب تصاعدي.</BudPopover><span>إعدادات الظهور</span></div>
 <label className="owner-partner-toggle"><input type="checkbox" checked={editor.visible} onChange={event=>change('visible',event.target.checked)}/><span>إظهار الشريك على الموقع بعد الحفظ</span></label>
 {valid(editor.logoUrl,true)&&<div className="owner-partner-preview"><button type="button" className="owner-button" onClick={()=>setZoom(true)} disabled={previewFailed}>معاينة بحجم أكبر</button>{!previewFailed?<img src={editor.logoUrl} alt={'معاينة شعار '+editor.name} referrerPolicy="no-referrer" onError={()=>setPreviewFailed(true)}/>:<BudNotice tone="danger" resolveOnUnmount>تعذر عرض صورة الشعار. تحقق من الرابط قبل النشر.</BudNotice>}{previewFailed&&<button type="button" className="owner-button" onClick={()=>setPreviewFailed(false)}>إعادة تحميل الشعار</button>}</div>}
 <div className="owner-actions"><button className="owner-button primary" type="submit" ><Save aria-hidden="true"/>مراجعة الحفظ</button>{editor.id&&<button type="button" className="owner-button" onClick={()=>onConfirm({kind:'partnerDelete',payload:{id:editor.id},title:'حذف الشريك '+editor.name})}><Trash2 aria-hidden="true"/>حذف الشريك</button>}</div></form></div>
 <div className="owner-card owner-partner-list"><h3>الشركاء المسجلون ({partners.length})</h3>
 {!partners.length&&<p className="owner-subtle">لا يوجد شركاء مضافون بعد. لن تظهر شعارات في الموقع حتى تضيف شريكًا وتفعّله.</p>}
 <BudFlipGrid className="owner-partner-items" items={partners.map(partner=>({id:partner.id,content:<button key={partner.id} type="button" className="owner-partner-entry" aria-pressed={editor.id===partner.id} onClick={()=>edit(partner)}><span className="owner-partner-image"><img src={partner.logoUrl} alt="" loading="lazy" referrerPolicy="no-referrer"/></span><span className="owner-partner-entry-text"><strong>{partner.name}</strong><small>ترتيب: {partner.sortOrder}</small></span><span className="owner-partner-entry-status">{partner.visible?<BudStatus tone="success"><Eye size={14} aria-hidden="true"/> منشور</BudStatus>:<BudStatus><EyeOff size={14} aria-hidden="true"/> مخفي</BudStatus>}{partner.websiteUrl&&<ExternalLink size={13} aria-hidden="true"/>}</span></button>}))}/>
 </div></div><BudDialog open={zoom} onClose={()=>setZoom(false)} titleId="partner-preview-title" className="owner-partner-zoom"><h2 id="partner-preview-title">معاينة الشعار</h2>{valid(editor.logoUrl,true)&&<img src={editor.logoUrl} alt={editor.name||'شعار الشريك'} referrerPolicy="no-referrer"/>}<button type="button" className="owner-button" onClick={()=>setZoom(false)}>إغلاق</button></BudDialog></section>;
}
