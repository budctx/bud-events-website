import {RotateCcw,Timer} from 'lucide-react';
import {gameFinished,remainingSeconds,gameWinner} from './engine.ts';
import type {ActiveMiniGame,MiniAction} from './engine.ts';
import {CATEGORIES,LETTERS,PATTERN_COLORS} from './catalog.ts';

type Props={game:ActiveMiniGame;now:number;send:(action:MiniAction)=>void};
const num=(v:number)=>new Intl.NumberFormat('ar-u-nu-latn').format(v);
function playerLabel(player:1|2){return 'اللاعب '+num(player);}
const colorClass=(value:string)=>'mini-color-'+({أحمر:'red',أزرق:'blue',أخضر:'green',أصفر:'yellow'} as Record<string,string>)[value];

export function MiniGameStage({game,now,send}:Props){
 const finished=gameFinished(game,now);
 const winner=gameWinner(game);
 return <section className="mini-stage" aria-label="شاشة اللعبة">
  <header className="mini-stage-header"><span className="mini-kicker">التحدي المباشر</span></header>
  {game.kind==='bomb'&&<>
   <div className="mini-status">الدور الآن: <strong>{playerLabel(game.turn)}</strong></div>
   <div className="mini-bomb-grid" style={{gridTemplateColumns:'repeat('+game.size+',minmax(0,1fr))'}}>
    {Array.from({length:game.size*game.size},(_,index)=>{
     const opened=game.opened.includes(index),isBomb=opened&&index===game.bomb;
     return <button key={index} type="button" className={'mini-cell mini-bomb-cell'+(opened?' is-open':'')+(isBomb?' is-bomb':'')} aria-label={'المربع '+num(index+1)+(opened?' مكشوف':'')} disabled={opened||game.finished} onClick={()=>send({type:'tap',index})}>{opened?(isBomb?'💣':'✓'):num(index+1)}</button>;
    })}
   </div>
   {game.finished&&<p className="mini-outcome" role="status">💥 خسر {playerLabel(game.loser!)} · فاز {playerLabel(winner!)}</p>}
  </>}
  {(game.kind==='form-word'||game.kind==='scramble')&&<>
   <div className="mini-timer" role="timer" aria-label="الوقت المتبقي"><Timer size={19}/><strong>{num(remainingSeconds(game,now))}</strong><span>ثانية</span></div>
   <div className="mini-letters" dir="rtl">{game.kind==='scramble'&&game.revealed?<strong className="mini-scramble-answer" dir="rtl">{game.answer}</strong>:game.letters.map((letter,index)=><span className="mini-letter" key={index}>{letter}</span>)}</div>
   <p className="mini-hint">{game.kind==='form-word'?'من يكوّن أطول كلمة صحيحة من هذه الأحرف؟':'ما الكلمة الصحيحة بعد ترتيب هذه الأحرف؟'}</p>
   {!finished?<button type="button" className="mini-cta mini-secondary" onClick={()=>send({type:'finish'})}>إنهاء التحدي</button>:game.kind==='scramble'&&!game.revealed?<button type="button" className="mini-cta mini-secondary" onClick={()=>send({type:'reveal'})}>إظهار الكلمة</button>:null}
  </>}
  {game.kind==='pattern'&&<>
   {(()=>{
    const elapsed=now-game.startedAt;
    const displaying=elapsed<game.level*700+800;
    const index=elapsed>=500?Math.floor((elapsed-500)/700):-1;
    const pulse=(elapsed-500)%700; // A dark gap makes repeated adjacent colors perceptible as distinct steps.
    const active=displaying&&index>=0&&index<game.level&&pulse<480?game.sequences[game.turn-1][index]:null;
    const turnChanging=elapsed>=0&&elapsed<1250;
    return <>
     <div className={'mini-pattern-turn'+(turnChanging?' is-turn-shifting':'')} role="status">
      <span>الدور الآن</span><strong>{playerLabel(game.turn)}</strong>
      <small>{displaying?'شاهد الأضواء':num(game.progress)+' / '+num(game.level)}</small>
     </div>
     <div className="mini-pattern-pads" aria-label="لوحة ألوان احفظ النمط">{PATTERN_COLORS.map(value=><button type="button" key={value} aria-label={'اللون '+value} className={'mini-pattern-pad '+colorClass(value)+(active===value?' is-lit':'')} disabled={displaying||game.finished} aria-disabled={displaying||game.finished} onClick={()=>send({type:'color',color:value})}/>)}</div>
     {!game.finished&&<button type="button" className="mini-icon-text" onClick={()=>send({type:'replay'})}><RotateCcw size={18}/> إعادة عرض النمط</button>}
    </>;
   })()}
   {game.finished&&<p className="mini-outcome" role="status">{game.draw?'لم يفز أحد':('فاز '+playerLabel(winner!))}</p>}
  </>}
  {game.kind==='emoji'&&<>
   <div className="mini-scorebar"><span>اللاعب 1 <strong>{num(game.scores[0])}</strong></span><span>الدور: <strong>{playerLabel(game.turn)}</strong></span><span>اللاعب 2 <strong>{num(game.scores[1])}</strong></span></div>
   <div className="mini-emoji-grid" style={{gridTemplateColumns:'repeat('+game.pairs+',minmax(0,1fr))'}} aria-label="بطاقات ذاكرة الإيموجي">
    {game.tiles.map((value,index)=>{
     const visible=game.matched.includes(index)||game.opened.includes(index);
     return <button type="button" key={index} className={'mini-cell mini-emoji-cell'+(visible?' is-open':'')+(game.matched.includes(index)?' is-matched':'')} disabled={game.finished||game.mismatchUntil!==null||visible} aria-label={'بطاقة '+num(index+1)+(visible?' '+value:' مخفية')} onClick={()=>send({type:'tap',index})}>{visible?value:num(index+1)}</button>;
    })}
   </div>
   {game.finished&&<p className="mini-outcome" role="status">🏆 فاز {playerLabel(winner!)} بنتيجة {num(game.scores[winner!-1])}</p>}
  </>}
  {game.kind==='wheel'&&(()=>{
   const idle=game.startedAt===null,elapsed=idle?0:now-game.startedAt!;
   const spinning=!idle&&!finished;
   return <>
    <div className="mini-wheel-track" aria-hidden="true">
     <div className="mini-wheel-reel" aria-label="تصنيف">{idle?<span className="mini-wheel-idle">الفئة</span>:elapsed<2600?<div key={'cat'+game.draws} className="mini-wheel-spinning">{[...CATEGORIES,...CATEGORIES,...CATEGORIES].map((c,i)=><span key={i}>{c}</span>)}</div>:<strong>{game.category}</strong>}</div>
     <span className="mini-wheel-divider" aria-hidden="true">|</span>
     <div className="mini-wheel-reel" aria-label="حرف">{idle?<span className="mini-wheel-idle">الحرف</span>:elapsed<3800?<div key={'letter'+game.draws} className="mini-wheel-spinning mini-wheel-long">{[...LETTERS,...LETTERS,...LETTERS].map((c,i)=><span key={i}>{c}</span>)}</div>:<strong>{game.letter}</strong>}</div>
    </div>
    <span className="bud-sr-only" role="status">{spinning?'جارٍ الدوران…':finished?`نتيجة السحب: ${game.category}، الحرف ${game.letter}`:''}</span>
    <button type="button" className={'mini-wheel-lever'+(spinning?' is-spinning':'')} disabled={spinning} aria-label={idle?'سحب المقبض':'إعادة السحب'} onClick={()=>send({type:'spin'})}>
     <span className="mini-wheel-lever-art" aria-hidden="true"><span className="mini-wheel-lever-knob"/><span className="mini-wheel-lever-shaft"/><span className="mini-wheel-lever-base"/></span>
     <span>{spinning?'جارٍ الدوران…':idle?'اسحب المقبض':'إعادة السحب'}</span>
    </button>
    {spinning&&<p className="mini-hint">تتوقف الفئة أولًا، ثم الحرف.</p>}
   </>;
  })()}
 </section>;
}
