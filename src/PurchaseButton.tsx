import type {ButtonHTMLAttributes} from 'react';
import {useId} from 'react';
import {RippleButton} from './RippleButton';

type Props=Omit<ButtonHTMLAttributes<HTMLButtonElement>,'children'> & {amountMinor:number;originalAmountMinor?:number;priceLoading?:boolean;loading?:boolean;secondary?:boolean};
const formatPrice=new Intl.NumberFormat('ar-SA-u-nu-latn',{maximumFractionDigits:2});
export function PurchaseButton({amountMinor,originalAmountMinor,priceLoading,loading=false,secondary=false,disabled,className='',...props}:Props){
 const descriptionId=useId();
 const price=priceLoading?'…':formatPrice.format(amountMinor/100);
 const original=originalAmountMinor&&originalAmountMinor>amountMinor?formatPrice.format(originalAmountMinor/100):null;
 return <><RippleButton {...props} className={`platform-action ${secondary?'platform-action-secondary':'platform-action-primary'} bud-purchase-button ${className}`} disabled={disabled||loading}
  aria-busy={loading} aria-describedby={loading?props['aria-describedby']:[props['aria-describedby'],descriptionId].filter(Boolean).join(' ')}>
  {loading?'جارٍ تجهيز الشراء…':<><span>شراء</span>{' '}<span className="bud-purchase-divider" aria-hidden="true"/>{' '}<span className="bud-purchase-price" dir="ltr"><img src="/assets/saudi-riyal.svg" width="18" height="20" alt="" aria-hidden="true"/>{original&&<s className="bud-purchase-original" aria-hidden="true"><bdi>{original}</bdi></s>}{' '}<bdi>{price}</bdi></span></>}
 </RippleButton><span id={descriptionId} className="bud-sr-only">{`ريال سعودي${original?` بدلًا من ${original} ريال سعودي`:""} — مفتاح فعالية سؤال وشرط`}</span></>;
}
