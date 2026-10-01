'use client'

// ─── Atelier 3 : identité du tiers d'une partie prenante ──────────────────────
// Rattache la partie prenante à une identité de tiers du groupe SANS toucher ses scores (exposition, fiabilité, menace, criticité
// « dangerosité » restent propres à l'analyse). Un rapprochement est proposé d'après le nom ou un alias, jamais appliqué sans clic.

import { useTranslation } from '@/lib/i18n/context'
import { findTierCandidates, type TierLite } from '@/lib/tier-identity'

export default function PartyTierLink({ name, tierId, tiers, onChange, disabled = false }: {
  name: string; tierId: string | null | undefined; tiers: TierLite[]; onChange: (tierId: string | null) => void; disabled?: boolean
}) {
  const { t } = useTranslation()
  const c = t.partyTier
  if (tiers.length === 0 && !tierId) return null
  const candidate = !tierId && name.trim() ? findTierCandidates({ nom: name }, tiers)[0] : undefined
  const candidateTier = candidate ? tiers.find(x => x.id === candidate.tierId) : undefined
  const known = !tierId || tiers.some(x => x.id === tierId)
  return (
    <div className="sm:col-span-2 space-y-1">
      <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
        <span className="shrink-0">{c.label}</span>
        <select aria-label={c.label} className="input text-sm flex-1" value={tierId ?? ''} disabled={disabled} onChange={e => onChange(e.target.value || null)}>
          <option value="">{c.none}</option>
          {!known && <option value={tierId ?? ''}>{c.unavailable}</option>}
          {tiers.map(x => <option key={x.id} value={x.id}>{x.nom}</option>)}
        </select>
      </label>
      {candidate && candidateTier && !disabled && (
        <p className="text-xs text-amber-800 dark:text-amber-300">
          <button type="button" className="underline" onClick={() => onChange(candidateTier.id)}>{c.suggest.replace('{name}', candidateTier.nom)}</button>
          <span className="ml-1">({c.reasons[candidate.reason]})</span>
        </p>
      )}
    </div>
  )
}
