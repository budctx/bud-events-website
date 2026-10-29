import {BudNotice} from './BudUI';
import {useEffect,useState} from 'react';
import {ExternalLink,Eye,EyeOff,Plus,Save,Trash2} from 'lucide-react';
import {BudBadge,BudStatus,BudFlipGrid,BudTooltip,BudPopover,BudDialog} from './BudUI';
import type {PartnerLogo} from './BudUI';

export type OwnerPartner=PartnerLogo&{sortOrder:number;visible:boolean};
type Payload={id:string|null;name:string;logoUrl:string;websiteUrl:string;sortOrder:number;visible:boolean};
const blank:Payload={id:null,name:'',logoUrl:'',websiteUrl:'',sortOrder:0,visible:false};
const valid=(value:string,logo:boolean)=>{try{const url=new URL(value);return url.protocol==='https:'&&!!url.hostname&&!url.username&&!url.password&&!url.hash&&(!logo||/\.(png|jpe?g|webp)$/i.test(url.pathname));}catch{return false;}};
export function PartnerManager({partners,onConfirm}:{partners:OwnerPartner[];onConfirm:(action:{kind:'partnerSave'|'partnerDelete';payload:Record<string,unknown>;title:string})=>void}){
 const [editor,setEditor]=useState<Payload>(blank);
 const [previewFailed,setPreviewFailed]=useState(false);
 const [zoom,setZoom]=useState(false);
 const edit=(value:OwnerPartner)=>{setEditor({id:value.id,name:value.name,logoUrl:value.logoUrl,websiteUrl:value.websiteUrl,sortOrder:value.sortOrder,visible:value.visible});setPreviewFailed(false);};
 const change=<K extends keyof Payload>(key:K,value:Payload[K])=>setEditor(previous=>({...previous,[key]:value}));
 const ready=editor.name.trim().length>=2&&editor.name.trim().length<=80&&valid(editor.logoUrl,true)&&(!editor.websiteUrl||valid(editor.websiteUrl,false))&&Number.isInteger(editor.sortOrder)&&editor.sortOrder>=0&&editor.sortOrder<=999;
 useEffect(()=>{if(editor.id&&!partners.some(p=>p.id===editor.id))setEditor(blank);},[partners,editor.id]);
 return <section className="owner-partners" aria-label="إدارة شركاء بُعد">
 <header className="owner-block-heading"><h3>الشركاء المنشورون</h3><BudBadge variant="outline">{partners.filter(x=>x.visible).length} منشور</BudBadge></header>
 <p className="owner-subtle">تتحكم هنا بشعار الشريك واسمه ورابطه وترتيبه. إضافة الشريك تبدأ مخفية، ولن يظهر في الواجهة حتى تفعّل «إظهار الشريك» وتحفظ.</p>
 <div className="owner-partners-grid">
 <div className="owner-card owner-partners-form"><div className="owner-block-heading"><h3>{editor.id?'تعديل شريك':'إضافة شريك'}</h3><button className="owner-icon-button" type="button" aria-label="إضافة شريك جديد" onClick={()=>{setEditor(blank);setPreviewFailed(false);}}><Plus aria-hidden="true"/></button></div>
 <form className="owner-partner-fields" onSubmit={event=>{event.preventDefault();if(ready)onConfirm({kind:'partnerSave',payload:{...editor,name:editor.name.trim()},title:editor.id?'تعديل بيانات الشريك':'إضافة شريك جديد'});}}>
 <label>اسم الشريك<input required maxLength={80} value={editor.name} onChange={event=>change('name',event.target.value)} placeholder="الاسم الظاهر للشريك" /></label>
 <div className="owner-partner-field"><div className="owner-partner-input-heading"><label htmlFor="owner-partner-logo">رابط الشعار (PNG / JPG / WebP عبر HTTPS)</label><BudTooltip label="متطلبات الصورة">رابط صورة عام وآمن عبر HTTPS، دون ملفات SVG أو روابط محلية، ويُفضّل صورة شفافة عالية الجودة.</BudTooltip></div><input id="owner-partner-logo" dir="ltr" type="url" required value={editor.logoUrl} onChange={event=>{change('logoUrl',event.target.value);setPreviewFailed(false);}} placeholder="https://example.com/logo.png" /></div>
 <label>رابط موقع الشريك (اختياري)<input dir="ltr" type="url" value={editor.websiteUrl} onChange={event=>change('websiteUrl',event.target.value)} placeholder="https://example.com" /></label>
 <label>الترتيب<input type="number" min={0} max={999} value={editor.sortOrder} onChange={event=>change('sortOrder',Number(event.target.value))}/></label>
 <div className="owner-partner-note"><BudPopover label="كيف يظهر الشريك؟">الشريك الجديد مخفي افتراضيًا. بعد تفعيل الظهور والحفظ، يظهر شعاره في شريط الشركاء بالواجهة. الترتيب تصاعدي.</BudPopover><span>إعدادات الظهور</span></div>
 <label className="owner-partner-toggle"><input type="checkbox" checked={editor.visible} onChange={event=>change('visible',event.target.checked)}/><span>إظهار الشريك على الموقع بعد الحفظ</span></label>
 {valid(editor.logoUrl,true)&&<div className="owner-partner-preview"><button type="button" className="owner-button" onClick={()=>setZoom(true)} disabled={previewFailed}>معاينة بحجم أكبر</button>{!previewFailed?<img src={editor.logoUrl} alt={'معاينة شعار '+editor.name} referrerPolicy="no-referrer" onError={()=>setPreviewFailed(true)}/>:<BudNotice tone="danger" resolveOnUnmount>تعذر عرض صورة الشعار. تحقق من الرابط قبل النشر.</BudNotice>}</div>}
 <div className="owner-actions"><button className="owner-button primary" type="submit" disabled={!ready||previewFailed}><Save aria-hidden="true"/>مراجعة الحفظ</button>{editor.id&&<button type="button" className="owner-button" onClick={()=>onConfirm({kind:'partnerDelete',payload:{id:editor.id},title:'حذف الشريك '+editor.name})}><Trash2 aria-hidden="true"/>حذف الشريك</button>}</div></form></div>
 <div className="owner-card owner-partner-list"><h3>الشركاء المسجلون ({partners.length})</h3>
 {!partners.length&&<p className="owner-subtle">لا يوجد شركاء مضافون بعد. لن تظهر شعارات في الموقع حتى تضيف شريكًا وتفعّله.</p>}
 <BudFlipGrid className="owner-partner-items" items={partners.map(partner=>({id:partner.id,content:<button key={partner.id} type="button" className="owner-partner-entry" aria-pressed={editor.id===partner.id} onClick={()=>edit(partner)}><span className="owner-partner-image"><img src={partner.logoUrl} alt="" loading="lazy" referrerPolicy="no-referrer"/></span><span className="owner-partner-entry-text"><strong>{partner.name}</strong><small>ترتيب: {partner.sortOrder}</small></span><span className="owner-partner-entry-status">{partner.visible?<BudStatus tone="success"><Eye size={14} aria-hidden="true"/> منشور</BudStatus>:<BudStatus><EyeOff size={14} aria-hidden="true"/> مخفي</BudStatus>}{partner.websiteUrl&&<ExternalLink size={13} aria-hidden="true"/>}</span></button>}))}/>
 </div></div><BudDialog open={zoom} onClose={()=>setZoom(false)} titleId="partner-preview-title" className="owner-partner-zoom"><h2 id="partner-preview-title">معاينة الشعار</h2>{valid(editor.logoUrl,true)&&<img src={editor.logoUrl} alt={editor.name||'شعار الشريك'} referrerPolicy="no-referrer"/>}<button type="button" className="owner-button" onClick={()=>setZoom(false)}>إغلاق</button></BudDialog></section>;
}
