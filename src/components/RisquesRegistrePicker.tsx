'use client'
// ─── Sélection de plusieurs risques du registre (recherche + cases à cocher) ──
// Utilisé pour associer un incident à un ou plusieurs risques existants (cas le plus courant).

import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'

const plain = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase()

export default function RisquesRegistrePicker({ risks, value, onChange }: { risks: { id: string; intitule: string }[]; value: string[]; onChange: (ids: string[]) => void }) {
  const { t } = useTranslation()
  const n = t.incidents
  const [q, setQ] = useState('')
  const choisis = value.map(id => risks.find(r => r.id === id)).filter((r): r is { id: string; intitule: string } => !!r)
  const visibles = useMemo(() => { const k = plain(q.trim()); return k ? risks.filter(r => plain(r.intitule).includes(k)) : risks }, [risks, q])
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id])
  return (
    <div className="space-y-2">
      {choisis.length > 0 && (
        <div>
          <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">{n.risquesChoisis.replace('{n}', String(choisis.length))}</p>
          <ul className="flex flex-wrap gap-1.5">
            {choisis.map(r => (
              <li key={r.id} className="inline-flex items-center gap-1 rounded-full bg-ebios-50 px-2 py-0.5 text-xs text-ebios-800 dark:bg-ebios-500/15 dark:text-ebios-200">
                {r.intitule}
                <button type="button" aria-label={n.retirerRisque.replace('{nom}', r.intitule)} onClick={() => toggle(r.id)} className="text-ebios-500 hover:text-red-600"><X size={12} aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <input type="search" aria-label={n.rechercherRisque} placeholder={n.rechercherRisque} value={q} onChange={e => setQ(e.target.value)}
        className="w-full rounded-sm border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-600" />
      {visibles.length === 0 ? <p className="text-xs italic text-gray-400">{n.aucunRisqueTrouve}</p> : (
        <ul className="max-h-48 overflow-y-auto rounded-sm border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
          {visibles.map(r => (
            <li key={r.id}>
              <label className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-700 dark:text-gray-200">
                <input type="checkbox" checked={value.includes(r.id)} onChange={() => toggle(r.id)} />{r.intitule}
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
