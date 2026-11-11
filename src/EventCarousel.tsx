import type {ReactNode} from 'react';
import {MantineProvider} from '@mantine/core';
import {upcomingEventCards} from './UpcomingEvents';
import './section-controls.css';

/** Show every product as a card without modifying its purchase, resume or setup actions. */
export default function EventCarousel({children,mini}:{children:ReactNode;mini?:ReactNode}){
 const upcoming=upcomingEventCards();
 return <section className="platform-event-catalog" data-testid="event-catalog" aria-label="فعاليات بُعد" dir="rtl">
  <MantineProvider forceColorScheme="light" withCssVariables={false} withGlobalClasses={false}>
   <div className="bud-product-grid">
    {children}
    {mini??upcoming[0]}
    {upcoming[1]}
   </div>
  </MantineProvider>
 </section>;
}
