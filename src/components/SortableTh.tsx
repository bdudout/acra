'use client'

// En-tête de colonne triable réutilisable (actions, risques, tiers). Clic =
// cycle asc → desc → aucun ; la flèche indique la colonne/sens actifs. Accessible
// (bouton, aria-sort). La logique de tri est dans lib/table-sort.ts (pure/testée).

import { sortIndicator, type SortState } from '@/lib/table-sort'

export default function SortableTh({ label, sortKey, sort, onSort, className = '', align = 'left' }: {
  label: string
  sortKey: string
  sort: SortState | null
  onSort: (key: string) => void
  className?: string
  align?: 'left' | 'right' | 'center'
}) {
  const active = sort?.key === sortKey
  const ind = sortIndicator(sort, sortKey)
  const ariaSort = !active ? 'none' : sort!.dir === 'asc' ? 'ascending' : 'descending'
  const justify = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'
  return (
    <th className={`px-3 py-2 font-medium ${className}`} aria-sort={ariaSort as React.AriaAttributes['aria-sort']}>
      <button type="button" onClick={() => onSort(sortKey)}
        className={`group inline-flex items-center gap-1 ${justify} hover:text-gray-800 dark:hover:text-gray-100 ${active ? 'text-gray-800 dark:text-gray-100' : ''}`}>
        <span>{label}</span>
        <span className={`text-[9px] leading-none ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}>{ind || '▲'}</span>
      </button>
    </th>
  )
}
