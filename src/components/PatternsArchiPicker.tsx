'use client'

// Sélection des patterns d'architecture de SI par cases à cocher (lot A1 de docs/specs/patterns-architecture-besoins.md).
// Vision technique, indépendante du secteur : facultatif, regroupé par famille, plafonné (configurable par l'organisation).

import { useTranslation } from '@/lib/i18n/context'
import { familyLabel, normalizePatterns, patternHelp, patternLabel, patternsByFamily, PATTERNS_MAX_MAX } from '@/lib/patterns-archi'

interface Props { value: string[]; onChange: (v: string[]) => void; max: number; disabled?: boolean }

export default function PatternsArchiPicker({ value, onChange, max, disabled = false }: Props) {
  const { t, locale } = useTranslation()
  const p = t.patternsArchi
  const selected = normalizePatterns(value, { max: PATTERNS_MAX_MAX })
  const full = selected.length >= max

  function toggle(code: string) {
    onChange(selected.includes(code) ? selected.filter(c => c !== code) : [...selected, code])
  }

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="text-sm font-medium text-gray-800">{p.title}</legend>
      <p className="text-xs text-gray-500">{p.intro}</p>
      <p className="text-xs font-medium text-gray-700" aria-live="polite">{p.counter.replace('{n}', String(selected.length)).replace('{max}', String(max))}</p>
      {full && !disabled && <p className="text-xs text-amber-700">{p.limit}</p>}
      {patternsByFamily().map(({ family, patterns }) => (
        <div key={family.id}>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{familyLabel(family.id, locale)}</h4>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {patterns.map(pt => {
              const checked = selected.includes(pt.code)
              return (
                <li key={pt.code}>
                  <label className="flex items-start gap-2 rounded-md border border-gray-200 px-2.5 py-1.5 text-sm has-[:disabled]:opacity-60">
                    <input type="checkbox" className="mt-0.5" checked={checked} disabled={disabled || (!checked && full)} onChange={() => toggle(pt.code)} />
                    <span>
                      <span className="font-medium text-gray-800">{patternLabel(pt.code, locale)}</span>
                      <span className="block text-xs text-gray-500">{patternHelp(pt.code, locale)}</span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </fieldset>
  )
}
