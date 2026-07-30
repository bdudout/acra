'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { taxonomieLabel, type TaxonomieNode } from '@/lib/taxonomie'
import { INCIDENT_STATUTS, transitionAutorisee, type IncidentStatut } from '@/lib/incident'

interface Incident {
  id: string; intitule: string; description: string | null
  dateSurvenance: string | null; dateDetection: string | null
  taxonomieCode: string | null; processusId: string | null; processusNom: string | null
  entite: string | null; impactEstime: number | null
  montantBrut: number | null; recuperations: number | null; perteNette: number | null
  delaiDetection: number | null
  riskItemId: string | null; riskItemIntitule: string | null
  statut: string; createdAt: string
}
type Proc = { id: string; nom: string }
type Risk = { id: string; intitule: string }

// Formulaire de DÉCLARATION : volontairement court (« 2 minutes »).
type DeclForm = {
  intitule: string; description: string; dateSurvenance: string; dateDetection: string
  processusId: string; entite: string; impactEstime: string
}
const EMPTY_DECL: DeclForm = { intitule: '', description: '', dateSurvenance: '', dateDetection: '', processusId: '', entite: '', impactEstime: '' }

// Formulaire de QUALIFICATION (2ᵉ ligne) : taxonomie, pertes, rattachement.
type QualForm = { taxonomieCode: string; montantBrut: string; recuperations: string; riskItemId: string; statut: string; clotureCommentaire: string }

const STATUT_BADGE: Record<string, string> = {
  DECLARE: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  QUALIFIE: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  CLOTURE: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  REJETE: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300',
}

export default function IncidentsManager({ canQualify }: { canQualify: boolean }) {
  const { t, locale } = useTranslation()
  const n = t.incidents
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [taxo, setTaxo] = useState<TaxonomieNode[]>([])
  const [procs, setProcs] = useState<Proc[]>([])
  const [risks, setRisks] = useState<Risk[]>([])
  const [loading, setLoading] = useState(true)
  const [decl, setDecl] = useState<DeclForm>(EMPTY_DECL)
  const [showDecl, setShowDecl] = useState(false)
  const [qualId, setQualId] = useState<string | null>(null)
  const [qual, setQual] = useState<QualForm>({ taxonomieCode: '', montantBrut: '', recuperations: '', riskItemId: '', statut: 'QUALIFIE', clotureCommentaire: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tr = useMemo(() => (key: string) => key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], t) as string ?? '', [t])
  const taxoLabel = (code: string | null) => {
    if (!code) return '—'
    const node = taxo.find(x => x.code === code)
    return node ? taxonomieLabel(node, tr) : code
  }
  const euros = (v: number | null) =>
    v == null ? '—' : new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)

  async function reload() {
    const [ii, tt, pp, rr] = await Promise.all([
      fetch('/api/incidents').then(x => x.ok ? x.json() : { incidents: [] }),
      fetch('/api/taxonomie').then(x => x.ok ? x.json() : { taxonomie: [] }),
      fetch('/api/processus').then(x => x.ok ? x.json() : { processus: [] }),
      fetch('/api/risk-items').then(x => x.ok ? x.json() : { risks: [] }),
    ])
    setIncidents(ii.incidents ?? []); setTaxo(tt.taxonomie ?? []); setProcs(pp.processus ?? [])
    setRisks((rr.risks ?? []).map((r: Risk) => ({ id: r.id, intitule: r.intitule })))
    setLoading(false)
  }
  useEffect(() => { reload() }, [])

  function err(code: string) { return (n.errors as Record<string, string>)[code] ?? code }

  async function declarer() {
    if (!decl.intitule.trim()) { setError(err('intitule_requis')); return }
    setBusy(true); setError(null)
    const res = await fetch('/api/incidents', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intitule: decl.intitule, description: decl.description || null,
        dateSurvenance: decl.dateSurvenance || null, dateDetection: decl.dateDetection || null,
        processusId: decl.processusId || null, entite: decl.entite || null,
        impactEstime: decl.impactEstime || null,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(err(data.error ?? 'erreur')); return }
    setDecl(EMPTY_DECL); setShowDecl(false); reload()
  }

  function startQual(i: Incident) {
    setQualId(i.id); setError(null)
    setQual({
      taxonomieCode: i.taxonomieCode ?? '', montantBrut: i.montantBrut?.toString() ?? '',
      recuperations: i.recuperations?.toString() ?? '', riskItemId: i.riskItemId ?? '',
      statut: i.statut === 'DECLARE' ? 'QUALIFIE' : i.statut, clotureCommentaire: '',
    })
  }

  async function enregistrerQual(i: Incident) {
    setBusy(true); setError(null)
    const res = await fetch(`/api/incidents/${i.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intitule: i.intitule, description: i.description,
        dateSurvenance: i.dateSurvenance, dateDetection: i.dateDetection,
        processusId: i.processusId, entite: i.entite, impactEstime: i.impactEstime,
        taxonomieCode: qual.taxonomieCode || null,
        montantBrut: qual.montantBrut || null, recuperations: qual.recuperations || null,
        riskItemId: qual.riskItemId || null, statut: qual.statut,
        clotureCommentaire: qual.clotureCommentaire || null,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(err(data.error ?? 'erreur')); return }
    setQualId(null); reload()
  }

  async function supprimer(id: string) {
    if (!confirm(n.confirmDelete)) return
    await fetch(`/api/incidents/${id}`, { method: 'DELETE' }); reload()
  }

  const inp = 'px-2 py-1.5 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm'
  const totalPertes = incidents.reduce((s, i) => s + (i.perteNette ?? 0), 0)
  const ouverts = incidents.filter(i => i.statut === 'DECLARE').length

  return (
    <div>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">🚨 {n.title}</h1>
        {!showDecl && <button onClick={() => { setDecl(EMPTY_DECL); setShowDecl(true) }} className="btn-primary text-sm">{n.declareBtn}</button>}
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{n.subtitle}</p>

      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <Tile label={n.total} value={incidents.length} />
          <Tile label={n.aQualifier} value={ouverts} tone={ouverts > 0 ? 'amber' : undefined} />
          <Tile label={n.perteNetteTotale} value={euros(totalPertes)} />
        </div>
      )}

      {/* Déclaration — ouverte à tous les rôles (1ʳᵉ ligne) */}
      {showDecl && (
        <div className="card p-4 mb-5 space-y-3">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{n.declareTitle}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{n.declareHint}</p>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <input value={decl.intitule} onChange={e => setDecl(f => ({ ...f, intitule: e.target.value }))} placeholder={n.intitulePlaceholder} className={`${inp} w-full`} />
          <textarea value={decl.description} onChange={e => setDecl(f => ({ ...f, description: e.target.value }))} placeholder={n.descriptionPlaceholder} rows={2} className={`${inp} w-full`} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs text-gray-500 dark:text-gray-400">{n.dateSurvenance}
              <input type="date" value={decl.dateSurvenance} onChange={e => setDecl(f => ({ ...f, dateSurvenance: e.target.value }))} className={`${inp} w-full mt-1`} />
            </label>
            <label className="text-xs text-gray-500 dark:text-gray-400">{n.dateDetection}
              <input type="date" value={decl.dateDetection} onChange={e => setDecl(f => ({ ...f, dateDetection: e.target.value }))} className={`${inp} w-full mt-1`} />
            </label>
            <label className="text-xs text-gray-500 dark:text-gray-400">{n.impactEstime}
              <select value={decl.impactEstime} onChange={e => setDecl(f => ({ ...f, impactEstime: e.target.value }))} className={`${inp} w-full mt-1`}>
                <option value="">—</option>
                {[1, 2, 3, 4].map(v => <option key={v} value={v}>{(n.impacts as Record<string, string>)[String(v)] ?? v}</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select value={decl.processusId} onChange={e => setDecl(f => ({ ...f, processusId: e.target.value }))} className={inp}>
              <option value="">{n.processNone}</option>
              {procs.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
            <input value={decl.entite} onChange={e => setDecl(f => ({ ...f, entite: e.target.value }))} placeholder={n.entityPlaceholder} className={inp} />
          </div>
          <div className="flex gap-2">
            <button onClick={declarer} disabled={busy} className="btn-primary text-sm disabled:opacity-50">{n.declare}</button>
            <button onClick={() => { setShowDecl(false); setError(null) }} className="text-sm text-gray-500 hover:text-gray-700">{n.cancel}</button>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-3">{n.colIncident}</th>
              <th className="px-4 py-3">{n.colCategory}</th>
              <th className="px-4 py-3">{n.colProcess}</th>
              <th className="px-4 py-3 text-right">{n.colPerte}</th>
              <th className="px-4 py-3">{n.colRisque}</th>
              <th className="px-4 py-3">{n.colStatut}</th>
              {canQualify && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={7} className="px-4 py-6 text-gray-400">…</td></tr>
              : incidents.length === 0 ? <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400 italic">{n.empty}</td></tr>
              : incidents.map(i => (
                <tr key={i.id} className="border-b border-gray-100 dark:border-gray-800 align-top">
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">
                    {i.intitule}
                    <span className="block text-xs text-gray-400">
                      {i.dateSurvenance ? new Date(i.dateSurvenance).toLocaleDateString(locale) : '—'}
                      {i.delaiDetection != null && ` · ${n.detectedIn.replace('{n}', String(i.delaiDetection))}`}
                      {i.entite && ` · ${i.entite}`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{taxoLabel(i.taxonomieCode)}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{i.processusNom ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-200 whitespace-nowrap">{euros(i.perteNette)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{i.riskItemIntitule ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUT_BADGE[i.statut] ?? STATUT_BADGE.DECLARE}`}>
                      {(n.statuts as Record<string, string>)[i.statut] ?? i.statut}
                    </span>
                  </td>
                  {canQualify && (
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      {qualId === i.id ? (
                        <span className="text-xs text-gray-400">…</span>
                      ) : (
                        <>
                          <button onClick={() => startQual(i)} className="text-xs text-ebios-600 hover:underline mr-2">{n.qualify}</button>
                          <button onClick={() => supprimer(i.id)} className="text-xs text-red-500 hover:underline">{n.delete}</button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Panneau de qualification (2ᵉ ligne) */}
      {canQualify && qualId && (() => {
        const i = incidents.find(x => x.id === qualId)
        if (!i) return null
        const depuis = i.statut as IncidentStatut
        return (
          <div className="card p-4 mt-5 space-y-3">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{n.qualifyTitle} — {i.intitule}</p>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs text-gray-500 dark:text-gray-400">{n.colCategory}
                <select value={qual.taxonomieCode} onChange={e => setQual(f => ({ ...f, taxonomieCode: e.target.value }))} className={`${inp} w-full mt-1`}>
                  <option value="">{n.categoryNone}</option>
                  {taxo.filter(x => x.actif !== false).map(x => <option key={x.code} value={x.code}>{taxonomieLabel(x, tr)}</option>)}
                </select>
              </label>
              <label className="text-xs text-gray-500 dark:text-gray-400">{n.linkRisk}
                <select value={qual.riskItemId} onChange={e => setQual(f => ({ ...f, riskItemId: e.target.value }))} className={`${inp} w-full mt-1`}>
                  <option value="">{n.riskNone}</option>
                  {risks.map(r => <option key={r.id} value={r.id}>{r.intitule}</option>)}
                </select>
              </label>
              <label className="text-xs text-gray-500 dark:text-gray-400">{n.montantBrut}
                <input type="number" min="0" step="0.01" value={qual.montantBrut} onChange={e => setQual(f => ({ ...f, montantBrut: e.target.value }))} className={`${inp} w-full mt-1`} />
              </label>
              <label className="text-xs text-gray-500 dark:text-gray-400">{n.recuperations}
                <input type="number" min="0" step="0.01" value={qual.recuperations} onChange={e => setQual(f => ({ ...f, recuperations: e.target.value }))} className={`${inp} w-full mt-1`} />
              </label>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <select value={qual.statut} onChange={e => setQual(f => ({ ...f, statut: e.target.value }))} className={inp}>
                {INCIDENT_STATUTS.filter(s => transitionAutorisee(depuis, s)).map(s => (
                  <option key={s} value={s}>{(n.statuts as Record<string, string>)[s] ?? s}</option>
                ))}
              </select>
              <button onClick={() => enregistrerQual(i)} disabled={busy} className="btn-primary text-sm disabled:opacity-50">{n.save}</button>
              <button onClick={() => { setQualId(null); setError(null) }} className="text-sm text-gray-500 hover:text-gray-700">{n.cancel}</button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function Tile({ label, value, tone }: { label: string; value: number | string; tone?: 'amber' }) {
  const color = tone === 'amber' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-800 dark:text-gray-100'
  return (
    <div className="card p-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}
