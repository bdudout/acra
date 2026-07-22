'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { formatDate } from '@/lib/format'
import {
  etatDerogation, joursAvantExpiration,
  canAvisRssiDerogation, canDoubleRegardDerogation, canValiderDerogation,
  canRevoquerDerogation, canCloturerDerogation,
  type DerogationEtat, type DerogationStatut,
} from '@/lib/derogation'
import type { UserRole } from '@/lib/permissions'

interface Derog {
  id: string
  portee: string
  referentiel: string | null
  ref: string | null
  risqueId: string | null
  intitule: string
  motif: string
  mesuresCompensatoires: string
  statut: DerogationStatut
  demandeurId: string
  avisRssiPar: string | null
  avisRssiCommentaire: string | null
  dateFin: string | null
}

const BADGE: Record<DerogationEtat, string> = {
  DEMANDEE: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  DOUBLE_REGARD: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300',
  VALIDATION_METIER: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  EXPIRE_BIENTOT: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
  EXPIREE: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
  REJETEE: 'bg-gray-200 text-gray-700 dark:bg-gray-600/40 dark:text-gray-300',
  CLOTUREE: 'bg-slate-200 text-slate-700 dark:bg-slate-600/40 dark:text-slate-200',
  REVOQUEE: 'bg-gray-200 text-gray-700 dark:bg-gray-600/40 dark:text-gray-300',
}

export default function DerogationsPanel({
  analyseId, currentUserId, currentUserRole, canEdit,
  referentielCourant, risques = [], locale,
}: {
  analyseId: string
  currentUserId: string
  currentUserRole: UserRole
  canEdit: boolean
  referentielCourant?: string | null
  risques?: { id: string; nom: string }[]
  locale: string
}) {
  const { t } = useTranslation()
  const d = t.derogations
  const [list, setList] = useState<Derog[]>([])
  const [alerteJours, setAlerteJours] = useState(30)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null) // action panel ouverte

  const user = { id: currentUserId, role: currentUserRole }

  async function reload() {
    const res = await fetch(`/api/analyses/${analyseId}/derogations`)
    if (!res.ok) return
    const data = await res.json()
    setList(data.derogations ?? [])
    if (typeof data.config?.alerteJours === 'number') setAlerteJours(data.config.alerteJours)
  }
  useEffect(() => { reload() }, [analyseId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Création ──
  const [form, setForm] = useState({ portee: 'CONTROLE', referentiel: referentielCourant ?? '', ref: '', risqueId: '', intitule: '', motif: '', mesures: '' })
  async function submitCreate() {
    setBusy(true); setError(null)
    const res = await fetch(`/api/analyses/${analyseId}/derogations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        portee: form.portee,
        referentiel: form.referentiel || null,
        ref: form.ref || null,
        risqueId: form.risqueId || null,
        intitule: form.intitule, motif: form.motif, mesuresCompensatoires: form.mesures,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError((d.errors as Record<string, string>)[data.error] ?? data.error ?? 'Erreur'); return }
    setCreating(false)
    setForm({ portee: 'CONTROLE', referentiel: referentielCourant ?? '', ref: '', risqueId: '', intitule: '', motif: '', mesures: '' })
    reload()
  }

  // ── Transitions ──
  async function transition(id: string, body: Record<string, unknown>) {
    setBusy(true); setError(null)
    const res = await fetch(`/api/derogations/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(data.error ?? 'Erreur'); return }
    setOpenId(null)
    reload()
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-gray-800 dark:text-gray-100">🪪 {d.title}</h3>
        {canEdit && (
          <button onClick={() => setCreating(v => !v)} className="text-sm text-ebios-600 hover:text-ebios-800 dark:text-ebios-300 font-medium">
            {creating ? d.cancel : `+ ${d.newBtn}`}
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{d.subtitle}</p>

      {error && <div className="mb-3 p-2 rounded bg-red-50 border border-red-200 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</div>}

      {/* Formulaire de création */}
      {creating && canEdit && (
        <div className="mb-4 space-y-2 p-3 rounded-lg border border-gray-200 bg-gray-50 dark:bg-gray-800/40 dark:border-gray-700">
          <select value={form.portee} onChange={e => setForm(f => ({ ...f, portee: e.target.value }))} className="w-full px-2 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm">
            {(['CONTROLE', 'RISQUE', 'SOCLE'] as const).map(p => <option key={p} value={p}>{(d.portees as Record<string, string>)[p]}</option>)}
          </select>
          {(form.portee === 'CONTROLE' || form.portee === 'SOCLE') && (
            <input value={form.referentiel} onChange={e => setForm(f => ({ ...f, referentiel: e.target.value }))} placeholder={d.referentiel} className="w-full px-2 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm" />
          )}
          {form.portee === 'CONTROLE' && (
            <input value={form.ref} onChange={e => setForm(f => ({ ...f, ref: e.target.value }))} placeholder={d.controle} className="w-full px-2 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm" />
          )}
          {form.portee === 'RISQUE' && (
            <select value={form.risqueId} onChange={e => setForm(f => ({ ...f, risqueId: e.target.value }))} className="w-full px-2 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm">
              <option value="">{d.risque}…</option>
              {risques.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
            </select>
          )}
          <input value={form.intitule} onChange={e => setForm(f => ({ ...f, intitule: e.target.value }))} placeholder={d.intitulePlaceholder} className="w-full px-2 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm" />
          <textarea value={form.motif} onChange={e => setForm(f => ({ ...f, motif: e.target.value }))} placeholder={d.motifPlaceholder} rows={2} className="w-full px-2 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm" />
          <textarea value={form.mesures} onChange={e => setForm(f => ({ ...f, mesures: e.target.value }))} placeholder={d.mesuresPlaceholder} rows={2} className="w-full px-2 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm" />
          <button onClick={submitCreate} disabled={busy} className="btn-primary text-sm disabled:opacity-50">{d.submit}</button>
        </div>
      )}

      {/* Liste */}
      {list.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">{d.empty}</p>
      ) : (
        <ul className="space-y-2">
          {list.map(x => {
            const etat = etatDerogation({ statut: x.statut, dateFin: x.dateFin }, alerteJours)
            const jours = joursAvantExpiration(x.dateFin)
            const rbac = { statut: x.statut, demandeurId: x.demandeurId, avisRssiPar: x.avisRssiPar }
            const canAvis = canAvisRssiDerogation(user, rbac)
            const canDouble = canDoubleRegardDerogation(user, rbac)
            const canVal = canValiderDerogation(user, rbac)
            const canRev = canRevoquerDerogation(user, rbac)
            const canClo = canCloturerDerogation(user, rbac, canEdit)
            const canProlong = x.statut === 'ACTIVE' && (canEdit || currentUserRole === 'RSSI')
            const hasAction = canAvis || canDouble || canVal || canRev || canClo || canProlong
            return (
              <li key={x.id} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{x.intitule}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {(d.portees as Record<string, string>)[x.portee] ?? x.portee}
                      {x.referentiel && ` · ${x.referentiel}`}{x.ref && ` · ${x.ref}`}
                    </p>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${BADGE[etat]}`}>
                    {(d.statuts as Record<string, string>)[etat] ?? etat}
                  </span>
                </div>
                {x.statut === 'ACTIVE' && x.dateFin && (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                    {jours >= 0 ? d.expiresIn.replace('{n}', String(jours)) : d.expiredSince.replace('{n}', String(-jours))}
                    {' · '}{d.validUntil} {formatDate(x.dateFin, locale)}
                  </p>
                )}
                {hasAction && (
                  <div className="mt-2">
                    <button onClick={() => setOpenId(openId === x.id ? null : x.id)} className="text-xs text-ebios-600 dark:text-ebios-300 hover:underline">
                      {openId === x.id ? d.cancel : '⚙︎ Actions'}
                    </button>
                    {openId === x.id && (
                      <ActionRow d={d} busy={busy}
                        onAvis={(fav, dbl, c) => transition(x.id, { action: 'AVIS_RSSI', favorable: fav, demandeDoubleRegard: dbl, commentaire: c })}
                        onDouble={(fav, c) => transition(x.id, { action: 'DOUBLE_REGARD', favorable: fav, commentaire: c })}
                        onValider={() => transition(x.id, { action: 'VALIDER' })}
                        onRejeter={c => transition(x.id, { action: 'REJETER', commentaire: c })}
                        onProlonger={(dt, c) => transition(x.id, { action: 'PROLONGER', nouvelleDateFin: dt || undefined, commentaire: c })}
                        onRevoquer={c => transition(x.id, { action: 'REVOQUER', commentaire: c })}
                        show={{ canAvis, canDouble, canVal, canRev, canProlong, canClo }} />
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// Barre d'actions contextuelle (avec un champ commentaire commun).
function ActionRow({ d, busy, show, onAvis, onDouble, onValider, onRejeter, onProlonger, onRevoquer }: {
  d: Record<string, unknown>
  busy: boolean
  show: { canAvis: boolean; canDouble: boolean; canVal: boolean; canRev: boolean; canProlong: boolean; canClo: boolean }
  onAvis: (fav: boolean, dbl: boolean, c: string) => void
  onDouble: (fav: boolean, c: string) => void
  onValider: () => void
  onRejeter: (c: string) => void
  onProlonger: (dt: string, c: string) => void
  onRevoquer: (c: string) => void
}) {
  const [c, setC] = useState('')
  const [dbl, setDbl] = useState(false)
  const [dt, setDt] = useState('')
  const s = d as Record<string, string>
  const btn = 'text-xs px-2 py-1 rounded font-medium disabled:opacity-50'
  return (
    <div className="mt-2 space-y-2 p-2 rounded bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700">
      <textarea value={c} onChange={e => setC(e.target.value)} placeholder={s.commentairePlaceholder} rows={2} className="w-full px-2 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-xs" />
      <div className="flex flex-wrap gap-2">
        {show.canAvis && <>
          <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={dbl} onChange={e => setDbl(e.target.checked)} />{s.demanderDoubleRegard}</label>
          <button disabled={busy} onClick={() => onAvis(true, dbl, c)} className={`${btn} bg-green-600 text-white`}>{s.avisFavorable}</button>
          <button disabled={busy} onClick={() => onAvis(false, false, c)} className={`${btn} bg-red-600 text-white`}>{s.avisDefavorable}</button>
        </>}
        {show.canDouble && <>
          <button disabled={busy} onClick={() => onDouble(true, c)} className={`${btn} bg-green-600 text-white`}>{s.doubleRegardFavorable}</button>
          <button disabled={busy} onClick={() => onDouble(false, c)} className={`${btn} bg-red-600 text-white`}>{s.doubleRegardDefavorable}</button>
        </>}
        {show.canVal && <>
          <button disabled={busy} onClick={onValider} className={`${btn} bg-green-600 text-white`}>{s.valider}</button>
          <button disabled={busy} onClick={() => onRejeter(c)} className={`${btn} bg-red-600 text-white`}>{s.rejeter}</button>
        </>}
        {show.canProlong && <>
          <input type="date" value={dt} onChange={e => setDt(e.target.value)} className="text-xs px-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600" />
          <button disabled={busy} onClick={() => onProlonger(dt, c)} className={`${btn} bg-blue-600 text-white`}>{s.prolonger}</button>
        </>}
        {show.canRev && <button disabled={busy} onClick={() => onRevoquer(c)} className={`${btn} bg-gray-600 text-white`}>{s.revoquer}</button>}
      </div>
    </div>
  )
}
