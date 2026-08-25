'use client'

import { AlertTriangle, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { MISSION_STATUTS, CONSTAT_STATUTS, CONSTAT_SOURCES, MISSION_TYPES, MISSION_RECURRENCES, transitionMissionAutorisee } from '@/lib/audit'
import { deduireResultatChecklist } from '@/lib/controle'

interface Synthese { total: number; ouverts: number; resolus: number; enRetard: number; critiques: number; tauxResolution: number }
type ChecklistStatut = 'OK' | 'KO' | 'NA'
interface ProgrammeResultat { label: string; statut: ChecklistStatut; commentaire?: string | null }
interface Mission {
  id: string; intitule: string; objectif: string | null; perimetre: string | null
  responsable: string | null; dateDebut: string | null; dateFin: string | null
  statut: string; synthese: Synthese
  programme: string[]; programmeResultats: ProgrammeResultat[]
  processusIds: string[]; controleIds: string[]
  type: string; recurrence: string
}
type ProcLite = { id: string; nom: string }
type CtrlLite = { id: string; intitule: string; niveau: string }
interface Constat {
  id: string; intitule: string; description: string | null; recommandation: string | null
  criticite: number | null; source: string; responsableAction: string | null
  echeance: string | null; statut: string; riskItemId: string | null; riskIntitule: string | null
  enRetard: boolean
}
type Risk = { id: string; intitule: string }

type MForm = { intitule: string; objectif: string; perimetre: string; responsable: string; dateDebut: string; dateFin: string; programme: string[]; processusIds: string[]; controleIds: string[]; type: string; recurrence: string }
const EMPTY_M: MForm = { intitule: '', objectif: '', perimetre: '', responsable: '', dateDebut: '', dateFin: '', programme: [], processusIds: [], controleIds: [], type: 'THEMATIQUE', recurrence: 'NONE' }
type CForm = { intitule: string; description: string; recommandation: string; criticite: string; source: string; responsableAction: string; echeance: string; statut: string; riskItemId: string }
const EMPTY_C: CForm = { intitule: '', description: '', recommandation: '', criticite: '', source: 'AUDIT_INTERNE', responsableAction: '', echeance: '', statut: 'OUVERT', riskItemId: '' }

const MISSION_BADGE: Record<string, string> = {
  PLANIFIEE: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  EN_COURS: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  CLOTUREE: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
}
const CHECK_BADGE: Record<string, string> = {
  OK: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  KO: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
  NA: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300',
}
const CONSTAT_BADGE: Record<string, string> = {
  OUVERT: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  EN_COURS: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  RESOLU: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  ACCEPTE: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
}
function critColor(n: number | null): string {
  if (n == null) return 'text-gray-400'
  if (n >= 4) return 'text-red-600 dark:text-red-400 font-semibold'
  if (n === 3) return 'text-amber-600 dark:text-amber-400'
  return 'text-gray-500'
}

export default function AuditManager({ canWrite }: { canWrite: boolean }) {
  const { t, locale } = useTranslation()
  const a = t.auditInterne
  const [missions, setMissions] = useState<Mission[]>([])
  const [risks, setRisks] = useState<Risk[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [constats, setConstats] = useState<Constat[]>([])
  const [loading, setLoading] = useState(true)
  const [mForm, setMForm] = useState<MForm>(EMPTY_M)
  const [showMForm, setShowMForm] = useState(false)
  const [cForm, setCForm] = useState<CForm>(EMPTY_C)
  const [cEditId, setCEditId] = useState<string | null>(null)
  const [showCForm, setShowCForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [procs, setProcs] = useState<ProcLite[]>([])
  const [ctrls, setCtrls] = useState<CtrlLite[]>([])
  // Cotation du programme en cours d'édition (mission dépliée) : missionId → résultats
  const [coteId, setCoteId] = useState<string | null>(null)
  const [cote, setCote] = useState<ProgrammeResultat[]>([])

  const jour = (d: string | null) => (d ? new Date(d).toLocaleDateString(locale) : '—')
  const lbl = (dict: unknown, k: string) => (dict as Record<string, string>)[k] ?? k
  function err(code: string) { return lbl(a.errors, code) }

  async function reload() {
    const [mm, rr, pp, cc] = await Promise.all([
      fetch('/api/audit/missions').then(x => x.ok ? x.json() : { missions: [] }),
      fetch('/api/risk-items').then(x => x.ok ? x.json() : { risks: [] }),
      fetch('/api/processus').then(x => x.ok ? x.json() : { processus: [] }),
      fetch('/api/controles').then(x => x.ok ? x.json() : { controles: [] }),
    ])
    setMissions(mm.missions ?? [])
    setRisks((rr.risks ?? []).map((r: Risk) => ({ id: r.id, intitule: r.intitule })))
    setProcs((pp.processus ?? []).map((p: ProcLite) => ({ id: p.id, nom: p.nom })))
    setCtrls((cc.controles ?? []).map((c: CtrlLite) => ({ id: c.id, intitule: c.intitule, niveau: c.niveau })))
    setLoading(false)
    if (openId) chargerConstats(openId)
  }
  async function chargerConstats(id: string) {
    const d = await fetch(`/api/audit/missions/${id}`).then(x => x.ok ? x.json() : { constats: [] })
    setConstats(d.constats ?? [])
  }
  useEffect(() => { reload() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function creerMission() {
    if (!mForm.intitule.trim()) { setError(err('intitule_requis')); return }
    setBusy(true); setError(null)
    const res = await fetch('/api/audit/missions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...mForm, objectif: mForm.objectif || null, perimetre: mForm.perimetre || null, responsable: mForm.responsable || null, dateDebut: mForm.dateDebut || null, dateFin: mForm.dateFin || null, programme: mForm.programme, processusIds: mForm.processusIds, controleIds: mForm.controleIds, type: mForm.type, recurrence: mForm.recurrence }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(err(data.error ?? 'erreur')); return }
    setMForm(EMPTY_M); setShowMForm(false); reload()
  }

  // Enregistre la cotation du programme d'audit (points de revue).
  async function enregistrerCotation(m: Mission) {
    setBusy(true); setError(null)
    const res = await fetch(`/api/audit/missions/${m.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intitule: m.intitule, programmeResultats: cote }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(err(data.error ?? 'erreur')); return }
    setCoteId(null); reload()
  }

  async function transitionnerMission(m: Mission, statut: string) {
    setBusy(true); setError(null); setFlash(null)
    const res = await fetch(`/api/audit/missions/${m.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intitule: m.intitule, statut }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(err(data.error ?? 'erreur')); return }
    if (data.suivanteId) setFlash(a.missionSuivantePlanifiee)
    reload()
  }

  async function supprimerMission(id: string) {
    if (!confirm(a.confirmDeleteMission)) return
    await fetch(`/api/audit/missions/${id}`, { method: 'DELETE' })
    if (openId === id) { setOpenId(null); setConstats([]) }
    reload()
  }

  function ouvrir(m: Mission) {
    const next = openId === m.id ? null : m.id
    setOpenId(next); setConstats([]); setShowCForm(false); setCEditId(null)
    if (next) chargerConstats(next)
  }

  function startConstat(c?: Constat) {
    setShowCForm(true); setError(null)
    if (c) {
      setCEditId(c.id)
      setCForm({ intitule: c.intitule, description: c.description ?? '', recommandation: c.recommandation ?? '', criticite: c.criticite?.toString() ?? '', source: c.source, responsableAction: c.responsableAction ?? '', echeance: c.echeance ? c.echeance.slice(0, 10) : '', statut: c.statut, riskItemId: c.riskItemId ?? '' })
    } else { setCEditId(null); setCForm(EMPTY_C) }
  }

  async function enregistrerConstat(missionId: string) {
    if (!cForm.intitule.trim()) { setError(err('intitule_requis')); return }
    setBusy(true); setError(null)
    const payload = { ...cForm, description: cForm.description || null, recommandation: cForm.recommandation || null, criticite: cForm.criticite || null, responsableAction: cForm.responsableAction || null, echeance: cForm.echeance || null, riskItemId: cForm.riskItemId || null }
    const res = await fetch(cEditId ? `/api/audit/constats/${cEditId}` : `/api/audit/missions/${missionId}/constats`, {
      method: cEditId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(err(data.error ?? 'erreur')); return }
    setShowCForm(false); setCEditId(null); reload()
  }

  async function supprimerConstat(id: string) {
    if (!confirm(a.confirmDeleteConstat)) return
    await fetch(`/api/audit/constats/${id}`, { method: 'DELETE' }); reload()
  }

  const inp = 'px-2 py-1.5 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm'
  const totalRetard = missions.reduce((s, m) => s + m.synthese.enRetard, 0)
  const totalCritiques = missions.reduce((s, m) => s + m.synthese.critiques, 0)
  const enCours = missions.filter(m => m.statut === 'EN_COURS').length

  return (
    <div>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100"><Search size={22} className="inline align-[-0.15em] mr-2" aria-hidden="true" /> {a.title}</h1>
        {canWrite && !showMForm && <button onClick={() => { setMForm(EMPTY_M); setShowMForm(true) }} className="btn-primary text-sm">{a.newMissionBtn}</button>}
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{a.subtitle}</p>
      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
      {flash && <p className="text-xs text-ebios-600 mb-3">{flash}</p>}

      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <Tile label={a.missionsEnCours} value={enCours} />
          <Tile label={a.constatsCritiques} value={totalCritiques} tone={totalCritiques > 0 ? 'red' : undefined} />
          <Tile label={a.recosEnRetard} value={totalRetard} tone={totalRetard > 0 ? 'amber' : undefined} />
        </div>
      )}

      {canWrite && showMForm && (
        <div className="card p-4 mb-5 space-y-3">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{a.newMissionTitle}</p>
          <input value={mForm.intitule} onChange={e => setMForm(f => ({ ...f, intitule: e.target.value }))} placeholder={a.missionIntitulePlaceholder} className={`${inp} w-full`} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <textarea value={mForm.objectif} onChange={e => setMForm(f => ({ ...f, objectif: e.target.value }))} placeholder={a.objectifPlaceholder} rows={2} className={inp} />
            <textarea value={mForm.perimetre} onChange={e => setMForm(f => ({ ...f, perimetre: e.target.value }))} placeholder={a.perimetrePlaceholder} rows={2} className={inp} />
          </div>
          {/* Programme d'audit : points de revue (coté à la clôture) */}
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{a.programme} <span className="text-gray-400">— {a.programmeHint}</span></div>
            <div className="space-y-1.5">
              {mForm.programme.map((pt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-5 text-right">{i + 1}.</span>
                  <input value={pt} onChange={e => setMForm(f => ({ ...f, programme: f.programme.map((p, j) => j === i ? e.target.value : p) }))} placeholder={a.programmePlaceholder} className={`${inp} flex-1`} />
                  <button type="button" onClick={() => setMForm(f => ({ ...f, programme: f.programme.filter((_, j) => j !== i) }))} className="text-xs text-red-500 hover:underline">{a.retirer}</button>
                </div>
              ))}
              <button type="button" onClick={() => setMForm(f => ({ ...f, programme: [...f.programme, ''] }))} className="text-xs text-ebios-600 hover:underline">+ {a.programmeAdd}</button>
            </div>
          </div>
          {/* Périmètre audité (N3→N1/N2) : processus et contrôles couverts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{a.perimetreProcessus} ({mForm.processusIds.length})</div>
              <div className="max-h-28 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
                {procs.length === 0 ? <div className="px-3 py-2 text-xs text-gray-400">—</div> : procs.map(p => (
                  <label key={p.id} className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                    <input type="checkbox" checked={mForm.processusIds.includes(p.id)} onChange={() => setMForm(f => ({ ...f, processusIds: f.processusIds.includes(p.id) ? f.processusIds.filter(x => x !== p.id) : [...f.processusIds, p.id] }))} />
                    <span className="text-gray-700 dark:text-gray-200 truncate" title={p.nom}>{p.nom}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{a.perimetreControles} ({mForm.controleIds.length})</div>
              <div className="max-h-28 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
                {ctrls.length === 0 ? <div className="px-3 py-2 text-xs text-gray-400">—</div> : ctrls.map(cc => (
                  <label key={cc.id} className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                    <input type="checkbox" checked={mForm.controleIds.includes(cc.id)} onChange={() => setMForm(f => ({ ...f, controleIds: f.controleIds.includes(cc.id) ? f.controleIds.filter(x => x !== cc.id) : [...f.controleIds, cc.id] }))} />
                    <span className="font-mono text-gray-400 shrink-0">{cc.niveau}</span>
                    <span className="text-gray-700 dark:text-gray-200 truncate" title={cc.intitule}>{cc.intitule}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <input value={mForm.responsable} onChange={e => setMForm(f => ({ ...f, responsable: e.target.value }))} placeholder={a.responsablePlaceholder} className={inp} />
            <label className="text-xs text-gray-500 dark:text-gray-400">{a.typeMission}
              <select value={mForm.type} onChange={e => setMForm(f => ({ ...f, type: e.target.value }))} className={`${inp} block mt-1`}>
                {MISSION_TYPES.map(tt => <option key={tt} value={tt}>{lbl(a.typeOpt, tt)}</option>)}
              </select>
            </label>
            <label className="text-xs text-gray-500 dark:text-gray-400">{a.recurrence}
              <select value={mForm.recurrence} onChange={e => setMForm(f => ({ ...f, recurrence: e.target.value }))} className={`${inp} block mt-1`} title={a.recurrenceHint}>
                {MISSION_RECURRENCES.map(rr => <option key={rr} value={rr}>{lbl(a.recurrenceOpt, rr)}</option>)}
              </select>
            </label>
            <label className="text-xs text-gray-500 dark:text-gray-400">{a.dateDebut}<input type="date" value={mForm.dateDebut} onChange={e => setMForm(f => ({ ...f, dateDebut: e.target.value }))} className={`${inp} block mt-1`} /></label>
            <label className="text-xs text-gray-500 dark:text-gray-400">{a.dateFin}<input type="date" value={mForm.dateFin} onChange={e => setMForm(f => ({ ...f, dateFin: e.target.value }))} className={`${inp} block mt-1`} /></label>
            <button onClick={creerMission} disabled={busy} className="btn-primary text-sm disabled:opacity-50">{a.add}</button>
            <button onClick={() => { setShowMForm(false); setError(null) }} className="text-sm text-gray-500 hover:text-gray-700">{a.cancel}</button>
          </div>
        </div>
      )}

      {loading ? <p className="text-gray-400">…</p>
        : missions.length === 0 ? <p className="text-gray-400 italic">{a.empty}</p>
        : (
          <div className="space-y-3">
            {missions.map(m => (
              <div key={m.id} className="card p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <button onClick={() => ouvrir(m)} className="text-left">
                      <span className="font-medium text-gray-800 dark:text-gray-100">{m.intitule}</span>
                      <span className="ml-2 text-gray-400 text-xs">{openId === m.id ? '▾' : '▸'}</span>
                    </button>
                    <span className="block text-xs text-gray-400">
                      {jour(m.dateDebut)} → {jour(m.dateFin)}{m.responsable && ` · ${m.responsable}`}
                      {m.type === 'PERIODIQUE' && <span className="ml-1.5 text-ebios-600 dark:text-ebios-300">· {lbl(a.typeOpt, 'PERIODIQUE')}{m.recurrence !== 'NONE' && ` ↻ ${lbl(a.recurrenceOpt, m.recurrence)}`}</span>}
                      {m.synthese.total > 0 && ` · ${a.constatsResume.replace('{r}', String(m.synthese.resolus)).replace('{t}', String(m.synthese.total))}`}
                      {m.synthese.enRetard > 0 && <> · <AlertTriangle size={13} className="inline align-[-0.15em] mr-0.5 text-amber-600" aria-hidden="true" />{m.synthese.enRetard}</>}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${MISSION_BADGE[m.statut]}`}>{lbl(a.missionStatuts, m.statut)}</span>
                    {canWrite && MISSION_STATUTS.filter(sx => sx !== m.statut && transitionMissionAutorisee(m.statut as never, sx)).map(sx => (
                      <button key={sx} onClick={() => transitionnerMission(m, sx)} disabled={busy} className="btn-secondary text-xs disabled:opacity-50">{lbl(a.missionActions, sx)}</button>
                    ))}
                    {canWrite && <button onClick={() => supprimerMission(m.id)} className="text-xs text-red-500 hover:underline">{a.delete}</button>}
                  </div>
                </div>

                {openId === m.id && (
                  <div className="mt-4 border-t border-gray-100 dark:border-gray-800 pt-3">
                    {/* Périmètre audité (N3 → 1ʳᵉ/2ᵉ ligne) */}
                    {(m.processusIds?.length > 0 || m.controleIds?.length > 0) && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                        {a.perimetreAudite} : {[...m.processusIds.map(id => procs.find(p => p.id === id)?.nom).filter(Boolean),
                          ...m.controleIds.map(id => ctrls.find(c => c.id === id)?.intitule).filter(Boolean)].join(' · ') || '—'}
                      </p>
                    )}

                    {/* Programme d'audit : cotation des points de revue */}
                    {m.programme?.length > 0 && (
                      <div className="mb-3 rounded-lg border border-gray-100 dark:border-gray-800 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{a.programme}</p>
                          {canWrite && coteId !== m.id && (
                            <button onClick={() => { setCoteId(m.id); setCote(m.programme.map(label => { const ex = (m.programmeResultats ?? []).find(r => r.label === label); return { label, statut: ex?.statut ?? 'OK', commentaire: ex?.commentaire ?? '' } })) }} className="btn-secondary text-xs">{a.coter}</button>
                          )}
                        </div>
                        {coteId === m.id ? (
                          <div className="space-y-1.5">
                            <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
                              {cote.map((pt, i) => (
                                <div key={i} className="flex flex-wrap items-center gap-2 px-3 py-1.5">
                                  <span className="text-xs text-gray-700 dark:text-gray-200 flex-1 min-w-[160px]" title={pt.label}>{pt.label}</span>
                                  <div className="flex gap-1">
                                    {(['OK', 'KO', 'NA'] as ChecklistStatut[]).map(st => (
                                      <button key={st} type="button" onClick={() => setCote(c => c.map((p, j) => j === i ? { ...p, statut: st } : p))}
                                        className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${pt.statut === st ? CHECK_BADGE[st] : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'}`}>{lbl(a.programmeStatuts, st)}</button>
                                    ))}
                                  </div>
                                  <input value={pt.commentaire ?? ''} onChange={e => setCote(c => c.map((p, j) => j === i ? { ...p, commentaire: e.target.value } : p))} placeholder={a.programmeComment} className={`${inp} text-xs flex-1 min-w-[140px]`} />
                                </div>
                              ))}
                            </div>
                            {(() => { const d = deduireResultatChecklist(cote as never); return d && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">{a.programmeSynthese
                                .replace('{ok}', String(cote.filter(c => c.statut === 'OK').length))
                                .replace('{ko}', String(cote.filter(c => c.statut === 'KO').length))
                                .replace('{na}', String(cote.filter(c => c.statut === 'NA').length))}</p>
                            )})()}
                            <div className="flex gap-2">
                              <button onClick={() => enregistrerCotation(m)} disabled={busy} className="btn-primary text-xs disabled:opacity-50">{a.add}</button>
                              <button onClick={() => setCoteId(null)} className="text-xs text-gray-500 hover:text-gray-700">{a.cancel}</button>
                            </div>
                          </div>
                        ) : (
                          <ul className="space-y-1">
                            {m.programme.map((label, i) => {
                              const r = (m.programmeResultats ?? []).find(x => x.label === label)
                              return (
                                <li key={i} className="flex items-center gap-2 text-xs">
                                  {r ? <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${CHECK_BADGE[r.statut]}`}>{lbl(a.programmeStatuts, r.statut)}</span> : <span className="text-[10px] text-gray-400">—</span>}
                                  <span className="text-gray-700 dark:text-gray-200">{label}</span>
                                  {r?.commentaire && <span className="text-gray-500 dark:text-gray-400 truncate">· {r.commentaire}</span>}
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{a.constats}</p>
                      {canWrite && !showCForm && <button onClick={() => startConstat()} className="btn-secondary text-xs">{a.newConstatBtn}</button>}
                    </div>

                    {canWrite && showCForm && (
                      <div className="rounded-lg bg-gray-50 dark:bg-gray-800/40 p-3 mb-3 space-y-2">
                        <input value={cForm.intitule} onChange={e => setCForm(f => ({ ...f, intitule: e.target.value }))} placeholder={a.constatIntitulePlaceholder} className={`${inp} w-full`} />
                        <textarea value={cForm.description} onChange={e => setCForm(f => ({ ...f, description: e.target.value }))} placeholder={a.descriptionPlaceholder} rows={2} className={`${inp} w-full`} />
                        <textarea value={cForm.recommandation} onChange={e => setCForm(f => ({ ...f, recommandation: e.target.value }))} placeholder={a.recommandationPlaceholder} rows={2} className={`${inp} w-full`} />
                        <div className="flex flex-wrap gap-2 items-end text-xs text-gray-500 dark:text-gray-400">
                          <label>{a.criticite}
                            <select value={cForm.criticite} onChange={e => setCForm(f => ({ ...f, criticite: e.target.value }))} className={`${inp} block mt-1`}>
                              <option value="">—</option>{[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </label>
                          <label>{a.source}
                            <select value={cForm.source} onChange={e => setCForm(f => ({ ...f, source: e.target.value }))} className={`${inp} block mt-1`}>
                              {CONSTAT_SOURCES.map(sx => <option key={sx} value={sx}>{lbl(a.sources, sx)}</option>)}
                            </select>
                          </label>
                          <label>{a.suivi}
                            <select value={cForm.statut} onChange={e => setCForm(f => ({ ...f, statut: e.target.value }))} className={`${inp} block mt-1`}>
                              {CONSTAT_STATUTS.map(sx => <option key={sx} value={sx}>{lbl(a.constatStatuts, sx)}</option>)}
                            </select>
                          </label>
                          <label>{a.echeance}<input type="date" value={cForm.echeance} onChange={e => setCForm(f => ({ ...f, echeance: e.target.value }))} className={`${inp} block mt-1`} /></label>
                          <input value={cForm.responsableAction} onChange={e => setCForm(f => ({ ...f, responsableAction: e.target.value }))} placeholder={a.responsableActionPlaceholder} className={inp} />
                          <select value={cForm.riskItemId} onChange={e => setCForm(f => ({ ...f, riskItemId: e.target.value }))} className={inp}>
                            <option value="">{a.riskNone}</option>
                            {risks.map(r => <option key={r.id} value={r.id}>{r.intitule}</option>)}
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => enregistrerConstat(m.id)} disabled={busy} className="btn-primary text-sm disabled:opacity-50">{a.save}</button>
                          <button onClick={() => { setShowCForm(false); setCEditId(null); setError(null) }} className="text-sm text-gray-500 hover:text-gray-700">{a.cancel}</button>
                        </div>
                      </div>
                    )}

                    {constats.length === 0 ? <p className="text-xs text-gray-400 italic">{a.aucunConstat}</p> : (
                      <ul className="space-y-2">
                        {constats.map(cc => (
                          <li key={cc.id} className="text-sm border-b border-gray-100 dark:border-gray-800 pb-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <span className={`mr-2 ${critColor(cc.criticite)}`}>C{cc.criticite ?? '—'}</span>
                                <span className="font-medium text-gray-800 dark:text-gray-100">{cc.intitule}</span>
                                {cc.source === 'REGULATEUR' && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">{lbl(a.sources, 'REGULATEUR')}</span>}
                                {cc.recommandation && <span className="block text-xs text-gray-500 dark:text-gray-400">→ {cc.recommandation}</span>}
                                <span className="block text-xs text-gray-400">
                                  {cc.responsableAction && `${cc.responsableAction} · `}{cc.echeance && jour(cc.echeance)}
                                  {cc.riskIntitule && ` · ${cc.riskIntitule}`}
                                  {cc.enRetard && <span className="text-red-500"> · {a.enRetard}</span>}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 whitespace-nowrap">
                                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${CONSTAT_BADGE[cc.statut]}`}>{lbl(a.constatStatuts, cc.statut)}</span>
                                {canWrite && <>
                                  <button onClick={() => startConstat(cc)} className="text-xs text-ebios-600 hover:underline">{a.edit}</button>
                                  <button onClick={() => supprimerConstat(cc.id)} className="text-xs text-red-500 hover:underline">{a.delete}</button>
                                </>}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
    </div>
  )
}

function Tile({ label, value, tone }: { label: string; value: number; tone?: 'red' | 'amber' }) {
  const color = tone === 'red' ? 'text-red-600 dark:text-red-400' : tone === 'amber' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-800 dark:text-gray-100'
  return (
    <div className="card p-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}
