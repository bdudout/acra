'use client'

// ─── Filtre « Entité » des listes (consolidation, lot E5) ─────────────────────
// Choix d'une entité du référentiel (arbre indenté) et inclusion des sous-entités. Masqué si le référentiel est vide.
// Le filtrage lui-même : lib/entites-filtre (`filtrerParEntite`).
import { useTranslation } from '@/lib/i18n/context'
import { optionsEntites } from '@/lib/entites-filtre'
import type { EntiteRef } from '@/lib/entites'

export default function FiltreEntite({ entites, valeur, sousEntites, onChange }: {
  entites: EntiteRef[]; valeur: string; sousEntites: boolean; onChange: (id: string, sousEntites: boolean) => void
}) {
  const { t } = useTranslation()
  if (!entites.length) return null
  const f = t.entites.filtre
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <select aria-label={f.label} value={valeur} onChange={ev => onChange(ev.target.value, sousEntites)}
        className="rounded-sm border border-gray-300 bg-white px-2 py-1 text-sm dark:bg-gray-800 dark:border-gray-600">
        <option value="">{f.toutes}</option>
        {optionsEntites(entites).map(o => <option key={o.id} value={o.id}>{'  '.repeat(o.niveau)}{o.nom}</option>)}
      </select>
      {valeur && (
        <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
          <input type="checkbox" checked={sousEntites} onChange={ev => onChange(valeur, ev.target.checked)} />{f.sousEntites}
        </label>
      )}
    </span>
  )
}
