'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { EFFICACITES, suggestResiduel, type EfficaciteControle } from '@/lib/campagne'

interface Avancement {
  total: number; aCoter: number; cotees: number; validees: number; rejetees: number
  tauxValidation: number; complete: boolean
}
interface Campagne {
  id: string; intitule: string; description: string | null
  dateDebut: string | null; dateFin: string | null
  statut: string; avancement: Avancement
}
interface Evaluation {
  id: string; riskIntitule: string; riskProprietaire: string | null
  origineGraviteInherente: number | null; origineVraisemblanceInherente: number | null
  origineGraviteResiduelle: number | null; origineVraisemblanceResiduelle: number | null
  graviteInherente: number | null; vraisemblanceInherente: number | null
  efficaciteControles: string | null
  graviteResiduelle: number | null; vraisemblanceResiduelle: number | null
  commentaire: string | null; statut: string
  evaluateurId: string | null; motifRejet: string | null
}

type Form = { intitule: string; description: string; dateDebut: string; dateFin: string }
const EMPTY: Form = { intitule: '', description: '', dateDebut: '', dateFin: '' }

type CoteForm = {
  graviteInherente: string; vraisemblanceInherente: string; efficaciteControles: string
  graviteResiduelle: string; vraisemblanceResiduelle: string; commentaire: string
}

const STATUT_BADGE: Record<string, string> = {
  BROUILLON: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  OUVERTE: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  CLOTUREE: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
}
const EVAL_BADGE: Record<string, string> = {
  A_COTER: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  COTEE: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  VALIDEE: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  REJETEE: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
}

export default function CampagnesManager({ canPilot, canCote }: { canPilot: boolean; canCote: boolean }) {
  const { t, locale } = useTranslation()
  const c = t.campagnes
  const [campagnes, setCampagnes] = useState<Campagne[]>([])
  const [ouverte, setOuverte] = useState<string | null>(null)
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Form>(EMPTY)
  const [showForm, setShowForm] = useState(false)
  const [coteId, setCoteId] = useState<string | null>(null)
  const [cote, setCote] = useState<CoteForm>({ graviteInherente: '', vraisemblanceInherente: '', efficaciteControles: '', graviteResiduelle: '', vraisemblanceResiduelle: '', commentaire: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const jour = (d: string | null) => (d ? new Date(d).toLocaleDateString(locale) : '—')
  const lbl = (dict: unknown, k: string) => (dict as Record<string, string>)[k] ?? k
  function err(code: string) { return lbl(c.errors, code) }

  async function reload() {
    const d = await fetch('/api/campagnes').then(x => x.ok ? x.json() : { campagnes: [] })
    setCampagnes(d.campagnes ?? []); setLoading(false)
    if (ouverte) chargerEvaluations(ouverte)
  }
  async function chargerEvaluations(id: string) {
    const d = await fetch(`/api/campagnes/${id}`).then(x => x.ok ? x.json() : { evaluations: [] })
    setEvaluations(d.evaluations ?? [])
  }
  useEffect(() => { reload() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function creer() {
    if (!form.intitule.trim()) { setError(err('intitule_requis')); return }
    setBusy(true); setError(null)
    const res = await fetch('/api/campagnes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intitule: form.intitule, description: form.description || null, dateDebut: form.dateDebut || null, dateFin: form.dateFin || null }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(err(data.error ?? 'erreur')); return }
    setForm(EMPTY); setShowForm(false); reload()
  }

  async function transitionner(x: Campagne, statut: string) {
    if (statut === 'CLOTUREE' && !confirm(c.confirmCloture)) return
    setBusy(true); setError(null)
    const res = await fetch(`/api/campagnes/${x.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ statut }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(err(data.error ?? 'erreur')); return }
    reload()
  }

  async function supprimer(id: string) {
    if (!confirm(c.confirmDelete)) return
    await fetch(`/api/campagnes/${id}`, { method: 'DELETE' })
    if (ouverte === id) { setOuverte(null); setEvaluations([]) }
    reload()
  }

  function ouvrirDetail(x: Campagne) {
    const next = ouverte === x.id ? null : x.id
    setOuverte(next); setEvaluations([]); setCoteId(null)
    if (next) chargerEvaluations(next)
  }

  function startCote(e: Evaluation) {
    setCoteId(e.id); setError(null)
    setCote({
      graviteInherente: e.graviteInherente?.toString() ?? '',
      vraisemblanceInherente: e.vraisemblanceInherente?.toString() ?? '',
      efficaciteControles: e.efficaciteControles ?? '',
      graviteResiduelle: e.graviteResiduelle?.toString() ?? '',
      vraisemblanceResiduelle: e.vraisemblanceResiduelle?.toString() ?? '',
      commentaire: e.commentaire ?? '',
    })
  }

  async function enregistrerCote(campagneId: string, e: Evaluation) {
    setBusy(true); setError(null)
    const res = await fetch(`/api/campagnes/${campagneId}/evaluations/${e.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...cote, statut: 'COTEE' }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(err(data.error ?? 'erreur')); return }
    setCoteId(null); reload()
  }

  async function statuerEvaluation(campagneId: string, e: Evaluation, statut: 'VALIDEE' | 'REJETEE') {
    let motifRejet = ''
    if (statut === 'REJETEE') {
      motifRejet = prompt(c.motifRejetPrompt) ?? ''
      if (!motifRejet.trim()) return
    }
    setBusy(true); setError(null)
    const res = await fetch(`/api/campagnes/${campagneId}/evaluations/${e.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut, motifRejet }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(err(data.error ?? 'erreur')); return }
    reload()
  }

  const inp = 'px-2 py-1.5 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm'
  const coteSelect = (v: string, set: (s: string) => void) => (
    <select value={v} onChange={e => set(e.target.value)} className={inp}>
      <option value="">—</option>
      {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
    </select>
  )
  const suggestion = suggestResiduel(
    cote.vraisemblanceInherente ? Number(cote.vraisemblanceInherente) : null,
    (cote.efficaciteControles || null) as EfficaciteControle | null,
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">🗳️ {c.title}</h1>
        {canPilot && !showForm && <button onClick={() => { setForm(EMPTY); setShowForm(true) }} className="btn-primary text-sm">{c.newBtn}</button>}
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{c.subtitle}</p>
      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

      {canPilot && showForm && (
        <div className="card p-4 mb-5 space-y-3">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{c.addTitle}</p>
          <input value={form.intitule} onChange={e => setForm(f => ({ ...f, intitule: e.target.value }))} placeholder={c.intitulePlaceholder} className={`${inp} w-full`} />
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder={c.descriptionPlaceholder} rows={2} className={`${inp} w-full`} />
          <div className="flex flex-wrap gap-3 items-end">
            <label className="text-xs text-gray-500 dark:text-gray-400">{c.dateDebut}
              <input type="date" value={form.dateDebut} onChange={e => setForm(f => ({ ...f, dateDebut: e.target.value }))} className={`${inp} block mt-1`} />
            </label>
            <label className="text-xs text-gray-500 dark:text-gray-400">{c.dateFin}
              <input type="date" value={form.dateFin} onChange={e => setForm(f => ({ ...f, dateFin: e.target.value }))} className={`${inp} block mt-1`} />
            </label>
            <button onClick={creer} disabled={busy} className="btn-primary text-sm disabled:opacity-50">{c.add}</button>
            <button onClick={() => { setShowForm(false); setError(null) }} className="text-sm text-gray-500 hover:text-gray-700">{c.cancel}</button>
          </div>
        </div>
      )}

      {loading ? <p className="text-gray-400">…</p>
        : campagnes.length === 0 ? <p className="text-gray-400 italic">{c.empty}</p>
        : (
          <div className="space-y-3">
            {campagnes.map(x => (
              <div key={x.id} className="card p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <button onClick={() => ouvrirDetail(x)} className="text-left">
                      <span className="font-medium text-gray-800 dark:text-gray-100">{x.intitule}</span>
                      <span className="ml-2 text-gray-400 text-xs">{ouverte === x.id ? '▾' : '▸'}</span>
                    </button>
                    <span className="block text-xs text-gray-400">
                      {jour(x.dateDebut)} → {jour(x.dateFin)}
                      {x.avancement.total > 0 && ` · ${c.progression.replace('{v}', String(x.avancement.validees)).replace('{t}', String(x.avancement.total))}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUT_BADGE[x.statut]}`}>{lbl(c.statuts, x.statut)}</span>
                    {x.avancement.total > 0 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">{x.avancement.tauxValidation}%</span>
                    )}
                    {canPilot && x.statut === 'BROUILLON' && (
                      <button onClick={() => transitionner(x, 'OUVERTE')} disabled={busy} className="btn-secondary text-xs disabled:opacity-50">{c.ouvrir}</button>
                    )}
                    {canPilot && x.statut === 'OUVERTE' && (
                      <button onClick={() => transitionner(x, 'CLOTUREE')} disabled={busy || !x.avancement.complete}
                        title={x.avancement.complete ? '' : c.clotureBloquee}
                        className="btn-secondary text-xs disabled:opacity-40">{c.cloturer}</button>
                    )}
                    {canPilot && x.statut !== 'CLOTUREE' && (
                      <button onClick={() => supprimer(x.id)} className="text-xs text-red-500 hover:underline">{c.delete}</button>
                    )}
                  </div>
                </div>

                {/* Évaluations de la campagne */}
                {ouverte === x.id && (
                  <div className="mt-4 border-t border-gray-100 dark:border-gray-800 pt-3">
                    {evaluations.length === 0 ? <p className="text-xs text-gray-400 italic">{c.aucuneEvaluation}</p> : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                            <th className="py-2">{c.colRisque}</th>
                            <th className="py-2">{c.colOrigine}</th>
                            <th className="py-2">{c.colCotation}</th>
                            <th className="py-2">{c.colStatut}</th>
                            <th className="py-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {evaluations.map(e => (
                            <tr key={e.id} className="border-t border-gray-100 dark:border-gray-800 align-top">
                              <td className="py-2 pr-2">
                                {e.riskIntitule}
                                {e.riskProprietaire && <span className="block text-xs text-gray-400">{e.riskProprietaire}</span>}
                                {e.motifRejet && <span className="block text-xs text-red-500">{e.motifRejet}</span>}
                              </td>
                              <td className="py-2 pr-2 text-xs text-gray-400 whitespace-nowrap">
                                {e.origineGraviteInherente ?? '—'}×{e.origineVraisemblanceInherente ?? '—'} → {e.origineGraviteResiduelle ?? '—'}×{e.origineVraisemblanceResiduelle ?? '—'}
                              </td>
                              <td className="py-2 pr-2 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
                                {e.graviteInherente ?? '—'}×{e.vraisemblanceInherente ?? '—'} → {e.graviteResiduelle ?? '—'}×{e.vraisemblanceResiduelle ?? '—'}
                                {e.efficaciteControles && <span className="block text-gray-400">{lbl(c.efficacites, e.efficaciteControles)}</span>}
                              </td>
                              <td className="py-2 pr-2">
                                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${EVAL_BADGE[e.statut]}`}>{lbl(c.evalStatuts, e.statut)}</span>
                              </td>
                              <td className="py-2 text-right whitespace-nowrap">
                                {x.statut === 'OUVERTE' && coteId !== e.id && (
                                  <>
                                    {canCote && e.statut !== 'VALIDEE' && (
                                      <button onClick={() => startCote(e)} className="text-xs text-ebios-600 hover:underline mr-2">{c.coter}</button>
                                    )}
                                    {canPilot && e.statut === 'COTEE' && (
                                      <>
                                        <button onClick={() => statuerEvaluation(x.id, e, 'VALIDEE')} disabled={busy} className="text-xs text-green-600 hover:underline mr-2 disabled:opacity-50">{c.valider}</button>
                                        <button onClick={() => statuerEvaluation(x.id, e, 'REJETEE')} disabled={busy} className="text-xs text-red-500 hover:underline">{c.rejeter}</button>
                                      </>
                                    )}
                                  </>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {/* Formulaire de cotation */}
                    {coteId && (() => {
                      const e = evaluations.find(v => v.id === coteId)
                      if (!e) return null
                      return (
                        <div className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/40 space-y-2">
                          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{c.coterTitre} — {e.riskIntitule}</p>
                          <div className="flex flex-wrap gap-3 items-end text-xs text-gray-500 dark:text-gray-400">
                            <label>{c.inherent}
                              <span className="flex gap-1 mt-1">
                                {coteSelect(cote.graviteInherente, v => setCote(f => ({ ...f, graviteInherente: v })))}
                                {coteSelect(cote.vraisemblanceInherente, v => setCote(f => ({ ...f, vraisemblanceInherente: v })))}
                              </span>
                            </label>
                            <label>{c.efficacite}
                              <select value={cote.efficaciteControles} onChange={ev => setCote(f => ({ ...f, efficaciteControles: ev.target.value }))} className={`${inp} block mt-1`}>
                                <option value="">—</option>
                                {EFFICACITES.map(x2 => <option key={x2} value={x2}>{lbl(c.efficacites, x2)}</option>)}
                              </select>
                            </label>
                            <label>{c.residuel}
                              <span className="flex gap-1 mt-1">
                                {coteSelect(cote.graviteResiduelle, v => setCote(f => ({ ...f, graviteResiduelle: v })))}
                                {coteSelect(cote.vraisemblanceResiduelle, v => setCote(f => ({ ...f, vraisemblanceResiduelle: v })))}
                              </span>
                            </label>
                            {suggestion != null && (
                              <button
                                onClick={() => setCote(f => ({ ...f, vraisemblanceResiduelle: String(suggestion) }))}
                                className="text-[11px] text-ebios-600 hover:underline pb-1.5"
                              >
                                {c.suggestion.replace('{v}', String(suggestion))}
                              </button>
                            )}
                          </div>
                          <textarea value={cote.commentaire} onChange={ev => setCote(f => ({ ...f, commentaire: ev.target.value }))} placeholder={c.commentairePlaceholder} rows={2} className={`${inp} w-full`} />
                          <div className="flex gap-2">
                            <button onClick={() => enregistrerCote(x.id, e)} disabled={busy} className="btn-primary text-sm disabled:opacity-50">{c.save}</button>
                            <button onClick={() => { setCoteId(null); setError(null) }} className="text-sm text-gray-500 hover:text-gray-700">{c.cancel}</button>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
