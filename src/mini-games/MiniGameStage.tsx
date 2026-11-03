import {useEffect,useState} from 'react';
import {RefreshCw,RotateCcw,Timer,Volume2,VolumeX} from 'lucide-react';
import {gameFinished,remainingSeconds,gameWinner} from './engine.ts';
import type {ActiveMiniGame,MiniAction} from './engine.ts';
import {CATEGORIES,LETTERS,PATTERN_COLORS} from './catalog.ts';

type Props={game:ActiveMiniGame;now:number;send:(action:MiniAction)=>void};
const num=(v:number)=>new Intl.NumberFormat('ar-u-nu-latn').format(v);
function playerLabel(player:1|2){return 'اللاعب '+num(player);}
const colorClass=(value:string)=>'mini-color-'+({أحمر:'red',أزرق:'blue',أخضر:'green',أصفر:'yellow'} as Record<string,string>)[value];

export function MiniGameStage({game,now,send}:Props){
 const [muted,setMuted]=useState(true);
 const finished=gameFinished(game,now);
 const winner=gameWinner(game);
 useEffect(()=>{
  if(muted||!finished||!('AudioContext' in window))return;
  // Optional original short tone; no third-party media, no autoplay before user gesture.
  let context:AudioContext|null=null;
  try{context=new AudioContext();const oscillator=context.createOscillator(),gain=context.createGain();oscillator.type='sine';oscillator.frequency.value=540;gain.gain.value=0.022;
   oscillator.connect(gain);gain.connect(context.destination);oscillator.start();oscillator.stop(context.currentTime+0.08);
   void context.close().catch(()=>{});
  }catch{void context?.close().catch(()=>{});}
 },[game.kind,finished,muted]);
 return <section className="mini-stage" aria-label="شاشة اللعبة">
  <header className="mini-stage-header">
   <span className="mini-kicker">التحدي المباشر</span>
   <button type="button" className="mini-icon-button" aria-label={muted?'تفعيل الصوت':'كتم الصوت'} aria-pressed={!muted} onClick={()=>setMuted(x=>!x)}>{muted?<VolumeX size={18}/>:<Volume2 size={18}/>}</button>
  </header>
  {game.kind==='bomb'&&<>
   <div className="mini-status">الدور الآن: <strong>{playerLabel(game.turn)}</strong></div>
   <div className="mini-bomb-grid" style={{gridTemplateColumns:'repeat('+game.size+',minmax(0,1fr))'}}>
    {Array.from({length:game.size*game.size},(_,index)=>{
     const open=game.opened.includes(index),bomb=open&&index===game.bomb;
     return <button key={index} type="button" className={'mini-cell mini-bomb-cell'+(open?' is-open':'')+(bomb?' is-bomb':'')} aria-label={'المربع '+num(index+1)+(open?' مكشوف':'')} disabled={open||game.finished} onClick={()=>send({type:'tap',index})}>{open?(bomb?'💣':'✓'):'?'}</button>;
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
   <div className="mini-status">المستوى <strong>{num(game.level)}</strong> · <strong>{playerLabel(game.turn)}</strong></div>
   {(()=>{
    const elapsed=now-game.startedAt,displaying=elapsed<game.level*700+800;
    const sequence=game.sequences[game.turn-1];
    const active=displaying&&elapsed>=500&&Math.floor((elapsed-500)/700)<game.level?sequence[Math.max(0,Math.floor((elapsed-500)/700))]:null;
    return <>
     <div className="mini-pattern-display" role="status" aria-label={displaying?'جارٍ عرض النمط':'حان وقت الإجابة'}>
      {displaying?<><span className={'mini-pattern-preview '+(active?colorClass(active):'')}/><strong>احفظ تسلسل الألوان</strong></>:<><strong>ردد التسلسل واضغط الألوان بالترتيب</strong><small>{num(game.progress)} من {num(game.level)}</small></>}
     </div>
     {!game.finished&&<div className="mini-pattern-pads">{PATTERN_COLORS.map(value=><button type="button" key={value} className={'mini-pattern-pad '+colorClass(value)} disabled={displaying} onClick={()=>send({type:'color',color:value})}>{value}</button>)}</div>}
     {!game.finished&&<button type="button" className="mini-icon-text" onClick={()=>send({type:'replay'})}><RotateCcw size={18}/> إعادة عرض النمط</button>}
    </>;
   })()}
   {game.finished&&<p className="mini-outcome" role="status">{game.draw?'لم يفز أحد':('فاز '+playerLabel(winner!))}</p>}
  </>}
  {game.kind==='emoji'&&<>
   <div className="mini-scorebar"><span>اللاعب 1 <strong>{num(game.scores[0])}</strong></span><span>الدور: <strong>{playerLabel(game.turn)}</strong></span><span>اللاعب 2 <strong>{num(game.scores[1])}</strong></span></div>
   <div className="mini-emoji-grid">
    {game.tiles.map((value,index)=>{
     const visible=game.matched.includes(index)||game.opened.includes(index);
     return <button type="button" key={index} className={'mini-cell mini-emoji-cell'+(visible?' is-open':'')+(game.matched.includes(index)?' is-matched':'')} disabled={game.finished||game.mismatchUntil!==null||visible} aria-label={'بطاقة '+num(index+1)+(visible?' '+value:' مخفية')} onClick={()=>send({type:'tap',index})}>{visible?value:'؟'}</button>;
    })}
   </div>
   {game.finished&&<p className="mini-outcome" role="status">🏆 فاز {playerLabel(winner!)} بنتيجة {num(game.scores[winner!-1])}</p>}
  </>}
  {game.kind==='wheel'&&<>
   <div className="mini-wheel-track" aria-live={finished?'polite':'off'}>
    <div className="mini-wheel-reel" aria-label="تصنيف">{now-game.startedAt<2600?<div key={'cat'+game.draws} className="mini-wheel-spinning">{[...CATEGORIES,...CATEGORIES,...CATEGORIES].map((c,i)=><span key={i}>{c}</span>)}</div>:<strong>{game.category}</strong>}</div>
    <span className="mini-wheel-divider">|</span>
    <div className="mini-wheel-reel" aria-label="حرف">{now-game.startedAt<3800?<div key={'letter'+game.draws} className="mini-wheel-spinning mini-wheel-long">{[...LETTERS,...LETTERS,...LETTERS].map((c,i)=><span key={i}>{c}</span>)}</div>:<strong>{game.letter}</strong>}</div>
   </div>
   <p className="mini-hint">{finished?'أول إجابة صحيحة بصوت المشارك تحسم التحدي.':'تتوقف الفئة أولًا، ثم يظهر الحرف…'}</p>
   {finished&&<button type="button" className="mini-icon-text" onClick={()=>send({type:'spin'})}><RefreshCw size={18}/> إعادة السحب</button>}
  </>}
 </section>;
}
