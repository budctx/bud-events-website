export type PublicPrice={baseAmountMinor:number;amountMinor:number;currency:'sar';promotion:{code:string;percent:number}|null};
export function initialPromo():string|null{
 const params=new URLSearchParams(location.search);const raw=params.get('promoCode')??params.get('coupon');
 if(raw!==null){const code=/^[a-z0-9_-]{3,40}$/i.test(raw)?raw.toLowerCase():null;try{if(code)sessionStorage.setItem('bud-promo-code',code);else sessionStorage.removeItem('bud-promo-code');}catch{/* URL remains available. */}return code;}
 try{const saved=sessionStorage.getItem('bud-promo-code');return saved&&/^[a-z0-9_-]{3,40}$/.test(saved)?saved:null;}catch{return null;}
}
export async function promoPrice(code:string|null,signal:AbortSignal):Promise<PublicPrice>{
 const res=await fetch('/api/checkout?'+(code?'promoCode='+encodeURIComponent(code):'price=1'),{credentials:'same-origin',signal,cache:'no-store'});
 const body=await res.json();const data=body?.data;
 if(!res.ok||body?.code!=='OK'||!data||data.currency!=='sar'||!Number.isSafeInteger(data.amountMinor)||data.amountMinor<=0
  ||!Number.isSafeInteger(data.baseAmountMinor)||data.baseAmountMinor<data.amountMinor||(code?data.promotion?.code!==code:data.promotion!==null&&(!/^[a-z0-9_-]{3,40}$/.test(data.promotion?.code)||!Number.isInteger(data.promotion?.percent)||data.promotion.percent<1||data.promotion.percent>99||data.amountMinor*100!==data.baseAmountMinor*(100-data.promotion.percent))))throw Error('PROMO_INVALID');
 return data;
}
