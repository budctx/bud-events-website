import {parsePrizeLines} from '../prize-lines.ts';
import {shufflePrizeNames} from '../manual-game.ts';
import type {ManualWinner,ManualPrize} from '../manual-game.ts';
import {WORDS,EMOJI_SYMBOLS,PATTERN_COLORS,availableWheelPairs} from './catalog.ts';
import type {MiniGameKind,PatternColor,WheelCategory} from './catalog.ts';

/** Mini Games is controlled only by its host, with no participant account or server gameplay mutations. */
export type Player = 1|2;
export type BombGame={kind:'bomb';size:4|5|6;bomb:number;opened:number[];turn:Player;loser:Player|null;finished:boolean};
export type WordGame={kind:'form-word'|'scramble';answer:string;letters:string[];deadline:number;finished:boolean;revealed:boolean};
export type PatternGame={kind:'pattern';level:number;sequences:[PatternColor[],PatternColor[]];turn:Player;progress:number;outcomes:[boolean|null,boolean|null];startedAt:number;replays:number;finished:boolean;winner:Player|null;draw:boolean};
export type EmojiGame={kind:'emoji';pairs:3|5|7;tiles:string[];opened:number[];matched:number[];turn:Player;scores:[number,number];mismatchUntil:number|null;finished:boolean;winner:Player|null};
export type WheelGame={kind:'wheel';category:WheelCategory;letter:string;example:string;startedAt:number;draws:number};
export type ActiveMiniGame=BombGame|WordGame|PatternGame|EmojiGame|WheelGame;
export type MiniPhase='live'|'prizes'|'closing';
export type MiniSession={
 schema:2;kind:'mini-games';phase:MiniPhase;prizes:ManualPrize[];winners:ManualWinner[];
 nextWinnerNumber:number;active:ActiveMiniGame|null;
};
export type MiniAction=
 | {type:'open';game:MiniGameKind;size?:4|5|6;pairs?:3|5|7;level?:4|5|6;seconds?:number}
 | {type:'tap';index:number}
 | {type:'color';color:PatternColor}
 | {type:'replay'}
 | {type:'resolve'}
 | {type:'finish'}
 | {type:'reveal'}
 | {type:'spin'}
 | {type:'close'}
 | {type:'winner';name:string}
 | {type:'rename-winner';winnerId:string;name:string}
 | {type:'delete-winner';winnerId:string}
 | {type:'open-prize';prizeId:string}
 | {type:'award';prizeId:string;winnerId:string}
 | {type:'phase';phase:MiniPhase};

export type PickIndex=(length:number)=>number;
export const pickIndex:PickIndex=(length)=>{
 if(!Number.isInteger(length)||length<1)throw Error('INVALID_RANDOM_LENGTH');
 if(globalThis.crypto?.getRandomValues){
  const max=0x100000000,cut=max-max%length,buffer=new Uint32Array(1);
  do{globalThis.crypto.getRandomValues(buffer);}while(buffer[0]>=cut);
  return buffer[0]%length;
 }
 return Math.floor(Math.random()*length);
};
function choose<T>(values:readonly T[],pick:PickIndex):T{
 if(!values.length)throw Error('EMPTY_CATALOG');
 const index=pick(values.length);
 if(!Number.isInteger(index)||index<0||index>=values.length)throw Error('INVALID_RANDOM_INDEX');
 return values[index];
}
function shuffle<T>(values:readonly T[],pick:PickIndex):T[]{
 const result=[...values];
 for(let i=result.length-1;i>0;i--){const j=pick(i+1);if(!Number.isInteger(j)||j<0||j>i)throw Error('INVALID_RANDOM_INDEX');[result[i],result[j]]=[result[j],result[i]];}
 return result;
}
function generateSequence(level:number,pick:PickIndex):PatternColor[]{
 return Array.from({length:level},()=>choose(PATTERN_COLORS,pick));
}
function distinctSequences(level:number,pick:PickIndex):[PatternColor[],PatternColor[]]{
 const first=generateSequence(level,pick);let second=generateSequence(level,pick);
 if(second.every((value,index)=>value===first[index]))second=[...second.slice(0,-1),PATTERN_COLORS[(PATTERN_COLORS.indexOf(second[level-1])+1)%PATTERN_COLORS.length]];
 return [first,second];
}
export function createMiniSession(prizeText:string,pick:PickIndex=pickIndex):MiniSession{
 const parsed=parsePrizeLines(prizeText);
 if(!parsed.valid)throw Error('INVALID_PRIZES');
 return {schema:2,kind:'mini-games',phase:'live',active:null,
  prizes:shufflePrizeNames(parsed.lines,pick).map((name,index)=>({id:'prize-'+(index+1),name,revealed:false,winnerId:null})),
  winners:[],nextWinnerNumber:1};
}
export function createMiniGame(kind:MiniGameKind,opts:Extract<MiniAction,{type:'open'}>,now:number,pick:PickIndex=pickIndex):ActiveMiniGame{
 if(kind==='bomb'){
  const size=([4,5,6] as const).includes(opts.size as 4|5|6)?opts.size!:5;
  return {kind,size,bomb:choose(Array.from({length:size*size},(_,i)=>i),pick),opened:[],turn:1,loser:null,finished:false};
 }
 if(kind==='emoji'){
  const pairs=([3,5,7] as const).includes(opts.pairs as 3|5|7)?opts.pairs!:5;
  const symbols=shuffle(EMOJI_SYMBOLS,pick).slice(0,pairs);
  return {kind,pairs,tiles:shuffle([...symbols,...symbols],pick),opened:[],matched:[],turn:1,scores:[0,0],mismatchUntil:null,finished:false,winner:null};
 }
 if(kind==='pattern'){
  const level=([4,5,6] as const).includes(opts.level as 4|5|6)?opts.level!:5;
  return {kind,level,sequences:distinctSequences(level,pick),turn:1,progress:0,outcomes:[null,null],startedAt:now,replays:0,finished:false,winner:null,draw:false};
 }
 if(kind==='form-word'||kind==='scramble'){
  const seconds=Math.min(180,Math.max(10,Math.floor(opts.seconds??(kind==='form-word'?60:30))));
  const answer=choose(WORDS.filter(value=>Array.from(value).length===5),pick);
  // A guaranteed solvable set of five letters; never show an impossible collection.
  const letters=shuffle(Array.from(answer),pick);
  if(letters.join('')===answer&&letters.length>1){[letters[0],letters[1]]=[letters[1],letters[0]];}
  return {kind,answer,letters,deadline:now+seconds*1000,finished:false,revealed:false};
 }
 const value=choose(availableWheelPairs(),pick);
 return {kind:'wheel',...value,startedAt:now,draws:1};
}
export function gameFinished(game:ActiveMiniGame,now=Date.now()):boolean{
 if(game.kind==='wheel')return now-game.startedAt>=3800;
 if(game.kind==='form-word'||game.kind==='scramble')return game.finished||now>=game.deadline;
 return game.finished;
}
export function remainingSeconds(game:WordGame,now=Date.now()):number{
 return game.finished?0:Math.max(0,Math.ceil((game.deadline-now)/1000));
}
export function gameWinner(game:ActiveMiniGame):Player|null{
 return game.kind==='bomb'?game.loser?(game.loser===1?2:1):null:game.kind==='emoji'||game.kind==='pattern'?game.winner:null;
}
export function recordableWinner(state:MiniSession,now=Date.now()):boolean{
 return state.phase==='live'&&!!state.active&&gameFinished(state.active,now)&&state.prizes.length>state.winners.length
  &&!(state.active.kind==='pattern'&&state.active.draw);
}
export function miniReducer(state:MiniSession,action:MiniAction,now=Date.now(),pick:PickIndex=pickIndex):MiniSession{
 if(state.phase==='closing')return state;
 if(action.type==='phase'){
  if(action.phase==='prizes'&&state.phase==='live')return {...state,phase:'prizes',active:null};
  if(action.phase==='live'&&state.phase==='prizes'&&!state.prizes.some(p=>p.revealed))return {...state,phase:'live'};
  if(action.phase==='closing'&&state.phase==='prizes')return {...state,phase:'closing',active:null};
  return state;
 }
 if(action.type==='rename-winner'){
  const name=action.name.trim();if(!name||name.length>80||!state.winners.some(w=>w.id===action.winnerId))return state;
  return {...state,winners:state.winners.map(w=>w.id===action.winnerId?{...w,name}:w)};
 }
 if(action.type==='delete-winner'){
  if(!state.winners.some(w=>w.id===action.winnerId))return state;
  return {...state,winners:state.winners.filter(w=>w.id!==action.winnerId),
   prizes:state.prizes.map(p=>p.winnerId===action.winnerId?{...p,winnerId:null,revealed:false}:p)};
 }
 if(action.type==='award'){
  if(state.phase!=='prizes'||!state.winners.some(w=>w.id===action.winnerId)||state.prizes.some(p=>p.winnerId===action.winnerId))return state;
  const prize=state.prizes.find(p=>p.id===action.prizeId);
  if(!prize||prize.revealed)return state;
  return {...state,prizes:state.prizes.map(p=>p.id===prize.id?{...p,revealed:true,winnerId:action.winnerId}:p)};
 }
 if(action.type==='open-prize'){
  if(state.phase!=='prizes')return state;
  const prize=state.prizes.find(p=>p.id===action.prizeId);
  if(!prize||prize.revealed)return state;
  return {...state,prizes:state.prizes.map(p=>p.id===prize.id?{...p,revealed:true}:p)};
 }
 if(state.phase!=='live')return state;
 if(action.type==='open')return {...state,active:createMiniGame(action.game,action,now,pick)};
 if(action.type==='close')return state.active?{...state,active:null}:state;
 if(!state.active)return state;
 const game=state.active;
 if(action.type==='winner'){
  const name=action.name.trim();
  if(!recordableWinner(state,now)||!name||name.length>80)return state;
  const winner={id:'winner-'+state.nextWinnerNumber,name};
  return {...state,winners:[...state.winners,winner],nextWinnerNumber:state.nextWinnerNumber+1,active:null};
 }
 if(action.type==='finish'&&(game.kind==='form-word'||game.kind==='scramble'))return {...state,active:{...game,finished:true}};
 if(action.type==='reveal'&&game.kind==='scramble'&&gameFinished(game,now))return {...state,active:{...game,revealed:true}};
 if(action.type==='spin'&&game.kind==='wheel'&&gameFinished(game,now)){
  const value=choose(availableWheelPairs(),pick);
  return {...state,active:{...game,...value,startedAt:now,draws:game.draws+1}};
 }
 if(action.type==='tap'&&game.kind==='bomb'){
  if(game.finished||!Number.isInteger(action.index)||action.index<0||action.index>=game.size*game.size||game.opened.includes(action.index))return state;
  const loser=action.index===game.bomb?game.turn:null;
  return {...state,active:{...game,opened:[...game.opened,action.index],loser,finished:loser!==null,turn:loser?game.turn:(game.turn===1?2:1)}};
 }
 if(action.type==='tap'&&game.kind==='emoji'){
  if(game.finished||game.mismatchUntil!==null||!Number.isInteger(action.index)||action.index<0||action.index>=game.tiles.length||game.matched.includes(action.index)||game.opened.includes(action.index))return state;
  const opened=[...game.opened,action.index];
  if(opened.length===1)return {...state,active:{...game,opened}};
  const [a,b]=opened;
  if(game.tiles[a]===game.tiles[b]){
   const matched=[...game.matched,a,b],scores:[number,number]=[...game.scores];
   scores[game.turn-1]++;
   const finished=matched.length===game.tiles.length;
   return {...state,active:{...game,opened:[],matched,scores,finished,winner:finished?(scores[0]>scores[1]?1:2):null}};
  }
  return {...state,active:{...game,opened,mismatchUntil:now+1000}};
 }
 if(action.type==='resolve'&&game.kind==='emoji'&&game.mismatchUntil!==null&&now>=game.mismatchUntil){
  return {...state,active:{...game,opened:[],mismatchUntil:null,turn:game.turn===1?2:1}};
 }
 if(action.type==='replay'&&game.kind==='pattern'&&!game.finished){
  return {...state,active:{...game,startedAt:now,progress:0,replays:game.replays+1}};
 }
 if(action.type==='color'&&game.kind==='pattern'&&!game.finished){
  const displayMs=game.level*700+800;
  if(now<game.startedAt+displayMs)return state;
  const correct=game.sequences[game.turn-1][game.progress]===action.color;
  const ended=!correct||game.progress+1===game.level;
  if(!ended)return {...state,active:{...game,progress:game.progress+1}};
  const outcomes:[boolean|null,boolean|null]=[...game.outcomes];
  outcomes[game.turn-1]=correct;
  if(game.turn===1)return {...state,active:{...game,outcomes,turn:2,progress:0,startedAt:now}};
  if(outcomes[0]&&outcomes[1]){
   const level=game.level+1;
   return {...state,active:{...game,level,sequences:distinctSequences(level,pick),outcomes:[null,null],turn:1,progress:0,startedAt:now,replays:0}};
  }
  const winner=outcomes[0]===outcomes[1]?null:outcomes[0]?1:2;
  return {...state,active:{...game,outcomes,finished:true,winner,draw:winner===null}};
 }
 return state;
}
