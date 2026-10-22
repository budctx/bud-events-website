import { useId, useRef, useState } from 'react';
import * as Switch from '@radix-ui/react-switch';
import * as Tooltip from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';
import './interface-controls.css';

export function InterfaceIcon({ kind }: { kind: 'home' | 'events' | 'bots' | 'designs' | 'exit' }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind === 'home' ? <><path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8" /></> : kind === 'events' ? <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4M17 3v4M3 10h18m-14 5h3m4 0h3" /></> : kind === 'bots' ? <><rect x="4" y="7" width="16" height="14" rx="4" /><path d="M12 7V3M10 3h4M1 12v5m22-5v5M9 16h6" /><circle cx="8" cy="12" r="1" /><circle cx="16" cy="12" r="1" /></> : kind === 'designs' ? <><path d="m4 16-1 5 5-1L21 7l-5-5Zm9-11 5 5" /><path d="m4 16 4 4" /></> : <><path d="M10 4H4v16h6m4-12 4 4-4 4m-6-4h13" /></>}</svg>;
}

export function AnimatedSwitch({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (value: boolean) => void }) {
  const id = useId();
  return <div className="bud-switch-field"><label htmlFor={id}>{label}</label><Switch.Root id={id} className="bud-switch" checked={checked} onCheckedChange={onCheckedChange}><Switch.Thumb className="bud-switch-thumb" /></Switch.Root></div>;
}

export function HelpTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return <Tooltip.Provider delayDuration={180}><Tooltip.Root open={open} onOpenChange={setOpen}>
    <Tooltip.Trigger asChild onPointerDown={event => event.preventDefault()} onClick={event => { event.preventDefault(); setOpen(previous => !previous); }}><button ref={trigger} type="button" className="bud-help-trigger" aria-label={label}>?</button></Tooltip.Trigger>
    <Tooltip.Portal><Tooltip.Content className="bud-tooltip" sideOffset={6} collisionPadding={12} onPointerDownOutside={event => { if (trigger.current?.contains(event.detail.originalEvent.target as Node)) event.preventDefault(); }}>{children}<Tooltip.Arrow className="bud-tooltip-arrow" /></Tooltip.Content></Tooltip.Portal>
  </Tooltip.Root></Tooltip.Provider>;
}
