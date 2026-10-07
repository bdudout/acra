'use client'

// ─── Champs personnalisés d'un formulaire (lot L5) ───────────────────────────
// Un contrôle par type (texte, nombre, liste, date, oui/non), généré depuis les définitions de
// l'organisation. Émet l'objet de valeurs complet ; une valeur vidée est retirée.

import { useTranslation } from '@/lib/i18n/context'
import type { ChampDef, ChampsValeurs } from '@/lib/champs-perso'

const inp = 'px-2 py-1.5 rounded-sm border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm'

export default function ChampsPersonnalisesFields({ defs, values, onChange, readOnly = false }: {
  defs: ChampDef[]; values: ChampsValeurs; onChange: (v: ChampsValeurs) => void; readOnly?: boolean
}) {
  const { t } = useTranslation()
  if (defs.length === 0) return null
  const set = (code: string, v: string | number | boolean | undefined) => {
    const next = { ...values }
    if (v === undefined || v === '') delete next[code]; else next[code] = v
    onChange(next)
  }
  if (readOnly) {
    const lignes = defs.filter(d => values[d.code] !== undefined)
    if (lignes.length === 0) return null
    return (
      <dl className="grid gap-2 sm:grid-cols-2 text-xs">
        {lignes.map(d => <div key={d.code}><dt className="font-semibold text-gray-500">{d.label}</dt><dd className="text-gray-800 dark:text-gray-100">{typeof values[d.code] === 'boolean' ? (values[d.code] ? t.personnalisation.oui : t.personnalisation.non) : String(values[d.code])}</dd></div>)}
      </dl>
    )
  }
  return (
    <fieldset className="space-y-2 rounded-lg border border-dashed border-gray-300 p-3 dark:border-gray-600">
      <legend className="px-1 text-xs font-semibold text-gray-500">{t.personnalisation.champsTitle}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {defs.map(d => {
          const label = d.requis ? `${d.label} *` : d.label
          const v = values[d.code]
          return d.type === 'OUINON' ? (
            <label key={d.code} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
              <input type="checkbox" aria-label={label} checked={v === true} onChange={e => set(d.code, e.target.checked ? true : undefined)} />{label}
            </label>
          ) : (
            <label key={d.code} className="text-xs text-gray-500 dark:text-gray-400">{label}
              {d.type === 'LISTE' ? (
                <select aria-label={label} value={typeof v === 'string' ? v : ''} onChange={e => set(d.code, e.target.value)} className={`${inp} block w-full mt-1`}>
                  <option value="">—</option>{d.options?.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : d.type === 'DATE' ? (
                <input type="date" aria-label={label} value={typeof v === 'string' ? v : ''} onChange={e => set(d.code, e.target.value)} className={`${inp} block w-full mt-1`} />
              ) : d.type === 'NOMBRE' ? (
                <input type="number" aria-label={label} value={typeof v === 'number' ? v : ''} onChange={e => set(d.code, e.target.value === '' ? undefined : Number(e.target.value))} className={`${inp} block w-full mt-1`} />
              ) : (
                <input aria-label={label} value={typeof v === 'string' ? v : ''} maxLength={500} onChange={e => set(d.code, e.target.value)} className={`${inp} block w-full mt-1`} />
              )}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
