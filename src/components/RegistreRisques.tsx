'use client'

import { NotebookText } from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { taxonomieLabel, type TaxonomieNode } from '@/lib/taxonomie'
import { RISK_STATUTS } from '@/lib/risk-item'
import RiskActionsPanel, { type ActionsSummary } from '@/components/RiskActionsPanel'

interface Risk {
  id: string; intitule: string; taxonomieCode: string | null; processusId: string | null
  processusNom: string | null; entite: string | null; proprietaire: string | null; statut: string
  provenance: string
  graviteInherente: number | null; vraisemblanceInherente: number | null
  graviteResiduelle: number | null; vraisemblanceResiduelle: number | null
  niveauInherent: number | null; niveauResiduel: number | null
  actionsSummary: ActionsSummary
  calibration: { occurrences: number; perteNetteTotale: number; vraisemblanceSuggeree: number | null } | null
  controleEfficacite: { evaluees: number; tauxConformite: number | null; efficacite: string | null; vraisemblanceSuggeree: number | null } | null
}
type Proc = { id: string; nom: string }
type Form = {
  intitule: string; taxonomieCode: string; processusId: string; entite: string; proprietaire: string
  statut: string; gi: string; vi: string; gr: string; vr: string
}
const EMPTY: Form = { intitule: '', taxonomieCode: '', processusId: '', entite: '', proprietaire: '', statut: 'IDENTIFIE', gi: '', vi: '', gr: '', vr: '' }

// Couleur du niveau (produit 1-25) — 3 paliers simples.
function niveauColor(n: number | null): string {
  if (n == null) return 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'
  if (n >= 12) return 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300'
  if (n >= 6) return 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
  return 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300'
}

export default function RegistreRisques({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation()
  const r = t.registre
  const [risks, setRisks] = useState<Risk[]>([])
  const [taxo, setTaxo] = useState<TaxonomieNode[]>([])
  const [procs, setProcs] = useState<Proc[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Form>(EMPTY)
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const tr = useMemo(() => (key: string) => key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], t) as string ?? '', [t])
  const taxoLabel = (code: string | null) => {
    if (!code) return '—'
    const node = taxo.find(n => n.code === code)
    return node ? taxonomieLabel(node, tr) : code
  }

  async function reload() {
    const [rr, tt, pp] = await Promise.all([
      fetch('/api/risk-items').then(x => x.ok ? x.json() : { risks: [] }),
      fetch('/api/taxonomie').then(x => x.ok ? x.json() : { taxonomie: [] }),
      fetch('/api/processus').then(x => x.ok ? x.json() : { processus: [] }),
    ])
    setRisks(rr.risks ?? []); setTaxo(tt.taxonomie ?? []); setProcs(pp.processus ?? [])
    setLoading(false)
  }
  useEffect(() => { reload() }, [])

  function err(code: string) { return (r.errors as Record<string, string>)[code] ?? code }
  const num = (s: string) => (s ? Number(s) : null)

  async function submit() {
    if (!form.intitule.trim()) { setError(err('intitule_requis')); return }
    setBusy(true); setError(null)
    const payload = {
      intitule: form.intitule, taxonomieCode: form.taxonomieCode || null, processusId: form.processusId || null,
      entite: form.entite || null, proprietaire: form.proprietaire || null, statut: form.statut,
      graviteInherente: num(form.gi), vraisemblanceInherente: num(form.vi),
      graviteResiduelle: num(form.gr), vraisemblanceResiduelle: num(form.vr),
    }
    const res = await fetch(editId ? `/api/risk-items/${editId}` : '/api/risk-items', {
      method: editId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(err(data.error ?? 'erreur')); return }
    setForm(EMPTY); setEditId(null); setShowForm(false); reload()
  }

  function startEdit(x: Risk) {
    setEditId(x.id); setShowForm(true); setError(null)
    setForm({
      intitule: x.intitule, taxonomieCode: x.taxonomieCode ?? '', processusId: x.processusId ?? '',
      entite: x.entite ?? '', proprietaire: x.proprietaire ?? '', statut: x.statut,
      gi: x.graviteInherente?.toString() ?? '', vi: x.vraisemblanceInherente?.toString() ?? '',
      gr: x.graviteResiduelle?.toString() ?? '', vr: x.vraisemblanceResiduelle?.toString() ?? '',
    })
  }
  // Applique la vraisemblance suggérée par la fréquence d'incidents observée.
  // Décision explicite du risk manager : rien n'est appliqué automatiquement.
  async function appliquerSuggestion(x: Risk, source: 'incidents' | 'controles' = 'incidents') {
    const v = source === 'controles'
      ? x.controleEfficacite?.vraisemblanceSuggeree
      : x.calibration?.vraisemblanceSuggeree
    if (v == null) return
    if (!confirm(r.calibration.confirm.replace('{v}', String(v)))) return
    await fetch(`/api/risk-items/${x.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intitule: x.intitule, taxonomieCode: x.taxonomieCode, processusId: x.processusId,
        entite: x.entite, proprietaire: x.proprietaire, statut: x.statut,
        graviteInherente: x.graviteInherente, vraisemblanceInherente: x.vraisemblanceInherente,
        graviteResiduelle: x.graviteResiduelle, vraisemblanceResiduelle: v,
      }),
    })
    reload()
  }

  async function remove(id: string) {
    if (!confirm(r.confirmDelete)) return
    await fetch(`/api/risk-items/${id}`, { method: 'DELETE' }); reload()
  }

  const sel = 'px-2 py-1.5 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm'
  const cote = (v: string, set: (s: string) => void, ph: string) => (
    <select value={v} onChange={e => set(e.target.value)} className={sel}><option value="">{ph}</option>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}</select>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100"><NotebookText size={22} className="inline align-[-0.15em] mr-2" aria-hidden="true" /> {r.title}</h1>
        {canEdit && !showForm && <button onClick={() => { setForm(EMPTY); setEditId(null); setShowForm(true) }} className="btn-primary text-sm">{r.newBtn}</button>}
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{r.subtitle}</p>

      {canEdit && showForm && (
        <div className="card p-4 mb-5 space-y-3">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{editId ? r.editTitle : r.addTitle}</p>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <input value={form.intitule} onChange={e => setForm(f => ({ ...f, intitule: e.target.value }))} placeholder={r.intitulePlaceholder} className={`${sel} w-full`} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select value={form.taxonomieCode} onChange={e => setForm(f => ({ ...f, taxonomieCode: e.target.value }))} className={sel}>
              <option value="">{r.categoryNone}</option>
              {taxo.filter(n => n.actif !== false).map(n => <option key={n.code} value={n.code}>{taxonomieLabel(n, tr)}</option>)}
            </select>
            <select value={form.processusId} onChange={e => setForm(f => ({ ...f, processusId: e.target.value }))} className={sel}>
              <option value="">{r.processNone}</option>
              {procs.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
            <input value={form.entite} onChange={e => setForm(f => ({ ...f, entite: e.target.value }))} placeholder={r.entityPlaceholder} className={sel} />
          </div>
          <div className="flex flex-wrap gap-4 items-center text-xs text-gray-600 dark:text-gray-300">
            <span className="font-medium">{r.inherent}:</span> {cote(form.gi, v => setForm(f => ({ ...f, gi: v })), r.gravity)} {cote(form.vi, v => setForm(f => ({ ...f, vi: v })), r.likelihood)}
            <span className="font-medium">{r.residual}:</span> {cote(form.gr, v => setForm(f => ({ ...f, gr: v })), r.gravity)} {cote(form.vr, v => setForm(f => ({ ...f, vr: v })), r.likelihood)}
            <select value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value }))} className={sel}>
              {RISK_STATUTS.map(s => <option key={s} value={s}>{(r.statuts as Record<string, string>)[s] ?? s}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={submit} disabled={busy} className="btn-primary text-sm disabled:opacity-50">{editId ? r.save : r.add}</button>
            <button onClick={() => { setShowForm(false); setEditId(null); setError(null) }} className="text-sm text-gray-500 hover:text-gray-700">{r.cancel}</button>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-3">{r.colIntitule}</th>
              <th className="px-4 py-3">{r.colCategory}</th>
              <th className="px-4 py-3">{r.colProcess}</th>
              <th className="px-4 py-3">{r.colInherent}</th>
              <th className="px-4 py-3">{r.colResidual}</th>
              <th className="px-4 py-3">{r.colStatut}</th>
              <th className="px-4 py-3">{r.colActions}</th>
              {canEdit && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={8} className="px-4 py-6 text-gray-400">…</td></tr>
              : risks.length === 0 ? <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400 italic">{r.empty}</td></tr>
              : risks.map(x => (
                <Fragment key={x.id}>
                <tr className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">
                    {x.intitule}
                    {x.provenance !== 'MANUEL' && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-ebios-100 text-ebios-700">{x.provenance}</span>}
                    {x.entite && <span className="block text-xs text-gray-400">{x.entite}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{taxoLabel(x.taxonomieCode)}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{x.processusNom ?? '—'}</td>
                  <td className="px-4 py-3"><span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${niveauColor(x.niveauInherent)}`}>{x.niveauInherent ?? '—'}</span></td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${niveauColor(x.niveauResiduel)}`}>{x.niveauResiduel ?? '—'}</span>
                    {x.controleEfficacite && x.controleEfficacite.vraisemblanceSuggeree != null && x.controleEfficacite.evaluees > 0 && x.controleEfficacite.vraisemblanceSuggeree !== x.vraisemblanceResiduelle && (
                      <button
                        onClick={() => appliquerSuggestion(x, 'controles')}
                        title={r.calibration.hintControles
                          .replace('{n}', String(x.controleEfficacite.evaluees))
                          .replace('{t}', String(x.controleEfficacite.tauxConformite))
                          .replace('{v}', String(x.controleEfficacite.vraisemblanceSuggeree))}
                        className="block mt-1 text-[10px] text-ebios-600 hover:underline whitespace-nowrap"
                      >
                        {r.calibration.badgeControles.replace('{v}', String(x.controleEfficacite.vraisemblanceSuggeree))}
                      </button>
                    )}
                    {x.calibration && x.calibration.vraisemblanceSuggeree != null && x.calibration.vraisemblanceSuggeree !== x.vraisemblanceResiduelle && (
                      <button
                        onClick={() => appliquerSuggestion(x)}
                        title={r.calibration.hint
                          .replace('{n}', String(x.calibration.occurrences))
                          .replace('{v}', String(x.calibration.vraisemblanceSuggeree))}
                        className="block mt-1 text-[10px] text-ebios-600 hover:underline whitespace-nowrap"
                      >
                        {r.calibration.badge
                          .replace('{n}', String(x.calibration.occurrences))
                          .replace('{v}', String(x.calibration.vraisemblanceSuggeree))}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{(r.statuts as Record<string, string>)[x.statut] ?? x.statut}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setExpandedId(id => id === x.id ? null : x.id)} className="inline-flex items-center gap-1.5 text-xs">
                      <ProgressBadge s={x.actionsSummary} labels={r.plan} />
                      <span className="text-gray-400">{expandedId === x.id ? '▾' : '▸'}</span>
                    </button>
                  </td>
                  {canEdit && <td className="px-4 py-3 whitespace-nowrap text-right">
                    <button onClick={() => startEdit(x)} className="text-xs text-ebios-600 hover:underline mr-2">{r.edit}</button>
                    <button onClick={() => remove(x.id)} className="text-xs text-red-500 hover:underline">{r.delete}</button>
                  </td>}
                </tr>
                {expandedId === x.id && (
                  <tr className="bg-gray-50/60 dark:bg-gray-800/30">
                    <td colSpan={canEdit ? 8 : 7} className="px-4 py-4">
                      <RiskActionsPanel riskId={x.id} canEdit={canEdit} onChange={reload} />
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

// Pastille de synthèse du plan d'action : taux d'avancement + alerte de retard.
function ProgressBadge({ s, labels }: { s: ActionsSummary; labels: Record<string, string> }) {
  if (s.total === 0) return <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-400">{labels.none}</span>
  const cls = s.enRetard > 0 ? 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300'
    : s.tauxAvancement === 100 ? 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300'
    : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {s.tauxAvancement}% · {s.faits}/{s.total}
      {s.enRetard > 0 && <span className="ml-1">⚠ {s.enRetard}</span>}
    </span>
  )
}
