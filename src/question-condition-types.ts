/** Persisted, versioned activity state inside the shared event's state JSON.
 * No browser authority: the server produces and commits this value.
 */
import type { DrawRecord, DrawState } from './draw-engine.ts';
export type QuestionConditionActivity = {
  kind: 'question-condition';
  draw: DrawState;
  current: DrawRecord | null;
  exhausted: boolean;
  round: number;
};
