'use client'

// ─── Notifications à suivre (régimes applicables à un incident) ──────────────
// Une carte par régime (NIS2, RGPD, interne, personnalisé…) avec, pour chaque phase,
// l'échéance, le statut et — pour la 2ᵉ ligne — le marquage « soumise » (référence de
// l'accusé facultative). Aide au suivi des délais : rien n'est transmis à l'autorité.

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'

export interface HorlogePhaseJson {
  code: string; labelKey?: string; label?: string
  echeance: string | null; statut: 'A_FAIRE' | 'SOUMIS' | 'EN_RETARD' | 'EN_ATTENTE'
  soumisLe: string | null; reference?: string; tardive: boolean
}
export interface HorlogeRegimeJson { regime: string; labelKey?: string; label?: string; autorite?: string; phases: HorlogePhaseJson[] }

const BADGE: Record<string, string> = {
  SOUMIS: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  EN_RETARD: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  A_FAIRE: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  EN_ATTENTE: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300',
}

export default function NotificationsPanel({ horloges, canQualify, busy, onMark, onUnmark }: {
  horloges: HorlogeRegimeJson[]; canQualify: boolean; busy: boolean
  onMark: (regime: string, phase: string, reference: string) => void
  onUnmark: (regime: string, phase: string) => void
}) {
  const { t, locale } = useTranslation()
  const n = t.incidents
  const [refs, setRefs] = useState<Record<string, string>>({})
  const tr = (key: string) => key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], t) as string ?? key
  const statuts = n.notifStatuts as Record<string, string>
  const fmt = (iso: string) => new Date(iso).toLocaleString(locale)

  if (horloges.length === 0) return <p className="text-sm italic text-gray-500">{n.notifNone}</p>
  return (
    <div className="space-y-4">
      {horloges.map(h => (
        <section key={h.regime} aria-label={h.label ?? (h.labelKey ? tr(h.labelKey) : h.regime)} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{h.label ?? (h.labelKey ? tr(h.labelKey) : h.regime)}</h3>
          <ul className="mt-2 space-y-2">
            {h.phases.map(p => {
              const key = `${h.regime}/${p.code}`
              return (
                <li key={p.code} className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 dark:border-gray-800 pt-2 first:border-t-0 first:pt-0">
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-200">{p.label ?? (p.labelKey ? tr(p.labelKey) : p.code)}</p>
                    <p className="text-[11px] text-gray-400">
                      {n.notifEcheance} : {p.echeance ? fmt(p.echeance) : '—'}
                      {p.soumisLe && ` · ${n.notifSoumisLe} ${fmt(p.soumisLe)}`}
                      {p.reference && ` · ${p.reference}`}
                      {p.tardive && ` · ${n.notifTardive}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${BADGE[p.statut] ?? BADGE.EN_ATTENTE}`}>{statuts[p.statut] ?? p.statut}</span>
                    {canQualify && p.statut !== 'SOUMIS' && (
                      <>
                        <input aria-label={n.notifReference} placeholder={n.notifReference} value={refs[key] ?? ''} maxLength={120}
                          onChange={e => setRefs(r => ({ ...r, [key]: e.target.value }))}
                          className="px-2 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-xs w-44" />
                        <button type="button" disabled={busy} onClick={() => onMark(h.regime, p.code, refs[key] ?? '')} className="btn-secondary text-[11px] disabled:opacity-50">{n.notifMarquer}</button>
                      </>
                    )}
                    {canQualify && p.statut === 'SOUMIS' && (
                      <button type="button" disabled={busy} onClick={() => onUnmark(h.regime, p.code)} className="text-[11px] text-gray-500 underline hover:no-underline disabled:opacity-50">{n.notifAnnuler}</button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      <p className="text-[11px] text-gray-400">{n.notifDisclaimer}</p>
    </div>
  )
}
