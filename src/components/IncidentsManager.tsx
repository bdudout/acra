'use client'

import { Siren } from 'lucide-react'
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
  doraReporting?: DoraReporting
}
interface DoraReporting {
  classe: 'MAJEUR' | 'SIGNIFICATIF' | 'MINEUR'
  echeances: { phase: string; echeance: string | null; statut: string; soumiseLe: string | null }[]
  synthese: { applicable: boolean; prochaineEcheance: string | null; enRetard: number; soumises: number }
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
  const [doraDetailId, setDoraDetailId] = useState<string | null>(null)

  const tr = useMemo(() => (key: string) => key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], t) as string ?? '', [t])
  const taxoLabel = (code: string | null) => {
    if (!code) return '—'
    const node = taxo.find(x => x.code === code)
    return node ? taxonomieLabel(node, tr) : code
  }
  const euros = (v: number | null) =>
    v == null ? '—' : new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)

  // Cellule « Déclaration DORA » (art. 19) : signal compact + accès au détail des
  // trois phases par incident majeur.
  function doraCell(i: Incident) {
    const d = i.doraReporting
    if (!d || !d.synthese.applicable) return <span className="text-gray-300 dark:text-gray-600">—</span>
    let chip
    if (d.synthese.enRetard > 0) chip = (
      <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300 whitespace-nowrap">
        ⚠ {d.synthese.enRetard} {n.doraEnRetard}
      </span>
    )
    else if (d.synthese.prochaineEcheance) chip = (
      <span className="text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
        {n.doraEcheance} : {new Date(d.synthese.prochaineEcheance).toLocaleDateString(locale)}
      </span>
    )
    else chip = (
      <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300 whitespace-nowrap">
        {n.doraDeclare}
      </span>
    )
    return (
      <button onClick={() => setDoraDetailId(i.id)} className="hover:underline focus:underline" title={n.doraDetailTitle}>
        {chip}
      </button>
    )
  }

  const DORA_PHASE_LABEL: Record<string, string> = {
    INITIALE: n.doraPhaseInitiale, INTERMEDIAIRE: n.doraPhaseIntermediaire, FINALE: n.doraPhaseFinale,
  }
  const DORA_STATUT_BADGE: Record<string, string> = {
    SOUMIS: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
    EN_RETARD: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
    A_FAIRE: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
    INAPPLICABLE: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300',
  }
  const DORA_PHASE_FIELD: Record<string, 'doraInitialeSoumiseLe' | 'doraIntermediaireSoumiseLe' | 'doraFinaleSoumiseLe'> = {
    INITIALE: 'doraInitialeSoumiseLe', INTERMEDIAIRE: 'doraIntermediaireSoumiseLe', FINALE: 'doraFinaleSoumiseLe',
  }

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

  // Export LDC (le périmètre = tous les incidents de l'organisation active).
  function exportLdc(format: 'csv' | 'xlsx') {
    window.location.href = `/api/incidents/export?format=${format}&lang=${locale}`
  }

  // Export ITS : registre de déclaration des incidents TIC majeurs (DORA art. 19).
  function exportIts() {
    window.location.href = `/api/reglementaire/dora-its`
  }

  // Enregistre un horodatage du workflow DORA (classification majeur ou soumission
  // d'une phase) sur l'incident, puis rafraîchit le détail.
  async function setDoraTimestamp(id: string, field: 'doraClasseMajeurLe' | 'doraInitialeSoumiseLe' | 'doraIntermediaireSoumiseLe' | 'doraFinaleSoumiseLe') {
    setBusy(true); setError(null)
    const res = await fetch(`/api/incidents/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: new Date().toISOString() }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(err(data.error ?? 'erreur')); return }
    reload()
  }

  // Promotion d'un incident orphelin en risque du registre (2ᵉ ligne).
  async function promouvoir(id: string) {
    setBusy(true); setError(null)
    const res = await fetch(`/api/incidents/${id}/promote`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(err(data.error ?? 'erreur')); return }
    reload()
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
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100"><Siren size={22} className="inline align-[-0.15em] mr-2" aria-hidden="true" /> {n.title}</h1>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 dark:text-gray-400">{n.exportLdc}</span>
          <button onClick={() => exportLdc('csv')} className="btn-secondary text-xs">{t.filtres.csv}</button>
          <button onClick={() => exportLdc('xlsx')} className="btn-secondary text-xs">{t.filtres.xlsx}</button>
          <button onClick={exportIts} className="btn-secondary text-xs" title={n.doraItsHint}>{n.doraExportIts}</button>
          {!showDecl && <button onClick={() => { setDecl(EMPTY_DECL); setShowDecl(true) }} className="btn-primary text-sm ml-1.5">{n.declareBtn}</button>}
        </div>
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
              <th className="px-4 py-3">{n.colDora}</th>
              {canQualify && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={8} className="px-4 py-6 text-gray-400">…</td></tr>
              : incidents.length === 0 ? <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400 italic">{n.empty}</td></tr>
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
                  <td className="px-4 py-3">{doraCell(i)}</td>
                  {canQualify && (
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      {qualId === i.id ? (
                        <span className="text-xs text-gray-400">…</span>
                      ) : (
                        <>
                          <button onClick={() => startQual(i)} className="text-xs text-ebios-600 hover:underline mr-2">{n.qualify}</button>
                          {!i.riskItemId && (
                            <button onClick={() => promouvoir(i.id)} disabled={busy} title={n.promoteHint}
                              className="text-xs text-ebios-600 hover:underline mr-2 disabled:opacity-50">{n.promote}</button>
                          )}
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

      {/* Détail de la déclaration DORA (3 phases) — art. 19 */}
      {doraDetailId && (() => {
        const i = incidents.find(x => x.id === doraDetailId)
        const d = i?.doraReporting
        if (!i || !d) return null
        const classeMajeur = d.classe === 'MAJEUR'
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDoraDetailId(null)}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{n.doraDetailTitle}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{i.intitule} — {n.doraClasse} : {(n.doraClasses as Record<string, string>)[d.classe] ?? d.classe}</p>
                </div>
                <button onClick={() => setDoraDetailId(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none" aria-label={n.cancel}>×</button>
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}

              {!i.doraReporting?.echeances.some(e => e.phase === 'INITIALE' && e.statut !== 'INAPPLICABLE') && (
                <p className="text-xs text-gray-500 dark:text-gray-400 italic">{n.doraNonApplicable}</p>
              )}

              <div className="space-y-2">
                {d.echeances.map(e => (
                  <div key={e.phase} className="flex items-center justify-between gap-2 border border-gray-100 dark:border-gray-700 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm text-gray-700 dark:text-gray-200">{DORA_PHASE_LABEL[e.phase] ?? e.phase}</p>
                      <p className="text-[11px] text-gray-400">
                        {e.echeance ? `${n.doraEcheance} : ${new Date(e.echeance).toLocaleString(locale)}` : '—'}
                        {e.soumiseLe && ` · ${n.doraSoumisLe} ${new Date(e.soumiseLe).toLocaleDateString(locale)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${DORA_STATUT_BADGE[e.statut] ?? DORA_STATUT_BADGE.INAPPLICABLE}`}>
                        {(n.doraStatuts as Record<string, string>)[e.statut] ?? e.statut}
                      </span>
                      {canQualify && classeMajeur && !e.soumiseLe && (
                        <button onClick={() => setDoraTimestamp(i.id, DORA_PHASE_FIELD[e.phase])} disabled={busy}
                          className="btn-secondary text-[11px] disabled:opacity-50">{n.doraMarquerSoumis}</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {canQualify && classeMajeur && (
                <div className="pt-1 border-t border-gray-100 dark:border-gray-700">
                  <button onClick={() => setDoraTimestamp(i.id, 'doraClasseMajeurLe')} disabled={busy}
                    className="btn-secondary text-xs disabled:opacity-50">{n.doraClasserMajeur}</button>
                  <p className="text-[11px] text-gray-400 mt-1">{n.doraClasserMajeurHint}</p>
                </div>
              )}
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
