/** Persisted, versioned activity state inside the shared event's state JSON.
 * Produced by the browser for local runs; legacy server sessions use the same shape.
 */
import type { DrawRecord, DrawState } from './draw-engine.ts';
export type QuestionConditionActivity = {
  kind: 'question-condition';
  draw: DrawState;
  current: DrawRecord | null;
  exhausted: boolean;
  round: number;
};
