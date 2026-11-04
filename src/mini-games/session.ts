import {CATEGORIES,GAME_IDS,LETTERS,WHEEL_EXAMPLES} from './catalog.ts';
import {createMiniSession,miniReducer} from './engine.ts';
import type {MiniAction,MiniSession,ActiveMiniGame} from './engine.ts';

/** Distinct namespace and schema leave all existing Question & Condition browser-v1 data intact. */
export type MiniRun={
 schema:2;storage:'browser-v2';kind:'mini-games';
 ownerId:string;eventId:string;title:string;expiresAt:string;version:number;updatedAt:string;
 state:MiniSession;released?:boolean;
};
export type MiniStart={ownerId:string;eventId:string;title:string;expiresAt:string;prizeText:string};
const prefix='bud-browser-event:v2:',pointer='bud-browser-event:active';
const object=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);
const integer=(value:unknown,min:number,max:number)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=min&&value<=max;
const unique=(values:unknown[])=>new Set(values).size===values.length;
function validGame(v:unknown):v is ActiveMiniGame{
 if(!object(v)||!GAME_IDS.includes(v.kind as typeof GAME_IDS[number]))return false;
 if(v.kind==='bomb')return [4,5,6].includes(Number(v.size))&&integer(v.bomb,0,Number(v.size)*Number(v.size)-1)&&Array.isArray(v.opened)&&v.opened.every(x=>integer(x,0,Number(v.size)*Number(v.size)-1))&&unique(v.opened)&&[1,2].includes(Number(v.turn))&&(v.loser===null||[1,2].includes(Number(v.loser)))&&typeof v.finished==='boolean';
 if(v.kind==='form-word'||v.kind==='scramble')return typeof v.answer==='string'&&[...v.answer].length===5&&Array.isArray(v.letters)&&v.letters.length===5&&v.letters.every(x=>typeof x==='string'&&[...x].length===1)&&Number.isFinite(v.deadline)&&typeof v.finished==='boolean'&&typeof v.revealed==='boolean';
 if(v.kind==='pattern')return integer(v.level,4,128)&&Array.isArray(v.sequences)&&v.sequences.length===2&&v.sequences.every((s:unknown)=>Array.isArray(s)&&s.length===v.level&&s.every(c=>['أحمر','أزرق','أخضر','أصفر'].includes(c)))&&[1,2].includes(Number(v.turn))&&integer(v.progress,0,Number(v.level))&&Array.isArray(v.outcomes)&&v.outcomes.length===2&&v.outcomes.every((o:unknown)=>o===null||typeof o==='boolean')&&Number.isFinite(v.startedAt)&&integer(v.replays,0,1e8)&&typeof v.finished==='boolean'&&(v.winner===null||[1,2].includes(Number(v.winner)))&&typeof v.draw==='boolean';
 if(v.kind==='emoji'){
  const tiles=v.tiles;
  if(!Array.isArray(tiles))return false;
  return [3,5,7].includes(Number(v.pairs))&&tiles.length===Number(v.pairs)*2&&tiles.every(x=>typeof x==='string'&&x.length<12)&&Array.isArray(v.opened)&&v.opened.length<=2&&v.opened.every(x=>integer(x,0,tiles.length-1))&&unique(v.opened)&&Array.isArray(v.matched)&&v.matched.length<=tiles.length&&v.matched.every(x=>integer(x,0,tiles.length-1))&&unique(v.matched)&&[1,2].includes(Number(v.turn))&&Array.isArray(v.scores)&&v.scores.length===2&&v.scores.every(x=>integer(x,0,Number(v.pairs)))&&(v.mismatchUntil===null||Number.isFinite(v.mismatchUntil))&&typeof v.finished==='boolean'&&(v.winner===null||[1,2].includes(Number(v.winner)));
 }
 return CATEGORIES.includes(v.category as typeof CATEGORIES[number])&&LETTERS.includes(v.letter as typeof LETTERS[number])&&WHEEL_EXAMPLES[v.category as typeof CATEGORIES[number]][v.letter as string]===v.example&&((v.startedAt===null&&v.draws===0)||(Number.isFinite(v.startedAt)&&integer(v.draws,1,1e8)));
}
export function validMiniSession(v:unknown):v is MiniSession{
 if(!object(v)||v.schema!==2||v.kind!=='mini-games'||!['live','prizes','closing'].includes(String(v.phase))||!integer(v.nextWinnerNumber,1,1001))return false;
 if(!Array.isArray(v.winners)||!Array.isArray(v.prizes)||v.winners.length>50||v.prizes.length>50||v.winners.length>v.prizes.length)return false;
 const winners=v.winners as unknown[],prizes=v.prizes as unknown[];
 if(winners.some(w=>!object(w)||typeof w.id!=='string'||!/^winner-[1-9][0-9]*$/.test(w.id)||typeof w.name!=='string'||!w.name.trim()||w.name.length>80)||!unique(winners.map(w=>(w as {id:string}).id)))return false;
 const winnerIds=new Set(winners.map(w=>(w as {id:string}).id));
 if(winners.some(w=>Number((w as {id:string}).id.slice(7))>=Number(v.nextWinnerNumber)))return false;
 if(prizes.some(p=>!object(p)||typeof p.id!=='string'||!/^prize-[1-9][0-9]*$/.test(p.id)||typeof p.name!=='string'||p.name.length>100||typeof p.revealed!=='boolean'||!(p.winnerId===null||typeof p.winnerId==='string'&&winnerIds.has(p.winnerId)))||!unique(prizes.map(p=>(p as {id:string}).id)))return false;
 if(v.phase!=='live'&&v.active!==null)return false;
 return v.active===null||validGame(v.active);
}
export function validMiniRun(v:unknown,ownerId?:string,eventId?:string):v is MiniRun{
 return object(v)&&v.schema===2&&v.storage==='browser-v2'&&v.kind==='mini-games'&&typeof v.ownerId==='string'&&v.ownerId.length>0&&(!ownerId||v.ownerId===ownerId)&&typeof v.eventId==='string'&&v.eventId.length>0&&(!eventId||v.eventId===eventId)&&typeof v.title==='string'&&v.title.length<=100&&typeof v.expiresAt==='string'&&Number.isFinite(Date.parse(v.expiresAt))&&integer(v.version,1,1e9)&&typeof v.updatedAt==='string'&&Number.isFinite(Date.parse(v.updatedAt))&&validMiniSession(v.state);
}
function key(ownerId:string,eventId:string){return prefix+ownerId+':'+eventId;}
export function readMiniRun(ownerId:string,eventId:string):MiniRun|null{
 try{const raw=localStorage.getItem(key(ownerId,eventId));if(!raw||raw.length>4000000)return null;const v:unknown=JSON.parse(raw);return validMiniRun(v,ownerId,eventId)?v:null;}catch{return null;}
}
export function listMiniRuns(ownerId:string):MiniRun[]{
 try{const result:MiniRun[]=[];for(let n=0;n<localStorage.length;n++){const k=localStorage.key(n);if(!k?.startsWith(prefix+ownerId+':'))continue;const v=readMiniRun(ownerId,k.slice((prefix+ownerId+':').length));if(v)result.push(v);}
 return result.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}catch{return [];}
}
export function saveMiniRun(run:MiniRun):boolean{
 try{if(!validMiniRun(run))return false;const serialized=JSON.stringify(run);if(serialized.length>4000000)return false;localStorage.setItem(key(run.ownerId,run.eventId),serialized);return localStorage.getItem(key(run.ownerId,run.eventId))===serialized;}catch{return false;}
}
export function createMiniRun(payload:MiniStart,now=Date.now()):MiniRun{
 const previous=readMiniRun(payload.ownerId,payload.eventId);if(previous)return previous;
 const run:MiniRun={kind:'mini-games',schema:2,storage:'browser-v2',ownerId:payload.ownerId,eventId:payload.eventId,title:payload.title,expiresAt:payload.expiresAt,version:1,updatedAt:new Date(now).toISOString(),state:createMiniSession(payload.prizeText)};
 if(!saveMiniRun(run))throw Error('LOCAL_STORAGE_UNAVAILABLE');
 return run;
}
export function stepMiniRun(run:MiniRun,action:MiniAction,now=Date.now()):MiniRun{
 if(now>=Date.parse(run.expiresAt)&&run.state.phase!=='closing')throw Error('LOCAL_EVENT_EXPIRED');
 const next=miniReducer(run.state,action,now);
 return next===run.state?run:{...run,state:next,version:run.version+1,updatedAt:new Date(now).toISOString()};
}
export function selectMiniRun(run:MiniRun){sessionStorage.setItem(pointer,JSON.stringify({ownerId:run.ownerId,eventId:run.eventId,storage:'browser-v2'}));}
export function restoreMiniRun(eventId:string|null):MiniRun|null{
 try{if(!eventId)return null;const raw=sessionStorage.getItem(pointer);const p:unknown=JSON.parse(raw??'null');return object(p)&&p.eventId===eventId&&p.storage==='browser-v2'&&typeof p.ownerId==='string'?readMiniRun(p.ownerId,eventId):null;}catch{return null;}
}
