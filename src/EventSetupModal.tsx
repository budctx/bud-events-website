import {useCallback,useRef,useState} from 'react';
import {EventSetupDialog} from './EventSetupDialog';
import HostPortal from './HostPortal';
import type {HostEvent,Locale} from './host-client';
import type {MiniRun} from './mini-games/session.ts';

export default function EventSetupModal({onClose,onPlay,onAuthLost,locale}:{onClose:()=>void;onPlay:(event:HostEvent|MiniRun)=>void;onAuthLost:()=>void;locale:Locale}){
 const blocked=useRef(false),[closeBlocked,setCloseBlocked]=useState(false);
 const blocking=useCallback((value:boolean)=>{blocked.current=value;setCloseBlocked(value);},[]);
 const close=()=>{if(!blocked.current)onClose();};
 return <EventSetupDialog title="إعداد الفعالية" onClose={close} closeDisabled={closeBlocked}>
  <HostPortal view="setup" locale={locale} onExit={close} onPlay={onPlay} onAuthLost={onAuthLost} onBlockingChange={blocking}/>
 </EventSetupDialog>;
}
