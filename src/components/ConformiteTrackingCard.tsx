'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/context'
import { CONFORMITE_STATUTS, type ConformiteStatut, type ConformiteStats } from '@/lib/conformite'
import ConformiteHistory from '@/components/ConformiteHistory'

export interface ConformiteControl {
  ref: string
  nom: string
  statut: ConformiteStatut
}

export interface ConformiteCardRow {
  /** Clé d'affichage unique (analyseId, ou org:<orgId>:<ref>). */
  key: string
  /** Origine : conformité par analyse (édition via /api/analyses) ou par organisation. */
  source: 'analyse' | 'org'
  analyseId?: string          // source === 'analyse'
  orgId?: string              // source === 'org'
  referentiel?: string        // source === 'org'
  nom: string
  isSocle: boolean
  frameworkNom: string
  canEdit: boolean
  total: number
  stats: ConformiteStats
  /** Contrôles non conformes / partiels (les actionnables), éditables inline. */
  nonConformites: ConformiteControl[]
}

const SEG: { key: keyof ConformiteStats; cls: string }[] = [
  { key: 'conforme', cls: 'bg-green-500' },
  { key: 'partiel', cls: 'bg-amber-400' },
  { key: 'nonConforme', cls: 'bg-red-500' },
  { key: 'na', cls: 'bg-gray-300' },
]

const DOT: Record<ConformiteStatut, string> = {
  conforme: 'bg-green-500', partiel: 'bg-amber-400', non_conforme: 'bg-red-500', na: 'bg-gray-300',
}

/** Carte de suivi + édition inline de la conformité du socle (dashboard). */
export default function ConformiteTrackingCard({ rows, locale }: { rows: ConformiteCardRow[]; locale: string }) {
  const { t } = useTranslation()
  const router = useRouter()
  const statutLabels = t.conformite.statuts as Record<string, string>
  // État local par ligne : stats affichées + statuts des non-conformités + expansion.
  const [state, setState] = useState<Record<string, { stats: ConformiteStats; ctrls: ConformiteControl[] }>>(
    () => Object.fromEntries(rows.map(r => [r.key, { stats: r.stats, ctrls: r.nonConformites }])),
  )
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState<string | null>(null)

  async function changeStatut(row: ConformiteCardRow, ref: string, statut: ConformiteStatut) {
    const busyKey = `${row.key}:${ref}`
    setBusy(busyKey)
    // Optimiste : refléter le nouveau statut localement.
    setState(prev => ({
      ...prev,
      [row.key]: { ...prev[row.key], ctrls: prev[row.key].ctrls.map(c => c.ref === ref ? { ...c, statut } : c) },
    }))
    // Édition selon l'origine : conformité par analyse ou par organisation.
    const url = row.source === 'org'
      ? `/api/organizations/${row.orgId}/conformite`
      : `/api/analyses/${row.analyseId}/conformite`
    const body = row.source === 'org' ? { referentiel: row.referentiel, ref, statut } : { ref, statut }
    try {
      const res = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (res.ok) {
        const d = await res.json() as { stats: ConformiteStats }
        setState(prev => ({ ...prev, [row.key]: { ...prev[row.key], stats: d.stats } }))
      }
      router.refresh() // réconcilier les autres vues (barre agrégée, catalogues)
    } catch {
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="card p-5">
      <h2 className="font-semibold text-gray-800 mb-1">🛡️ {t.dashboard.conformiteTitle}</h2>
      <p className="text-xs text-gray-500 mb-4">{t.dashboard.conformiteSubtitle}</p>
      <div className="space-y-4">
        {rows.map(r => {
          const st = state[r.key]?.stats ?? r.stats
          const ctrls = state[r.key]?.ctrls ?? r.nonConformites
          const isOpen = !!open[r.key]
          return (
            <div key={r.key} className="border border-gray-100 rounded-lg p-3">
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  {r.source === 'org'
                    ? <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium flex-shrink-0" title={t.dashboard.conformiteOrgBadge}>🏢</span>
                    : r.isSocle && <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium flex-shrink-0" title="Analyse socle">🏛️</span>}
                  <span className="text-sm font-medium text-gray-800 truncate">{r.nom}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">· {r.frameworkNom}</span>
                </div>
                {r.source === 'analyse' && (
                  <Link href={`/analyses/${r.analyseId}/atelier/1#socle-conformite`} className="text-xs text-ebios-600 hover:text-ebios-800 hover:underline flex-shrink-0">
                    {t.dashboard.conformiteModify} →
                  </Link>
                )}
              </div>

              {/* Barre de répartition */}
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100 mb-1.5">
                {SEG.map(seg => {
                  const n = st[seg.key] as number
                  return n > 0 ? <div key={seg.key} className={seg.cls} style={{ width: `${(n / Math.max(st.evalues, 1)) * 100}%` }} /> : null
                })}
              </div>
              <div className="flex items-center justify-between text-xs flex-wrap gap-x-3 gap-y-1">
                <span className="font-semibold text-gray-700">{st.tauxConformite}% {t.dashboard.conformiteRate}</span>
                <span className="text-gray-500">
                  <span className="text-green-600">{st.conforme} {statutLabels.conforme}</span>
                  {' · '}<span className="text-amber-600">{st.partiel} {statutLabels.partiel}</span>
                  {' · '}<span className="text-red-600 font-medium">{st.nonConforme} {statutLabels.non_conforme}</span>
                  {' · '}<span className="text-gray-400">{st.evalues}/{st.total}</span>
                </span>
              </div>

              {/* Non-conformités éditables inline */}
              {ctrls.length > 0 && (
                <div className="mt-2 border-t border-gray-100 pt-2">
                  <button
                    type="button"
                    onClick={() => setOpen(o => ({ ...o, [r.key]: !isOpen }))}
                    className="text-xs text-gray-600 hover:text-gray-900 font-medium"
                  >
                    {isOpen ? '▾' : '▸'} {ctrls.length} {t.dashboard.conformiteNonConfLabel}
                  </button>
                  {isOpen && (
                    <ul className="mt-2 space-y-1.5">
                      {ctrls.map(c => (
                        <li key={c.ref} className="flex items-start gap-2 text-xs">
                          <span className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${DOT[c.statut]}`} />
                          <span className="flex-1 min-w-0">
                            <span className="text-gray-400 mr-1">{c.ref}</span>
                            <span className="text-gray-700">{c.nom}</span>
                          </span>
                          {r.canEdit ? (
                            <select
                              value={c.statut}
                              disabled={busy === `${r.key}:${c.ref}`}
                              onChange={e => changeStatut(r, c.ref, e.target.value as ConformiteStatut)}
                              className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[11px] text-gray-700 flex-shrink-0 disabled:opacity-50"
                              aria-label={`${c.ref} — ${t.dashboard.conformiteModify}`}
                            >
                              {CONFORMITE_STATUTS.map(s => (
                                <option key={s} value={s}>{statutLabels[s]}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-[11px] text-gray-500 flex-shrink-0">{statutLabels[c.statut]}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Historique & tendance (conformité org) */}
              {r.source === 'org' && r.orgId && r.referentiel && (
                <ConformiteHistory orgId={r.orgId} referentiel={r.referentiel} locale={locale} canEdit={r.canEdit} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
