import {ButtonUtility} from './ButtonUtility';
import {Pencil,Trash2} from 'lucide-react';
import type { ManualPrize, ManualWinner } from './manual-game';
import type { Locale } from './i18n';

export function WinnerNumber({ id }: { id: string }) {
  return <bdi className="mg-winner-number">{id.replace('winner-', '')}</bdi>;
}

/** Shared record identity and ordering for the host panel and management dialog. */
export function WinnerList({ winners, prizes, locale, selectedId, onSelect, onEdit, onDelete, readOnly = false }: {
  winners: ManualWinner[]; prizes: ManualPrize[]; locale: Locale; selectedId?: string;
  onSelect?: (id: string) => void; onEdit?: (winner: ManualWinner) => void;
  onDelete?: (winner: ManualWinner) => void; readOnly?: boolean;
}) {
  const ar = locale === 'ar';
  if (!winners.length) return <p className="mg-winners-empty">{ar ? 'لا يوجد فائزون بعد' : 'No winners yet'}</p>;
  return <ol className="mg-winner-list" aria-label={ar ? 'قائمة الفائزين' : 'Winner list'}>{winners.map(winner => {
    const prize = prizes.find(p => p.winnerId === winner.id);
    const content = <><WinnerNumber id={winner.id} /><span className="mg-winner-copy"><strong dir="auto">{winner.name}</strong>{onSelect && <small>{prize ? <>{ar ? 'حصل على: ' : 'Awarded: '}<bdi>{prize.name}</bdi></> : selectedId === winner.id ? (ar ? 'محدد للسحب' : 'Selected for draw') : (ar ? 'بانتظار الجائزة' : 'Awaiting prize')}</small>}</span>{onSelect && <span aria-hidden="true">{prize ? '✓' : selectedId === winner.id ? '●' : '○'}</span>}</>;
    return <li key={winner.id} data-winner-id={winner.id} data-awarded={!!prize}>
      {onSelect ? <div className="mg-winner-select-row"><button className="mg-winner-option" type="button" aria-pressed={selectedId === winner.id} disabled={!!prize} onClick={() => onSelect(winner.id)}>{content}</button>{onDelete && <ButtonUtility label={`${ar ? 'حذف' : 'Delete'} ${winner.name} #${winner.id.replace('winner-', '')}`} icon={Trash2} tone="danger" className="mg-winner-quick-delete" isDisabled={readOnly} onPress={() => onDelete(winner)}/>}</div> : <div className="mg-winner-row">{content}{!readOnly && <span className="mg-winner-tools">{onEdit&&<ButtonUtility label={`${ar ? 'تعديل' : 'Edit'} ${winner.name} #${winner.id.replace('winner-', '')}`} icon={Pencil} onPress={() => onEdit(winner)}/>}{onDelete&&<ButtonUtility label={`${ar ? 'حذف' : 'Delete'} ${winner.name} #${winner.id.replace('winner-', '')}`} icon={Trash2} tone="danger" onPress={() => onDelete(winner)}/>}</span>}</div>}
    </li>;
  })}</ol>;
}

export function WinnerIcon({ kind }: { kind: 'edit' | 'delete' | 'trophy' | 'people' | 'gift' }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind === 'edit' ? <><path d="m16 3 5 5-12 12-6 1 1-6Z" /><path d="m13 6 5 5" /></> : kind === 'delete' ? <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></> : kind === 'trophy' ? <><path d="M8 3h8v6a4 4 0 0 1-8 0ZM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4M12 13v6m-4 2h8m-8 0v-2h8v2" /></> : kind === 'people' ? <><circle cx="12" cy="7" r="4" /><path d="M5 21v-3a7 7 0 0 1 14 0v3" /></> : <><path d="M3 8h18v4H3zM5 12v9h14v-9M12 8v13" /><path d="M12 8S4 9 5 4c1-4 7 0 7 4Zm0 0s8 1 7-4c-1-4-7 0-7 4Z" /></>}</svg>;
}
