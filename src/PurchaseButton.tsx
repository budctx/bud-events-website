import type {ButtonHTMLAttributes} from 'react';
import {RippleButton} from './RippleButton';

type Props=Omit<ButtonHTMLAttributes<HTMLButtonElement>,'children'> & {amountMinor:number;loading?:boolean;secondary?:boolean};
const formatPrice=new Intl.NumberFormat('ar-SA-u-nu-arab',{maximumFractionDigits:2});
export function PurchaseButton({amountMinor,loading=false,secondary=false,disabled,className='',...props}:Props){
 const price=formatPrice.format(amountMinor/100);
 return <RippleButton {...props} className={`platform-action ${secondary?'platform-action-secondary':'platform-action-primary'} bud-purchase-button ${className}`} disabled={disabled||loading}
  aria-busy={loading} aria-label={loading?'جارٍ تجهيز الشراء…':`شراء فعالية سؤال وشرط مقابل ${price} ريال سعودي`}>
  {loading?'جارٍ تجهيز الشراء…':<><span>شراء</span>{' '}<span className="bud-purchase-divider" aria-hidden="true"/>{' '}<span className="bud-purchase-price" dir="ltr"><img src="/assets/saudi-riyal.svg" width="18" height="20" alt="" aria-hidden="true"/><bdi>{price}</bdi></span></>}
 </RippleButton>;
}
