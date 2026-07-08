'use client'

import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/context'

/**
 * Bandeau affiché sur le site de démonstration (ACRA-Demo, ACRA_DEMO_MODE=true).
 * Rappelle qu'il s'agit d'un environnement temporaire (RGPD) et propose deux
 * actions : exporter ses données de test et déployer / contacter pour un usage réel.
 * Le compte à rebours d'expiration et l'export « organisation entière » arrivent
 * en phase 2 (cycle de vie / purge).
 */
export default function DemoBanner({ contactUrl }: { contactUrl: string }) {
  const { t } = useTranslation()
  const d = t.demo
  const external = /^https?:|^mailto:/.test(contactUrl)
  return (
    <div className="w-full bg-indigo-600 text-white text-sm">
      <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-medium">🧪 {d.badge}</span>
        <span className="text-indigo-100">{d.notice}</span>
        <span className="ml-auto flex items-center gap-3">
          <Link href="/analyses" className="underline underline-offset-2 hover:text-white text-indigo-50">
            {d.exportCta}
          </Link>
          {external ? (
            <a href={contactUrl} target="_blank" rel="noopener noreferrer"
              className="rounded bg-white/15 hover:bg-white/25 px-2.5 py-1 font-medium">
              {d.deployCta}
            </a>
          ) : (
            <Link href={contactUrl}
              className="rounded bg-white/15 hover:bg-white/25 px-2.5 py-1 font-medium">
              {d.deployCta}
            </Link>
          )}
        </span>
      </div>
    </div>
  )
}
