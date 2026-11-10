import {RotateCcw,Timer} from 'lucide-react';
import {gameFinished,remainingSeconds,gameWinner,WHEEL_CATEGORY_STOP_MS,WHEEL_LETTER_STOP_MS,PATTERN_TURN_NOTICE_MS,PATTERN_FLASH_STEP_MS,PATTERN_DISPLAY_TAIL_MS} from './engine.ts';
import type {ActiveMiniGame,MiniAction} from './engine.ts';
import {CATEGORIES,LETTERS,PATTERN_COLORS} from './catalog.ts';
import {MiniFlipCard} from './MiniFlipCard';

type Props={game:ActiveMiniGame;now:number;send:(action:MiniAction)=>void};
const num=(v:number)=>new Intl.NumberFormat('ar-u-nu-latn').format(v);
function playerLabel(player:1|2){return 'اللاعب '+num(player);}
const colorClass=(value:string)=>'mini-color-'+({أحمر:'red',أزرق:'blue',أخضر:'green',أصفر:'yellow'} as Record<string,string>)[value];

export function MiniGameStage({game,now,send}:Props){
 const finished=gameFinished(game,now);
 const winner=gameWinner(game);
 return <section className="mini-stage" aria-label="شاشة اللعبة">
  {!(game.kind==='pattern'&&game.finished)&&<header className="mini-stage-header"><span className="mini-kicker">التحدي المباشر</span></header>}
  {game.kind==='bomb'&&<>
   <div className="mini-status">الدور الآن: <strong>{playerLabel(game.turn)}</strong></div>
   <div className="mini-bomb-grid" style={{gridTemplateColumns:'repeat('+game.size+',minmax(0,1fr))'}}>
    {Array.from({length:game.size*game.size},(_,index)=>{
     const opened=game.opened.includes(index),isBomb=opened&&index===game.bomb;
     return <MiniFlipCard key={index} className={'mini-cell mini-bomb-cell'+(opened?' is-open':'')+(isBomb?' is-bomb':'')}
      label={'المربع '+num(index+1)+(opened?' مكشوف':'')} disabled={opened||game.finished}
      revealed={opened} explode={isBomb} back={num(index+1)} front={isBomb?'💣':'✓'} onPress={()=>send({type:'tap',index})}/>;
    })}
   </div>
  </>}
  {(game.kind==='form-word'||game.kind==='scramble')&&<>
   <div className="mini-timer" role="timer" aria-label="الوقت المتبقي"><Timer size={19}/><strong>{num(remainingSeconds(game,now))}</strong><span>ثانية</span></div>
   <div className="mini-letters" dir="rtl">{game.kind==='scramble'&&game.revealed?<strong className="mini-scramble-answer" dir="rtl">{game.answer}</strong>:game.letters.map((letter,index)=><span className="mini-letter" key={index}>{letter}</span>)}</div>
   <p className="mini-hint">{game.kind==='form-word'?'خمسة أحرف عشوائية — كوّن منها كلمة صحيحة.':'ما الكلمة الصحيحة بعد ترتيب هذه الأحرف؟'}</p>
   {game.kind==='scramble'?<div className="mini-word-actions">
    <button type="button" className="mini-cta mini-primary" disabled={game.revealed} onClick={()=>send({type:'reveal'})}>كشف الكلمة الصحيحة</button>
    <button type="button" className="mini-cta mini-secondary" onClick={()=>send({type:'change-word'})}>تغيير الكلمة</button>
   </div>:!finished?<button type="button" className="mini-cta mini-secondary" onClick={()=>send({type:'finish'})}>إنهاء التحدي</button>:null}
  </>}
  {game.kind==='pattern'&&!game.finished&&(()=>{
    const elapsed=now-game.startedAt;
    const announcing=game.replays===0&&elapsed>=0&&elapsed<PATTERN_TURN_NOTICE_MS;
    const sequenceElapsed=elapsed-(game.replays===0?PATTERN_TURN_NOTICE_MS:0);
    const displaying=sequenceElapsed<game.level*PATTERN_FLASH_STEP_MS+PATTERN_DISPLAY_TAIL_MS;
    const index=sequenceElapsed>=500?Math.floor((sequenceElapsed-500)/PATTERN_FLASH_STEP_MS):-1;
    const pulse=(sequenceElapsed-500)%PATTERN_FLASH_STEP_MS;
    const active=displaying&&index>=0&&index<game.level&&pulse<480?game.sequences[game.turn-1][index]:null;
    return <>
     <div className="mini-pattern-turn" role="status">
      <span>الدور الآن</span><strong>{playerLabel(game.turn)}</strong>
      <small>{displaying?'شاهد الأضواء':num(game.progress)+' / '+num(game.level)}</small>
     </div>
     <div className="mini-pattern-board">
      <div className="mini-pattern-pads" aria-label="لوحة ألوان احفظ النمط">{PATTERN_COLORS.map(value=><button type="button" key={value} aria-label={'اللون '+value} className={'mini-pattern-pad '+colorClass(value)+(active===value?' is-lit':'')} disabled={displaying} aria-disabled={displaying} onClick={()=>send({type:'color',color:value})}/>)}</div>
      {announcing&&<div className="mini-pattern-announcement" role="status"><strong>{game.turn===1?'دور اللاعب الأول':'دور اللاعب الثاني'}</strong><span>استعد لحفظ التسلسل</span></div>}
     </div>
     <button type="button" className="mini-icon-text" onClick={()=>send({type:'replay'})}><RotateCcw size={18}/> إعادة عرض النمط</button>
    </>;
   })()}
  {game.kind==='emoji'&&<>
   <div className="mini-scorebar"><span>اللاعب 1 <strong>{num(game.scores[0])}</strong></span><span>الدور: <strong>{playerLabel(game.turn)}</strong></span><span>اللاعب 2 <strong>{num(game.scores[1])}</strong></span></div>
   <div className="mini-emoji-grid" style={{gridTemplateColumns:'repeat('+(Number.isInteger(Math.sqrt(game.tiles.length))?Math.sqrt(game.tiles.length):game.pairs)+',minmax(0,1fr))'}} aria-label="بطاقات ذاكرة الإيموجي">
    {game.tiles.map((value,index)=>{
     const visible=game.matched.includes(index)||game.opened.includes(index);
     return <MiniFlipCard key={index} className={'mini-cell mini-emoji-cell'+(visible?' is-open':'')+(game.matched.includes(index)?' is-matched':'')}
       revealed={visible} disabled={game.finished||game.mismatchUntil!==null||visible}
       label={'بطاقة '+num(index+1)+(visible?' '+value:' مخفية')} back={num(index+1)} front={value} onPress={()=>send({type:'tap',index})}/>;
    })}
   </div>
   {game.finished&&<p className="mini-outcome" role="status">{winner?`🏆 فاز ${playerLabel(winner)} بنتيجة ${num(game.scores[winner-1])}`:`تعادل اللاعبان بنتيجة ${num(game.scores[0])} مقابل ${num(game.scores[1])}`}</p>}
  </>}
  {game.kind==='wheel'&&(()=>{
   const idle=game.startedAt===null,elapsed=idle?0:now-game.startedAt!;
   const spinning=!idle&&!finished;
   return <>
    <div className="mini-wheel-track" aria-hidden="true">
     <div className="mini-wheel-reel" aria-label="تصنيف">{idle?<span className="mini-wheel-idle">الفئة</span>:elapsed<WHEEL_CATEGORY_STOP_MS?<div key={'cat'+game.draws} className="mini-wheel-spinning">{[...CATEGORIES,...CATEGORIES,...CATEGORIES].map((c,i)=><span key={i}>{c}</span>)}</div>:<strong>{game.category}</strong>}</div>
     <span className="mini-wheel-divider" aria-hidden="true"/>
     <div className="mini-wheel-reel" aria-label="حرف">{idle?<span className="mini-wheel-idle">الحرف</span>:elapsed<WHEEL_LETTER_STOP_MS?<div key={'letter'+game.draws} className="mini-wheel-spinning mini-wheel-long">{[...LETTERS,...LETTERS,...LETTERS].map((c,i)=><span key={i}>{c}</span>)}</div>:<strong>{game.letter}</strong>}</div>
    </div>
    {finished&&<p className="mini-wheel-readout" role="status"><span>التصنيف: <strong>{game.category}</strong></span><span>الحرف: <strong>{game.letter}</strong></span></p>}
    <span className="bud-sr-only" role="status">{spinning?'جارٍ الدوران…':''}</span>
    <button type="button" className={'mini-wheel-lever'+(spinning?' is-spinning':'')} disabled={spinning} aria-label={idle?'سحب المقبض':'إعادة السحب'} onClick={()=>send({type:'spin'})}>
     <span className="mini-wheel-lever-art" aria-hidden="true"><span className="mini-wheel-lever-base"/><span className="mini-wheel-lever-handle"/></span>
     <span>{spinning?'جارٍ الدوران…':idle?'اسحب المقبض':'إعادة السحب'}</span>
    </button>
    {spinning&&<p className="mini-hint">يتوقف التصنيف أولًا، ثم الحرف.</p>}
     
   </>;
  })()}
 </section>;
}
