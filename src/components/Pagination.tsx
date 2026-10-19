'use client'
// Barre de pagination des grandes listes (lot V1) : total, taille de page, navigation. i18n ×5 (t.pagination).
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { TAILLES_PAGE, type MetaPagination } from '@/lib/pagination'

export default function Pagination({ pagination, onPage, onTaille }: { pagination: MetaPagination | null; onPage: (page: number) => void; onTaille: (taille: number) => void }) {
  const { t } = useTranslation()
  const p = t.pagination
  if (!pagination) return null
  const { page, pages, total, taille } = pagination
  const debut = total === 0 ? 0 : (page - 1) * taille + 1
  const fin = Math.min(total, page * taille)
  const btn = 'inline-flex items-center gap-1 px-2 py-1 rounded-sm border border-gray-300 dark:border-gray-600 text-sm disabled:opacity-40'
  return (
    <nav aria-label={p.navigation} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm text-gray-600 dark:text-gray-300">
      <span aria-live="polite">{p.resultats.replace('{debut}', String(debut)).replace('{fin}', String(fin)).replace('{total}', String(total))}</span>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1">
          {p.parPage}
          <select value={taille} onChange={e => onTaille(Number(e.target.value))} className="border border-gray-300 dark:border-gray-600 rounded-sm px-1 py-0.5 bg-white dark:bg-gray-800">
            {TAILLES_PAGE.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button type="button" className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={p.precedente}><ChevronLeft size={14} aria-hidden="true" />{p.precedente}</button>
        <span>{p.page.replace('{page}', String(page)).replace('{pages}', String(pages))}</span>
        <button type="button" className={btn} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label={p.suivante}>{p.suivante}<ChevronRight size={14} aria-hidden="true" /></button>
      </div>
    </nav>
  )
}
