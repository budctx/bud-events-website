import type {PartnerLogo} from './BudUI';

const cacheKey='bud-public-partners:v1';
const cacheTtlMs=60_000;

function validPartner(value:unknown):value is PartnerLogo{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const partner=value as Record<string,unknown>;
 return typeof partner.id==='string'&&typeof partner.name==='string'&&typeof partner.logoUrl==='string'&&typeof partner.websiteUrl==='string';
}
function readCache():PartnerLogo[]|null{
 try{
  const raw=sessionStorage.getItem(cacheKey);if(!raw||raw.length>24_000)return null;
  const cached:unknown=JSON.parse(raw);
  if(!cached||typeof cached!=='object'||Array.isArray(cached))return null;
  const value=cached as {expiresAt?:unknown;partners?:unknown};
  if(typeof value.expiresAt!=='number'||value.expiresAt<=Date.now()||!Array.isArray(value.partners)||!value.partners.every(validPartner))return null;
  return value.partners;
 }catch{return null;}
}
function writeCache(partners:PartnerLogo[]){try{sessionStorage.setItem(cacheKey,JSON.stringify({expiresAt:Date.now()+cacheTtlMs,partners}));}catch{/* Public partner caching is an optional optimization. */}}
export function clearPublicPartnersCache(){try{sessionStorage.removeItem(cacheKey);}catch{/* A disabled cache must never block owner actions. */}}
export async function getPublicPartners(signal?:AbortSignal):Promise<PartnerLogo[]>{
 const cached=readCache();if(cached)return cached;
 const response=await fetch('/api/owner?public=partners',{credentials:'omit',signal});
 if(!response.ok)return [];
 const result:unknown=await response.json().catch(()=>null);
 if(!result||typeof result!=='object'||Array.isArray(result))return [];
 const data=(result as {code?:unknown;data?:unknown}).data;
 const partners=(result as {code?:unknown}).code==='OK'&&Array.isArray(data)?data.filter(validPartner):[];
 writeCache(partners);return partners;
}
