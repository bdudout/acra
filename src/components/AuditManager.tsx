'use client'

import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { MISSION_STATUTS, CONSTAT_STATUTS, CONSTAT_SOURCES, transitionMissionAutorisee } from '@/lib/audit'

interface Synthese { total: number; ouverts: number; resolus: number; enRetard: number; critiques: number; tauxResolution: number }
interface Mission {
  id: string; intitule: string; objectif: string | null; perimetre: string | null
  responsable: string | null; dateDebut: string | null; dateFin: string | null
  statut: string; synthese: Synthese
}
interface Constat {
  id: string; intitule: string; description: string | null; recommandation: string | null
  criticite: number | null; source: string; responsableAction: string | null
  echeance: string | null; statut: string; riskItemId: string | null; riskIntitule: string | null
  enRetard: boolean
}
type Risk = { id: string; intitule: string }

type MForm = { intitule: string; objectif: string; perimetre: string; responsable: string; dateDebut: string; dateFin: string }
const EMPTY_M: MForm = { intitule: '', objectif: '', perimetre: '', responsable: '', dateDebut: '', dateFin: '' }
type CForm = { intitule: string; description: string; recommandation: string; criticite: string; source: string; responsableAction: string; echeance: string; statut: string; riskItemId: string }
const EMPTY_C: CForm = { intitule: '', description: '', recommandation: '', criticite: '', source: 'AUDIT_INTERNE', responsableAction: '', echeance: '', statut: 'OUVERT', riskItemId: '' }

const MISSION_BADGE: Record<string, string> = {
  PLANIFIEE: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  EN_COURS: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  CLOTUREE: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
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

  const jour = (d: string | null) => (d ? new Date(d).toLocaleDateString(locale) : '—')
  const lbl = (dict: unknown, k: string) => (dict as Record<string, string>)[k] ?? k
  function err(code: string) { return lbl(a.errors, code) }

  async function reload() {
    const [mm, rr] = await Promise.all([
      fetch('/api/audit/missions').then(x => x.ok ? x.json() : { missions: [] }),
      fetch('/api/risk-items').then(x => x.ok ? x.json() : { risks: [] }),
    ])
    setMissions(mm.missions ?? [])
    setRisks((rr.risks ?? []).map((r: Risk) => ({ id: r.id, intitule: r.intitule })))
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
      body: JSON.stringify({ ...mForm, objectif: mForm.objectif || null, perimetre: mForm.perimetre || null, responsable: mForm.responsable || null, dateDebut: mForm.dateDebut || null, dateFin: mForm.dateFin || null }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(err(data.error ?? 'erreur')); return }
    setMForm(EMPTY_M); setShowMForm(false); reload()
  }

  async function transitionnerMission(m: Mission, statut: string) {
    setBusy(true); setError(null)
    const res = await fetch(`/api/audit/missions/${m.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intitule: m.intitule, statut }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(err(data.error ?? 'erreur')); return }
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
          <div className="flex flex-wrap gap-3 items-end">
            <input value={mForm.responsable} onChange={e => setMForm(f => ({ ...f, responsable: e.target.value }))} placeholder={a.responsablePlaceholder} className={inp} />
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
                      {m.synthese.total > 0 && ` · ${a.constatsResume.replace('{r}', String(m.synthese.resolus)).replace('{t}', String(m.synthese.total))}`}
                      {m.synthese.enRetard > 0 && ` · ⚠ ${m.synthese.enRetard}`}
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
