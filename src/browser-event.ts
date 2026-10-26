import type {HostDashboard,HostEvent,StartHostEvent} from './host-client';
import {initialManualState,manualGameReducer,validDuration} from './manual-game.ts';
import type {ManualAction,ManualState} from './manual-game.ts';
import {validateCatalog} from './draw-engine.ts';
import type {PairCatalog} from './draw-engine.ts';
import {beginQuestionCondition,onQuestionConditionRound,restartQuestionConditionCycle} from './question-condition-activity.ts';
export type BrowserContent={version:string;pairs:PairCatalog;questions:string[];conditions:string[]};
export type BrowserRun=HostEvent&{storage:'browser-v1';schema:1;ownerId:string;expiresAt:string;content:BrowserContent;released?:boolean;adoptionPending?:boolean};
export type BrowserPackage={ownerId:string;eventId:string;title:string;expiresAt:string;content:BrowserContent;legacy:HostEvent|null};
const prefix='bud-browser-event:v1:',pointer='bud-browser-event:active';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export class BrowserEventError extends Error{code:string;constructor(code:string){super(code);this.code=code;this.name='BrowserEventError';}}
export function validBrowserContent(v:unknown):v is BrowserContent{
 if(!object(v)||typeof v.version!=='string'||v.version.length>128||!Array.isArray(v.pairs))return false;
 for(const field of ['questions','conditions'])if(!Array.isArray(v[field])||v[field].length<1||v[field].length>500||v[field].some((x:unknown)=>typeof x!=='string'||!x||x.length>2000))return false;
 try{validateCatalog(v.pairs as PairCatalog);return (v.pairs as PairCatalog).every(([q,c])=>/^(0|[1-9][0-9]{0,2})$/.test(q)&&/^(0|[1-9][0-9]{0,2})$/.test(c)&&Number(q)<(v.questions as string[]).length&&Number(c)<(v.conditions as string[]).length);}catch{return false;}
}
function validState(s:unknown):s is ManualState{
 if(!object(s)||!['live','prizes','closing'].includes(String(s.phase))||!object(s.config)||!validDuration(Number(s.config.duration))||typeof s.config.timerEnabled!=='boolean'||![1,2,3].includes(Number(s.config.attempts)))return false;
 if(!Array.isArray(s.winners)||s.winners.length>1000||s.winners.some(w=>!object(w)||typeof w.id!=='string'||typeof w.name!=='string'||w.name.length>80))return false;
 if(!Array.isArray(s.prizes)||s.prizes.length>50||s.prizes.some(p=>!object(p)||typeof p.id!=='string'||typeof p.name!=='string'||p.name.length>100||typeof p.revealed!=='boolean'||p.winnerId!==null&&typeof p.winnerId!=='string'))return false;
 if(!Number.isFinite(s.remaining)||Number(s.remaining)<0||Number(s.remaining)>30||!Number.isSafeInteger(s.attempt)||Number(s.attempt)<1||Number(s.attempt)>Number(s.config.attempts))return false;
 return ['question','condition','pendingWinner'].every(k=>typeof s[k]==='boolean')&&Number.isSafeInteger(s.round)&&Number(s.round)>=0&&Number.isSafeInteger(s.nextWinnerNumber)&&Number(s.nextWinnerNumber)>0&&(s.deadline===null||typeof s.deadline==='number'&&Number.isFinite(s.deadline))&&object(s.activityDraw)&&object(s.activityDraw.draw)&&Array.isArray(s.activityDraw.draw.history)&&s.activityDraw.draw.history.length<=100000;
}
function validActivity(state:ManualState,content:BrowserContent){
 const a=state.activityDraw!;const d=a.draw;
 if(a.kind!=='question-condition'||a.round!==state.round||typeof a.exhausted!=='boolean'||!Number.isSafeInteger(d.cycle)||d.cycle<1||typeof d.awaitingNewCycle!=='boolean')return false;
 const pairs=new Set(content.pairs.map(p=>JSON.stringify(p)));const seen=new Set<string>();
 for(const r of d.history){if(!object(r)||!Array.isArray(r.pair)||!pairs.has(JSON.stringify(r.pair))||!Number.isSafeInteger(r.cycle)||r.cycle<1||r.cycle>d.cycle||!Number.isSafeInteger(r.index)||r.index<1)return false;const key=r.cycle+':'+JSON.stringify(r.pair);if(seen.has(key))return false;seen.add(key);}
 return a.exhausted?a.current===null&&d.awaitingNewCycle:!!a.current&&!d.awaitingNewCycle&&JSON.stringify(a.current)===JSON.stringify(d.history.at(-1));
}
function validRun(v:unknown,ownerId?:string,eventId?:string):v is BrowserRun{return object(v)&&v.schema===1&&v.storage==='browser-v1'&&typeof v.ownerId==='string'&&(!ownerId||v.ownerId===ownerId)&&typeof v.eventId==='string'&&(!eventId||v.eventId===eventId)&&typeof v.title==='string'&&v.title.length<=100&&typeof v.expiresAt==='string'&&Number.isFinite(Date.parse(v.expiresAt))&&Number.isSafeInteger(v.version)&&Number(v.version)>0&&validBrowserContent(v.content)&&validState(v.state)&&validActivity(v.state,v.content);}
const key=(ownerId:string,eventId:string)=>prefix+ownerId+':'+eventId;
export function readBrowserRun(ownerId:string,eventId:string):BrowserRun|null{try{const raw=localStorage.getItem(key(ownerId,eventId));if(!raw||raw.length>4000000)return null;const value:unknown=JSON.parse(raw);return validRun(value,ownerId,eventId)?value:null;}catch{return null;}}
export function listBrowserRuns(ownerId:string):BrowserRun[]{try{const values:BrowserRun[]=[];for(let n=0;n<localStorage.length;n++){const name=localStorage.key(n);if(!name?.startsWith(prefix+ownerId+':'))continue;const value=readBrowserRun(ownerId,name.slice((prefix+ownerId+':').length));if(value)values.push(value);}return values.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));}catch{return [];}}
export function saveBrowserRun(run:BrowserRun):boolean{try{const raw=JSON.stringify(run);if(raw.length>4000000||!validRun(run))return false;localStorage.setItem(key(run.ownerId,run.eventId),raw);return localStorage.getItem(key(run.ownerId,run.eventId))===raw;}catch{return false;}}
export function selectBrowserRun(run:BrowserRun){sessionStorage.setItem(pointer,JSON.stringify({ownerId:run.ownerId,eventId:run.eventId}));}
export function clearBrowserPointer(){try{sessionStorage.removeItem(pointer);}catch{/* Local records remain account-scoped; no server authority is stored. */}}
export function restoreBrowserRun(eventId:string|null):BrowserRun|null{try{if(!eventId)return null;const p=JSON.parse(sessionStorage.getItem(pointer)??'null');return object(p)&&p.eventId===eventId&&typeof p.ownerId==='string'?readBrowserRun(p.ownerId,eventId):null;}catch{return null;}}
export function browserStorageReady(){try{const name=prefix+'probe:'+crypto.randomUUID();localStorage.setItem(name,'x'.repeat(1048576));sessionStorage.setItem(name,'1');const ok=localStorage.getItem(name)?.length===1048576&&sessionStorage.getItem(name)==='1';localStorage.removeItem(name);sessionStorage.removeItem(name);return ok&&'locks' in navigator;}catch{return false;}}
export function prepareBrowserRun(pkg:BrowserPackage,start?:StartHostEvent):BrowserRun{
 if(!pkg.ownerId||!pkg.eventId||!validBrowserContent(pkg.content)||!Number.isFinite(Date.parse(pkg.expiresAt)))throw new BrowserEventError('LOCAL_CONTENT_INVALID');
 const prior=readBrowserRun(pkg.ownerId,pkg.eventId);if(prior)return prior;
 if(!start&&!pkg.legacy)throw new BrowserEventError('LOCAL_EVENT_MISSING');
 let state=start?manualGameReducer(initialManualState(),{type:'start',config:start.config,prizeText:start.prizeText}):structuredClone(pkg.legacy!.state);
 if(!state.activityDraw)state={...state,activityDraw:beginQuestionCondition(pkg.content.pairs).activity};
 if(!validState(state))throw new BrowserEventError('LOCAL_CONTENT_INVALID');
 const run:BrowserRun={schema:1,storage:'browser-v1',ownerId:pkg.ownerId,eventId:pkg.eventId,title:pkg.title,phase:state.phase==='closing'?'completed':state.phase,version:1,state,content:pkg.content,expiresAt:pkg.expiresAt,updatedAt:new Date().toISOString(),...(!start?{adoptionPending:true}:{})};
 if(!saveBrowserRun(run))throw new BrowserEventError('LOCAL_STORAGE_UNAVAILABLE');return run;
}
export function browserCards(run:BrowserRun){const pair=run.state.activityDraw?.current?.pair;return {question:pair?run.content.questions[Number(pair[0])]??'':'',condition:pair?run.content.conditions[Number(pair[1])]??'':''};}
export function stepBrowserRun(run:BrowserRun,action:ManualAction,now=Date.now()):BrowserRun{
 if(now>=Date.parse(run.expiresAt))throw new BrowserEventError('LOCAL_EVENT_EXPIRED');
 if(run.state.phase==='closing'||action.type==='start'||action.type==='reset')return run;
 let state:ManualState;
 const activity=run.state.activityDraw!;
 if(action.type==='restart-cycle'){
  if(run.state.phase!=='live'||run.state.pendingWinner||run.state.question||run.state.condition)return run;
  state={...run.state,activityDraw:restartQuestionConditionCycle(activity,run.content.pairs).activity};
 }else{
  if(activity.exhausted&&['reveal','correct','wrong','save-winner'].includes(action.type))return run;
  state=manualGameReducer(run.state,action.type==='reveal'||action.type==='tick'?{...action,now}:action);
  if(state.round!==run.state.round)state={...state,activityDraw:onQuestionConditionRound(activity,state.round,run.content.pairs).activity};
 }
 if(state===run.state)return run;
 return {...run,state,phase:state.phase==='closing'?'completed':state.phase,version:run.version+1,updatedAt:new Date(now).toISOString()};
}
export function mergeBrowserDashboard(data:HostDashboard,ownerId:string):HostDashboard{
 const runs=listBrowserRuns(ownerId).map(run=>Date.now()>=Date.parse(run.expiresAt)&&run.state.phase!=='closing'?{...run,phase:'completed',state:{...run.state,phase:'closing' as const,deadline:null,pendingWinner:false}}:run);const local=new Map(runs.map(r=>[r.eventId,r]));
 const events=data.events.map(event=>local.get(event.eventId)??event);
 for(const run of runs)if(!events.some(e=>e.eventId===run.eventId))events.push(run);
 return {...data,events:events.map(event=>event.storage==='browser-v1'&&!('content' in event)?{...event,localMissing:true}:event).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)))};
}
