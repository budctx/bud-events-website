import test from 'node:test';
import assert from 'node:assert/strict';
import {createMiniRun,readMiniRun,saveMiniRun,stepMiniRun,selectMiniRun,restoreMiniRun,validMiniRun,listMiniRuns} from '../src/mini-games/session.ts';

class StorageFixture {
 data=new Map<string,string>();
 get length(){return this.data.size;}
 key(index:number){return [...this.data.keys()][index]??null;}
 getItem(k:string){return this.data.get(k)??null;}
 setItem(k:string,v:string){this.data.set(k,v);}
 removeItem(k:string){this.data.delete(k);}
 clear(){this.data.clear();}
}
const local=new StorageFixture(),session=new StorageFixture();
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:local});
Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:session});
const payload={ownerId:'host-mini',eventId:'mini-id-1',title:'ميني قيمز',expiresAt:new Date(Date.now()+4*60*60*1000).toISOString(),prizeText:'جائزة 1\nجائزة 2'};
test('v2 browser saves remain distinct, account scoped and reload safely',()=>{
 local.clear();session.clear();
 let run=createMiniRun(payload);
 assert.ok(validMiniRun(run));
 assert.ok(local.data.has('bud-browser-event:v2:host-mini:mini-id-1'));
 assert.equal(local.data.size,1);
 run=stepMiniRun(run,{type:'open',game:'wheel'});
 assert.equal(run.state.active?.kind,'wheel');
 assert.equal(saveMiniRun(run),true);
 selectMiniRun(run);
 assert.deepEqual(restoreMiniRun(run.eventId),run);
 assert.deepEqual(readMiniRun(run.ownerId,run.eventId),run);
 assert.equal(readMiniRun('other',run.eventId),null);
 assert.deepEqual(listMiniRuns(run.ownerId),[run]);
 assert.deepEqual(createMiniRun({...payload,prizeText:'جائزة أخرى'}),run);
});
test('malformed records are rejected without touching question-condition v1 storage',()=>{
 local.clear();session.clear();
 const run=createMiniRun(payload);
 const key='bud-browser-event:v2:host-mini:mini-id-1';
 for(const invalid of [
  {...run,ownerId:'foreign'},
  {...run,schema:1},
  {...run,state:{...run.state,winners:[{id:'winner-1',name:'متطفل'}]}},
  {...run,state:{...run.state,active:{kind:'wheel',category:'بلاد',letter:'ظ',example:'غير موجود',startedAt:1,draws:1}}},
 ]){
  local.setItem(key,JSON.stringify(invalid));
  assert.equal(readMiniRun(payload.ownerId,payload.eventId),null);
 }
 assert.equal(local.getItem('bud-browser-event:v1:host-mini:mini-id-1'),null);
 local.clear();assert.equal(readMiniRun(payload.ownerId,payload.eventId),null);
});
test('expired mini games are not mutable and no winner can be forged without prizes',()=>{
 local.clear();
 const run=createMiniRun({...payload,eventId:'mini-2',prizeText:''});
 const started=stepMiniRun(run,{type:'open',game:'wheel'},Date.now());
 assert.equal(started.state.active?.kind,'wheel');
 assert.throws(()=>stepMiniRun(started,{type:'close'},Date.parse(started.expiresAt)),/LOCAL_EVENT_EXPIRED/);
});

test('idle wheel can persist and resume without an implicit spin',()=>{
 local.clear();
 const run=createMiniRun({...payload,eventId:'idle-wheel'});
 const next=stepMiniRun(run,{type:'open',game:'wheel'});
 assert.equal(next.state.active?.kind,'wheel');
 assert.equal(next.state.active?.kind==='wheel'&&next.state.active.startedAt,null);
 assert.equal(saveMiniRun(next),true);
 assert.deepEqual(readMiniRun(next.ownerId,next.eventId),next);
});

test('custom Mini Games title is preserved across local saves and session restoration',()=>{
 local.clear();session.clear();
 const custom='مسابقة ديسمبر — تحدي الفرق';
 const run=createMiniRun({...payload,eventId:'custom-title',title:custom});
 assert.equal(run.title,custom);
 selectMiniRun(run);
 const restored=restoreMiniRun(run.eventId);
 assert.ok(restored);
 assert.equal(restored.title,custom);
 const updated=stepMiniRun(restored,{type:'add-winner',name:'سارة'});
 assert.equal(saveMiniRun(updated),true);
 assert.equal(readMiniRun(run.ownerId,run.eventId)?.title,custom);
 assert.equal(restoreMiniRun(run.eventId)?.title,custom);
});
