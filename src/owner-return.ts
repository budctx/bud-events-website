// Navigation only; the API independently checks owner identity on every request.
export type OwnerReturn={ownerId:string;section:string;search:string;offset:number;expiresAt:number};
const key='bud-owner-reauth-return:v1';
const sections=['overview','users','user','keys','payments','events','audit','health','settings','partners','search'];
export function readOwnerReturn():OwnerReturn|null{
 try{const value=JSON.parse(sessionStorage.getItem(key)??'null');
  return value&&typeof value.ownerId==='string'&&sections.includes(value.section)&&typeof value.search==='string'&&value.search.length<=80&&Number.isSafeInteger(value.offset)&&value.offset>=0&&value.offset<=100000&&Number.isFinite(value.expiresAt)&&value.expiresAt>Date.now()&&value.expiresAt<=Date.now()+600000?value:null;
 }catch{return null;}
}
export function saveOwnerReturn(value:Omit<OwnerReturn,'expiresAt'>):boolean{
 try{sessionStorage.setItem(key,JSON.stringify({...value,expiresAt:Date.now()+600000}));return readOwnerReturn()!==null;}catch{return false;}
}
export function clearOwnerReturn(){try{sessionStorage.removeItem(key);}catch{/* Navigation state grants no access. */}}
