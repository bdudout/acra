'use client'

// ─── Champs L3 d'un contrôle : typologie, mode, clé, échantillonnage ─────────
// Le calcul de taille d'échantillon est une PROPOSITION (lib/controle-l3) : le
// responsable garde la main sur la valeur retenue.

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { TYPES_CONTROLE, MODES_CONTROLE, METHODES_ECHANTILLON, tailleEchantillonSuggeree, type MethodeEchantillon } from '@/lib/controle-l3'

export interface L3FormValue { typeControle: string; modeControle: string; cle: boolean; methodeEchantillon: string }
const inp = 'px-2 py-1.5 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm'

export default function ControleL3Fields({ value, onChange, onApplySuggestion }: { value: L3FormValue; onChange: (v: L3FormValue) => void; onApplySuggestion?: (n: number) => void }) {
  const { t } = useTranslation()
  const c = t.controles
  const [population, setPopulation] = useState('')
  const suggestion = tailleEchantillonSuggeree((value.methodeEchantillon || null) as MethodeEchantillon | null, Number(population), value.cle)
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="text-xs text-gray-500 dark:text-gray-400">{c.ctl_typeControle}
          <select aria-label={c.ctl_typeControle} value={value.typeControle} onChange={e => onChange({ ...value, typeControle: e.target.value })} className={`${inp} w-full mt-1`}>
            <option value="">{c.ctl_aucun}</option>
            {TYPES_CONTROLE.map(x => <option key={x} value={x}>{(c.ctl_types as Record<string, string>)[x]}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-500 dark:text-gray-400">{c.ctl_modeControle}
          <select aria-label={c.ctl_modeControle} value={value.modeControle} onChange={e => onChange({ ...value, modeControle: e.target.value })} className={`${inp} w-full mt-1`}>
            {MODES_CONTROLE.map(x => <option key={x} value={x}>{(c.ctl_modes as Record<string, string>)[x]}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-500 dark:text-gray-400">{c.ctl_methodeEchantillon}
          <select aria-label={c.ctl_methodeEchantillon} value={value.methodeEchantillon} onChange={e => onChange({ ...value, methodeEchantillon: e.target.value })} className={`${inp} w-full mt-1`}>
            <option value="">{c.ctl_aucun}</option>
            {METHODES_ECHANTILLON.map(x => <option key={x} value={x}>{(c.ctl_methodes as Record<string, string>)[x]}</option>)}
          </select>
        </label>
      </div>
      <label className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300">
        <input type="checkbox" aria-label={c.ctl_cle} checked={value.cle} onChange={e => onChange({ ...value, cle: e.target.checked })} className="mt-0.5" />
        <span><span className="font-medium">{c.ctl_cle}</span> — {c.ctl_cleHint}</span>
      </label>
      {value.methodeEchantillon && value.methodeEchantillon !== 'FIXE' && (
        <div className="flex flex-wrap items-end gap-2 text-xs text-gray-500 dark:text-gray-400">
          <label>{c.ctl_population}
            <input type="number" min="1" aria-label={c.ctl_population} value={population} onChange={e => setPopulation(e.target.value)} className={`${inp} block w-32 mt-1`} />
          </label>
          {suggestion != null && (
            <button type="button" onClick={() => onApplySuggestion?.(suggestion)} className="rounded border border-ebios-300 px-2 py-1 text-ebios-700 hover:bg-ebios-50 dark:border-ebios-700 dark:hover:bg-gray-800">
              {c.ctl_echantillonSuggere.replace('{n}', String(suggestion))}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
