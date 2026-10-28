import {touchInputActive} from './input-modality';
// Adapted from Untitled UI's MIT ButtonUtility pattern (see THIRD_PARTY_NOTICES.md).
import {useRef,useState} from 'react';
import type {ComponentType} from 'react';
import {Button} from 'react-aria-components';
import type {ButtonProps} from 'react-aria-components';
import * as Tooltip from '@radix-ui/react-tooltip';
import './section-controls.css';
type Props=Omit<ButtonProps,'children'|'className'|'aria-label'> & {label:string;icon:ComponentType<{size?:number;'aria-hidden'?:boolean}>;className?:string;tone?:'neutral'|'danger';color?:'secondary'|'tertiary'};
export function ButtonUtility({label,icon:Icon,className='',tone='neutral',color='secondary',...props}:Props){
 const trigger=useRef<HTMLButtonElement>(null),[open,setOpen]=useState(false);
 return <Tooltip.Provider delayDuration={180}><Tooltip.Root open={open} onOpenChange={next=>setOpen(next&&!touchInputActive())}><Tooltip.Trigger asChild>
  <Button {...props} ref={trigger} aria-label={label} className={'bud-utility '+className} data-tone={tone} data-color={color}><Icon size={20} aria-hidden={true}/></Button>
 </Tooltip.Trigger><Tooltip.Portal container={trigger.current?.closest('dialog')??undefined}><Tooltip.Content className="bud-ui-tooltip" onEscapeKeyDown={()=>{setOpen(false);trigger.current?.closest('dialog')?.dispatchEvent(new Event('cancel',{cancelable:true}));}} sideOffset={7} collisionPadding={12}>{label}<Tooltip.Arrow className="bud-ui-tooltip-arrow"/></Tooltip.Content></Tooltip.Portal></Tooltip.Root></Tooltip.Provider>;
}
