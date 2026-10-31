import {useCallback,useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {MantineProvider,DirectionProvider} from '@mantine/core';
import {Carousel} from '@mantine/carousel';
import type {EmblaCarouselType} from 'embla-carousel';
import {useReducedMotion} from 'motion/react';
import {ArrowLeft,ArrowRight} from 'lucide-react';
import {ButtonUtility} from './ButtonUtility';
import {upcomingEventCards} from './UpcomingEvents';
import '@mantine/carousel/styles.css';
import './section-controls.css';

const names=['سؤال وشرط','ميني قيمز','كروت الحظ'];
export default function EventCarousel({children}:{children:ReactNode}){
 const [api,setApi]=useState<EmblaCarouselType>(),[selected,setSelected]=useState(0);
 const reduced=useReducedMotion(),scope=useRef<HTMLDivElement>(null);
 const getRoot=useCallback(()=>scope.current??undefined,[]);
 useEffect(()=>{
  if(!api)return;
  const update=()=>setSelected(api.selectedScrollSnap());
  update();api.on('select',update);api.on('reInit',update);
  return()=>{api.off('select',update);api.off('reInit',update);};
 },[api]);
 // Keep upcoming products on the approved first product's responsive dimensions.
 useEffect(()=>{
  const root=scope.current;
  if(!root)return;
  let frame=0;
  const sync=()=>{
   cancelAnimationFrame(frame);
   frame=requestAnimationFrame(()=>{
    const card=root.querySelector('.bud-events-slide:first-child>.platform-product-card');
    const preview=card?.querySelector('.qc-demo');
    const face=preview?.querySelector('.qc-demo-card');
    if(!card||!preview||!face)return;
    for(const [name,value] of [['--bud-event-panel-height',card.getBoundingClientRect().height],['--bud-event-preview-height',preview.getBoundingClientRect().height],['--bud-event-preview-width',preview.getBoundingClientRect().width],['--bud-event-face-width',face.getBoundingClientRect().width]] as const){
     const next=`${value}px`;
     if(root.style.getPropertyValue(name)!==next)root.style.setProperty(name,next);
    }
   });
  };
  const observer=new ResizeObserver(sync);
  // Observe the slide as well: the sample is lazy-loaded after this effect.
  const first=root.querySelector('.bud-events-slide:first-child');
  if(first)observer.observe(first);
  const mutation=new MutationObserver(()=>{
   for(const el of root.querySelectorAll('.bud-events-slide:first-child :is(.platform-product-card,.qc-demo,.qc-demo-card)'))observer.observe(el);
   sync();
  });
  mutation.observe(root,{childList:true,subtree:true});
  sync();
  return()=>{observer.disconnect();mutation.disconnect();cancelAnimationFrame(frame);};
 },[]);
 const slides=[children,...upcomingEventCards()];
 return <div ref={scope} className="platform-event-catalog" data-testid="event-carousel">
  <DirectionProvider initialDirection="rtl" detectDirection={false}>
   <MantineProvider forceColorScheme="light" withCssVariables={false} withGlobalClasses={false} getRootElement={getRoot}>
    <Carousel aria-label="فعاليات بُعد" aria-roledescription="عارض فعاليات" dir="rtl" tabIndex={0} getEmblaApi={setApi}
     onKeyDown={event=>{if(event.target!==event.currentTarget)return;if(event.key==='ArrowLeft'){event.preventDefault();api?.scrollNext(!!reduced);}else if(event.key==='ArrowRight'){event.preventDefault();api?.scrollPrev(!!reduced);}else if(event.key==='Home'||event.key==='End'){event.preventDefault();api?.scrollTo(event.key==='Home'?0:2,!!reduced);}}}
     withControls={false} withIndicators={false} withKeyboardEvents={false} slideSize="100%" slideGap={24}
     emblaOptions={{direction:'rtl',align:'start',loop:false,duration:reduced?0:25}}
     className="bud-events-carousel" classNames={{viewport:'bud-events-viewport',container:'bud-events-track',slide:'bud-events-slide'}}>
     {slides.map((slide,index)=><Carousel.Slide key={names[index]} inert={index!==selected} aria-hidden={index!==selected} role="group" aria-roledescription="شريحة" aria-label={names[index]}>{slide}</Carousel.Slide>)}
    </Carousel>
   </MantineProvider>
  </DirectionProvider>
  <div className="bud-carousel-navigation" aria-label="التنقل بين الفعاليات">
   <ButtonUtility label="الفعالية السابقة" icon={ArrowRight} isDisabled={!api||selected===0} onPress={()=>api?.scrollPrev(!!reduced)}/>
   <div className="bud-carousel-dots" aria-label="اختيار الفعالية">{names.map((name,index)=><button key={name} type="button" aria-label={'عرض فعالية '+name} aria-current={index===selected?'true':undefined} onClick={()=>api?.scrollTo(index,!!reduced)}><span/></button>)}</div>
   <ButtonUtility label="الفعالية التالية" icon={ArrowLeft} isDisabled={!api||selected===2} onPress={()=>api?.scrollNext(!!reduced)}/>
  </div>
  <p className="bud-carousel-status" role="status" aria-live="polite" aria-atomic="true">{names[selected]} · {new Intl.NumberFormat('ar-u-nu-latn').format(selected+1)} من 3</p>
 </div>;
}
