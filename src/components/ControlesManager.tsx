'use client'

import { FlaskConical, Paperclip } from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { CONTROLE_NIVEAUX, PERIODICITES, RESULTATS } from '@/lib/controle'

interface Efficacite {
  evaluees: number; conformes: number; anomalies: number
  tauxConformite: number | null
  efficacite: 'FORTE' | 'MOYENNE' | 'FAIBLE' | null
  vraisemblanceSuggeree: number | null
}
interface Preuve { nom: string; mime: string; taille: number; dataUrl: string }
interface Execution { id: string; resultat: string; dateRealisation: string; constat: string | null; preuves: Preuve[] }
interface Controle {
  id: string; intitule: string; description: string | null
  niveau: string; periodicite: string; responsable: string | null
  tailleEchantillon: number | null; actif: boolean
  riskItemId: string | null; riskItemIntitule: string | null
  processusId: string | null; processusNom: string | null
  derniereExecution: string | null; prochaineEcheance: string
  etatEcheance: 'A_VENIR' | 'DU' | 'EN_RETARD' | null
  efficacite: Efficacite; executions: Execution[]; nbExecutions: number
}
type Proc = { id: string; nom: string }
type Risk = { id: string; intitule: string }

type Form = {
  intitule: string; description: string; niveau: string; periodicite: string
  responsable: string; riskItemId: string; processusId: string; tailleEchantillon: string
}
const EMPTY: Form = { intitule: '', description: '', niveau: 'N1', periodicite: 'TRIMESTRIEL', responsable: '', riskItemId: '', processusId: '', tailleEchantillon: '' }

type ExecForm = { resultat: string; dateRealisation: string; constat: string; tailleTestee: string; anomaliesTrouvees: string }
const EMPTY_EXEC: ExecForm = { resultat: 'CONFORME', dateRealisation: '', constat: '', tailleTestee: '', anomaliesTrouvees: '' }

const ECHEANCE_BADGE: Record<string, string> = {
  A_VENIR: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  DU: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  EN_RETARD: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
}
const EFF_BADGE: Record<string, string> = {
  FORTE: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  MOYENNE: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  FAIBLE: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
}
const RESULTAT_BADGE: Record<string, string> = {
  CONFORME: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  ANOMALIE: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
  NON_APPLICABLE: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300',
}

export default function ControlesManager({ canDefine, canExecute }: { canDefine: boolean; canExecute: boolean }) {
  const { t, locale } = useTranslation()
  const c = t.controles
  const [controles, setControles] = useState<Controle[]>([])
  const [procs, setProcs] = useState<Proc[]>([])
  const [risks, setRisks] = useState<Risk[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Form>(EMPTY)
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [execId, setExecId] = useState<string | null>(null)
  const [exec, setExec] = useState<ExecForm>(EMPTY_EXEC)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [preuves, setPreuves] = useState<Preuve[]>([])

  // Lit les fichiers choisis en data URL (même stockage que les dérogations).
  async function chargerPreuves(files: FileList | null) {
    if (!files) return
    const lus = await Promise.all(Array.from(files).slice(0, 5).map(f => new Promise<Preuve>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve({ nom: f.name, mime: f.type, taille: f.size, dataUrl: String(reader.result) })
      reader.onerror = reject
      reader.readAsDataURL(f)
    })))
    setPreuves(p => [...p, ...lus].slice(0, 5))
  }

  const jour = (d: string | null) => (d ? new Date(d).toLocaleDateString(locale) : '—')
  const lbl = (dict: unknown, k: string) => (dict as Record<string, string>)[k] ?? k

  async function reload() {
    const [cc, pp, rr] = await Promise.all([
      fetch('/api/controles').then(x => x.ok ? x.json() : { controles: [] }),
      fetch('/api/processus').then(x => x.ok ? x.json() : { processus: [] }),
      fetch('/api/risk-items').then(x => x.ok ? x.json() : { risks: [] }),
    ])
    setControles(cc.controles ?? []); setProcs(pp.processus ?? [])
    setRisks((rr.risks ?? []).map((r: Risk) => ({ id: r.id, intitule: r.intitule })))
    setLoading(false)
  }
  useEffect(() => { reload() }, [])

  function err(code: string) { return lbl(c.errors, code) }

  async function submit() {
    if (!form.intitule.trim()) { setError(err('intitule_requis')); return }
    setBusy(true); setError(null)
    const payload = {
      intitule: form.intitule, description: form.description || null,
      niveau: form.niveau, periodicite: form.periodicite,
      responsable: form.responsable || null,
      riskItemId: form.riskItemId || null, processusId: form.processusId || null,
      tailleEchantillon: form.tailleEchantillon || null,
    }
    const res = await fetch(editId ? `/api/controles/${editId}` : '/api/controles', {
      method: editId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(err(data.error ?? 'erreur')); return }
    setForm(EMPTY); setEditId(null); setShowForm(false); reload()
  }

  function startEdit(x: Controle) {
    setEditId(x.id); setShowForm(true); setError(null)
    setForm({
      intitule: x.intitule, description: x.description ?? '', niveau: x.niveau, periodicite: x.periodicite,
      responsable: x.responsable ?? '', riskItemId: x.riskItemId ?? '', processusId: x.processusId ?? '',
      tailleEchantillon: x.tailleEchantillon?.toString() ?? '',
    })
  }

  async function enregistrerExec(x: Controle) {
    setBusy(true); setError(null); setFlash(null)
    const res = await fetch(`/api/controles/${x.id}/executions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resultat: exec.resultat, dateRealisation: exec.dateRealisation || null,
        constat: exec.constat || null, tailleTestee: exec.tailleTestee || null,
        anomaliesTrouvees: exec.anomaliesTrouvees || null,
        preuves,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(err(data.error ?? 'erreur')); return }
    if (data.actionCreee) setFlash(c.actionGeneree)
    setExec(EMPTY_EXEC); setPreuves([]); setExecId(null); reload()
  }

  async function basculerActif(x: Controle) {
    await fetch(`/api/controles/${x.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intitule: x.intitule, actif: !x.actif }),
    })
    reload()
  }

  async function supprimer(id: string) {
    if (!confirm(c.confirmDelete)) return
    await fetch(`/api/controles/${id}`, { method: 'DELETE' }); reload()
  }

  const inp = 'px-2 py-1.5 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm'
  const enRetard = controles.filter(x => x.etatEcheance === 'EN_RETARD').length
  const dus = controles.filter(x => x.etatEcheance === 'DU').length
  const actifs = controles.filter(x => x.actif).length

  return (
    <div>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100"><FlaskConical size={22} className="inline align-[-0.15em] mr-2" aria-hidden="true" /> {c.title}</h1>
        {canDefine && !showForm && (
          <button onClick={() => { setForm(EMPTY); setEditId(null); setShowForm(true) }} className="btn-primary text-sm">{c.newBtn}</button>
        )}
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{c.subtitle}</p>

      {flash && <p className="text-xs text-ebios-600 mb-3">{flash}</p>}

      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <Tile label={c.actifs} value={actifs} />
          <Tile label={c.dus} value={dus} tone={dus > 0 ? 'amber' : undefined} />
          <Tile label={c.enRetard} value={enRetard} tone={enRetard > 0 ? 'red' : undefined} />
        </div>
      )}

      {canDefine && showForm && (
        <div className="card p-4 mb-5 space-y-3">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{editId ? c.editTitle : c.addTitle}</p>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <input value={form.intitule} onChange={e => setForm(f => ({ ...f, intitule: e.target.value }))} placeholder={c.intitulePlaceholder} className={`${inp} w-full`} />
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder={c.descriptionPlaceholder} rows={2} className={`${inp} w-full`} />
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <label className="text-xs text-gray-500 dark:text-gray-400">{c.niveau}
              <select value={form.niveau} onChange={e => setForm(f => ({ ...f, niveau: e.target.value }))} className={`${inp} w-full mt-1`}>
                {CONTROLE_NIVEAUX.map(n => <option key={n} value={n}>{lbl(c.niveaux, n)}</option>)}
              </select>
            </label>
            <label className="text-xs text-gray-500 dark:text-gray-400">{c.periodicite}
              <select value={form.periodicite} onChange={e => setForm(f => ({ ...f, periodicite: e.target.value }))} className={`${inp} w-full mt-1`}>
                {PERIODICITES.map(p => <option key={p} value={p}>{lbl(c.periodicites, p)}</option>)}
              </select>
            </label>
            <label className="text-xs text-gray-500 dark:text-gray-400">{c.responsable}
              <input value={form.responsable} onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))} className={`${inp} w-full mt-1`} />
            </label>
            <label className="text-xs text-gray-500 dark:text-gray-400">{c.echantillon}
              <input type="number" min="1" value={form.tailleEchantillon} onChange={e => setForm(f => ({ ...f, tailleEchantillon: e.target.value }))} className={`${inp} w-full mt-1`} />
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select value={form.riskItemId} onChange={e => setForm(f => ({ ...f, riskItemId: e.target.value }))} className={inp}>
              <option value="">{c.riskNone}</option>
              {risks.map(r => <option key={r.id} value={r.id}>{r.intitule}</option>)}
            </select>
            <select value={form.processusId} onChange={e => setForm(f => ({ ...f, processusId: e.target.value }))} className={inp}>
              <option value="">{c.processNone}</option>
              {procs.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={submit} disabled={busy} className="btn-primary text-sm disabled:opacity-50">{editId ? c.save : c.add}</button>
            <button onClick={() => { setShowForm(false); setEditId(null); setError(null) }} className="text-sm text-gray-500 hover:text-gray-700">{c.cancel}</button>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-3">{c.colControle}</th>
              <th className="px-4 py-3">{c.colRattachement}</th>
              <th className="px-4 py-3">{c.colPeriodicite}</th>
              <th className="px-4 py-3">{c.colEcheance}</th>
              <th className="px-4 py-3">{c.colEfficacite}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="px-4 py-6 text-gray-400">…</td></tr>
              : controles.length === 0 ? <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400 italic">{c.empty}</td></tr>
              : controles.map(x => (
                <Fragment key={x.id}>
                  <tr className={`border-b border-gray-100 dark:border-gray-800 align-top ${x.actif ? '' : 'opacity-50'}`}>
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">
                      {x.intitule}
                      <span className="block text-xs text-gray-400">
                        {lbl(c.niveaux, x.niveau)}{x.responsable && ` · ${x.responsable}`}
                        {x.tailleEchantillon != null && ` · n=${x.tailleEchantillon}`}
                        {!x.actif && ` · ${c.inactif}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {x.riskItemIntitule ?? '—'}
                      {x.processusNom && <span className="block">{x.processusNom}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{lbl(c.periodicites, x.periodicite)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {x.etatEcheance ? (
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${ECHEANCE_BADGE[x.etatEcheance]}`}>
                          {lbl(c.etats, x.etatEcheance)}
                        </span>
                      ) : <span className="text-xs text-gray-400">—</span>}
                      <span className="block text-[10px] text-gray-400 mt-0.5">{jour(x.prochaineEcheance)}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {x.efficacite.efficacite ? (
                        <button onClick={() => setExpandedId(id => id === x.id ? null : x.id)} className="inline-flex items-center gap-1">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${EFF_BADGE[x.efficacite.efficacite]}`}>
                            {x.efficacite.tauxConformite}% · {lbl(c.efficacites, x.efficacite.efficacite)}
                          </span>
                          <span className="text-gray-400 text-xs">{expandedId === x.id ? '▾' : '▸'}</span>
                        </button>
                      ) : <span className="text-xs text-gray-400">{c.jamaisExecute}</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      {canExecute && x.actif && (
                        <button onClick={() => { setExecId(x.id); setExec(EMPTY_EXEC); setPreuves([]); setError(null) }} className="text-xs text-ebios-600 hover:underline mr-2">{c.execute}</button>
                      )}
                      {canDefine && <>
                        <button onClick={() => startEdit(x)} className="text-xs text-ebios-600 hover:underline mr-2">{c.edit}</button>
                        <button onClick={() => basculerActif(x)} className="text-xs text-gray-500 hover:underline mr-2">{x.actif ? c.desactiver : c.activer}</button>
                        <button onClick={() => supprimer(x.id)} className="text-xs text-red-500 hover:underline">{c.delete}</button>
                      </>}
                    </td>
                  </tr>

                  {/* Historique + suggestion de vraisemblance issue de l'efficacité */}
                  {expandedId === x.id && (
                    <tr className="bg-gray-50/60 dark:bg-gray-800/30">
                      <td colSpan={6} className="px-4 py-4">
                        <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                          {c.historique} — {c.resume
                            .replace('{e}', String(x.efficacite.evaluees))
                            .replace('{c}', String(x.efficacite.conformes))
                            .replace('{a}', String(x.efficacite.anomalies))}
                          {x.efficacite.vraisemblanceSuggeree != null && x.riskItemIntitule && (
                            <span className="ml-1 text-ebios-600">
                              · {c.suggestion.replace('{v}', String(x.efficacite.vraisemblanceSuggeree))}
                            </span>
                          )}
                        </p>
                        <ul className="space-y-1">
                          {x.executions.map(e => (
                            <li key={e.id} className="flex items-center gap-2 text-xs">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${RESULTAT_BADGE[e.resultat]}`}>{lbl(c.resultats, e.resultat)}</span>
                              <span className="text-gray-400">{jour(e.dateRealisation)}</span>
                              {e.constat && <span className="text-gray-600 dark:text-gray-300 truncate">{e.constat}</span>}
                              {e.preuves?.length > 0 && <span className="text-gray-400"><Paperclip size={15} className="inline align-[-0.15em] mr-1.5" aria-hidden="true" /> {e.preuves.length}</span>}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}

                  {/* Saisie d'une exécution */}
                  {canExecute && execId === x.id && (
                    <tr className="bg-ebios-50/40 dark:bg-ebios-500/5">
                      <td colSpan={6} className="px-4 py-4 space-y-2">
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{c.executeTitle} — {x.intitule}</p>
                        {error && <p className="text-xs text-red-600">{error}</p>}
                        <div className="flex flex-wrap gap-2 items-end">
                          <label className="text-xs text-gray-500 dark:text-gray-400">{c.resultat}
                            <select value={exec.resultat} onChange={e => setExec(f => ({ ...f, resultat: e.target.value }))} className={`${inp} block mt-1`}>
                              {RESULTATS.map(rr => <option key={rr} value={rr}>{lbl(c.resultats, rr)}</option>)}
                            </select>
                          </label>
                          <label className="text-xs text-gray-500 dark:text-gray-400">{c.dateRealisation}
                            <input type="date" value={exec.dateRealisation} onChange={e => setExec(f => ({ ...f, dateRealisation: e.target.value }))} className={`${inp} block mt-1`} />
                          </label>
                          <label className="text-xs text-gray-500 dark:text-gray-400">{c.tailleTestee}
                            <input type="number" min="0" value={exec.tailleTestee} onChange={e => setExec(f => ({ ...f, tailleTestee: e.target.value }))} className={`${inp} block mt-1 w-24`} />
                          </label>
                          <label className="text-xs text-gray-500 dark:text-gray-400">{c.anomaliesTrouvees}
                            <input type="number" min="0" value={exec.anomaliesTrouvees} onChange={e => setExec(f => ({ ...f, anomaliesTrouvees: e.target.value }))} className={`${inp} block mt-1 w-24`} />
                          </label>
                        </div>
                        <textarea value={exec.constat} onChange={e => setExec(f => ({ ...f, constat: e.target.value }))} placeholder={c.constatPlaceholder} rows={2} className={`${inp} w-full`} />
                        <div>
                          <label className="text-xs text-gray-500 dark:text-gray-400">{c.preuves}
                            <input type="file" multiple onChange={e => chargerPreuves(e.target.files)} className={`${inp} block mt-1 w-full`} />
                          </label>
                          {preuves.length > 0 && (
                            <ul className="mt-1 space-y-0.5">
                              {preuves.map((p, i) => (
                                <li key={i} className="text-xs text-gray-500 flex items-center gap-2">
                                  <span className="truncate">{p.nom}</span>
                                  <button onClick={() => setPreuves(list => list.filter((_, j) => j !== i))} className="text-red-500 hover:underline">{c.retirer}</button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => enregistrerExec(x)} disabled={busy} className="btn-primary text-sm disabled:opacity-50">{c.save}</button>
                          <button onClick={() => { setExecId(null); setError(null) }} className="text-sm text-gray-500 hover:text-gray-700">{c.cancel}</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Tile({ label, value, tone }: { label: string; value: number; tone?: 'amber' | 'red' }) {
  const color = tone === 'red' ? 'text-red-600 dark:text-red-400' : tone === 'amber' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-800 dark:text-gray-100'
  return (
    <div className="card p-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}
