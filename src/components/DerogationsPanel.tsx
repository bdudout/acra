'use client'

import { IdCard } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { formatDate } from '@/lib/format'
import AutocompleteInput from '@/components/AutocompleteInput'
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
  const [doubleRegardActif, setDoubleRegardActif] = useState(true)
  const [dureeDefaut, setDureeDefaut] = useState(180)
  const [dureeMax, setDureeMax] = useState(365)
  // Référentiels de l'org (mesures existantes) + exigences du référentiel choisi.
  const [refs, setRefs] = useState<{ code: string; nom: string }[]>([])
  const [exigences, setExigences] = useState<{ ref: string; nom: string }[]>([])
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
    if (typeof data.config?.doubleRegard === 'boolean') setDoubleRegardActif(data.config.doubleRegard)
    if (typeof data.config?.dureeDefautJours === 'number') setDureeDefaut(data.config.dureeDefautJours)
    if (typeof data.config?.dureeMaxJours === 'number') setDureeMax(data.config.dureeMaxJours)
  }
  useEffect(() => { reload() }, [analyseId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Référentiels de l'org (pour la sélection d'une mesure de référentiel existant).
  useEffect(() => {
    fetch('/api/referentiels').then(r => r.ok ? r.json() : null).then(d => {
      if (Array.isArray(d?.referentiels)) setRefs(d.referentiels.map((x: { code: string; nom: string }) => ({ code: x.code, nom: x.nom })))
    }).catch(() => { /* dégrade en texte libre */ })
  }, [])

  // ── Création ──
  const [form, setForm] = useState({ portee: 'CONTROLE', referentiel: referentielCourant ?? '', ref: '', risqueId: '', intitule: '', motif: '', mesures: '', dureeJours: '' })

  // Exigences du référentiel sélectionné (portée CONTROLE) → choix de la mesure.
  useEffect(() => {
    if (form.portee !== 'CONTROLE' || !form.referentiel || !refs.some(r => r.code === form.referentiel)) { setExigences([]); return }
    fetch(`/api/referentiels/exigences?code=${encodeURIComponent(form.referentiel)}`).then(r => r.ok ? r.json() : null).then(d => {
      if (Array.isArray(d?.exigences)) setExigences(d.exigences.map((e: { ref: string; nom: string }) => ({ ref: e.ref, nom: e.nom })))
    }).catch(() => setExigences([]))
  }, [form.portee, form.referentiel, refs])
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
        dureeJours: form.dureeJours ? Number(form.dureeJours) : undefined,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError((d.errors as Record<string, string>)[data.error] ?? data.error ?? 'Erreur'); return }
    setCreating(false)
    setForm({ portee: 'CONTROLE', referentiel: referentielCourant ?? '', ref: '', risqueId: '', intitule: '', motif: '', mesures: '', dureeJours: '' })
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
        <h3 className="font-semibold text-gray-800 dark:text-gray-100"><IdCard size={22} className="inline align-[-0.15em] mr-2" aria-hidden="true" /> {d.title}</h3>
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
            {(['CONTROLE', 'RISQUE'] as const).map(p => <option key={p} value={p}>{(d.portees as Record<string, string>)[p]}</option>)}
          </select>
          {form.portee === 'CONTROLE' && (
            // Référentiel existant de l'org (ISO/PSSI…) ; repli texte libre si aucun.
            refs.length > 0 ? (
              <select value={form.referentiel} onChange={e => setForm(f => ({ ...f, referentiel: e.target.value, ref: '' }))} className="w-full px-2 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm">
                <option value="">{d.referentiel}…</option>
                {refs.map(r => <option key={r.code} value={r.code}>{r.nom}</option>)}
              </select>
            ) : (
              <input value={form.referentiel} onChange={e => setForm(f => ({ ...f, referentiel: e.target.value }))} placeholder={d.referentiel} className="w-full px-2 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm" />
            )
          )}
          {form.portee === 'CONTROLE' && (
            // Mesure du référentiel (exigence/contrôle) ; autocomplétion via datalist.
            exigences.length > 0 ? (
              <select value={form.ref}
                onChange={e => { const ex = exigences.find(x => x.ref === e.target.value); setForm(f => ({ ...f, ref: e.target.value, intitule: f.intitule || (ex ? `[${ex.ref}] ${ex.nom}` : f.intitule) })) }}
                className="w-full px-2 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm">
                <option value="">{d.controle}…</option>
                {exigences.map(ex => <option key={ex.ref} value={ex.ref}>[{ex.ref}] {ex.nom}</option>)}
              </select>
            ) : (
              <input value={form.ref} onChange={e => setForm(f => ({ ...f, ref: e.target.value }))} placeholder={d.controle} className="w-full px-2 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm" />
            )
          )}
          {form.portee === 'RISQUE' && (
            <select value={form.risqueId} onChange={e => setForm(f => ({ ...f, risqueId: e.target.value }))} className="w-full px-2 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm">
              <option value="">{d.risque}…</option>
              {risques.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
            </select>
          )}
          <AutocompleteInput field="mesure" lang={locale} value={form.intitule} onChange={v => setForm(f => ({ ...f, intitule: v }))}
            placeholder={d.intitulePlaceholder} className="w-full px-2 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm" />
          <textarea value={form.motif} onChange={e => setForm(f => ({ ...f, motif: e.target.value }))} placeholder={d.motifPlaceholder} rows={2} className="w-full px-2 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm" />
          <textarea value={form.mesures} onChange={e => setForm(f => ({ ...f, mesures: e.target.value }))} placeholder={d.mesuresPlaceholder} rows={2} className="w-full px-2 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm" />
          {/* Date butoir = durée (jours), plafonnée au délai maximal configuré. */}
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <span>{d.dureeLabel}</span>
            <input type="number" min={1} max={dureeMax} value={form.dureeJours}
              onChange={e => setForm(f => ({ ...f, dureeJours: e.target.value }))}
              placeholder={String(dureeDefaut)} className="w-24 px-2 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm" />
            <span className="text-gray-400">{d.dureeMaxHint?.replace('{max}', String(dureeMax))}</span>
          </label>
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
                        onCloturer={(preuves, c) => transition(x.id, { action: 'CLOTURER', preuves, commentaire: c })}
                        doubleRegardActif={doubleRegardActif}
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

// Lit des fichiers en data URL (comme les logos d'organisation), cap 5 × ~1 Mo.
function readPreuves(files: FileList | null): Promise<{ nom: string; mime: string; taille: number; dataUrl: string }[]> {
  const list = Array.from(files ?? []).slice(0, 5).filter(f => f.size <= 1_000_000)
  return Promise.all(list.map(f => new Promise<{ nom: string; mime: string; taille: number; dataUrl: string }>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve({ nom: f.name.slice(0, 200), mime: f.type, taille: f.size, dataUrl: String(r.result) })
    r.onerror = reject
    r.readAsDataURL(f)
  })))
}

// Barre d'actions contextuelle (avec un champ commentaire commun).
function ActionRow({ d, busy, show, doubleRegardActif, onAvis, onDouble, onValider, onRejeter, onProlonger, onRevoquer, onCloturer }: {
  d: Record<string, unknown>
  busy: boolean
  doubleRegardActif: boolean
  show: { canAvis: boolean; canDouble: boolean; canVal: boolean; canRev: boolean; canProlong: boolean; canClo: boolean }
  onAvis: (fav: boolean, dbl: boolean, c: string) => void
  onDouble: (fav: boolean, c: string) => void
  onValider: () => void
  onRejeter: (c: string) => void
  onProlonger: (dt: string, c: string) => void
  onRevoquer: (c: string) => void
  onCloturer: (preuves: { nom: string; mime: string; taille: number; dataUrl: string }[], c: string) => void
}) {
  const [c, setC] = useState('')
  const [dbl, setDbl] = useState(false)
  const [dt, setDt] = useState('')
  const [preuves, setPreuves] = useState<{ nom: string; mime: string; taille: number; dataUrl: string }[]>([])
  const s = d as Record<string, string>
  const btn = 'text-xs px-2 py-1 rounded font-medium disabled:opacity-50'
  return (
    <div className="mt-2 space-y-2 p-2 rounded bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700">
      <textarea value={c} onChange={e => setC(e.target.value)} placeholder={s.commentairePlaceholder} rows={2} className="w-full px-2 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-xs" />
      <div className="flex flex-wrap gap-2">
        {show.canAvis && <>
          {doubleRegardActif && <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={dbl} onChange={e => setDbl(e.target.checked)} />{s.demanderDoubleRegard}</label>}
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
      {show.canClo && (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-200 dark:border-gray-700">
          <input type="file" multiple onChange={async e => setPreuves(await readPreuves(e.target.files))}
            className="text-xs text-gray-600 dark:text-gray-300 file:mr-2 file:text-xs file:rounded file:border-0 file:bg-gray-200 dark:file:bg-gray-700 file:px-2 file:py-1" />
          <button disabled={busy || preuves.length === 0} onClick={() => onCloturer(preuves, c)} className={`${btn} bg-slate-700 text-white`}>{s.cloturer}</button>
          {preuves.length > 0 && <span className="text-[11px] text-gray-500">{preuves.length} ✓</span>}
        </div>
      )}
    </div>
  )
}
