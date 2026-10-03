'use client'
// ─── Choix de plusieurs sous-secteurs pour une analyse ──────────────────────────
// Ne propose que ce qui est cohérent avec le secteur : les sous-secteurs de sa famille, puis, à part, les
// interconnexions entre SI (transverses). Ordre de coche conservé : le premier est le sous-secteur principal.
// Plafond MAX_SOUS_SECTEURS. Une valeur reçue incohérente (après un changement de secteur) est ignorée.

import { useTranslation } from '@/lib/i18n/context'
import { useEbiosData } from '@/lib/i18n/use-ebios-data'
import { MAX_SOUS_SECTEURS, normalizeSousSecteurs, selectableSousSecteurIds } from '@/lib/sous-secteurs'

export default function SousSecteursPicker({ secteur, value, onChange, disabled = false }: {
  secteur: string
  value: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const { SOUS_SECTEURS } = useEbiosData()
  const ids = selectableSousSecteurIds(secteur)
  if (!ids.length) return null
  const selected = normalizeSousSecteurs(secteur, value)
  const label = new Map((SOUS_SECTEURS as { id: string; label: string }[]).map(s => [s.id, s.label]))
  const own = ids
  const full = selected.length >= MAX_SOUS_SECTEURS

  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  const item = (id: string) => {
    const checked = selected.includes(id)
    return (
      <label key={id} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input type="checkbox" className="mt-0.5" checked={checked} disabled={disabled || (!checked && full)} onChange={() => toggle(id)} />
        <span>
          {label.get(id) ?? id}
          {selected[0] === id && <span className="ml-1.5 text-xs font-semibold text-indigo-700">({t.newAnalysis.subSectorPrimary})</span>}
        </span>
      </label>
    )
  }

  return (
    <fieldset className="space-y-1.5">
      <legend className="label">{t.newAnalysis.subSector} <span className="text-gray-400 font-normal">({t.optional})</span></legend>
      <p className="text-xs text-gray-500">{t.newAnalysis.subSectorsMulti.replace('{max}', String(MAX_SOUS_SECTEURS))}</p>
      <div className="grid gap-1 sm:grid-cols-2">{own.map(item)}</div>
      <p className="text-xs text-gray-500">{t.newAnalysis.subSectorHint}</p>
    </fieldset>
  )
}
