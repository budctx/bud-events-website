import test from 'node:test';
import assert from 'node:assert/strict';
import {createMiniSession,createMiniGame,miniReducer,gameFinished,recordableWinner,remainingSeconds} from '../src/mini-games/engine.ts';
import {availableWheelPairs,CATEGORIES,LETTERS,WORDS} from '../src/mini-games/catalog.ts';
const first=()=>0;
test('the full Arabic letter wheel only contains possible, approved combinations',()=>{
 const options=availableWheelPairs();
 assert.equal(LETTERS.length,24);
 assert.equal(options.length,CATEGORIES.length*LETTERS.length);
 for(const {category,letter,example} of options){
  assert.ok(CATEGORIES.includes(category));
  assert.ok(!'ثذضظ'.includes(letter));
  assert.ok(example.length>0);
 }
 for(let i=0;i<40;i++){const g=createMiniGame('wheel',{type:'open',game:'wheel'},1000,()=>i%options.length);assert.equal(g.kind,'wheel');if(g.kind==='wheel')assert.ok(!'ثذضظ'.includes(g.letter));}
});
test('no-prize sessions play normally and never allow winner registration',()=>{
 let session=createMiniSession('',first);
 assert.equal(session.prizes.length,0);
 session=miniReducer(session,{type:'open',game:'bomb',size:4},1000,first);
 assert.equal(session.active?.kind,'bomb');
 session=miniReducer(session,{type:'tap',index:0},1001,first);
 assert.ok(session.active?.kind==='bomb'&&session.active.finished);
 assert.equal(recordableWinner(session,1002),false);
 assert.strictEqual(miniReducer(session,{type:'winner',name:'سارة'},1002),session);
 session=miniReducer(session,{type:'close'});
 assert.equal(session.active,null);
 session=miniReducer(session,{type:'phase',phase:'prizes'});
 session=miniReducer(session,{type:'phase',phase:'closing'});
 assert.equal(session.phase,'closing');
});
test('one bomb, turn alternation and no double opening; losing player is correctly identified',()=>{
 let s=createMiniSession('جائزة',first);
 s=miniReducer(s,{type:'open',game:'bomb',size:4},1000,first);
 assert.equal(s.active?.kind,'bomb');
 if(s.active?.kind!=='bomb')return;
 const bomb=s.active.bomb;
 const safe=bomb===0?1:0;
 s=miniReducer(s,{type:'tap',index:safe},1100,first);
 assert.equal(s.active?.kind==='bomb'&&s.active.turn,2);
 assert.strictEqual(miniReducer(s,{type:'tap',index:safe},1200,first),s);
 s=miniReducer(s,{type:'tap',index:bomb},1300,first);
 assert.equal(s.active?.kind==='bomb'&&s.active.loser,2);
 s=miniReducer(s,{type:'winner',name:'سارة'},1400,first);
 assert.equal(s.winners[0].name,'سارة');
 assert.equal(s.active,null);
});
test('word and scramble are always solvable; timers only expire at the deadline',()=>{
 assert.ok(WORDS.length>=25);
 for(const kind of ['form-word','scramble'] as const){
  const g=createMiniGame(kind,{type:'open',game:kind,seconds:30},3000,first);
  assert.ok(g.kind===kind);
  if(g.kind!=='form-word'&&g.kind!=='scramble')continue;
  assert.equal(g.letters.length,5);
  assert.equal(g.letters.slice().sort().join(''),g.answer.split('').sort().join(''));
  assert.equal(remainingSeconds(g,3000),30);
  assert.equal(gameFinished(g,32999),false);
  assert.equal(gameFinished(g,33000),true);
 }
});
test('matching emoji pairs stay open, score the current player and ties are impossible',()=>{
 let s=createMiniSession('الجائزة 1\nالجائزة 2',first);
 s=miniReducer(s,{type:'open',game:'emoji',pairs:5},1,first);
 assert.equal(s.active?.kind,'emoji');
 if(s.active?.kind!=='emoji')return;
 const tiles=[...s.active.tiles];
 for(const symbol of new Set(tiles)){
  for(let i=0;i<tiles.length;i++)if(tiles[i]===symbol){s=miniReducer(s,{type:'tap',index:i},2+i,first);}
 }
 assert.equal(s.active?.kind==='emoji'&&s.active.finished,true);
 assert.equal(s.active?.kind==='emoji'&&s.active.scores[0],5);
 assert.equal(s.active?.kind==='emoji'&&s.active.winner,1);
});
test('two wrong emoji picks lock input for a full second and rotate the turn',()=>{
 let s=createMiniSession('جائزة',first);
 s=miniReducer(s,{type:'open',game:'emoji',pairs:3},1,first);
 if(s.active?.kind!=='emoji')return;
 const a=0;
 // Find two actual different symbols without relying on shuffle order.
 const firstSymbol=s.active.tiles[0];
 const other=s.active.tiles.findIndex(x=>x!==firstSymbol);
 assert.ok(other>=0);
 s=miniReducer(s,{type:'tap',index:a},10,first);
 s=miniReducer(s,{type:'tap',index:other},20,first);
 assert.equal(s.active?.kind==='emoji'&&s.active.mismatchUntil,1020);
 assert.strictEqual(miniReducer(s,{type:'resolve'},1019,first),s);
 s=miniReducer(s,{type:'resolve'},1020,first);
 assert.equal(s.active?.kind==='emoji'&&s.active.turn,2);
});
test('pattern mistakes are assessed after both players; both pass raises difficulty',()=>{
 let s=createMiniSession('جائزة',first);
 s=miniReducer(s,{type:'open',game:'pattern',level:5},100,first);
 if(s.active?.kind!=='pattern')return;
 const firstSeq=[...s.active.sequences[0]],secondSeq=[...s.active.sequences[1]];
 for(let i=0;i<firstSeq.length;i++)s=miniReducer(s,{type:'color',color:firstSeq[i]},100+5*700+800+i+1,first);
 assert.equal(s.active?.kind==='pattern'&&s.active.turn,2);
 if(s.active?.kind!=='pattern')return;
 const secondStart=s.active.startedAt;
 for(let i=0;i<secondSeq.length;i++)s=miniReducer(s,{type:'color',color:secondSeq[i]},secondStart+5*700+800+i+1,first);
 assert.equal(s.active?.kind==='pattern'&&s.active.level,6);
 assert.equal(s.active?.kind==='pattern'&&s.active.turn,1);
 assert.equal(s.active?.kind==='pattern'&&s.active.finished,false);
});
test('winner count never exceeds prize count and repeated names retain different ids',()=>{
 let s=createMiniSession('أ\nب',first);
 for(let i=0;i<3;i++){
  s=miniReducer(s,{type:'open',game:'bomb',size:4},i*1000,first);
  s=miniReducer(s,{type:'tap',index:0},i*1000+10,first);
  s=miniReducer(s,{type:'winner',name:'محمد'},i*1000+20,first);
 }
 assert.equal(s.winners.length,2);
 assert.equal(new Set(s.winners.map(w=>w.id)).size,2);
 assert.equal(s.prizes.length,2);
 s=miniReducer(s,{type:'phase',phase:'prizes'});
 s=miniReducer(s,{type:'award',prizeId:s.prizes[0].id,winnerId:s.winners[0].id});
 assert.equal(s.prizes[0].revealed,true);
 s=miniReducer(s,{type:'phase',phase:'closing'});
 assert.equal(s.phase,'closing');
});

test('shared prize stage can add a bounded winner without reopening an activity',()=>{
 let state=createMiniSession('أولى\nثانية',first);
 state=miniReducer(state,{type:'phase',phase:'prizes'});
 const added=miniReducer(state,{type:'add-winner',name:'  نورة  '});
 assert.equal(added.phase,'prizes');
 assert.equal(added.active,null);
 assert.deepEqual(added.winners,[{id:'winner-1',name:'نورة'}]);
 const second=miniReducer(added,{type:'add-winner',name:'نورة'});
 assert.equal(second.winners.length,2);
 assert.strictEqual(miniReducer(second,{type:'add-winner',name:'زائد'}),second);
});

test('new sessions start fixed 4x4 bomb, five emoji pairs and a five-step pattern',()=>{
 const b=createMiniGame('bomb',{type:'open',game:'bomb',size:6},0,first);
 assert.equal(b.kind,'bomb');if(b.kind==='bomb')assert.equal(b.size,4);
 const easy=createMiniGame('emoji',{type:'open',game:'emoji',pairs:3},0,first);
 assert.equal(easy.kind,'emoji');if(easy.kind==='emoji'){assert.equal(easy.pairs,5);assert.equal(easy.tiles.length,10);}
 const hard=createMiniGame('emoji',{type:'open',game:'emoji',pairs:7},0,first);
 assert.equal(hard.kind,'emoji');if(hard.kind==='emoji'){assert.equal(hard.pairs,7);assert.equal(hard.tiles.length,14);}
 const pattern=createMiniGame('pattern',{type:'open',game:'pattern',level:4},0,first);
 assert.equal(pattern.kind,'pattern');if(pattern.kind==='pattern'){assert.equal(pattern.level,5);assert.deepEqual(pattern.sequences.map(s=>s.length),[5,5]);}
});
test('wheel remains stopped until a host spin action; cannot double spin while turning',()=>{
 let state=createMiniSession('',first);
 state=miniReducer(state,{type:'open',game:'wheel'},1000,first);
 assert.equal(state.active?.kind,'wheel');
 if(state.active?.kind!=='wheel')return;
 assert.equal(state.active.startedAt,null);
 assert.equal(state.active.draws,0);
 assert.equal(gameFinished(state.active,5000),false);
 state=miniReducer(state,{type:'spin'},5000,first);
 if(state.active?.kind!=='wheel')return;
 assert.equal(state.active.startedAt,5000);
 assert.equal(state.active.draws,1);
 assert.strictEqual(miniReducer(state,{type:'spin'},5001,first),state);
 assert.equal(gameFinished(state.active,8799),false);
 assert.equal(gameFinished(state.active,8800),true);
 state=miniReducer(state,{type:'spin'},8801,first);
 assert.equal(state.active?.kind==='wheel'&&state.active.draws,2);
});

test('winner management works across live and prizes without interrupting active games',()=>{
 let s=createMiniSession('أولى\nثانية',first);
 s=miniReducer(s,{type:'add-winner',name:'سارة'});
 s=miniReducer(s,{type:'add-winner',name:'سارة'});
 assert.deepEqual(s.winners.map(w=>w.id),['winner-1','winner-2']);
 assert.equal(s.winners[0].name,s.winners[1].name);
 assert.strictEqual(miniReducer(s,{type:'add-winner',name:'زائد'}),s);
 s=miniReducer(s,{type:'rename-winner',winnerId:'winner-2',name:'نورة'});
 assert.equal(s.winners[1].name,'نورة');
 const active=miniReducer(s,{type:'open',game:'bomb',size:4},1000,first);
 assert.strictEqual(miniReducer(active,{type:'add-winner',name:'خاطئ'}),active);
 s=miniReducer(active,{type:'close'});
 s=miniReducer(s,{type:'phase',phase:'prizes'});
 s=miniReducer(s,{type:'award',prizeId:'prize-1',winnerId:'winner-1'});
 assert.equal(s.prizes[0].revealed,true);
 s=miniReducer(s,{type:'delete-winner',winnerId:'winner-1'});
 assert.equal(s.prizes[0].revealed,false);
 assert.equal(s.prizes[0].winnerId,null);
 s=miniReducer(s,{type:'add-winner',name:'سارة'});
 assert.deepEqual(s.winners.map(w=>w.id),['winner-2','winner-3']);
 s=miniReducer(s,{type:'phase',phase:'closing'});
 assert.strictEqual(miniReducer(s,{type:'rename-winner',winnerId:'winner-2',name:'غير مسموح'}),s);
 assert.strictEqual(miniReducer(s,{type:'delete-winner',winnerId:'winner-2'}),s);
 assert.strictEqual(miniReducer(s,{type:'add-winner',name:'غير مسموح'}),s);
 const empty=createMiniSession('',first);
 assert.strictEqual(miniReducer(empty,{type:'add-winner',name:'لا جوائز'}),empty);
});
