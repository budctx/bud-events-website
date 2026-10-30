import {BudNotice} from './BudUI';
import { useEffect, useRef, useState } from 'react';
import type { Locale } from './host-client';
type Result = { companyId:string; productId:string; planId:string; currency:'sar'; amountMinor:number };
/** Explicit operator URL only. The server still requires the configured verified pilot session. */
export default function WhopPreflight({ locale, onAuthLost }: { locale:Locale; onAuthLost:()=>void }) {
  const [busy, setBusy] = useState(false), [result, setResult] = useState<Result | null>(null), [message, setMessageText] = useState('');
  const [tone,setTone]=useState<'info'|'success'|'danger'>('info');
  const setMessage=(text:string,nextTone:typeof tone='danger')=>{setMessageText(text);setTone(nextTone);};
  const [references,setReferences]=useState<string[]>([]);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  const ar = locale === 'ar';
  const inspect = async (quote=false) => {
    if (busy) return;
    setBusy(true); setResult(null); setMessage(''); setReferences([]);
    const controller = new AbortController(); active.current = controller;
    try {
      const response = await fetch(quote?'/api/whop-quote':'/api/whop-preflight', { method:'POST', credentials:'same-origin', signal:controller.signal });
      const body = await response.json().catch(() => null), data = body?.data;
      if (controller.signal.aborted) return;
      if (response.status === 401) { onAuthLost(); return; }
      if(quote&&['WHOP_PRODUCTION_REQUEST_REJECTED','WHOP_PRODUCTION_ACCESS_DENIED'].includes(body?.code)
        &&['quote_preview','plan_read'].includes(data?.request?.operation)&&[400,401,403,422].includes(data?.request?.providerStatus)) {
        const reasons:Record<string,string>=ar?{access:'صلاحية الوصول',version:'إصدار واجهة Whop',location:'موقع التسعير',currency:'عملة التسعير',tax:'حساب الضريبة',promo:'رمز الخصم',required_field:'حقل مطلوب',unclassified:'سبب غير مصنف'}
          :{access:'access permission',version:'Whop API version',location:'quote location',currency:'quote currency',tax:'tax calculation',promo:'promo code',required_field:'required field',unclassified:'unclassified reason'};
        const fields=['account_id','company_id','plan_id','line_items','presentment_country','presentment_currency','address','currency','amount'];
        const reason=Object.hasOwn(reasons,data.request.reason)?reasons[data.request.reason]:reasons.unclassified;
        const field=fields.includes(data.request.field)?' ('+data.request.field+')':'';
        setMessage((ar?'رفض Whop ':'Whop rejected ')+(data.request.operation==='quote_preview'?(ar?'طلب التسعير: ':'the quote request: '):(ar?'قراءة الخطة: ':'the plan read: '))+reason+field);
        return;
      }
      const evidence=data?.evidence;
      if(evidence?.apiVersion==='2026-10-15-1'&&evidence.resource==='plans'&&evidence.quoteChecked===false) {
        const refs=['API: '+evidence.apiVersion];
        for(const [key,prefix] of [['companyId','biz'],['planId','plan'],['productId','prod']]) {
          for(const side of ['expected','observed']) {
            const value=evidence[side]?.[key];
            if(typeof value==='string'&&new RegExp('^'+prefix+'_[A-Za-z0-9]{5,80}$').test(value))refs.push(side+' '+key+': '+value);
          }
        }
        const bindings:Record<string,string>=ar?{matched:'مطابق',mismatched:'مختلف',not_configured:'لم يضبط المنتج المتوقع'}:{matched:'Matched',mismatched:'Mismatch',not_configured:'Expected product not configured'};
        if(Object.hasOwn(bindings,evidence.productBinding))refs.push((ar?'مطابقة المنتج: ':'Product binding: ')+bindings[evidence.productBinding]);
        if(typeof evidence.checkedAt==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(evidence.checkedAt))refs.push(evidence.checkedAt);
        if(typeof evidence.providerDate==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(evidence.providerDate))refs.push('Whop: '+evidence.providerDate);
        if(Number.isSafeInteger(evidence.cacheAgeSeconds)&&evidence.cacheAgeSeconds>=0&&evidence.cacheAgeSeconds<=999999999)refs.push('Cache age (s): '+evidence.cacheAgeSeconds);
        setReferences(refs);
      }
      if(quote&&response.ok&&body?.code==='OK'&&data?.previewOnly===true&&data.country==='SA'&&data.currency==='sar'&&data.quantity===1
        &&data.paymentCreated===false&&data.checkoutCreated===false&&data.creditGranted===false
        &&Number.isSafeInteger(data.totalMinor)&&data.totalMinor>=0&&data.totalMinor<=1000000000
        &&Number.isSafeInteger(data.taxAmountMinor)&&data.taxAmountMinor>=0&&data.taxAmountMinor<=data.totalMinor) {
        const format=(value:number)=>new Intl.NumberFormat(locale,{style:'currency',currency:'sar'}).format(value/100);
        setMessage(ar?`تقدير السعودية لمفتاح واحد: الإجمالي ${format(data.totalMinor)}؛ الضريبة ${format(data.taxAmountMinor)}. ليس سعرًا نهائيًا لعميل، ولا دفعة أو إذنًا لفتح البيع.`
          :`Saudi Arabia preview for one key: total ${format(data.totalMinor)}; tax ${format(data.taxAmountMinor)}. Not a final buyer quote, payment or launch approval.`,'info'); return;
      }
      const fields: Record<string, string> = ar
        ? { plan:'معرّف الخطة',company:'حساب البيع',product:'المنتج',billing:'نوع الدفع',currency:'العملة',price:'السعر',renewal:'رسوم التجديد',conversion:'تحويل العملة',tax:'الضريبة' }
        : { plan:'Plan ID',company:'Seller account',product:'Product',billing:'Billing type',currency:'Currency',price:'Price',renewal:'Renewal charge',conversion:'Currency conversion',tax:'Tax' };
      if (response.status === 409 && body?.code === 'PRODUCTION_PLAN_MISMATCH' && Array.isArray(data?.mismatches)
        && data.mismatches.length > 0 && data.mismatches.length <= 9 && data.mismatches.every((field:unknown) => typeof field === 'string' && Object.hasOwn(fields, field))) {
        const states: Record<string,string> = ar
          ? { enabled:'مفعّل',disabled:'معطّل',missing:'غير متاح في الرد',invalid:'صيغة غير متوافقة',inclusive:'ضمن السعر عند احتسابها',exclusive:'تضاف عند احتسابها',unspecified:'غير محددة' }
          : { enabled:'Enabled',disabled:'Disabled',missing:'Absent from response',invalid:'Incompatible format',inclusive:'Included if assessed',exclusive:'Added if assessed',unspecified:'Unspecified' };
        const labels: Record<string,string> = ar
          ? {conversion:'تحويل العملة',taxCollection:'تحصيل الضريبة',taxType:'أسلوب الضريبة'}
          : {conversion:'Currency conversion',taxCollection:'Tax collection',taxType:'Tax treatment'};
        const settings = Object.keys(labels).flatMap(key => typeof data.settings?.[key] === 'string' && Object.hasOwn(states,data.settings[key])
          ? [labels[key] + ': ' + states[data.settings[key]]] : []);
        setMessage((ar ? 'حقول لم تجتز المطابقة: ' : 'Fields that did not pass verification: ') + data.mismatches.map((field:string) => fields[field]).join(ar ? '، ' : ', ')
          + (settings.length ? ' — ' + settings.join(ar ? '؛ ' : '; ') : '')); return;
      }
      const reasons: Record<string, string> = ar ? {
        QUOTE_PREFLIGHT_NOT_CONFIGURED:'فحص التسعير المستقل غير مفعّل أو لم تُثبت هوية المنتج بعد.',
        INVALID_PRODUCTION_QUOTE:'تعذر التحقق من عرض السعر؛ لا يُعد تسعيرًا ناجحًا.',
        WHOP_PRODUCTION_ACCESS_DENIED: 'رفض Whop صلاحية الوصول إلى الخطة. يلزم مراجعة صلاحية المفتاح المحفوظ.',
        WHOP_PRODUCTION_RESOURCE_NOT_FOUND: 'لم يجد Whop الخطة المطلوبة. يلزم مراجعة ربط الخطة بالحساب.',
        WHOP_PRODUCTION_RATE_LIMITED: 'طلب Whop الانتظار قبل إعادة الفحص.',
        WHOP_PRODUCTION_REQUEST_REJECTED: 'رفض Whop صيغة طلب الفحص. يلزم مراجعة توافق إصدار الربط.',
        INVALID_PRODUCTION_PROVIDER_RESPONSE: 'وصل رد غير متوافق من Whop. يلزم مراجعة صيغة بيانات الربط.',
        PRODUCTION_PLAN_MISMATCH: 'تم الوصول إلى Whop، لكن بيانات الخطة لا تطابق شروط البيع المعتمدة.',
      } : {
        QUOTE_PREFLIGHT_NOT_CONFIGURED:'The independent quote probe is disabled or the product binding is missing.',
        INVALID_PRODUCTION_QUOTE:'The quote could not be verified; pricing has not passed.',
        WHOP_PRODUCTION_ACCESS_DENIED: 'Whop denied plan access. Review the saved key permissions.',
        WHOP_PRODUCTION_RESOURCE_NOT_FOUND: 'Whop could not find the requested plan. Review its account binding.',
        WHOP_PRODUCTION_RATE_LIMITED: 'Whop requested a pause before another check.',
        WHOP_PRODUCTION_REQUEST_REJECTED: 'Whop rejected the inspection request format. Review API version compatibility.',
        INVALID_PRODUCTION_PROVIDER_RESPONSE: 'Whop returned an incompatible response. Review the integration data format.',
        PRODUCTION_PLAN_MISMATCH: 'Whop responded, but the plan does not match the approved sale requirements.',
      };
      if (!response.ok && typeof body?.code === 'string' && Object.hasOwn(reasons, body.code)) { setMessage(reasons[body.code]); return; }
      if (!response.ok || body?.code !== 'OK' || !data || typeof data.companyId !== 'string' || !/^biz_[A-Za-z0-9]{5,80}$/.test(data.companyId)
        || typeof data.productId !== 'string' || !/^prod_[A-Za-z0-9]{5,80}$/.test(data.productId) || typeof data.planId !== 'string' || !/^plan_[A-Za-z0-9]{5,80}$/.test(data.planId) || data.currency !== 'sar'
        || data.amountMinor !== 300 || data.checkoutCreated !== false || data.paymentCreated !== false || data.creditGranted !== false) throw Error();
      setResult({ companyId:data.companyId,productId:data.productId,planId:data.planId,currency:data.currency,amountMinor:data.amountMinor });
      setMessage(ar ? 'تم التحقق من خطة الدفع. لم يُنشأ طلب شراء أو دفعة أو مفتاح.' : 'The payment plan was verified. No checkout, payment or key was created.','success');
    } catch { if (!controller.signal.aborted) setMessage(ar ? 'لم ينجح التحقق. لا تفعّل الدفع قبل مراجعة الإعدادات.' : 'Verification did not pass. Review the configuration before attempting a payment.'); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  return <section className="platform-payment-status" data-testid="whop-preflight" aria-labelledby="whop-preflight-heading" aria-busy={busy}>
    <div><h2 id="whop-preflight-heading">{ar ? 'فحص ربط الدفع — حساب الإدارة' : 'Payment connection check — admin account'}</h2>
      <p>{ar ? 'إعدادات الخطة الخام لا تثبت المبلغ النهائي أو الضريبة على عملية شراء. فحص السعر منفصل ولا ينفذ دفعًا.' : 'Raw plan settings do not establish a purchase total or tax. The separate quote probe never charges.'}</p>
      <BudNotice tone={tone}>{message}</BudNotice>
      {references.length>0&&<details><summary>{ar?'دليل القراءة':'Read evidence'}</summary>{references.map(value=><p key={value}><bdi dir="ltr">{value}</bdi></p>)}</details>}
      {result && <><p>{new Intl.NumberFormat(locale,{style:'currency',currency:'sar'}).format(result.amountMinor/100)}</p>
        <details><summary>{ar ? 'مراجع الفحص' : 'Inspection references'}</summary>
          <p><bdi dir="ltr">{result.companyId}</bdi></p><p><bdi dir="ltr">{result.productId}</bdi></p><p><bdi dir="ltr">{result.planId}</bdi></p>
        </details></>}
    </div><button className="platform-action platform-action-secondary" type="button" disabled={busy} onClick={() => void inspect()}>
      {busy ? (ar ? 'جارٍ التحقق…' : 'Checking…') : (ar ? 'التحقق من الخطة' : 'Inspect plan')}
    </button>
    <button className="platform-action platform-action-secondary" type="button" disabled={busy} onClick={()=>void inspect(true)}>
      {ar?'عرض سعر تقديري — السعودية':'Preview price — Saudi Arabia'}
    </button>
  </section>;
}
