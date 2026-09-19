'use client'

import { Calendar, FlaskConical } from 'lucide-react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/context'
import { resolvePublicContent, type PublicContentConfig } from '@/lib/public-content'

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
  // Surcharges de contenu public (bandeau/CTA) réglées par le SUPER_ADMIN.
  const [content, setContent] = useState<PublicContentConfig | null>(null)
  useEffect(() => {
    fetch('/api/demo/status')
      .then(r => r.ok ? r.json() : null)
      .then(s => {
        if (s?.demo && typeof s.daysUntilPurge === 'number') setDays(s.daysUntilPurge)
        if (s?.content) setContent(s.content)
      })
      .catch(() => {})
  }, [])

  // Repli i18n : valeurs par défaut appliquées quand aucune surcharge n'est définie.
  const pc = resolvePublicContent(content, {
    notice: d.notice, contactUrl: '/deployer', contactLabel: d.deployCta,
  })
  const contactExternal = !pc.contactUrl.startsWith('/')
  return (
    <div data-testid="demo-banner" className="w-full bg-gradient-to-r from-[#3730a3] via-[#4338ca] to-[#0369a1] text-white text-sm leading-snug shadow-sm">
      <div data-testid="demo-banner-content" className="max-w-7xl mx-auto flex flex-col items-center justify-center gap-2 px-4 py-2.5 text-center lg:flex-row lg:justify-between lg:text-left">
        {/* Info : badge démo + rappel RGPD + compte à rebours */}
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">
            <FlaskConical size={15} className="inline align-[-0.15em] mr-1.5" aria-hidden="true" /> {d.badge}
          </span>
          <span className="max-w-3xl text-indigo-50">{pc.notice}</span>
          {days !== null && (
            <span className="whitespace-nowrap text-indigo-50" title={d.expiresInTitle}>
              · <Calendar size={13} className="inline align-[-0.15em] mr-1" aria-hidden="true" />{d.expiresIn.replace('{n}', String(days))}
            </span>
          )}
        </div>
        {/* Actions : deux boutons homogènes (secondaire ligné / primaire plein) */}
        <div data-testid="demo-banner-actions" className="flex flex-wrap items-center justify-center gap-2">
          <a href="/api/export/org"
            className="rounded-lg border border-white/50 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors">
            {d.exportCta}
          </a>
          {contactExternal ? (
            <a href={pc.contactUrl} target="_blank" rel="noopener noreferrer"
              className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-indigo-800 hover:bg-indigo-50 transition-colors">
              {pc.contactLabel}
            </a>
          ) : (
            <Link href={pc.contactUrl}
              className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-indigo-800 hover:bg-indigo-50 transition-colors">
              {pc.contactLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
