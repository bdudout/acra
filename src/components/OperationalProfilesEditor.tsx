'use client'

// ─── Éditeur des profils opérationnels US/UK (NIST CSF 2.0 / NCSC CAF v4.0) ──
// Un bloc par cadre : niveau cible du profil, synthèse (couverture, écarts,
// actions liées, dernière revue), puis les points du catalogue officiel groupés
// par fonction/objectif. Sauvegarde atomique par cadre (le serveur horodate les
// points modifiés) ; promotion d'un écart en plan d'action (anti-doublon serveur).
// Les intitulés normatifs restent en anglais officiel ; l'interface est traduite.

import { useEffect, useMemo, useState } from 'react'
import { Download, ExternalLink } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import {
  OPERATIONAL_PROFILE_CATALOGS, OPERATIONAL_PROFILE_STATUSES, isActionableGap, operationalProfileStats,
  type OperationalProfileEntry, type OperationalProfileFramework, type OperationalProfileStatus,
  type OperationalProfileStats, type OperationalProfileActionSummary,
} from '@/lib/operational-profiles'

export interface EditorProfile {
  framework: OperationalProfileFramework
  id: string | null
  cible: string | null
  entries: OperationalProfileEntry[]
  updatedAt: string | null
  stats: OperationalProfileStats
  actions: Record<string, OperationalProfileActionSummary>
  actionsOpen: number
  actionsOverdue: number
}

type Msg = { kind: 'ok' | 'error'; text: string }

export default function OperationalProfilesEditor({ profiles, canManage, focusRef }: { profiles: EditorProfile[]; canManage: boolean; focusRef?: string }) {
  useEffect(() => {
    if (!focusRef) return
    document.getElementById(`op-${focusRef}`)?.scrollIntoView?.({ block: 'center' })
  }, [focusRef])
  return (
    <div className="space-y-8">
      {profiles.map(p => <ProfileSection key={p.framework} initial={p} canManage={canManage} focusRef={focusRef} />)}
    </div>
  )
}

function ProfileSection({ initial, canManage, focusRef }: { initial: EditorProfile; canManage: boolean; focusRef?: string }) {
  const { t, locale } = useTranslation()
  const o = t.operationalProfiles
  const statuses = o.statuses as Record<OperationalProfileStatus, string>
  const catalog = OPERATIONAL_PROFILE_CATALOGS[initial.framework]
  const [entries, setEntries] = useState(initial.entries)
  const [cible, setCible] = useState(initial.cible ?? '')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<Msg | null>(null)
  const [itemMsg, setItemMsg] = useState<Record<string, Msg>>({})
  const [actions, setActions] = useState(initial.actions)

  const byRef = useMemo(() => new Map(entries.map(e => [e.ref, e])), [entries])
  const stats = useMemo(() => operationalProfileStats(entries, catalog.items.length), [entries, catalog.items.length])
  const actionsOpen = Object.values(actions).reduce((n, a) => n + a.open, 0)
  const actionsOverdue = Object.values(actions).reduce((n, a) => n + a.overdue, 0)
  const fmtDate = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleDateString(locale) : o.stats.never

  function update(ref: string, field: 'statut' | 'cible' | 'responsable' | 'commentaire', value: string) {
    setDirty(true); setMsg(null)
    setEntries(prev => {
      const old = prev.find(e => e.ref === ref) ?? { ref, statut: 'NON_EVALUE' as const }
      const next = { ...old, [field]: value || undefined } as OperationalProfileEntry
      if (field === 'statut') next.statut = (value || 'NON_EVALUE') as OperationalProfileStatus
      return prev.some(e => e.ref === ref) ? prev.map(e => e.ref === ref ? next : e) : [...prev, next]
    })
  }

  async function save(): Promise<boolean> {
    setBusy('save'); setMsg(null)
    try {
      const res = await fetch('/api/operational-profiles', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ framework: initial.framework, entries, cible: cible || null }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg({ kind: 'error', text: o.saveError.replace('{error}', String(data.error ?? res.status)) }); return false }
      if (Array.isArray(data.entries)) setEntries(data.entries)
      setDirty(false); setMsg({ kind: 'ok', text: o.saved })
      return true
    } catch {
      setMsg({ kind: 'error', text: o.saveError.replace('{error}', '—') }); return false
    } finally { setBusy(null) }
  }

  async function createAction(ref: string) {
    // Le serveur ne promeut qu'un écart ENREGISTRÉ : on enregistre d'abord si besoin.
    if (dirty && !(await save())) return
    setBusy(ref)
    try {
      const res = await fetch('/api/operational-profiles/actions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ framework: initial.framework, ref }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setItemMsg(m => ({ ...m, [ref]: { kind: 'error', text: o.actionError.replace('{error}', String(data.error ?? res.status)) } })); return }
      if (!data.existing) {
        setActions(a => { const s = a[ref] ?? { total: 0, open: 0, overdue: 0 }; return { ...a, [ref]: { ...s, total: s.total + 1, open: s.open + 1 } } })
      }
      setItemMsg(m => ({ ...m, [ref]: { kind: 'ok', text: data.existing ? o.actionExists : o.actionCreated } }))
    } catch {
      setItemMsg(m => ({ ...m, [ref]: { kind: 'error', text: o.actionError.replace('{error}', '—') } }))
    } finally { setBusy(null) }
  }

  const tiles: { label: string; value: string }[] = [
    { label: o.stats.coverage, value: `${stats.coverage} %` },
    { label: o.stats.assessed, value: `${stats.assessed}/${stats.total}` },
    { label: o.stats.gaps, value: String(stats.gaps) },
    { label: o.stats.targetGaps, value: String(stats.targetGaps) },
    { label: o.stats.lastReview, value: fmtDate(stats.lastReviewedAt) },
  ]

  return (
    <section className="card p-5" aria-labelledby={`op-title-${initial.framework}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 id={`op-title-${initial.framework}`} className="text-lg font-semibold text-gray-900 dark:text-gray-100">{catalog.title}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {catalog.version} · <a className="text-ebios-600 hover:underline inline-flex items-center gap-0.5" href={catalog.sourceUrl} target="_blank" rel="noopener noreferrer">{o.source}<ExternalLink size={11} aria-hidden="true" /></a>
          </p>
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <label className="text-xs text-gray-600 dark:text-gray-300">
            {o.targetLevel}
            <select aria-label={o.targetLevel} disabled={!canManage} value={cible} onChange={e => { setCible(e.target.value); setDirty(true); setMsg(null) }}
              className="mt-1 block rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-600">
              <option value="">{o.targetLevelNone}</option>
              {catalog.targetLevels.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </label>
          <a href={`/api/operational-profiles/export?framework=${initial.framework}`} className="btn-secondary text-sm inline-flex items-center gap-1.5">
            <Download size={14} aria-hidden="true" />{o.exportCsv}
          </a>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
        {tiles.map(tile => (
          <div key={tile.label} className="rounded-md bg-gray-50 dark:bg-gray-800/60 px-3 py-2">
            <dt className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{tile.label}</dt>
            <dd className="text-base font-semibold tabular-nums text-gray-900 dark:text-gray-100">{tile.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
        {o.linkedActions.replace('{open}', String(actionsOpen)).replace('{overdue}', String(actionsOverdue))}
      </p>
      <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{o.officialText} {o.disclaimer}</p>

      <div className="mt-5 space-y-6">
        {catalog.groups.map(group => (
          <div key={group.ref}>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100"><span className="font-mono text-ebios-700 dark:text-ebios-300 mr-1.5">{group.ref}</span>{group.label}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{group.description}</p>
            <div className="mt-2 divide-y divide-gray-100 dark:divide-gray-700">
              {catalog.items.filter(i => i.group === group.ref).map(item => {
                const entry = byRef.get(item.ref) ?? { ref: item.ref, statut: 'NON_EVALUE' as const }
                const act = actions[item.ref]
                const im = itemMsg[item.ref]
                return (
                  <div key={item.ref} id={`op-${item.ref}`} className={`py-3 scroll-mt-24 ${focusRef === item.ref ? 'rounded-md ring-2 ring-ebios-300 px-2' : ''}`}>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100"><span className="font-mono mr-1.5">{item.ref}</span>{item.label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.description}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      <label className="text-xs text-gray-600 dark:text-gray-300">{o.current}
                        <select aria-label={`${item.ref} ${o.current}`} disabled={!canManage} value={entry.statut} onChange={e => update(item.ref, 'statut', e.target.value)}
                          className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-600">
                          {OPERATIONAL_PROFILE_STATUSES.map(s => <option key={s} value={s}>{statuses[s]}</option>)}
                        </select>
                      </label>
                      <label className="text-xs text-gray-600 dark:text-gray-300">{o.target}
                        <select aria-label={`${item.ref} ${o.target}`} disabled={!canManage} value={entry.cible ?? 'NON_EVALUE'} onChange={e => update(item.ref, 'cible', e.target.value === 'NON_EVALUE' ? '' : e.target.value)}
                          className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-600">
                          {OPERATIONAL_PROFILE_STATUSES.map(s => <option key={s} value={s}>{statuses[s]}</option>)}
                        </select>
                      </label>
                    </div>
                    {canManage ? (
                      <div className="grid grid-cols-1 gap-2 mt-2">
                        <input aria-label={`${item.ref} ${o.owner}`} value={entry.responsable ?? ''} maxLength={120} onChange={e => update(item.ref, 'responsable', e.target.value)} placeholder={o.owner}
                          className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-600" />
                        <textarea aria-label={`${item.ref} ${o.justification}`} value={entry.commentaire ?? ''} maxLength={2000} onChange={e => update(item.ref, 'commentaire', e.target.value)} placeholder={o.justification} rows={2}
                          className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-600" />
                      </div>
                    ) : (entry.responsable || entry.commentaire) && (
                      <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">{[entry.responsable, entry.commentaire].filter(Boolean).join(' — ')}</p>
                    )}
                    <div className="mt-2 flex items-center gap-3 flex-wrap text-xs">
                      {entry.updatedAt && <span className="text-gray-500 dark:text-gray-400">{o.lastChange} : {fmtDate(entry.updatedAt)}</span>}
                      {act && act.total > 0 && <span className="text-gray-600 dark:text-gray-300">{o.linkedActions.replace('{open}', String(act.open)).replace('{overdue}', String(act.overdue))}</span>}
                      {canManage && isActionableGap(entry) && (
                        <button type="button" disabled={busy !== null} onClick={() => createAction(item.ref)} className="font-medium text-ebios-700 hover:underline disabled:opacity-50">{o.createAction}</button>
                      )}
                      {im && <span role="status" className={im.kind === 'ok' ? 'text-green-700' : 'text-red-700'}>{im.text}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {canManage ? (
        <div className="mt-5 flex items-center gap-3 flex-wrap sticky bottom-0 bg-white/90 dark:bg-gray-900/90 py-2">
          <button type="button" disabled={busy !== null} onClick={() => save()} className="btn-primary text-sm disabled:opacity-50">{o.save}</button>
          {dirty && <span className="text-xs text-amber-700">{o.unsaved}</span>}
          {msg && <span role="status" className={`text-xs ${msg.kind === 'ok' ? 'text-green-700' : 'text-red-700'}`}>{msg.text}</span>}
        </div>
      ) : <p className="mt-4 text-xs text-gray-500">{o.readOnly}</p>}
    </section>
  )
}
