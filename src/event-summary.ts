import type { ManualState } from './manual-game';
/** Closing and history must copy the same results, including unawarded winners. */
export function formatEventResults(state: Pick<ManualState,'winners'|'prizes'>, locale: 'ar'|'en', includeRecordNumbers=false): string {
  const unawarded = locale === 'ar' ? 'لم تُمنح جائزة' : 'No prize awarded';
  const unnamed = locale === 'ar' ? 'دون اسم' : 'No recipient';
  return [
    ...state.winners.map(winner=>`${includeRecordNumbers?`#${winner.id.replace(/^winner-/,'')} `:''}${winner.name} — ${state.prizes.find(prize=>prize.winnerId===winner.id)?.name ?? unawarded}`),
    ...state.prizes.filter(prize=>prize.revealed&&!prize.winnerId).map(prize=>`${unnamed} — ${prize.name}`),
  ].join('\n');
}
