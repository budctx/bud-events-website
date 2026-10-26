import { useCountdown } from 'react-countdown-circle-timer';
import './event-countdown.css';

type Props = {
  duration: number;
  remaining: number;
  label: string;
  className?: string;
  active?: boolean;
  unit?: string;
};

/** Official circle-timer renderer, controlled by the existing event deadline.
 * Its internal clock stays paused: there must be no second countdown that can
 * restart or drift away from locally saved progress on reload or tab resume.
 */
export function EventCountdown({ duration, remaining, label, className = '', active = true, unit }: Props) {
  const seconds = Math.min(duration, Math.max(0, remaining));
  const ratio = seconds / duration;
  const urgent = ratio <= 0.2;
  const expired = seconds === 0;
  const { path, pathLength, strokeWidth, size } = useCountdown({
    duration, isPlaying: false, size: 100, strokeWidth: 7, colors: '#FBB03B',
  });
  return <div className={`event-countdown ${className}`} data-active={active} data-urgent={urgent} data-expired={expired}
    role={active ? 'timer' : undefined} aria-label={active ? label : undefined} aria-live="off">
    <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
      <path d={path} fill="none" stroke="#E6E2D9" strokeWidth={strokeWidth} />
      <path className="event-countdown-progress" d={path} fill="none" strokeWidth={strokeWidth} strokeLinecap="round"
        strokeDasharray={pathLength} strokeDashoffset={pathLength * (1 - ratio)} />
    </svg>
    <span className="event-countdown-value"><bdi>{Math.ceil(seconds)}</bdi>{unit && <small>{unit}</small>}</span>
  </div>;
}
