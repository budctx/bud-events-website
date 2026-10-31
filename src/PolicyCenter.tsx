import {useEffect,useRef,useState} from 'react';
import {Accordion,DirectionProvider,MantineProvider,Tabs,TextInput} from '@mantine/core';
import {Search} from 'lucide-react';
import {policyContent,supportUrl,PolicyBody,certificateValidationUrl,freelanceDocumentNumber} from './FooterContent';
import '@mantine/core/styles.css';
import './policy-center.css';
const tabs=[['support','المساعدة والدعم'],['terms','شروط الاستخدام'],['refund','الاسترجاع والشكاوى'],['privacy','سياسة الخصوصية']] as const;
type Tab=typeof tabs[number][0];
const readTab=():Tab=>{const value=location.hash.slice(1);return value==='terms'||value==='privacy'||value==='refund'?value:'support';};
export function PolicyCenter(){
 const [tab,setTab]=useState<Tab>(readTab),[query,setQuery]=useState(''),[opened,setOpened]=useState<string[]>([]);const root=useRef<HTMLElement>(null);
 useEffect(()=>{const update=()=>{setTab(readTab());setQuery('');setOpened([]);};window.addEventListener('hashchange',update);window.addEventListener('popstate',update);return()=>{window.removeEventListener('hashchange',update);window.removeEventListener('popstate',update);};},[]);
 const select=(value:string|null)=>{if(!value)return;setTab(value as Tab);setQuery('');setOpened([]);history.pushState(null,'',location.pathname+location.search+'#'+value);};
 const sections=policyContent[tab].filter(([title,body])=>(title+' '+body).includes(query.trim()));
 return <section ref={root} className="bud-policy-center" dir="rtl"><DirectionProvider initialDirection="rtl" detectDirection={false}><MantineProvider forceColorScheme="light" withCssVariables={false} withGlobalClasses={false} getRootElement={()=>root.current??undefined}>
 <header><p>كل ما تحتاج معرفته عن بُعد</p><h1>مركز المساعدة والسياسات</h1><p>تعرّف على طريقة الاستخدام، بياناتك، وكيف تتواصل معنا.</p></header>
 <Tabs value={tab} onChange={select} dir="rtl" className="bud-policy-layout" keepMounted={false}>
 <aside><Tabs.List aria-label="أقسام المساعدة والسياسات" className="bud-policy-tabs">{tabs.map(([id,label])=><Tabs.Tab key={id} value={id}>{label}</Tabs.Tab>)}</Tabs.List><a href={supportUrl} target="_blank" rel="noopener noreferrer">تواصل عبر Discord ↗</a></aside>
 {tabs.map(([id,label])=><Tabs.Panel key={id} value={id} className="bud-policy-panel"><h2>{label}</h2><p className="bud-policy-version">مسودة للمراجعة · آخر تحديث: 31 أكتوبر 2026</p><TextInput className="bud-policy-search" type="search" label="ابحث في هذا القسم" value={query} onChange={e=>setQuery(e.currentTarget.value)} placeholder="اكتب كلمة مثل المفاتيح أو البيانات" leftSection={<Search size={18} aria-hidden="true"/>}/><p role="status" className="bud-policy-count">{sections.length.toLocaleString('ar-SA-u-nu-latn')} مواضيع</p>{sections.length?<Accordion multiple value={query.trim()?sections.map(([title])=>title):opened} onChange={setOpened} classNames={{item:'bud-policy-topic',control:'bud-policy-control',content:'bud-policy-body'}}>{sections.map(([title,body])=><Accordion.Item key={title} value={title}><Accordion.Control>{title}</Accordion.Control><Accordion.Panel><PolicyBody body={body}/></Accordion.Panel></Accordion.Item>)}</Accordion>:<p>لا توجد نتائج مطابقة. جرّب كلمة أخرى.</p>}{id==='terms'&&<section className="bud-freelance-document" aria-labelledby="bud-document-title"><h3 id="bud-document-title">وثيقة العمل الحر</h3><p>رقم الوثيقة المقدَّم من إدارة بُعد. للتحقق من حالة الوثيقة وصلاحيتها، استخدم خدمة التحقق في منصة العمل الحر الرسمية. عرض الرقم هنا لا يعني توثيق المتجر الإلكتروني.</p><div className="bud-freelance-document-actions"><span>رقم الوثيقة: <bdi dir="ltr">{freelanceDocumentNumber}</bdi></span><a href={certificateValidationUrl} target="_blank" rel="noopener noreferrer">التحقق عبر منصة العمل الحر ↗</a></div></section>}<a className="platform-action" href={supportUrl} target="_blank" rel="noopener noreferrer">تحتاج مساعدة؟ تواصل معنا</a></Tabs.Panel>)}
 </Tabs></MantineProvider></DirectionProvider></section>;
}
