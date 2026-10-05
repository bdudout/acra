'use client'
// ─── Badge de pertinence d'un exemple d'atelier ───────────────────────────────
// Dit POURQUOI l'exemple est proposé : cas d'usage (sous-secteur choisi), architecture (pattern coché, nommé) ou
// secteur (mots-clés). Cf. lib/exemples-sectoriels (annoterPertinence) et lib/exemples-context (rankExemples).

import { Star } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { patternLabel } from '@/lib/patterns-archi'

export function pertinenceText(ex: { pertinence?: unknown; patternsPertinents?: unknown; pertinent?: unknown }, w: { relevantLabel: string; relevantCasUsage: string; relevantArchi: string }, locale: Parameters<typeof patternLabel>[1]): string | null {
  if (ex.pertinence === 'CAS_USAGE') return w.relevantCasUsage
  if (ex.pertinence === 'ARCHITECTURE') {
    const codes = Array.isArray(ex.patternsPertinents) ? (ex.patternsPertinents as string[]) : []
    return w.relevantArchi.replace('{patterns}', codes.map(c => patternLabel(c, locale)).join(', '))
  }
  if (ex.pertinence === 'SECTEUR' || ex.pertinent === true) return w.relevantLabel
  return null
}

export default function PertinenceBadge({ ex, className = 'text-xs mb-1' }: { ex: { pertinence?: unknown; patternsPertinents?: unknown; pertinent?: unknown }; className?: string }) {
  const { t, locale } = useTranslation()
  const text = pertinenceText(ex, t.workshop, locale)
  if (!text) return null
  return <div className={`${className} text-ebios-700 dark:text-ebios-300 font-semibold`}><Star size={15} className="inline align-[-0.15em] mr-1.5" aria-hidden="true" /> {text}</div>
}
