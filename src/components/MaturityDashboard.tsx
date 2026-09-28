'use client'

// ─── Maturité — tableau de bord (lecture RAS / RAD) et évaluation ─────────────
// Un profil = la couche maturité du suivi de conformité d'un référentiel (même
// objet, mêmes points, mêmes actions). Haut de page : cible globale (le « RAS »)
// et tableau de bord actuel / cible par domaine, plus grands écarts (le « RAD »).
// Bas de page : évaluation point par point (maturité actuelle, cible propre ou
// héritée, responsable, justification), statut de conformité affiché à côté.
// Sauvegarde : seuls les points modifiés sont envoyés ; le serveur horodate.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, ExternalLink } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import {
  MATURITY_LEVELS, effectiveTarget, isMaturityGap, maturityStats,
  type Maturites, type MaturityEntry, type MaturityScaleLevel, type MaturityStats, type RefActionSummary,
} from '@/lib/maturity'
import type { ConformiteStatut } from '@/lib/conformite'

export interface MaturityDashboardProps {
  canManage: boolean
  scale: MaturityScaleLevel[]
  referentiels: { code: string; nom: string }[]
  profile: {
    referentiel: string
    conformiteId: string | null
    items: { ref: string; nom: string; description: string; categorie: string }[]
    categories: Record<string, string>
    maturites: Maturites
    maturiteCible: number | null
    conformite: Record<string, ConformiteStatut>
    stats: MaturityStats
    actions: Record<string, RefActionSummary>
    updatedAt: string | null
  }
}

type Msg = { kind: 'ok' | 'error'; text: string }
const EDITABLE = ['actuel', 'cible', 'responsable', 'commentaire'] as const

export default function MaturityDashboard({ canManage, scale, referentiels, profile }: MaturityDashboardProps) {
  const { t, locale } = useTranslation()
  const m = t.maturite
  const statutLabel = t.conformite.statuts as Record<string, string>
  const router = useRouter()
  const [maturites, setMaturites] = useState<Maturites>(profile.maturites)
  const [cible, setCible] = useState<number | null>(profile.maturiteCible)
  const [dirty, setDirty] = useState<Set<string>>(new Set())
  const [cibleDirty, setCibleDirty] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<Msg | null>(null)
  const [itemMsg, setItemMsg] = useState<Record<string, Msg>>({})
  const [actions, setActions] = useState(profile.actions)

  const stats = useMemo(() => maturityStats(profile.items, maturites, cible), [profile.items, maturites, cible])
  const level = (n: number) => `${n} — ${scale.find(l => l.niveau === n)?.libelle ?? ''}`
  const fmtDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString(locale) : m.stats.never)
  const outOf5 = (n: number | null) => (n === null ? '—' : `${n} / 5`)
  const isDirty = dirty.size > 0 || cibleDirty

  function update(ref: string, field: (typeof EDITABLE)[number], value: string) {
    setMsg(null)
    setMaturites(prev => {
      const next: MaturityEntry = { ...(prev[ref] ?? {}) }
      if (field === 'actuel' || field === 'cible') {
        if (value === '') delete next[field]; else next[field] = Number(value)
      } else if (value) next[field] = value
      else delete next[field]
      return { ...prev, [ref]: next }
    })
    setDirty(prev => new Set(prev).add(ref))
  }

  async function save(): Promise<boolean> {
    setBusy('save'); setMsg(null)
    const payload: Record<string, MaturityEntry> = {}
    for (const ref of dirty) {
      const e = maturites[ref] ?? {}
      const clean: Record<string, unknown> = {}
      for (const f of EDITABLE) if (e[f] !== undefined) clean[f] = e[f]
      payload[ref] = clean as MaturityEntry
    }
    try {
      const res = await fetch('/api/maturite', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referentiel: profile.referentiel, maturites: payload, ...(cibleDirty ? { maturiteCible: cible } : {}) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg({ kind: 'error', text: m.saveError.replace('{error}', String(data.error ?? res.status)) }); return false }
      if (data.maturites && typeof data.maturites === 'object') setMaturites(data.maturites)
      setDirty(new Set()); setCibleDirty(false)
      setMsg({ kind: 'ok', text: m.saved })
      return true
    } catch {
      setMsg({ kind: 'error', text: m.saveError.replace('{error}', '—') }); return false
    } finally { setBusy(null) }
  }

  async function createAction(ref: string) {
    // Le serveur ne promeut qu'un écart ENREGISTRÉ : on enregistre d'abord si besoin.
    if (isDirty && !(await save())) return
    setBusy(ref)
    try {
      const res = await fetch('/api/maturite/actions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referentiel: profile.referentiel, ref }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setItemMsg(p => ({ ...p, [ref]: { kind: 'error', text: m.actionError.replace('{error}', String(data.error ?? res.status)) } })); return }
      if (!data.existing) setActions(a => { const s = a[ref] ?? { total: 0, open: 0, overdue: 0 }; return { ...a, [ref]: { ...s, total: s.total + 1, open: s.open + 1 } } })
      setItemMsg(p => ({ ...p, [ref]: { kind: 'ok', text: data.existing ? m.actionExists : m.actionCreated } }))
    } catch {
      setItemMsg(p => ({ ...p, [ref]: { kind: 'error', text: m.actionError.replace('{error}', '—') } }))
    } finally { setBusy(null) }
  }

  const actionButton = (ref: string) => canManage && isMaturityGap(maturites[ref], cible) && (
    <button type="button" disabled={busy !== null} onClick={() => createAction(ref)} className="text-xs font-medium text-ebios-700 hover:underline disabled:opacity-50">{m.createAction}</button>
  )
  const itemName = (ref: string) => profile.items.find(i => i.ref === ref)?.nom ?? ''
  const actionsOpen = Object.values(actions).reduce((n, a) => n + a.open, 0)
  const actionsOverdue = Object.values(actions).reduce((n, a) => n + a.overdue, 0)

  const tiles = [
    { label: m.stats.averageCurrent, value: outOf5(stats.averageCurrent) },
    { label: m.stats.averageTarget, value: outOf5(stats.averageTarget) },
    { label: m.stats.belowTarget, value: `${stats.belowTarget} / ${stats.assessed}` },
    { label: m.stats.assessed, value: `${stats.assessed} / ${stats.total}` },
    { label: m.stats.lastReview, value: fmtDate(stats.lastReviewedAt) },
  ]

  return (
    <div className="space-y-6">
      {/* ── Cadre : référentiel et cible globale (le « RAS ») ── */}
      <section className="card p-5">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div className="flex items-end gap-4 flex-wrap">
            <label className="text-xs text-gray-600 dark:text-gray-300">{m.referentiel}
              <select aria-label={m.referentiel} value={profile.referentiel}
                onChange={e => router.push(`/maturite?referentiel=${encodeURIComponent(e.target.value)}`)}
                className="mt-1 block rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-600">
                {referentiels.map(r => <option key={r.code} value={r.code}>{r.nom}</option>)}
              </select>
            </label>
            <label className="text-xs text-gray-600 dark:text-gray-300">{m.globalTarget}
              <select aria-label={m.globalTarget} disabled={!canManage} value={cible ?? ''}
                onChange={e => { setCible(e.target.value === '' ? null : Number(e.target.value)); setCibleDirty(true); setMsg(null) }}
                className="mt-1 block rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-600">
                <option value="">{m.noTarget}</option>
                {MATURITY_LEVELS.map(n => <option key={n} value={n}>{level(n)}</option>)}
              </select>
            </label>
          </div>
          <div className="flex items-center gap-3 flex-wrap text-sm">
            <a href="/configuration#maturite-echelle" className="text-ebios-700 hover:underline inline-flex items-center gap-1">{m.scaleLink}<ExternalLink size={12} aria-hidden="true" /></a>
            <a href={`/api/maturite/export?referentiel=${encodeURIComponent(profile.referentiel)}`} className="btn-secondary text-sm inline-flex items-center gap-1.5">
              <Download size={14} aria-hidden="true" />{m.exportCsv}
            </a>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-600 dark:text-gray-300 bg-ebios-50/60 dark:bg-gray-800/60 rounded-md px-3 py-2">{m.rasRad}</p>
      </section>

      {/* ── Tableau de bord (le « RAD ») ── */}
      <section className="card p-5" aria-label={m.domains}>
        <dl className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {tiles.map(tile => (
            <div key={tile.label} className="rounded-md bg-gray-50 dark:bg-gray-800/60 px-3 py-2">
              <dt className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{tile.label}</dt>
              <dd className="text-base font-semibold tabular-nums text-gray-900 dark:text-gray-100">{tile.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
          {m.stats.actions} : {m.linkedActions.replace('{open}', String(actionsOpen)).replace('{overdue}', String(actionsOverdue))}
        </p>

        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{m.domains}</h2>
            <ul className="mt-2 space-y-3">
              {stats.domains.map(d => {
                const cur = d.averageCurrent ?? 0
                const tgt = d.averageTarget
                return (
                  <li key={d.categorie}>
                    <div className="flex justify-between gap-2 text-xs">
                      <span className="text-gray-700 dark:text-gray-200">{profile.categories[d.categorie] ?? d.categorie}</span>
                      <span className="tabular-nums text-gray-500">
                        {d.averageCurrent === null ? m.notAssessed : `${d.averageCurrent}${tgt !== null ? ` → ${tgt}` : ''}`}
                        {d.belowTarget > 0 && <span className="ml-2 text-amber-700">▼ {d.belowTarget}</span>}
                      </span>
                    </div>
                    {/* Barre 0–5 : maturité actuelle moyenne, repère = cible moyenne. */}
                    <div className="relative mt-1 h-2 rounded-full bg-gray-100 dark:bg-gray-700" aria-hidden="true">
                      <div className={`h-2 rounded-full ${tgt !== null && cur < tgt ? 'bg-amber-500' : 'bg-ebios-500'}`} style={{ width: `${(cur / 5) * 100}%` }} />
                      {tgt !== null && <div className="absolute -top-1 h-4 w-0.5 bg-gray-800 dark:bg-gray-100" style={{ left: `calc(${(tgt / 5) * 100}% - 1px)` }} />}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{m.topGaps}</h2>
            {stats.topGaps.length === 0 ? <p className="mt-2 text-xs text-gray-500">{m.noGaps}</p> : (
              <ul aria-label={m.topGaps} className="mt-2 divide-y divide-gray-100 dark:divide-gray-700">
                {stats.topGaps.map(g => (
                  <li key={g.ref} className="py-2 flex items-center justify-between gap-3 text-sm">
                    <a href={`#mat-${g.ref}`} className="min-w-0 truncate text-gray-800 dark:text-gray-100 hover:underline">
                      <span className="font-mono mr-1.5">{g.ref}</span>{itemName(g.ref)}
                    </a>
                    <span className="shrink-0 flex items-center gap-3">
                      <span className="tabular-nums text-xs text-amber-700">{g.actuel} → {g.cible}</span>
                      {actionButton(g.ref)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <p className="mt-4 text-[11px] text-gray-500 dark:text-gray-400">{m.officialText} {m.disclaimer}</p>
      </section>

      {/* ── Évaluation point par point ── */}
      <section className="card p-5">
        {Object.keys(profile.categories).map(cat => (
          <div key={cat} className="mb-6 last:mb-0">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{profile.categories[cat]}</h3>
            <div className="mt-2 divide-y divide-gray-100 dark:divide-gray-700">
              {profile.items.filter(i => i.categorie === cat).map(item => {
                const e = maturites[item.ref] ?? {}
                const statut = profile.conformite[item.ref]
                const act = actions[item.ref]
                const im = itemMsg[item.ref]
                const target = effectiveTarget(e, cible)
                return (
                  <div key={item.ref} id={`mat-${item.ref}`} className="py-3 scroll-mt-24">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100"><span className="font-mono mr-1.5">{item.ref}</span>{item.nom}</p>
                      {statut && <span className="shrink-0 rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-[11px] text-gray-700 dark:text-gray-200" title={m.compliance}>{statutLabel[statut] ?? statut}</span>}
                    </div>
                    {item.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.description}</p>}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      <label className="text-xs text-gray-600 dark:text-gray-300">{m.current}
                        <select aria-label={`${item.ref} ${m.current}`} disabled={!canManage} value={e.actuel ?? ''} onChange={ev => update(item.ref, 'actuel', ev.target.value)}
                          className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-600">
                          <option value="">{m.notAssessed}</option>
                          {scale.map(l => <option key={l.niveau} value={l.niveau} title={l.definition}>{level(l.niveau)}</option>)}
                        </select>
                      </label>
                      <label className="text-xs text-gray-600 dark:text-gray-300">{m.target}
                        <select aria-label={`${item.ref} ${m.target}`} disabled={!canManage} value={e.cible ?? ''} onChange={ev => update(item.ref, 'cible', ev.target.value)}
                          className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-600">
                          <option value="">{`${m.targetInherited} (${cible !== null ? level(cible) : m.noTarget})`}</option>
                          {scale.map(l => <option key={l.niveau} value={l.niveau} title={l.definition}>{level(l.niveau)}</option>)}
                        </select>
                      </label>
                    </div>
                    {canManage ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                        <input aria-label={`${item.ref} ${m.owner}`} value={e.responsable ?? ''} maxLength={120} placeholder={m.owner}
                          onChange={ev => update(item.ref, 'responsable', ev.target.value)}
                          className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-600" />
                        <input aria-label={`${item.ref} ${m.justification}`} value={e.commentaire ?? ''} maxLength={2000} placeholder={m.justification}
                          onChange={ev => update(item.ref, 'commentaire', ev.target.value)}
                          className="sm:col-span-2 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-600" />
                      </div>
                    ) : (e.responsable || e.commentaire) && (
                      <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">{[e.responsable, e.commentaire].filter(Boolean).join(' — ')}</p>
                    )}
                    <div className="mt-2 flex items-center gap-3 flex-wrap text-xs">
                      {e.actuel !== undefined && target !== null && e.actuel < target && <span className="text-amber-700 tabular-nums">▼ {e.actuel} → {target}</span>}
                      {e.updatedAt && <span className="text-gray-500 dark:text-gray-400">{m.lastChange} : {fmtDate(e.updatedAt)}</span>}
                      {act && act.total > 0 && <span className="text-gray-600 dark:text-gray-300">{m.linkedActions.replace('{open}', String(act.open)).replace('{overdue}', String(act.overdue))}</span>}
                      {actionButton(item.ref)}
                      {im && <span role="status" className={im.kind === 'ok' ? 'text-green-700' : 'text-red-700'}>{im.text}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </section>

      {canManage ? (
        <div className="sticky bottom-0 z-10 flex items-center gap-3 flex-wrap bg-white/95 dark:bg-gray-900/95 border-t border-gray-200 dark:border-gray-700 px-4 py-3 rounded-t-lg">
          <button type="button" disabled={busy !== null || !isDirty} onClick={() => save()} className="btn-primary text-sm disabled:opacity-50">{m.save}</button>
          {isDirty && <span className="text-xs text-amber-700">{m.unsaved}</span>}
          {msg && <span role="status" className={`text-xs ${msg.kind === 'ok' ? 'text-green-700' : 'text-red-700'}`}>{msg.text}</span>}
        </div>
      ) : <p className="text-xs text-gray-500">{m.readOnly}</p>}
    </div>
  )
}
