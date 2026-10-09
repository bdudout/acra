'use client'

// ─── Services tiers rattachés à un risque du registre (vue inverse de l'évaluation des tiers) ─────────────────────────
// Évaluations d'usages de services tiers rattachées à ce risque (risque d'externalisation) : zone actuelle → cible et
// statut. Rien n'est affiché quand aucun service n'est rattaché. API : /api/risk-items/[id]/tiers.
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'

type Niveau = { menace: number; zone: string } | null
interface Service { tiers: string; offre: string; usage: string; statut: string; actuelle: Niveau; cible: Niveau }
const ZONE_BADGE: Record<string, string> = { danger: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200', controle: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200', veille: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-200' }

export default function RiskTiersPanel({ riskId }: { riskId: string }) {
  const { t, locale } = useTranslation()
  const [services, setServices] = useState<Service[]>([])
  useEffect(() => {
    fetch(`/api/risk-items/${riskId}/tiers`).then(r => (r.ok ? r.json() : null)).then((j: { services?: Service[] } | null) => setServices(j?.services ?? [])).catch(() => setServices([]))
  }, [riskId])
  if (!services.length) return null
  const a3 = t.workshop.a3
  const zone: Record<string, string> = { danger: a3.radar.zoneDanger, controle: a3.radar.zoneControle, veille: a3.radar.zoneVeille }
  const badge = (n: Niveau) => (n ? <span className={`rounded-full px-2 py-0.5 ${ZONE_BADGE[n.zone]}`}>{`${n.menace.toLocaleString(locale, { maximumFractionDigits: 2 })} — ${zone[n.zone] ?? n.zone}`}</span> : <span className="text-gray-400">{t.tierEval.nonCote}</span>)
  return (
    <section className="mt-4" aria-label={t.tierEval.servicesRattaches}>
      <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t.tierEval.servicesRattaches}</h4>
      <ul className="mt-1 space-y-1">
        {services.map((s, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 text-xs text-gray-700 dark:text-gray-200">
            <span>{s.tiers} — {s.offre} — {s.usage}</span>
            {badge(s.actuelle)}<span aria-hidden>→</span>{badge(s.cible)}
            <span className="text-gray-500">{(t.tierEval.statuts as Record<string, string>)[s.statut] ?? s.statut}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
