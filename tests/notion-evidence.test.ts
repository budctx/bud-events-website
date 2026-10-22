import test from 'node:test';
import assert from 'node:assert/strict';
import { evidence,publish } from '../scripts/sync-notion-ci.mjs';
const run={id:'39758470648',attempt:'1',conclusion:'success',sha:'dde0d23a4941aea97e31c391844e4faf934c6822',url:'https://github.com/budctx/bud-events-website/actions/runs/39758470648',updatedAt:'2026-10-22T10:00:00Z'};
const config={token:'test-only',dataSourceId:'992d1aed-dea5-4c2d-b826-a11f968f6e9b',run};
test('success is evidence, not stage signoff',()=>{
 const e=evidence(run); assert.equal(e.id,'BUD-CI-39758470648-A1');
 assert.equal(e.properties.Result.status.name,'PASS');
 assert.equal(e.properties['Record Scope'].select.name,'Historical evidence');
 assert.equal(e.properties.Stage,undefined);
});
test('failed and cancelled have non-success statuses',()=>{
 assert.equal(evidence({...run,conclusion:'failure'}).properties.Result.status.name,'FAILED');
 assert.equal(evidence({...run,conclusion:'cancelled'}).properties.Result.status.name,'IN REVIEW');
});
test('external URLs and false SHAs are refused',()=>{
 assert.throws(()=>evidence({...run,url:'https://example.com/other'}),/URL/);
 assert.throws(()=>evidence({...run,sha:'fake'}),/SHA/);
});
test('creates one Notion historical evidence item with correct source data',async()=>{
 const calls=[];const transport=async(url,opts)=>{calls.push({url,body:JSON.parse(opts.body)});return{ok:true,json:async()=>url.endsWith('/query')?{results:[]}:{id:'notion-page-id',url:'https://www.notion.so/example'}}};
 const r=await publish(config,transport);assert.equal(r.status,'created');assert.equal(calls.length,2);
 assert.equal(calls[1].body.properties.Stage,undefined);
 assert.equal(calls[1].body.properties['Version SHA'].rich_text[0].text.content,run.sha);
 assert.equal(calls[1].body.parent.type,'data_source_id');
});
test('duplicate delivery is idempotent',async()=>{
 let calls=0;const transport=async()=>{calls++;return{ok:true,json:async()=>({results:[{id:'existing-id'}]})}};
 assert.equal((await publish(config,transport)).status,'already-present'); assert.equal(calls,1);
});
test('API permission failure is not hidden',async()=>{
 await assert.rejects(publish(config,async()=>({ok:false,status:403})),/403/);
});
