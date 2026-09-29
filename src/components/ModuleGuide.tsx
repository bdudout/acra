'use client'

// ─── Explication in situ d'un module ─────────────────────────────────────────
// Bandeau repliable « À quoi ça sert / Comment s'en servir / Ce que vous en tirez ».
// Le contenu vient de l'i18n du module (une seule source ×5).

import { HelpCircle } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'

export interface ModuleGuideText { what: string; how: string; result: string }

export default function ModuleGuide({ guide }: { guide: ModuleGuideText }) {
  const { t } = useTranslation()
  const rows: [string, string][] = [[t.exemples.guideWhat, guide.what], [t.exemples.guideHow, guide.how], [t.exemples.guideResult, guide.result]]
  return (
    <details open className="rounded-lg border border-blue-200 bg-blue-50/60 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-800/60">
      <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-blue-800 dark:text-blue-300"><HelpCircle size={14} className="inline align-[-0.15em] mr-1" aria-hidden="true" />{t.exemples.guideTitle}</summary>
      <dl className="mt-2 space-y-1.5">
        {rows.map(([k, v]) => (
          <div key={k}><dt className="text-xs font-semibold text-gray-600 dark:text-gray-300">{k}</dt><dd className="text-gray-800 dark:text-gray-100">{v}</dd></div>
        ))}
      </dl>
    </details>
  )
}
