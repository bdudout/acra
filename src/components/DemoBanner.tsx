'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/context'

/**
 * Bandeau affiché sur le site de démonstration (ACRA-Demo, ACRA_DEMO_MODE=true).
 * Rappelle qu'il s'agit d'un environnement temporaire (RGPD) et propose deux
 * actions : exporter ses données de test et consulter la page de déploiement
 * (architecture recommandée + lien GitHub) pour un usage réel dans son SI.
 */
export default function DemoBanner() {
  const { t } = useTranslation()
  const d = t.demo
  // Compte à rebours d'expiration : jours restants avant purge de l'org du testeur.
  const [days, setDays] = useState<number | null>(null)
  useEffect(() => {
    fetch('/api/demo/status')
      .then(r => r.ok ? r.json() : null)
      .then(s => { if (s?.demo && typeof s.daysUntilPurge === 'number') setDays(s.daysUntilPurge) })
      .catch(() => {})
  }, [])
  return (
    <div className="w-full bg-indigo-600 text-white text-[13px] leading-tight">
      <div className="max-w-7xl mx-auto px-4 py-1.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 sm:justify-between">
        {/* Info : badge démo + rappel RGPD + compte à rebours */}
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">
            🧪 {d.badge}
          </span>
          <span className="text-indigo-100">{d.notice}</span>
          {days !== null && (
            <span className="whitespace-nowrap text-indigo-50" title={d.expiresInTitle}>
              · 🗓 {d.expiresIn.replace('{n}', String(days))}
            </span>
          )}
        </div>
        {/* Actions : deux boutons homogènes (secondaire ligné / primaire plein) */}
        <div className="flex items-center gap-2 whitespace-nowrap">
          <a href="/api/export/org"
            className="rounded-md border border-white/40 px-2.5 py-1 font-medium text-white hover:bg-white/10 transition-colors">
            {d.exportCta}
          </a>
          <Link href="/deployer"
            className="rounded-md bg-white px-2.5 py-1 font-medium text-indigo-700 hover:bg-indigo-50 transition-colors">
            {d.deployCta}
          </Link>
        </div>
      </div>
    </div>
  )
}
