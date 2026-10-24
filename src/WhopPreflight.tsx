import { useEffect, useRef, useState } from 'react';
import type { Locale } from './host-client';
type Result = { companyId:string; productId:string; planId:string; currency:'sar'; amountMinor:number };
/** Explicit operator URL only. The server still requires the configured verified pilot session. */
export default function WhopPreflight({ locale, onAuthLost }: { locale:Locale; onAuthLost:()=>void }) {
  const [busy, setBusy] = useState(false), [result, setResult] = useState<Result | null>(null), [message, setMessage] = useState('');
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  const ar = locale === 'ar';
  const inspect = async () => {
    if (busy) return;
    setBusy(true); setResult(null); setMessage('');
    const controller = new AbortController(); active.current = controller;
    try {
      const response = await fetch('/api/whop-preflight', { method:'POST', credentials:'same-origin', signal:controller.signal });
      const body = await response.json().catch(() => null), data = body?.data;
      if (controller.signal.aborted) return;
      if (response.status === 401) { onAuthLost(); return; }
      if (!response.ok || body?.code !== 'OK' || !data || typeof data.companyId !== 'string' || !/^biz_[A-Za-z0-9]{5,80}$/.test(data.companyId)
        || typeof data.productId !== 'string' || !/^prod_[A-Za-z0-9]{5,80}$/.test(data.productId) || typeof data.planId !== 'string' || !/^plan_[A-Za-z0-9]{5,80}$/.test(data.planId) || data.currency !== 'sar'
        || data.amountMinor !== 200 || data.checkoutCreated !== false || data.paymentCreated !== false || data.creditGranted !== false) throw Error();
      setResult({ companyId:data.companyId,productId:data.productId,planId:data.planId,currency:data.currency,amountMinor:data.amountMinor });
      setMessage(ar ? 'تم التحقق من خطة التجربة. لم يُنشأ طلب شراء أو دفعة أو مفتاح.' : 'The pilot plan was verified. No checkout, payment or key was created.');
    } catch { if (!controller.signal.aborted) setMessage(ar ? 'لم ينجح التحقق. لا تبدأ تجربة الدفع قبل مراجعة الإعدادات.' : 'Verification did not pass. Review the configuration before attempting a payment.'); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  return <section className="platform-payment-status" data-testid="whop-preflight" aria-labelledby="whop-preflight-heading" aria-busy={busy}>
    <div><h2 id="whop-preflight-heading">{ar ? 'فحص ربط الدفع — حساب التجربة' : 'Payment connection check — pilot account'}</h2>
      <p>{ar ? 'فحص إعدادات الخطة فقط، قبل تجربة الدفع الفعلية.' : 'Inspect the plan configuration before the real payment test.'}</p>
      {message && <p role="status">{message}</p>}
      {result && <><p>{new Intl.NumberFormat(locale,{style:'currency',currency:'sar'}).format(result.amountMinor/100)}</p>
        <details><summary>{ar ? 'مراجع الفحص' : 'Inspection references'}</summary>
          <p><bdi dir="ltr">{result.companyId}</bdi></p><p><bdi dir="ltr">{result.productId}</bdi></p><p><bdi dir="ltr">{result.planId}</bdi></p>
        </details></>}
    </div><button className="platform-action platform-action-secondary" type="button" disabled={busy} onClick={() => void inspect()}>
      {busy ? (ar ? 'جارٍ التحقق…' : 'Checking…') : (ar ? 'التحقق من الخطة' : 'Inspect plan')}
    </button>
  </section>;
}
