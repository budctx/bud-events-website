// Only administrative form inputs are retained for this tab/account, never issued codes or credentials.
export type PendingOwnerOperation={ownerId:string;operationId:string;kind:string;payload:Record<string,unknown>;reason:string;title:string};
const prefix='bud-owner-pending:';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const fields:Record<string,string[]>={createCode:['qty','maxUses','expiresAt'],suspendCode:['id'],grant:['hostId','qty'],restrict:['hostId','suspended'],setting:['name','value'],ack:['fingerprint'],inspectPayment:['orderId','paymentId'],recoverPayment:['orderId','paymentId'],partnerSave:['id','name','logoUrl','websiteUrl','sortOrder','visible'],partnerDelete:['id']};
function valid(v:unknown,ownerId:string):v is PendingOwnerOperation{
 if(!v||typeof v!=='object'||Array.isArray(v))return false;
 const p=v as PendingOwnerOperation;
 return p.ownerId===ownerId&&typeof p.operationId==='string'&&uuid.test(p.operationId)&&Object.hasOwn(fields,p.kind)
  &&!!p.payload&&typeof p.payload==='object'&&!Array.isArray(p.payload)&&Object.keys(p.payload).every(key=>fields[p.kind].includes(key))
  &&typeof p.reason==='string'&&p.reason.length<=300&&typeof p.title==='string'&&p.title.length<=300;
}
export function readOwnerPending(ownerId:string):PendingOwnerOperation|null{
 try{const raw=sessionStorage.getItem(prefix+ownerId);if(!raw||raw.length>4096)return null;const p:unknown=JSON.parse(raw);return valid(p,ownerId)?p:null;}catch{return null;}
}
export function saveOwnerPending(p:PendingOwnerOperation):boolean{
 if(!valid(p,p.ownerId))return false;
 try{const raw=JSON.stringify(p);if(raw.length>4096)return false;sessionStorage.setItem(prefix+p.ownerId,raw);return sessionStorage.getItem(prefix+p.ownerId)===raw;}catch{return false;}
}
export function clearOwnerPending(ownerId:string,operationId?:string){try{if(operationId&&readOwnerPending(ownerId)?.operationId!==operationId)return;sessionStorage.removeItem(prefix+ownerId);}catch{/* A retained marker safely resolves through its server receipt next time. */}}
