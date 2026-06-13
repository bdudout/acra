'use client'

/**
 * EbiosGuide — Interactive EBIOS RM methodology accordion
 *
 * Displayed in the dashboard sidebar. Shows all 5 workshops as collapsible
 * panels, each with:
 *  - Translated title and subtitle (from the i18n `ateliersMeta` array)
 *  - A short description
 *  - Workshop step badges
 *  - A direct link to the relevant page in the official ANSSI PDF guide
 *
 * Also renders an "ANSSI Resources" section at the bottom with links to
 * the official EBIOS RM method page and the full PDF.
 *
 * State: `openIndex` — which panel is expanded (null = all collapsed)
 *
 * Colour theming: each workshop has its own colour set defined in
 * `ATELIER_COLORS` (indigo/red/orange/yellow/green).
 *
 * The translated content falls back to the French static `ATELIERS_META`
 * if `t.ateliersMeta` is not populated (e.g. during SSR hydration).
 */

import { useState } from 'react'
import Link from 'next/link'
import { ATELIERS_META } from '@/lib/ebios-data'
import { useTranslation } from '@/lib/i18n/context'

const ATELIER_LINKS = [
  'https://www.ssi.gouv.fr/uploads/2018/10/guide-methode-ebios-risk-manager.pdf#page=27',
  'https://www.ssi.gouv.fr/uploads/2018/10/guide-methode-ebios-risk-manager.pdf#page=47',
  'https://www.ssi.gouv.fr/uploads/2018/10/guide-methode-ebios-risk-manager.pdf#page=67',
  'https://www.ssi.gouv.fr/uploads/2018/10/guide-methode-ebios-risk-manager.pdf#page=95',
  'https://www.ssi.gouv.fr/uploads/2018/10/guide-methode-ebios-risk-manager.pdf#page=117',
]

const ATELIER_COLORS = [
  { bg: 'bg-indigo-50', border: 'border-indigo-200', badge: 'bg-indigo-100 text-indigo-700', link: 'text-indigo-600 hover:text-indigo-800' },
  { bg: 'bg-red-50',    border: 'border-red-200',    badge: 'bg-red-100 text-red-700',       link: 'text-red-600 hover:text-red-800'       },
  { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700', link: 'text-orange-600 hover:text-orange-800' },
  { bg: 'bg-yellow-50', border: 'border-yellow-200', badge: 'bg-yellow-100 text-yellow-800', link: 'text-yellow-600 hover:text-yellow-800' },
  { bg: 'bg-green-50',  border: 'border-green-200',  badge: 'bg-green-100 text-green-700',   link: 'text-green-600 hover:text-green-800'   },
]

export default function EbiosGuide() {
  const { t, locale } = useTranslation()
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const metas: any[] = (t as any).ateliersMeta ?? []

  // Ressources ANSSI — version anglaise du guide EBIOS RM pour les locales non-FR
  const isFr = locale === 'fr'
  const guidePageUrl = isFr
    ? 'https://www.ssi.gouv.fr/guide/ebios-risk-manager-la-methode/'
    : 'https://messervices.cyber.gouv.fr/guides/en-ebios-risk-manager-method'
  const guidePdfUrl = isFr
    ? 'https://www.ssi.gouv.fr/uploads/2018/10/guide-methode-ebios-risk-manager.pdf'
    : 'https://cyber.gouv.fr/sites/default/files/2019/11/anssi-guide-ebios_risk_manager-en-v1.0.pdf'
  // Liens par atelier : ancres de page valides pour le PDF FR uniquement ; en
  // anglais on pointe vers le PDF EN (sans ancre, pagination différente).
  const atelierLinks = isFr ? ATELIER_LINKS : ATELIER_LINKS.map(() => guidePdfUrl)

  return (
    <div>
      <h2 className="font-semibold text-gray-800 mb-3">{t.dashboard.guideTitle}</h2>

      <div className="rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
        {ATELIERS_META.map((a, i) => {
          const meta = metas[i] ?? {}
          const colors = ATELIER_COLORS[i]
          const isOpen = openIndex === i

          return (
            <div key={a.num}>
              {/* En-tête cliquable */}
              <button
                className={`w-full text-left p-3 flex items-start gap-3 transition-colors ${
                  isOpen ? colors.bg : 'hover:bg-gray-50'
                }`}
                onClick={() => setOpenIndex(isOpen ? null : i)}
                aria-expanded={isOpen}
              >
                <span className="text-xl flex-shrink-0 mt-0.5">{a.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${colors.badge}`}>
                      A{a.num}
                    </span>
                    <span className="text-xs font-semibold text-gray-800 truncate">
                      {meta.titre ?? a.titre}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 leading-snug">
                    {meta.sousTitre ?? a.sousTitre}
                  </p>
                </div>
                <span className={`text-gray-400 text-xs mt-1 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>

              {/* Détail dépliable */}
              {isOpen && (
                <div className={`px-4 pb-4 pt-2 ${colors.bg} border-t ${colors.border}`}>
                  <p className="text-xs text-gray-700 leading-relaxed mb-3">
                    {meta.description ?? a.description}
                  </p>

                  {/* Étapes — traduites via meta.etapes, repli sur le statique FR */}
                  {(() => { const etapes: string[] = (t as any).ateliersEtapes?.[i] ?? a.etapes; return etapes?.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-gray-600 mb-1.5">{t.dashboard.stepsLabel}</p>
                      <div className="flex flex-wrap gap-1">
                        {etapes.map((etape: string, j: number) => (
                          <span
                            key={j}
                            className={`text-xs px-2 py-0.5 rounded-full ${colors.badge}`}
                          >
                            {j + 1}. {etape}
                          </span>
                        ))}
                      </div>
                    </div>
                  ); })()}

                  {/* Lien vers le guide officiel */}
                  <a
                    href={atelierLinks[i]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1 text-xs font-medium ${colors.link}`}
                  >
                    📄 Guide ANSSI — Atelier {a.num} →
                  </a>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Ressources ANSSI */}
      <div className="mt-4 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
        <h3 className="text-sm font-semibold text-indigo-900 mb-2">📚 {t.dashboard.anssiTitle}</h3>
        <ul className="space-y-1 text-xs text-indigo-700">
          <li>
            <a
              href={guidePageUrl}
              target="_blank"
              rel="noopener"
              className="hover:underline"
            >
              {t.dashboard.anssiGuide}
            </a>
          </li>
          <li>
            <a
              href={guidePdfUrl}
              target="_blank"
              rel="noopener"
              className="hover:underline"
            >
              {t.dashboard.anssiPdf}
            </a>
          </li>
        </ul>
      </div>
    </div>
  )
}
