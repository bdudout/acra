'use client'

// ─── Appréciation des risques — saisie directe (méthodes type ISO 31000) ─────
// Écran d'évaluation SIMPLE : un tableau de risques saisis directement (intitulé +
// gravité × vraisemblance → niveau), avec stratégie de traitement. Sans scénarios
// EBIOS. Consomme l'API /api/analyses/[id]/risques (cf. lib/risque-direct). Le
// niveau est recalculé côté serveur ; on l'affiche via le palier de la matrice.

import { useEffect, useState } from 'react'
import { Plus, Trash2, Lightbulb } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { getRiskTier } from '@/lib/risk-scale'
import { prioritise, countDecisions } from '@/lib/risque-priorisation'
import type { RisqueExemple } from '@/lib/risque-exemples'

interface RisqueRow {
  id: string; nom: string; description?: string | null
  gravite: number; vraisemblance: number; niveauRisque: number; strategie: string
}
const STRATEGIES = ['REDUIRE', 'ACCEPTER', 'TRANSFERER', 'REFUSER', 'SURVEILLER'] as const
const TIER_CLASS: Record<string, string> = {
  faible:   'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-200',
  modere:   'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-200',
  eleve:    'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-200',
  critique: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-200',
}

/**
 * Mode d'affichage (différenciation des phases ISO 27005) :
 *  - full          : tout (ajout + cotation + traitement) — ISO 31000, NIST.
 *  - identify      : construire la liste (intitulés + suggestions), sans cotation.
 *  - rate          : coter gravité × vraisemblance → niveau (pas d'ajout).
 *  - treat         : choisir la stratégie de traitement (pas de cotation).
 *  - review        : priorisation lecture seule + décision d'acceptation (Évaluation).
 */
export type RisquesMode = 'full' | 'identify' | 'rate' | 'treat' | 'review'

export default function RisquesDirects({ analyseId, editable, suggestions, mode = 'full' }: { analyseId: string; editable: boolean; suggestions?: RisqueExemple[]; mode?: RisquesMode }) {
  const { t } = useTranslation()
  const m = t.risquesDirects
  // Colonnes / actions visibles selon le mode (phase). L'ajout n'existe qu'en
  // identification (et en mode complet) ; la cotation en analyse ; le traitement en
  // traitement. Le niveau est masqué tant qu'on n'a pas coté (identification).
  const showAdd = mode === 'full' || mode === 'identify'
  const showAddScoring = mode === 'full' // pas de G/V dans l'ajout en identification
  const col = {
    gravite: mode === 'full' || mode === 'rate',
    vraisemblance: mode === 'full' || mode === 'rate',
    niveau: mode !== 'identify',
    strategie: mode === 'full' || mode === 'treat',
  }
  const [rows, setRows] = useState<RisqueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [nom, setNom] = useState('')
  const [gravite, setGravite] = useState(2)
  const [vraisemblance, setVraisemblance] = useState(2)
  const [busy, setBusy] = useState(false)
  const [justAddedId, setJustAddedId] = useState<string | null>(null)

  async function reload() {
    const d = await fetch(`/api/analyses/${analyseId}/risques`).then(r => r.ok ? r.json() : { risques: [] }).catch(() => ({ risques: [] }))
    setRows(d.risques ?? []); setLoading(false)
  }
  useEffect(() => { reload() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function ajouter() {
    if (!nom.trim() || busy) return
    setBusy(true)
    const res = await fetch(`/api/analyses/${analyseId}/risques`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, gravite, vraisemblance }),
    }).catch(() => null)
    setBusy(false)
    if (res && res.ok) { setNom(''); setGravite(2); setVraisemblance(2); reload() }
  }

  async function maj(id: string, patch: Partial<RisqueRow>) {
    const res = await fetch(`/api/analyses/${analyseId}/risques/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    }).catch(() => null)
    if (res && res.ok) { const d = await res.json(); setRows(prev => prev.map(r => r.id === id ? { ...r, ...d.risque } : r)) }
  }

  async function supprimer(id: string) {
    if (!confirm(m.deleteConfirm)) return
    const res = await fetch(`/api/analyses/${analyseId}/risques/${id}`, { method: 'DELETE' }).catch(() => null)
    if (res && res.ok) setRows(prev => prev.filter(r => r.id !== id))
  }

  // Clic sur une suggestion = AJOUT DIRECT au registre (le plus simple possible),
  // avec surlignage + « Annuler » (undo) le temps que l'utilisateur vérifie. Les
  // G/V restent modifiables ensuite dans la ligne.
  async function addSuggestion(ex: RisqueExemple) {
    if (busy) return
    setBusy(true)
    const res = await fetch(`/api/analyses/${analyseId}/risques`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom: ex.intitule, gravite: ex.gravite, vraisemblance: ex.vraisemblance }),
    }).then(r => r.ok ? r.json() : null).catch(() => null)
    setBusy(false)
    const newId = res?.risque?.id as string | undefined
    await reload()
    if (newId) {
      setJustAddedId(newId)
      window.setTimeout(() => setJustAddedId(cur => (cur === newId ? null : cur)), 6000)
    }
  }

  // Undo d'un ajout : retrait OPTIMISTE immédiat (sans confirmation — l'action vient
  // d'être faite) puis suppression best-effort côté serveur.
  async function undoAdd(id: string) {
    setJustAddedId(cur => (cur === id ? null : cur))
    setRows(prev => prev.filter(r => r.id !== id))
    await fetch(`/api/analyses/${analyseId}/risques/${id}`, { method: 'DELETE' }).catch(() => null)
  }

  const niveauBadge = (n: number, g: number, v: number) => {
    const tier = getRiskTier(g * v)
    return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${TIER_CLASS[tier]}`}>{n} · {m[`tier_${tier}` as keyof typeof m] as string}</span>
  }
  const echelle = [1, 2, 3, 4]

  // #5 — masque les suggestions déjà présentes dans le registre (dédup par intitulé).
  const existingNames = new Set(rows.map(r => (r.nom ?? '').trim().toLowerCase()))
  const shownSuggestions = (suggestions ?? []).filter(s => !existingNames.has(s.intitule.trim().toLowerCase()))

  // ── Mode review (Évaluation) : priorisation lecture seule + décision d'acceptation.
  const prioritized = prioritise(rows)
  const counts = countDecisions(rows)
  const decisionBadge = (d: 'treat' | 'accept') => (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${d === 'treat' ? TIER_CLASS.critique : TIER_CLASS.faible}`}>
      {d === 'treat' ? m.decisionTreat : m.decisionAccept}
    </span>
  )

  return (
    <section className="card p-6">
      <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-1">{m.title}</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{editable ? m.subtitle : m.subtitleReadonly}</p>

      {editable && showAdd && (
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <label className="text-xs text-gray-500 dark:text-gray-400 flex-1 min-w-[12rem]">{m.colNom}
            <input value={nom} onChange={e => setNom(e.target.value)} placeholder={m.nomPlaceholder}
              className="block mt-1 w-full px-2 py-1.5 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm" />
          </label>
          {showAddScoring && <label className="text-xs text-gray-500 dark:text-gray-400">{m.colGravite}
            <select value={gravite} onChange={e => setGravite(Number(e.target.value))} className="block mt-1 px-2 py-1.5 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm">
              {echelle.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>}
          {showAddScoring && <label className="text-xs text-gray-500 dark:text-gray-400">{m.colVraisemblance}
            <select value={vraisemblance} onChange={e => setVraisemblance(Number(e.target.value))} className="block mt-1 px-2 py-1.5 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm">
              {echelle.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>}
          <button onClick={ajouter} disabled={busy || !nom.trim()} className="btn-primary text-sm inline-flex items-center gap-1 disabled:opacity-50">
            <Plus size={15} aria-hidden="true" /> {m.add}
          </button>
        </div>
      )}

      {/* Suggestions sectorielles (R3) : pré-remplissent le formulaire, modifiables avant ajout. */}
      {editable && showAdd && shownSuggestions.length > 0 && (
        <div className="mb-5">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
            <Lightbulb size={14} aria-hidden="true" />{m.suggestionsLabel}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {shownSuggestions.map((ex, i) => (
              <button key={i} type="button" onClick={() => addSuggestion(ex)} disabled={busy}
                title={m.suggestionsHint}
                className="inline-flex items-center gap-1.5 rounded-full border border-ebios-200 dark:border-ebios-900/50 bg-ebios-50/70 dark:bg-ebios-900/10 px-2.5 py-1 text-xs text-ebios-800 dark:text-ebios-200 hover:bg-ebios-100 dark:hover:bg-ebios-900/20 disabled:opacity-50">
                <Plus size={12} aria-hidden="true" />
                <span>{ex.intitule}</span>
                <span className="text-ebios-500 dark:text-ebios-400 tabular-nums">G{ex.gravite}·V{ex.vraisemblance}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === 'review' ? (
        loading ? <p className="text-xs text-gray-400">…</p>
        : rows.length === 0 ? <p className="text-xs text-gray-400 italic">{m.empty}</p>
        : (
          <div>
            <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
              {m.prioSummary.replace('{treat}', String(counts.treat)).replace('{accept}', String(counts.accept))}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-3 py-2">{m.colNom}</th>
                  <th className="px-3 py-2">{m.colNiveau}</th>
                  <th className="px-3 py-2">{m.colDecision}</th>
                </tr></thead>
                <tbody>
                  {prioritized.map(({ row: r, decision }) => (
                    <tr key={r.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-100">{r.nom}</td>
                      <td className="px-3 py-2">{niveauBadge(r.niveauRisque, r.gravite, r.vraisemblance)}</td>
                      <td className="px-3 py-2">{decisionBadge(decision)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : loading ? <p className="text-xs text-gray-400">…</p>
        : rows.length === 0 ? <p className="text-xs text-gray-400 italic">{m.empty}</p>
        : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="px-3 py-2">{m.colNom}</th>
                {col.gravite && <th className="px-3 py-2">{m.colGravite}</th>}
                {col.vraisemblance && <th className="px-3 py-2">{m.colVraisemblance}</th>}
                {col.niveau && <th className="px-3 py-2">{m.colNiveau}</th>}
                {col.strategie && <th className="px-3 py-2">{m.colStrategie}</th>}
                <th className="px-3 py-2" />
              </tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className={`border-b border-gray-100 dark:border-gray-800 ${r.id === justAddedId ? 'bg-ebios-50 dark:bg-ebios-900/20 transition-colors' : ''}`}>
                    <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-100">
                      {r.nom}
                      {r.id === justAddedId && (
                        <button onClick={() => undoAdd(r.id)} className="ml-2 text-xs font-normal text-ebios-600 hover:text-ebios-800 underline">{m.undo}</button>
                      )}
                    </td>
                    {col.gravite && <td className="px-3 py-2">
                      <select disabled={!editable} value={r.gravite} onChange={e => maj(r.id, { gravite: Number(e.target.value) })} className="px-1.5 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm disabled:opacity-60">
                        {echelle.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </td>}
                    {col.vraisemblance && <td className="px-3 py-2">
                      <select disabled={!editable} value={r.vraisemblance} onChange={e => maj(r.id, { vraisemblance: Number(e.target.value) })} className="px-1.5 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm disabled:opacity-60">
                        {echelle.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </td>}
                    {col.niveau && <td className="px-3 py-2">{niveauBadge(r.niveauRisque, r.gravite, r.vraisemblance)}</td>}
                    {col.strategie && <td className="px-3 py-2">
                      <select disabled={!editable} value={r.strategie} onChange={e => maj(r.id, { strategie: e.target.value })} className="px-1.5 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm disabled:opacity-60">
                        {STRATEGIES.map(s => <option key={s} value={s}>{(m.strategies as Record<string, string>)[s]}</option>)}
                      </select>
                    </td>}
                    <td className="px-3 py-2 text-right">
                      {editable && <button onClick={() => supprimer(r.id)} className="text-gray-400 hover:text-red-600 p-1" aria-label={m.delete}><Trash2 size={15} aria-hidden="true" /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </section>
  )
}
