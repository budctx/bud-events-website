import {useBudToast} from './BudUI';
import { useCallback, useEffect, useState } from 'react';
import { getPaymentReceipt, HostClientError } from './host-client';
import type { Locale } from './host-client';
import type { PaymentReceipt, PaymentState } from './payment-state';
const copy = {
  ar: { title: 'حالة طلبك', loading: 'جارٍ التحقق من الطلب…', pending: 'الدفع قيد التحقق', pendingHelp: 'قد يتأخر التأكيد قليلًا. سيظهر المفتاح بعد تأكيد الدفع؛ لا تحتاج إلى الشراء مرة أخرى.',
    confirmed: 'تم تأكيد الدفع', confirmedHelp: 'أُضيف مفتاح الفعالية إلى حسابك. استكمال فعالية بدأت سابقًا لا يستهلك مفتاحًا إضافيًا.',
    review: 'الطلب قيد المراجعة', reviewHelp: 'نراجع حالة هذا الطلب. لا تُعِد الشراء، واحتفظ بمرجع الطلب للتواصل مع الدعم.',
    refunded: 'تم تأكيد استرداد الدفعة', refundedHelp: 'تأكد الاسترداد لدى مزوّد الدفع. قد يختلف وقت ظهوره في وسيلة الدفع. المفتاح المرتبط بالطلب قيد المراجعة.',
    disputed: 'الدفعة قيد النزاع', disputedHelp: 'ورد نزاع على هذه الدفعة. حالة المفتاح قيد المراجعة؛ تواصل مع الدعم بمرجع الطلب.',
    unavailable: 'تعذر التحقق من حالة الطلب الآن.', unavailableHelp: 'هذا لا يعني فشل الدفع. أعد التحقق لاحقًا قبل محاولة الشراء مجددًا.', retry: 'تحديث الحالة', reference: 'مرجع الطلب' },
  en: { title: 'Your order status', loading: 'Checking your order…', pending: 'Payment confirmation pending', pendingHelp: 'Confirmation may take a little time. Your key appears after payment is confirmed; you do not need to buy again.',
    confirmed: 'Payment confirmed', confirmedHelp: 'An event key was added to your account. Resuming an event you already started uses no additional key.',
    review: 'Order under review', reviewHelp: 'We are reviewing this order. Do not purchase again; keep your order reference when contacting support.',
    refunded: 'Payment refund confirmed', refundedHelp: 'The payment provider confirmed a refund. The time it appears on your payment method may vary. The associated key is under review.',
    disputed: 'Payment disputed', disputedHelp: 'A dispute was reported for this payment. The key is under review; contact support with your order reference.',
    unavailable: 'We cannot verify your order status right now.', unavailableHelp: 'This does not mean payment failed. Check again later before trying another purchase.', retry: 'Refresh status', reference: 'Order reference' },
};

export default function PaymentStatus({ orderId, locale, onAuthLost, onState }: {
  orderId: string; locale: Locale; onAuthLost: () => void; onState: (state: PaymentState) => void;
}) {
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);

  const [unavailable, setUnavailable] = useState(false);
  const [revision, setRevision] = useState(0);
  const t = copy[locale];
  const toast=useBudToast();
  const retry=useCallback(()=>setRevision(value=>value+1),[]);
  useEffect(() => {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined, polls = 0, refreshing = false, notified: PaymentState | null = null;
    const refresh = async () => {
      if (refreshing || controller.signal.aborted) return;
      refreshing = true; setUnavailable(false);
      try {
        const data = await getPaymentReceipt(orderId, controller.signal);
        if (controller.signal.aborted) return;
        if (data.orderId !== orderId || !['pending','confirmed','review','refunded','disputed'].includes(data.state)
          || data.currency !== 'sar' || !Number.isSafeInteger(data.amountMinor) || data.amountMinor < 1) throw new Error();
        setReceipt(data);
        if (data.state !== 'pending' && data.state !== notified) { notified = data.state; onState(data.state); }
        if (data.state === 'pending' && polls++ < 12 && !document.hidden) timer = setTimeout(() => void refresh(), 5000);
      } catch (error) {
        if (controller.signal.aborted) return;
        setReceipt(null); setUnavailable(true);
        if (error instanceof HostClientError && error.status === 401) onAuthLost();
      } finally { refreshing = false; }
    };
    const focus = () => { if (timer) clearTimeout(timer); void refresh(); };
    void refresh(); window.addEventListener('focus', focus);
    return () => { controller.abort(); if (timer) clearTimeout(timer); window.removeEventListener('focus', focus); };
  }, [orderId, revision, onAuthLost, onState]);
  const state = receipt?.state;
  const message = unavailable ? t.unavailable : state ? t[state] : t.loading;
  const detail = unavailable ? t.unavailableHelp : state ? t[`${state}Help`] : '';
  const amount=receipt?new Intl.NumberFormat(locale,{style:'currency',currency:receipt.currency}).format(receipt.amountMinor/100):'';
  const tone=unavailable?'danger':state==='confirmed'?'success':state==='pending'?'info':'warning';
  const persistent=unavailable||!!state&&state!=='confirmed';
  useEffect(()=>{
    toast(message,tone,{id:`payment-${orderId}`,description:detail,amount,reference:orderId,referenceLabel:t.reference,action:{label:t.retry,onPress:retry},testId:'payment-status',persistent});
  },[toast,message,tone,orderId,detail,amount,t.reference,t.retry,retry,persistent]);
  return null;
}
