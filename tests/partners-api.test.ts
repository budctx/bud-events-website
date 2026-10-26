import test from 'node:test';
import assert from 'node:assert/strict';
import {handlePartners} from '../server/partners.ts';
const url='https://bud-events-website.vercel.app/api/owner?public=partners';
const env={BUD_BACKEND_ENABLED:'true',SUPABASE_URL:'https://cepmvqqrjcvhyzszqand.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-backend-secret'};
test('public partners endpoint is read-only, filters unsafe logos and never returns owner data',async()=>{
 const traffic:{url:string;method:string}[]=[];
 const transport=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  traffic.push({url:String(input),method:String(init?.method)});
  return Response.json([
   {id:'a',name:'Approved',logoUrl:'https://cdn.example.com/logo.png',websiteUrl:'https://example.com'},
   {id:'b',name:'Unsafe',logoUrl:'javascript:alert(1)',websiteUrl:''}
  ]);
 }) as typeof fetch;
 const response=await handlePartners(new Request(url),env,transport);
 assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');
 const payload=await response.json();assert.equal(payload.code,'OK');
 assert.deepEqual(payload.data,[{id:'a',name:'Approved',logoUrl:'https://cdn.example.com/logo.png',websiteUrl:'https://example.com'}]);
 assert.equal(traffic.length,1);assert.equal(traffic[0].method,'POST');
 assert.match(traffic[0].url,/\/rpc\/bud_site_partners_public$/);
 assert.equal((await handlePartners(new Request(url,{method:'POST'}),env,transport)).status,405);
 assert.equal((await handlePartners(new Request(url+'&edit=1'),env,transport)).status,400);
 assert.equal(traffic.length,1);
 assert.equal((await handlePartners(new Request(url),{},transport)).status,503);
});
