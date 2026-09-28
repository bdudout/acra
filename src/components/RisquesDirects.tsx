'use client'

// ─── Appréciation des risques — saisie directe (méthodes type ISO 31000) ─────
// Écran d'évaluation SIMPLE : un tableau de risques saisis directement (intitulé +
// gravité × vraisemblance → niveau), avec stratégie de traitement. Sans scénarios
// EBIOS. Consomme l'API /api/analyses/[id]/risques (cf. lib/risque-direct). Le
// niveau est recalculé côté serveur ; on l'affiche via le palier de la matrice.

import { useEffect, useState } from 'react'
import { Plus, Trash2, Lightbulb, ShieldCheck, Shield, ListChecks } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { resolveScaleConfig, type ScaleConfig } from '@/lib/risk-scale'
import { APPETIT_DEFAULT, type AppetitConfig } from '@/lib/appetit'
import { prioritiseRisks, countRiskDecisions, evaluateRisk, scaleLevels, scaleSeuil, type Decision, type RiskEvaluation } from '@/lib/risque-priorisation'
import RiskMesures from '@/components/RiskMesures'
import RiskPlans from '@/components/RiskPlans'
import RiskVulnerabilites from '@/components/RiskVulnerabilites'
import type { RisqueExemple } from '@/lib/risque-exemples'
import { filterByOwner, ownerFilterOptions, OWNER_NONE } from '@/lib/risque-proprietaire'
import { DOMAINES_360 } from '@/lib/projet360'

interface RisqueRow {
  id: string; nom: string; description?: string | null
  gravite: number; vraisemblance: number; niveauRisque: number; strategie: string
  // 3 niveaux : brut (ci-dessus) → actuel (mesures existantes) → résiduel (plans d'action).
  graviteActuelle?: number | null; vraisemblanceActuelle?: number | null; niveauActuel?: number | null
  graviteResiduelle?: number | null; vraisemblanceResiduelle?: number | null; niveauResiduel?: number | null
  vulnerabilites?: { description: string }[] | null
  taxonomieCode?: string | null
  proprietaire?: string | null
  /** Domaine (analyse projet 360) et analyse cyber d'origine en cas d'import. */
  domaine?: string | null
  sourceAnalyseId?: string | null
  mesuresCount?: number
  plansCount?: number
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
export type TreatmentSections = 'mesures' | 'plans' | 'both'

export default function RisquesDirects({ analyseId, editable, suggestions, mode = 'full', withVulnerabilites = false, treatmentSections, scale, appetit, ownerSuggestions = [], withDomaine = false }: {
  analyseId: string; editable: boolean; suggestions?: RisqueExemple[]; mode?: RisquesMode; withVulnerabilites?: boolean; treatmentSections?: TreatmentSections
  /** Échelle de l'organisation (4 ou 5 niveaux, paliers, matrice) — défaut EBIOS RM 4 niveaux. */
  scale?: Partial<ScaleConfig> | null
  /** Appétit au risque de l'organisation (critère d'acceptation de l'évaluation). */
  appetit?: AppetitConfig | null
  /** Suggestions de propriétaires : noms des membres de l'org + entités (P3). */
  ownerSuggestions?: string[]
  /** Analyse projet 360 : domaine par risque (ajout, ligne, filtre, colonne d'évaluation). */
  withDomaine?: boolean
}) {
  const { t } = useTranslation()
  const m = t.risquesDirects
  // Libellés des domaines lus seulement en mode 360 (t.projet360).
  const p360 = withDomaine ? t.projet360 : null
  const domaineLabel = (d: string | null | undefined) => (d && p360 ? (p360.domaines as Record<string, string>)[d] ?? d : p360?.domaineNone ?? '')
  // P1/P2 : critères de l'organisation (échelle + appétit) — cf. lib/risque-priorisation.
  const scaleCfg = resolveScaleConfig(scale)
  const evalCtx = { scale: scaleCfg, appetit: appetit ?? APPETIT_DEFAULT }
  // Sections du panneau « détails » (déplié) selon la phase :
  //  - vulnérabilités : identification (ISO 27005 uniquement) ;
  //  - mesures + plans d'action : traitement (et écran complet).
  const showVulnSection = withVulnerabilites && (mode === 'identify' || mode === 'full')
  const resolvedTreatmentSections = treatmentSections ?? (mode === 'treat' || mode === 'full' ? 'both' : undefined)
  const showMesuresSection = resolvedTreatmentSections === 'mesures' || resolvedTreatmentSections === 'both'
  const showPlansSection = resolvedTreatmentSections === 'plans' || resolvedTreatmentSections === 'both'
  const hasDetails = showVulnSection || showMesuresSection || showPlansSection
  const treatmentLabel = showMesuresSection && !showPlansSection ? m.manageMesures
    : showPlansSection && !showMesuresSection ? m.managePlans : m.manageTreatment
  // Colonnes / actions visibles selon le mode (phase). L'ajout n'existe qu'en
  // identification (et en mode complet) ; la cotation en analyse ; le traitement en
  // traitement. Le niveau est masqué tant qu'on n'a pas coté (identification).
  const showAdd = mode === 'full' || mode === 'identify'
  const showAddScoring = mode === 'full' // pas de G/V dans l'ajout en identification
  const col = {
    // Cotation BRUTE (gravité × vraisemblance) : analyse + écran complet.
    brut: mode === 'full' || mode === 'rate',
    niveau: mode !== 'identify',
    strategie: mode === 'full' || mode === 'treat',
    // Cotation RÉSIDUELLE (cible après traitement) : phase traitement + écran complet.
    residuel: mode === 'full' || mode === 'treat',
    // Cotation ACTUELLE (avec mesures de sécurité existantes) : analyse + écran complet.
    actuel: mode === 'full' || mode === 'rate',
  }
  // Nombre de colonnes du tableau standard (pour le colSpan de la sous-ligne mesures).
  const colCount = 1 + [col.brut, col.niveau, col.actuel, col.residuel, col.strategie].filter(Boolean).length + 1
  const [rows, setRows] = useState<RisqueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [nom, setNom] = useState('')
  const [gravite, setGravite] = useState(2)
  const [vraisemblance, setVraisemblance] = useState(2)
  const [busy, setBusy] = useState(false)
  const [justAddedId, setJustAddedId] = useState<string | null>(null)
  const [detailsOpenId, setDetailsOpenId] = useState<string | null>(null)
  // Filtre par propriétaire (P3) : '' = tous, OWNER_NONE = sans propriétaire.
  const [ownerFilter, setOwnerFilter] = useState('')
  // Domaine (mode 360) : filtre ('' = tous) et domaine du risque à ajouter.
  const [domaineFilter, setDomaineFilter] = useState('')
  const [newDomaine, setNewDomaine] = useState('')

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
      body: JSON.stringify({ nom, gravite, vraisemblance, ...(withDomaine ? { domaine: newDomaine || null } : {}) }),
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

  // Pastille d'un palier de l'échelle de l'organisation (couleur configurée +
  // libellé en infobulle et pour les lecteurs d'écran — pas d'information par la seule couleur).
  const seuilDot = (couleur: string) => {
    const hex = /^#?[0-9a-fA-F]{6}$/.test(couleur) ? (couleur.startsWith('#') ? couleur : `#${couleur}`) : '#9ca3af'
    return <span aria-hidden="true" className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: hex }} />
  }
  // Badge d'un niveau préfixé par son libellé (Brut / Actuel / Résiduel), coloré
  // selon le palier de l'échelle de l'organisation (matrice qualitative incluse).
  const niveauTag = (label: string, g: number, v: number, n: number) => {
    const seuil = scaleSeuil(g, v, scaleCfg)
    return <span title={seuil.label} className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
      {seuilDot(seuil.couleur)}<span className="opacity-70">{label}</span> {n}<span className="sr-only"> — {seuil.label}</span>
    </span>
  }
  const decisionBadge = (d: Decision) => (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${d === 'treat' ? TIER_CLASS.critique : TIER_CLASS.faible}`}>
      {d === 'treat' ? m.decisionTreat : m.decisionAccept}
    </span>
  )
  // Critère ayant fondé la décision : appétit (seuil) ou échelle de l'organisation.
  const basisText = (e: RiskEvaluation) => e.basis === 'APPETIT'
    ? m.basisAppetit.replace('{seuil}', String(e.seuilAppetit))
    : m.basisEchelle.replace('{palier}', e.seuil.label)

  // Cellule « niveaux » : BRUT toujours ; ACTUEL/RÉSIDUEL seulement s'ils sont
  // RÉDUITS (mesures existantes / plans d'action) — pas de bruit quand tout est égal.
  const niveauxCell = (r: RisqueRow) => {
    const brut = r.niveauRisque
    const actuel = r.niveauActuel ?? brut
    const residuel = r.niveauResiduel ?? actuel
    const gA = r.graviteActuelle ?? r.gravite, vA = r.vraisemblanceActuelle ?? r.vraisemblance
    const gR = r.graviteResiduelle ?? gA, vR = r.vraisemblanceResiduelle ?? vA
    // Écran complet (ISO 31000, NIST) : la décision d'évaluation est affichée ici
    // (pas de phase « Évaluation » dédiée) — P2 de l'audit.
    const evaluation = mode === 'full' ? evaluateRisk(r, evalCtx) : null
    return (
      <div role="group" aria-label={m.colNiveau} className="flex flex-wrap items-center gap-1.5">
        {niveauTag(m.niveauBrut, r.gravite, r.vraisemblance, brut)}
        {actuel < brut && <><span className="text-gray-400" aria-hidden="true">→</span>{niveauTag(m.niveauActuel, gA, vA, actuel)}</>}
        {residuel < actuel && <><span className="text-gray-400" aria-hidden="true">→</span>{niveauTag(m.niveauResiduel, gR, vR, residuel)}</>}
        {evaluation && <span title={basisText(evaluation)}>{decisionBadge(evaluation.decision)}</span>}
      </div>
    )
  }
  // Niveaux sélectionnables : échelle de l'organisation (1..4 ou 1..5).
  const echelle = scaleLevels(scaleCfg)

  // Cellule responsive : tableau sur écran large ; sous md, ligne libellé / valeur.
  const cell = (label: string, content: React.ReactNode) => (
    <td className="flex items-center justify-between gap-3 px-3 py-1.5 md:table-cell md:py-2">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 md:hidden">{label}</span>
      {content}
    </td>
  )
  // Paire gravité × vraisemblance d'un niveau (brut / actuel / résiduel), avec
  // abréviations traduites et libellés accessibles. Actuel ← brut, résiduel ← brut par défaut.
  const LEVELS = {
    brut:     { g: 'gravite', v: 'vraisemblance', label: m.niveauBrut },
    actuel:   { g: 'graviteActuelle', v: 'vraisemblanceActuelle', label: m.colActuelAvecMesures },
    residuel: { g: 'graviteResiduelle', v: 'vraisemblanceResiduelle', label: m.colResiduelCible },
  } as const
  const gvPair = (r: RisqueRow, level: keyof typeof LEVELS) => {
    const L = LEVELS[level]
    const gv = (r[L.g] as number | null | undefined) ?? r.gravite
    const vv = (r[L.v] as number | null | undefined) ?? r.vraisemblance
    const sel = 'px-1 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 disabled:opacity-60'
    // Valeur saisie avant un passage de l'échelle de 5 à 4 niveaux : conservée affichable.
    const opts = (cur: number) => (echelle.includes(cur) ? echelle : [...echelle, cur])
    return (
      <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
        <span aria-hidden="true" title={m.colGravite}>{m.abbrGravite}</span>
        <select aria-label={`${L.label} — ${m.colGravite}`} disabled={!editable} value={gv} onChange={e => maj(r.id, { [L.g]: Number(e.target.value) } as Partial<RisqueRow>)} className={sel}>
          {opts(gv).map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span aria-hidden="true" title={m.colVraisemblance}>{m.abbrVraisemblance}</span>
        <select aria-label={`${L.label} — ${m.colVraisemblance}`} disabled={!editable} value={vv} onChange={e => maj(r.id, { [L.v]: Number(e.target.value) } as Partial<RisqueRow>)} className={sel}>
          {opts(vv).map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
    )
  }

  // #5 — masque les suggestions déjà présentes dans le registre (dédup par intitulé).
  const existingNames = new Set(rows.map(r => (r.nom ?? '').trim().toLowerCase()))
  const shownSuggestions = (suggestions ?? []).filter(s => !existingNames.has(s.intitule.trim().toLowerCase()))

  // ── Mode review (Évaluation) : priorisation lecture seule + décision d'acceptation.
  const shownRows = filterByOwner(rows, ownerFilter).filter(r => !withDomaine || !domaineFilter || (r.domaine ?? '') === domaineFilter)
  const ownerOptions = ownerFilterOptions(rows)
  const prioritized = prioritiseRisks(shownRows, evalCtx)
  const counts = countRiskDecisions(shownRows, evalCtx)
  const datalistId = `owners-${analyseId}`
  // Propriétaire éditable sous l'intitulé (ISO 27005 §7.2.2 : dès l'identification).
  const ownerField = (r: RisqueRow) => editable
    ? <input key={`${r.id}-${r.proprietaire ?? ''}`} list={datalistId} defaultValue={r.proprietaire ?? ''} placeholder={m.proprietairePlaceholder}
        aria-label={`${m.colProprietaire} — ${r.nom}`}
        onBlur={e => { const v = e.target.value.trim(); if (v !== (r.proprietaire ?? '')) maj(r.id, { proprietaire: v || null }) }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        className="mt-1 w-full max-w-[16rem] rounded border border-transparent bg-transparent px-1 py-0.5 text-xs font-normal text-gray-600 placeholder:italic placeholder:text-gray-400 hover:border-gray-300 focus:border-ebios-400 focus:bg-white dark:text-gray-300 dark:focus:bg-gray-900" />
    : <span className="mt-0.5 block text-xs font-normal text-gray-500 dark:text-gray-400">{r.proprietaire ?? <span className="italic">{m.ownerMissing}</span>}</span>

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
          {p360 && <label className="text-xs text-gray-500 dark:text-gray-400">{p360.colDomaine}
            <select aria-label={p360.newRiskDomain} value={newDomaine} onChange={e => setNewDomaine(e.target.value)} className="block mt-1 px-2 py-1.5 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm">
              <option value="">{p360.domaineNone}</option>
              {DOMAINES_360.map(d => <option key={d} value={d}>{domaineLabel(d)}</option>)}
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

      {rows.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <label htmlFor={`${datalistId}-filter`}>{m.colProprietaire}</label>
          <select id={`${datalistId}-filter`} value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}
            className="rounded border border-gray-300 px-1.5 py-1 text-xs dark:border-gray-600 dark:bg-gray-900">
            <option value="">{m.filterOwnerAll}</option>
            <option value={OWNER_NONE}>{m.filterOwnerNone}</option>
            {ownerOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          {p360 && <select aria-label={p360.filterDomain} value={domaineFilter} onChange={e => setDomaineFilter(e.target.value)}
            className="rounded border border-gray-300 px-1.5 py-1 text-xs dark:border-gray-600 dark:bg-gray-900">
            <option value="">{p360.filterDomainAll}</option>
            {DOMAINES_360.map(d => <option key={d} value={d}>{domaineLabel(d)}</option>)}
          </select>}
          {(ownerFilter || domaineFilter) && <span>{shownRows.length} / {rows.length}</span>}
        </div>
      )}
      <datalist id={datalistId}>{ownerSuggestions.map(o => <option key={o} value={o} />)}</datalist>
      {mode === 'review' ? (
        loading ? <p className="text-xs text-gray-400">…</p>
        : rows.length === 0 ? <p className="text-xs text-gray-400 italic">{m.empty}</p>
        : (
          <div>
            <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
              {m.prioSummary.replace('{treat}', String(counts.treat)).replace('{accept}', String(counts.accept))}
            </p>
            <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">{m.evalHint}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-3 py-2">{m.colNom}</th>
                  <th className="px-3 py-2">{m.colProprietaire}</th>
                  {p360 && <th className="px-3 py-2">{p360.colDomaine}</th>}
                  <th className="px-3 py-2">{m.colNiveauEvalue}</th>
                  <th className="px-3 py-2">{m.colDecision}</th>
                  <th className="px-3 py-2">{m.colCritere}</th>
                </tr></thead>
                <tbody>
                  {prioritized.map(({ row: r, evaluation: e }) => (
                    <tr key={r.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-100">{r.nom}</td>
                      <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300">{r.proprietaire ?? <span className="italic text-amber-700 dark:text-amber-300">{m.ownerMissing}</span>}</td>
                      {p360 && <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300">{domaineLabel(r.domaine)}</td>}
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-200">
                          {seuilDot(e.seuil.couleur)}<span className="font-semibold tabular-nums">{e.niveau}</span> · {e.seuil.label}
                          {r.niveauActuel != null && r.niveauActuel < r.niveauRisque && <span className="text-gray-400">({m.niveauBrut} {r.niveauRisque})</span>}
                        </span>
                      </td>
                      <td className="px-3 py-2">{decisionBadge(e.decision)}</td>
                      <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">{basisText(e)}</td>
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
          <div className="md:overflow-x-auto">
            {/* Tableau sur écran large ; sous md, chaque ligne devient une carte
                (libellés affichés dans les cellules) — même markup, pas de duplication. */}
            <table className="block w-full text-sm md:table">
              <thead className="hidden md:table-header-group"><tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="px-3 py-2 min-w-[14rem]">{m.colNom}</th>
                {col.brut && <th className="px-3 py-2 whitespace-nowrap">{m.niveauBrut} <span className="normal-case font-normal">({m.abbrGravite}×{m.abbrVraisemblance})</span></th>}
                {col.niveau && <th className="px-3 py-2">{m.colNiveau}</th>}
                {col.actuel && <th className="px-3 py-2">{m.colActuelAvecMesures}</th>}
                {col.residuel && <th className="px-3 py-2">{m.colResiduelCible}</th>}
                {col.strategie && <th className="px-3 py-2">{m.colStrategie}</th>}
                <th className="px-3 py-2" />
              </tr></thead>
              <tbody className="block space-y-3 md:table-row-group md:space-y-0">
                {shownRows.map(r => [
                  <tr key={r.id} className={`block rounded-lg border border-gray-200 dark:border-gray-700 md:table-row md:rounded-none md:border-0 md:border-b md:border-gray-100 md:dark:border-gray-800 ${r.id === justAddedId ? 'bg-ebios-50 dark:bg-ebios-900/20 transition-colors' : ''}`}>
                    <td className="block px-3 py-2 font-medium text-gray-800 dark:text-gray-100 md:table-cell">
                      <div className="flex items-center gap-2">
                        {hasDetails && <button onClick={() => setDetailsOpenId(cur => cur === r.id ? null : r.id)} aria-expanded={detailsOpenId === r.id}
                          aria-label={treatmentLabel} title={treatmentLabel}
                          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-gray-200 bg-white px-1.5 py-1 text-xs font-medium text-gray-600 hover:border-ebios-300 hover:bg-ebios-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                          {showMesuresSection && <span className="inline-flex items-center gap-0.5 text-green-700 dark:text-green-300"><ShieldCheck size={14} aria-hidden="true" />{r.mesuresCount ?? 0}</span>}
                          {showPlansSection && <span className="inline-flex items-center gap-0.5 text-blue-700 dark:text-blue-300"><Shield size={14} aria-hidden="true" />{r.plansCount ?? 0}</span>}
                          <span className="hidden xl:inline text-[10px] text-gray-500">{showMesuresSection && showPlansSection
                            ? m.treatmentCounts.replace('{mesures}', String(r.mesuresCount ?? 0)).replace('{plans}', String(r.plansCount ?? 0))
                            : showMesuresSection ? m.mesuresCount.replace('{count}', String(r.mesuresCount ?? 0))
                              : m.plansCount.replace('{count}', String(r.plansCount ?? 0))}</span>
                        </button>}
                        <span className="min-w-0 flex-1 break-words">{r.nom}
                          {p360 && r.sourceAnalyseId && <span className="ml-2 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200">{p360.importedBadge}</span>}
                          {ownerField(r)}
                          {p360 && (editable
                            ? <select aria-label={`${p360.colDomaine} — ${r.nom}`} value={r.domaine ?? ''} onChange={e => maj(r.id, { domaine: e.target.value || null })}
                                className="mt-1 block rounded border border-gray-200 px-1 py-0.5 text-xs font-normal text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                                <option value="">{p360.domaineNone}</option>
                                {DOMAINES_360.map(d => <option key={d} value={d}>{domaineLabel(d)}</option>)}
                              </select>
                            : <span className="mt-0.5 block text-xs font-normal text-gray-500">{domaineLabel(r.domaine)}</span>)}
                        </span>
                        {editable && <button onClick={() => supprimer(r.id)} className="text-gray-400 hover:text-red-600 p-1 md:hidden" aria-label={m.delete}><Trash2 size={15} aria-hidden="true" /></button>}
                      </div>
                      {r.id === justAddedId && (
                        <button onClick={() => undoAdd(r.id)} className="ml-2 text-xs font-normal text-ebios-600 hover:text-ebios-800 underline">{m.undo}</button>
                      )}
                    </td>
                    {col.brut && cell(m.niveauBrut, gvPair(r, 'brut'))}
                    {col.niveau && cell(m.colNiveau, niveauxCell(r))}
                    {col.actuel && cell(m.colActuelAvecMesures, gvPair(r, 'actuel'))}
                    {col.residuel && cell(m.colResiduelCible, gvPair(r, 'residuel'))}
                    {col.strategie && cell(m.colStrategie,
                      <select aria-label={`${m.colStrategie} — ${r.nom}`} disabled={!editable} value={r.strategie} onChange={e => maj(r.id, { strategie: e.target.value })} className="px-1.5 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm disabled:opacity-60">
                        {STRATEGIES.map(s => <option key={s} value={s}>{(m.strategies as Record<string, string>)[s]}</option>)}
                      </select>)}
                    <td className="hidden px-3 py-2 text-right whitespace-nowrap md:table-cell">
                      {editable && <button onClick={() => supprimer(r.id)} className="text-gray-400 hover:text-red-600 p-1" aria-label={m.delete}><Trash2 size={15} aria-hidden="true" /></button>}
                    </td>
                  </tr>,
                  hasDetails && detailsOpenId === r.id && (
                    <tr key={`${r.id}-details`} className="block bg-gray-50/50 dark:bg-gray-900/20 md:table-row">
                      <td className="block px-3 pb-3 md:table-cell" colSpan={colCount}>
                        <div className="space-y-2">
                          {showVulnSection && <RiskVulnerabilites analyseId={analyseId} riskId={r.id} editable={editable} initial={r.vulnerabilites ?? []} />}
                          {showMesuresSection && <RiskMesures analyseId={analyseId} riskId={r.id} editable={editable} />}
                          {showPlansSection && <RiskPlans analyseId={analyseId} riskId={r.id} editable={editable} />}
                        </div>
                      </td>
                    </tr>
                  ),
                ])}
              </tbody>
            </table>
          </div>
        )}
    </section>
  )
}
