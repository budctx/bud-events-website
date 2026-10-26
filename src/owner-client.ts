import { HostClientError } from './host-client';
export type OwnerRow = Record<string, unknown>;
export type OwnerData = {rows?:OwnerRow[];mayHaveMore?:boolean;[key:string]:unknown};
export async function ownerRequest<T = OwnerData>(body: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {response=await fetch('/api/owner',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});}
  catch(error){if(signal?.aborted)throw error;throw new HostClientError('NETWORK_ERROR',0);}
  const result=await response.json().catch(()=>null);
  if(!response.ok || result?.code!=='OK' || result.data===undefined)throw new HostClientError(result?.code??'SERVICE_UNAVAILABLE',response.status);
  return result.data as T;
}
export function ownerError(reason: unknown): string {
  if(!(reason instanceof HostClientError))return 'تعذر الاتصال. تحقق من الحالة قبل إعادة المحاولة.';
  const messages: Record<string,string>={
    DISCORD_AUTH_REQUIRED:'انتهت جلسة الدخول. سجّل دخولك مجددًا.', OWNER_REQUIRED:'هذه الصفحة متاحة لمالك المنصة فقط.',
    OWNER_REAUTH_REQUIRED:'يلزم تسجيل دخول حديث لتأكيد هويتك قبل هذا الإجراء.', RATE_LIMITED:'محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا.',
    INVALID_OR_EXPIRED_CODE:'المفتاح غير صالح أو غير متاح للاستخدام.', ACCOUNT_RESTRICTED:'استخدام هذا الحساب مقيّد. تواصل مع الدعم.',
    IDEMPOTENCY_KEY_REUSED:'هذا الطلب مرتبط بعملية أخرى. تحقق من السجل.',
    OWNER_PANEL_NOT_CONFIGURED:'لوحة المالك غير متاحة حاليًا.', REDEEM_NOT_CONFIGURED:'استرداد المفاتيح غير متاح حاليًا.',
    OWNER_POLICY_NOT_CONFIGURED:'لم تُضبط حدود المنح المعتمدة بعد.',INVALID_REQUEST:'تحقق من الحقول المدخلة.',
  };
  return messages[reason.code]??'لم يتأكد إتمام العملية. أعد المحاولة بنفس الطلب للتحقق من إيصالها.';
}
