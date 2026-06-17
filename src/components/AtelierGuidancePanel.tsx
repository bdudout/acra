'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'

/**
 * AtelierGuidancePanel — Panneau latéral de conseils par atelier (fonctionnalité
 * optionnelle, OrganizationConfig.conseilsAteliersActive, activée par défaut).
 *
 * Affiche les participants recommandés (Métier, DSI, RSSI…) et des conseils
 * essentiels issus de la méthode EBIOS RM / des fiches du Club EBIOS, plus des
 * liens « En savoir plus ». Masquable par l'utilisateur (état persisté en
 * localStorage, partagé entre ateliers).
 */

// Liens externes (URL neutres ; libellés via i18n t.atelierGuidance.links)
const GUIDANCE_LINKS: { key: 'anssi' | 'clubEbios'; url: string }[] = [
  { key: 'anssi', url: 'https://cyber.gouv.fr/la-methode-ebios-risk-manager' },
  { key: 'clubEbios', url: 'https://club-ebios.org/site/' },
]

const STORAGE_KEY = 'acra-guidance-collapsed'

interface Props {
  /** Numéro d'atelier 1–5. */
  num: number
}

export default function AtelierGuidancePanel({ num }: Props) {
  const { t } = useTranslation()
  const g = t.atelierGuidance
  const [collapsed, setCollapsed] = useState(false)

  // État replié persisté (lu après montage pour éviter un mismatch d'hydratation)
  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === '1')
  }, [])

  function toggle(next: boolean) {
    setCollapsed(next)
    try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0') } catch { /* quota / mode privé */ }
  }

  const data = (g as unknown as Record<string, { participants: string[]; tips: string[] }>)[`a${num}`]
  if (!data) return null

  if (collapsed) {
    return (
      <aside className="hidden lg:block w-10 shrink-0">
        <button
          type="button"
          onClick={() => toggle(false)}
          aria-label={g.showAria}
          title={g.panelTitle}
          className="sticky top-24 flex h-32 w-10 flex-col items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-ebios-50 hover:text-ebios-700 transition-colors"
        >
          <span className="text-lg">💡</span>
          <span className="[writing-mode:vertical-rl] rotate-180 text-xs font-medium">{g.panelTitle}</span>
        </button>
      </aside>
    )
  }

  const linkLabels = g.links as Record<string, string>

  return (
    <aside className="hidden lg:block w-72 shrink-0">
      <div className="sticky top-24 rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
            <span>💡</span>{g.panelTitle}
          </h2>
          <button
            type="button"
            onClick={() => toggle(true)}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            {g.hide}
          </button>
        </div>

        {/* Participants recommandés */}
        <section className="mb-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            👥 {g.participantsTitle}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {data.participants.map(p => (
              <span key={p} className="rounded-full border border-ebios-100 bg-ebios-50 px-2 py-0.5 text-xs font-medium text-ebios-700">
                {p}
              </span>
            ))}
          </div>
        </section>

        {/* Conseils essentiels */}
        <section className="mb-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            🎯 {g.tipsTitle}
          </h3>
          <ul className="space-y-2">
            {data.tips.map((tip, i) => (
              <li key={i} className="flex gap-2 text-xs text-gray-600">
                <span className="mt-0.5 text-ebios-500">›</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] italic text-gray-400">{g.tipsSource}</p>
        </section>

        {/* En savoir plus */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            🔗 {g.learnMore}
          </h3>
          <ul className="space-y-1">
            {GUIDANCE_LINKS.map(l => (
              <li key={l.key}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-ebios-600 hover:text-ebios-800 hover:underline"
                >
                  {linkLabels[l.key] ?? l.key} ↗
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </aside>
  )
}
