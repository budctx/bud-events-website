import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareBrowserRun,stepBrowserRun,saveBrowserRun,readBrowserRun,restoreBrowserRun,selectBrowserRun,mergeBrowserDashboard} from '../src/browser-event.ts';
class MemoryStorage { data=new Map<string,string>();get length(){return this.data.size;}key(i:number){return [...this.data.keys()][i]??null;}getItem(k:string){return this.data.get(k)??null;}setItem(k:string,v:string){this.data.set(k,v);}removeItem(k:string){this.data.delete(k);}}
const local=new MemoryStorage(),session=new MemoryStorage();
Object.defineProperty(globalThis,'localStorage',{value:local});Object.defineProperty(globalThis,'sessionStorage',{value:session});
const pkg={ownerId:'owner-a',eventId:'event-a',title:'Local',expiresAt:new Date(Date.now()+3600000).toISOString(),content:{version:'v1',pairs:[['0','0'],['1','1']] as const,questions:['Q1','Q2'],conditions:['C1','C2']},legacy:null};
const start={action:'start' as const,idempotencyKey:'test',title:'Local',config:{duration:5,timerEnabled:true,attempts:1 as const},prizeText:'Private prize'};
test('browser timer uses immediate wall-clock deadline and reload restores the exact local state',()=>{
 local.data.clear();let run=prepareBrowserRun(pkg,start);const time=Date.now();run=stepBrowserRun(run,{type:'reveal',card:'question',now:0},time);assert.equal(run.state.deadline,null);run=stepBrowserRun(run,{type:'reveal',card:'condition',now:0},time+10);assert.equal(run.state.deadline,time+5010);assert.ok(saveBrowserRun(run));selectBrowserRun(run);assert.deepEqual(restoreBrowserRun(pkg.eventId),run);assert.equal(readBrowserRun('other',pkg.eventId),null);assert.deepEqual(prepareBrowserRun(pkg,{...start,prizeText:'overwrite'}),run);
 run=stepBrowserRun(run,{type:'correct'});run=stepBrowserRun(run,{type:'save-winner',name:'Private winner'});assert.equal(run.state.winners[0].name,'Private winner');assert.equal(run.state.round,1);assert.ok(saveBrowserRun(run));assert.deepEqual(readBrowserRun(pkg.ownerId,pkg.eventId),run);
 run=stepBrowserRun(run,{type:'reveal',card:'question',now:0});run=stepBrowserRun(run,{type:'reveal',card:'condition',now:0});run=stepBrowserRun(run,{type:'wrong'});assert.equal(run.state.activityDraw?.exhausted,true);assert.equal(stepBrowserRun(run,{type:'reveal',card:'question',now:0}),run);run=stepBrowserRun(run,{type:'restart-cycle'});assert.equal(run.state.activityDraw?.draw.cycle,2);assert.ok(saveBrowserRun(run));
 assert.throws(()=>stepBrowserRun(run,{type:'wrong'},Date.parse(pkg.expiresAt)),/LOCAL_EVENT_EXPIRED/);
});
test('missing or malformed local progress has no server snapshot fallback',()=>{
 local.data.clear();assert.throws(()=>prepareBrowserRun(pkg),/LOCAL_EVENT_MISSING/);const run=prepareBrowserRun(pkg,start);const key=`bud-browser-event:v1:${pkg.ownerId}:${pkg.eventId}`;
 for(const corrupt of [{...run,ownerId:'foreign'},{...run,state:{...run.state,remaining:'broken'}},{...run,state:{...run.state,activityDraw:{...run.state.activityDraw,draw:{history:[null]}}}}]){local.setItem(key,JSON.stringify(corrupt));assert.equal(readBrowserRun(pkg.ownerId,pkg.eventId),null);}
 local.data.clear();const receipt={...run,state:{...run.state,prizes:[],winners:[]}};delete (receipt as any).content;const result=mergeBrowserDashboard({credits:1,events:[receipt],products:[],contentVersions:[]},pkg.ownerId);assert.equal(result.events[0].localMissing,true);
});
