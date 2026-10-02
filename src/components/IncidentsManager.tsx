'use client'

// ─── Gestion des incidents ────────────────────────────────────────────────────
//
// Registre des incidents : saisie, taxonomie, transitions de statut gardées
// (lib/incident), détection de doublons (lib/incident-dedup). Colonnes triables
// et filtrables « façon tableur » via ColumnMenu (lib/table-sort + table-filter).
// Un incident peut être promu en plan d'action (cf. TraitementPopover / conformité).

import { Siren, Info, X, Copy } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/context'
import { taxonomieLabel, type TaxonomieNode } from '@/lib/taxonomie'
import { INCIDENT_STATUTS, transitionAutorisee, type IncidentStatut } from '@/lib/incident'
import ColumnMenu from '@/components/ColumnMenu'
import { nextSort, sortRows, type SortState, type SortDir } from '@/lib/table-sort'
import { distinctValues, applyColumnFilters, toggleColumnValue, onlyColumnValue, clearColumnFilter, type ColumnFilters } from '@/lib/table-filter'
import { findIncidentDuplicates } from '@/lib/incident-dedup'
import { todayInputDate, suggestionsFromValues } from '@/lib/form-defaults'
import AutocompleteInput from '@/components/AutocompleteInput'
import { mostFrequentString } from '@/lib/most-frequent'
import ChampsPersonnalisesFields from '@/components/ChampsPersonnalisesFields'
import { usePersonnalisationChamps } from '@/components/usePersonnalisationChamps'
import type { ChampsValeurs } from '@/lib/champs-perso'
import IncidentAnalysePanel, { type AnalyseValue } from '@/components/IncidentAnalysePanel'
import NotificationsPanel, { type HorlogeRegimeJson } from '@/components/NotificationsPanel'
import DeclarationModal from '@/components/DeclarationModal'
import IncidentTypePicker from '@/components/IncidentTypePicker'
import { incidentTypeByKey } from '@/lib/incident-types-catalogue'
import PertesEditor from '@/components/PertesEditor'
import IncidentsConfigEditor from '@/components/IncidentsConfigEditor'
import type { IncidentsConfig, IncidentsConfigRaw } from '@/lib/incidents-config'
import type { LignePerte, LigneRecuperation } from '@/lib/pertes'

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
  doublons?: { id: string; intitule: string; statut: string; score: number }[]
  // Lot L1
  typeEvenement?: string | null; quasiIncident?: boolean; champs?: ChampsValeurs; catalogueKey?: string | null
  causeRacine?: string | null; causeDetail?: string | null; leconsApprises?: string | null
  chronologie?: AnalyseValue['chronologie']; impactsNonFinanciers?: AnalyseValue['impactsNonFinanciers']; allocations?: AnalyseValue['allocations']
  attributs?: { significatif?: boolean; donneesPersonnelles?: boolean; contractuel?: boolean; regimes?: string[] }
  pertes?: LignePerte[]; recuperationsLignes?: LigneRecuperation[]; dateReglement?: string | null
  l1?: { horloges: HorlogeRegimeJson[]; nbEnRetard: number; totaux: { net: number | null }; seuils: { collectee: boolean; grandePerte: boolean } }
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
  typeEvenement: string; quasiIncident: boolean; significatif: boolean; donneesPersonnelles: boolean; contractuel: boolean
  champs: ChampsValeurs
  catalogueKey: string
}
const EMPTY_DECL: DeclForm = { intitule: '', description: '', dateSurvenance: '', dateDetection: '', processusId: '', entite: '', impactEstime: '', typeEvenement: '', quasiIncident: false, significatif: false, donneesPersonnelles: false, contractuel: false, catalogueKey: '', champs: {} }
// Formulaire de déclaration vierge : dates de survenance et détection = aujourd'hui
// par défaut (l'incident vient en général d'être constaté). Modifiables.
function emptyDecl(): DeclForm {
  return { ...EMPTY_DECL, dateSurvenance: todayInputDate(), dateDetection: todayInputDate() }
}

// Formulaire de QUALIFICATION (2ᵉ ligne) : taxonomie, pertes, rattachement.
type QualForm = {
  taxonomieCode: string; riskItemId: string; statut: string; clotureCommentaire: string
  typeEvenement: string; quasiIncident: boolean; significatif: boolean; donneesPersonnelles: boolean; contractuel: boolean; dateReglement: string
  champs: ChampsValeurs
}
const EMPTY_QUAL: QualForm = { taxonomieCode: '', riskItemId: '', statut: 'QUALIFIE', clotureCommentaire: '', typeEvenement: '', quasiIncident: false, significatif: false, donneesPersonnelles: false, contractuel: false, dateReglement: '', champs: {} }

const STATUT_BADGE: Record<string, string> = {
  DECLARE: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  QUALIFIE: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  CLOTURE: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  REJETE: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300',
}

export default function IncidentsManager({ canQualify, canConfigure = false }: { canQualify: boolean; canConfigure?: boolean }) {
  const { t, locale } = useTranslation()
  const n = t.incidents
  // Filtre par statut piloté par l'URL (deep-link pilotage : ?statut=DECLARE).
  const _sp = useSearchParams()
  const _stInit = (_sp.get('statut') || '').toUpperCase()
  const [filtreStatut, setFiltreStatut] = useState<string>(INCIDENT_STATUTS.includes(_stInit as IncidentStatut) ? _stInit : '')
  const [sort, setSort] = useState<SortState | null>(null)
  const onSort = (key: string) => setSort((s) => nextSort(s, key))
  const onSortDir = (key: string, dir: SortDir) => setSort({ key, dir })
  const [colFilters, setColFilters] = useState<ColumnFilters>({})
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [taxo, setTaxo] = useState<TaxonomieNode[]>([])
  const [procs, setProcs] = useState<Proc[]>([])
  const [risks, setRisks] = useState<Risk[]>([])
  const [loading, setLoading] = useState(true)
  const [decl, setDecl] = useState<DeclForm>(emptyDecl)
  const [showDecl, setShowDecl] = useState(false)
  const [qualId, setQualId] = useState<string | null>(null)
  const [qual, setQual] = useState<QualForm>(EMPTY_QUAL)
  const [qualPertes, setQualPertes] = useState<{ pertes: LignePerte[]; recups: LigneRecuperation[] }>({ pertes: [], recups: [] })
  const [cfg, setCfg] = useState<IncidentsConfig | null>(null)
  const [showConfig, setShowConfig] = useState(false)
  const [configMsg, setConfigMsg] = useState<string | null>(null)
  const [notifId, setNotifId] = useState<string | null>(null)
  const [declId, setDeclId] = useState<string | null>(null)
  const defsChamps = usePersonnalisationChamps('incident')
  const [analyse, setAnalyse] = useState<AnalyseValue>({ causeRacine: '', causeDetail: '', leconsApprises: '', chronologie: [], impactsNonFinanciers: [], allocations: [] })
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doraDetailId, setDoraDetailId] = useState<string | null>(null)

  const tr = useMemo(() => (key: string) => key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], t) as string ?? '', [t])
  const taxoLabel = (code: string | null) => {
    if (!code) return '—'
    const node = taxo.find(x => x.code === code)
    return node ? taxonomieLabel(node, tr) : code
  }
  const devise = cfg?.deviseReference ?? 'EUR'
  const euros = (v: number | null) =>
    v == null ? '—' : new Intl.NumberFormat(locale, { style: 'currency', currency: devise, maximumFractionDigits: 0 }).format(v)

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
    if (ii.config) setCfg(ii.config)
    setIncidents(ii.incidents ?? []); setTaxo(tt.taxonomie ?? []); setProcs(pp.processus ?? [])
    setRisks((rr.risks ?? []).map((r: Risk) => ({ id: r.id, intitule: r.intitule })))
    setLoading(false)
  }
  useEffect(() => { reload() }, [])

  function err(code: string) { return (n.errors as Record<string, string>)[code] ?? (n.l1b.errors as Record<string, string>)[code] ?? (t.personnalisation.errors as Record<string, string>)[code] ?? code }

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
        // Le type d'un incident type n'est envoyé que s'il est actif au catalogue de l'organisation (sinon : non renseigné, jamais une erreur).
        typeEvenement: decl.typeEvenement && (!cfg || cfg.typesEvenement.some(x => x.code === decl.typeEvenement && x.actif)) ? decl.typeEvenement : null,
        quasiIncident: decl.quasiIncident, champs: decl.champs,
        ...(decl.catalogueKey ? { catalogueKey: decl.catalogueKey, causeRacine: incidentTypeByKey(decl.catalogueKey)?.causeRacine } : {}),
        attributs: { significatif: decl.significatif, donneesPersonnelles: decl.donneesPersonnelles, contractuel: decl.contractuel },
      }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(err(data.error ?? 'erreur')); return }
    setDecl(emptyDecl()); setShowDecl(false); reload()
  }

  function startQual(i: Incident) {
    setQualId(i.id); setError(null)
    const a = i.attributs ?? {}
    setQual({
      taxonomieCode: i.taxonomieCode ?? '', riskItemId: i.riskItemId ?? '',
      statut: i.statut === 'DECLARE' ? 'QUALIFIE' : i.statut, clotureCommentaire: '',
      typeEvenement: i.typeEvenement ?? '', quasiIncident: !!i.quasiIncident,
      significatif: !!a.significatif, donneesPersonnelles: !!a.donneesPersonnelles, contractuel: !!a.contractuel,
      dateReglement: i.dateReglement ? i.dateReglement.slice(0, 10) : '', champs: i.champs ?? {},
    })
    // Lignes existantes ; à défaut, on amorce avec les agrégats historiques (montant brut / récupérations).
    const ref = cfg?.deviseReference ?? 'EUR'
    const pertes = i.pertes && i.pertes.length ? i.pertes : (i.montantBrut ? [{ type: 'PERTE_DIRECTE', montant: i.montantBrut, devise: ref, statut: 'ESTIME' as const }] : [])
    const recups = i.recuperationsLignes && i.recuperationsLignes.length ? i.recuperationsLignes : (i.recuperations ? [{ type: 'AUTRE', montant: i.recuperations, devise: ref }] : [])
    setQualPertes({ pertes, recups })
    setAnalyse({ causeRacine: i.causeRacine ?? '', causeDetail: i.causeDetail ?? '', leconsApprises: i.leconsApprises ?? '', chronologie: i.chronologie ?? [], impactsNonFinanciers: i.impactsNonFinanciers ?? [], allocations: i.allocations ?? [] })
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
        pertes: qualPertes.pertes, recuperationsLignes: qualPertes.recups,
        typeEvenement: qual.typeEvenement || null, quasiIncident: qual.quasiIncident, dateReglement: qual.dateReglement || null, champs: qual.champs,
        causeRacine: analyse.causeRacine || null, causeDetail: analyse.causeDetail || null, leconsApprises: analyse.leconsApprises || null,
        chronologie: analyse.chronologie.map(e => ({ ...e, date: e.date.length === 16 ? `${e.date}:00Z` : e.date })), impactsNonFinanciers: analyse.impactsNonFinanciers, allocations: analyse.allocations.filter(a => a.entite.trim()),
        attributs: { significatif: qual.significatif, donneesPersonnelles: qual.donneesPersonnelles, contractuel: qual.contractuel },
        riskItemId: qual.riskItemId || null, statut: qual.statut,
        clotureCommentaire: qual.clotureCommentaire || null,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(err(data.error ?? 'erreur')); return }
    setQualId(null); reload()
  }

  // Rapprochement LDC ↔ comptabilité (B-PER-6) : lecture seule, écarts listés.
  async function rapprocherCompta(file: File) {
    setBusy(true); setError(null); setImportMsg(null)
    const csv = await file.text()
    const res = await fetch('/api/incidents/rapprochement', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csv }) })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(err(data.error ?? 'erreur')); return }
    const s = data.synthese as { ok: number; ecarts: number; absentsLdc: number; absentsCompta: number; ecartTotal: number }
    const ecarts = (data.lignes as { reference: string; ldc: number; compta: number; statut: string }[]).filter(l => l.statut !== 'OK').slice(0, 5)
      .map(l => n.l1b.rapproEcart.replace('{r}', l.reference).replace('{ldc}', String(l.ldc)).replace('{compta}', String(l.compta))).join(' · ')
    const erreurs = (data.erreurs as { ligne: number; error: string }[]).slice(0, 3).map(x => n.l1b.rapproLigne.replace('{l}', String(x.ligne)).replace('{e}', err(x.error))).join(' · ')
    setImportMsg([n.l1b.rapproResultat.replace('{ok}', String(s.ok)).replace('{e}', String(s.ecarts)).replace('{l}', String(s.absentsLdc)).replace('{c}', String(s.absentsCompta)).replace('{t}', String(s.ecartTotal)), ecarts, erreurs].filter(Boolean).join(' '))
  }

  // Import CSV (historique, export SIEM/ITSM) : 2ᵉ ligne ; résultat par ligne.
  async function importerCsv(file: File) {
    setBusy(true); setError(null); setImportMsg(null)
    const csv = await file.text()
    const res = await fetch('/api/incidents/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csv }) })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(err(data.error ?? 'erreur')); return }
    const detail = (data.erreurs as { ligne: number; error: string }[]).slice(0, 5).map(x => n.l1b.importLigne.replace('{l}', String(x.ligne)).replace('{e}', err(x.error))).join(' · ')
    setImportMsg(`${n.l1b.importResultat.replace('{n}', String(data.crees)).replace('{e}', String(data.erreurs.length))}${data.tronque ? ` ${n.l1b.importTronque}` : ''}${detail ? ` ${detail}` : ''}`)
    reload()
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

  // Notifications réglementaires / contractuelles : marquer / annuler la soumission d'une phase.
  async function marquerNotification(id: string, regime: string, phase: string, reference: string) {
    setBusy(true); setError(null)
    const res = await fetch(`/api/incidents/${id}/notifications`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regime, phase, ...(reference.trim() ? { reference: reference.trim() } : {}) }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(err(data.error ?? 'erreur')); return }
    reload()
  }
  async function annulerNotification(id: string, regime: string, phase: string) {
    setBusy(true); setError(null)
    const res = await fetch(`/api/incidents/${id}/notifications`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ regime, phase }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(err(data.error ?? 'erreur')); return }
    reload()
  }
  async function enregistrerConfig(raw: IncidentsConfigRaw) {
    setBusy(true); setConfigMsg(null)
    const res = await fetch('/api/incidents/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(raw) })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setConfigMsg(n.configError.replace('{error}', String(data.error ?? res.status))); return }
    setConfigMsg(n.configSaved); reload()
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

  const INC_STATUT_RANK: Record<string, number> = Object.fromEntries(INCIDENT_STATUTS.map((s, i) => [s, i]))
  const incAccessor = (i: Incident, key: string): unknown => {
    switch (key) {
      case 'incident': return i.intitule
      case 'category': return taxoLabel(i.taxonomieCode)
      case 'process': return i.processusNom
      case 'perte': return i.perteNette
      case 'risque': return i.riskItemIntitule
      case 'statut': return INC_STATUT_RANK[i.statut] ?? 99
      default: return ''
    }
  }
  const incDisplay = (i: Incident, key: string): unknown => {
    switch (key) {
      case 'category': return taxoLabel(i.taxonomieCode)
      case 'process': return i.processusNom ?? ''
      case 'risque': return i.riskItemIntitule ?? ''
      case 'statut': return (n.statuts as Record<string, string>)[i.statut] ?? i.statut
      default: return ''
    }
  }
  const baseIncidents = filtreStatut ? incidents.filter(i => i.statut === filtreStatut) : incidents
  const distinctInc = (key: string) => distinctValues(baseIncidents, (i) => incDisplay(i, key))
  const incColFiltered = applyColumnFilters(baseIncidents, colFilters, incDisplay)
  const visibleIncidents = sort ? sortRows(incColFiltered, sort, incAccessor) : incColFiltered
  const onColToggle = (key: string, value: string) => setColFilters((f) => toggleColumnValue(f, key, value, distinctInc(key)))
  const onColOnly = (key: string, value: string) => setColFilters((f) => onlyColumnValue(f, key, value))
  const onColClear = (key: string) => setColFilters((f) => clearColumnFilter(f, key))
  const inp = 'px-2 py-1.5 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm'
  // Suggestions d'entités à partir des incidents déjà saisis (org courante).
  const entiteSug = suggestionsFromValues(incidents.map(i => i.entite))
  const defaultEntite = mostFrequentString(incidents.map(i => i.entite))
  const totalPertes = incidents.reduce((s, i) => s + (i.perteNette ?? 0), 0)
  const ouverts = incidents.filter(i => i.statut === 'DECLARE').length

  // Doublons probables du signalement en cours de saisie (avant création) — calculés
  // côté client sur les incidents déjà chargés (1 événement = 1 enregistrement).
  const declDoublons = useMemo(() => {
    if (decl.intitule.trim().length < 4) return []
    return findIncidentDuplicates(
      { id: 'nouveau', intitule: decl.intitule, statut: 'DECLARE', dateSurvenance: decl.dateSurvenance || null, dateDetection: decl.dateDetection || null, processusId: decl.processusId || null, entite: decl.entite || null },
      incidents.map(i => ({ id: i.id, intitule: i.intitule, statut: i.statut, dateSurvenance: i.dateSurvenance, dateDetection: i.dateDetection, processusId: i.processusId, entite: i.entite })),
    ).slice(0, 4)
  }, [decl.intitule, decl.dateSurvenance, decl.dateDetection, decl.processusId, decl.entite, incidents])

  return (
    <div>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100"><Siren size={22} className="inline align-[-0.15em] mr-2" aria-hidden="true" /> {n.title}</h1>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 dark:text-gray-400">{n.exportLdc}</span>
          <button onClick={() => exportLdc('csv')} className="btn-secondary text-xs">{t.filtres.csv}</button>
          <button onClick={() => exportLdc('xlsx')} className="btn-secondary text-xs">{t.filtres.xlsx}</button>
          <button onClick={exportIts} className="btn-secondary text-xs" title={n.doraItsHint}>{n.doraExportIts}</button>
          {canQualify && <label className="btn-secondary text-xs cursor-pointer" title={n.l1b.importHint}>{n.l1b.importBtn}<input type="file" accept=".csv,text/csv" className="sr-only" aria-label={n.l1b.importBtn} onChange={e => { const f = e.target.files?.[0]; if (f) importerCsv(f); e.target.value = '' }} /></label>}
          {canQualify && <label className="btn-secondary text-xs cursor-pointer" title={n.l1b.rapproHint}>{n.l1b.rapproBtn}<input type="file" accept=".csv,text/csv" className="sr-only" aria-label={n.l1b.rapproBtn} onChange={e => { const f = e.target.files?.[0]; if (f) rapprocherCompta(f); e.target.value = '' }} /></label>}
          {canConfigure && <button onClick={() => { setShowConfig(v => !v); setConfigMsg(null) }} className="btn-secondary text-xs">{n.configBtn}</button>}
          {!showDecl && <button onClick={() => { setDecl({ ...emptyDecl(), entite: defaultEntite }); setShowDecl(true) }} className="btn-primary text-sm ml-1.5">{n.declareBtn}</button>}
        </div>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{n.subtitle}</p>

      {/* Note : qui déclare — ouvert à tous, mais attendu des risk managers / métiers gestion d'incident */}
      <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-lg px-3 py-2 mb-5 text-xs text-gray-600 dark:text-gray-300">
        <Info size={14} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-300" aria-hidden="true" />
        <span>{n.declareRolesNote}</span>
      </div>

      {importMsg && <p role="status" className="mb-3 text-xs text-gray-600 dark:text-gray-300">{importMsg}</p>}
      {canConfigure && showConfig && cfg && (
        <div className="mb-5">
          <IncidentsConfigEditor key={JSON.stringify(cfg)} config={cfg} onSave={enregistrerConfig} busy={busy} />
          {configMsg && <p role="status" className="mt-2 text-xs text-gray-600 dark:text-gray-300">{configMsg}</p>}
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <button type="button" onClick={() => setFiltreStatut('')} className="text-left"><Tile label={n.total} value={incidents.length} /></button>
          <button type="button" onClick={() => setFiltreStatut(filtreStatut === 'DECLARE' ? '' : 'DECLARE')} className="text-left" title={n.dedup.queueHint}>
            <Tile label={n.aQualifier} value={ouverts} tone={ouverts > 0 ? 'amber' : undefined} />
          </button>
          <Tile label={n.perteNetteTotale} value={euros(totalPertes)} />
        </div>
      )}

      {/* Déclaration — ouverte à tous les rôles (1ʳᵉ ligne) */}
      {showDecl && (
        <div className="card p-4 mb-5 space-y-3">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{n.declareTitle}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{n.declareHint}</p>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <IncidentTypePicker selectedKey={decl.catalogueKey || null}
            onPick={tpl => setDecl(f => ({ ...f, catalogueKey: tpl.catalogueKey, intitule: tpl.intitule, description: tpl.description, typeEvenement: tpl.typeEvenement, donneesPersonnelles: tpl.donneesPersonnelles || f.donneesPersonnelles }))}
            onClear={() => setDecl(f => ({ ...f, catalogueKey: '' }))} />
          <input value={decl.intitule} onChange={e => setDecl(f => ({ ...f, intitule: e.target.value }))} placeholder={n.intitulePlaceholder} className={`${inp} w-full`} />
          {declDoublons.length > 0 && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
              <p className="font-semibold flex items-center gap-1.5"><Copy size={13} aria-hidden="true" /> {n.dedup.warnTitle}</p>
              <ul className="mt-1 space-y-0.5">
                {declDoublons.map(d => (
                  <li key={d.id}>• {d.intitule} <span className="text-amber-600 dark:text-amber-300">({(n.statuts as Record<string, string>)[d.statut] ?? d.statut})</span></li>
                ))}
              </ul>
              <p className="mt-1 text-amber-700 dark:text-amber-300/80">{n.dedup.warnHint}</p>
            </div>
          )}
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
            <AutocompleteInput field="entite" lang={locale} value={decl.entite} onChange={v => setDecl(f => ({ ...f, entite: v }))} placeholder={n.entityPlaceholder} className={inp} />
          </div>
          <L1FieldsBlock v={decl} set={patch => setDecl(f => ({ ...f, ...patch }))} cfg={cfg} n={n} inp={inp} />
          <ChampsPersonnalisesFields defs={defsChamps} values={decl.champs} onChange={v => setDecl(f => ({ ...f, champs: v }))} />
          <div className="flex gap-2">
            <button onClick={declarer} disabled={busy} className="btn-primary text-sm disabled:opacity-50">{n.declare}</button>
            <button onClick={() => { setShowDecl(false); setError(null) }} className="text-sm text-gray-500 hover:text-gray-700">{n.cancel}</button>
          </div>
        </div>
      )}

      {filtreStatut && (
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className="px-2 py-0.5 rounded-full bg-ebios-100 text-ebios-800 dark:bg-ebios-500/15 dark:text-ebios-300 font-medium">{(n.statuts as Record<string,string>)[filtreStatut] ?? filtreStatut}</span>
          <button onClick={() => setFiltreStatut('')} className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"><X size={14} /> {t.actions.clearFilters}</button>
        </div>
      )}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <ColumnMenu label={n.colIncident} sortKey="incident" sort={sort} onSortCycle={onSort} onSortDir={onSortDir} onSortClear={() => setSort(null)} className="px-4 py-3" />
              <ColumnMenu label={n.colCategory} sortKey="category" sort={sort} onSortCycle={onSort} onSortDir={onSortDir} onSortClear={() => setSort(null)} className="px-4 py-3"
                values={distinctInc('category')} allowed={colFilters.category} onToggle={onColToggle} onOnly={onColOnly} onClearFilter={onColClear} />
              <ColumnMenu label={n.colProcess} sortKey="process" sort={sort} onSortCycle={onSort} onSortDir={onSortDir} onSortClear={() => setSort(null)} className="px-4 py-3"
                values={distinctInc('process')} allowed={colFilters.process} onToggle={onColToggle} onOnly={onColOnly} onClearFilter={onColClear} />
              <ColumnMenu label={n.colPerte} sortKey="perte" sort={sort} onSortCycle={onSort} onSortDir={onSortDir} onSortClear={() => setSort(null)} align="right" className="px-4 py-3" />
              <ColumnMenu label={n.colRisque} sortKey="risque" sort={sort} onSortCycle={onSort} onSortDir={onSortDir} onSortClear={() => setSort(null)} className="px-4 py-3"
                values={distinctInc('risque')} allowed={colFilters.risque} onToggle={onColToggle} onOnly={onColOnly} onClearFilter={onColClear} />
              <ColumnMenu label={n.colStatut} sortKey="statut" sort={sort} onSortCycle={onSort} onSortDir={onSortDir} onSortClear={() => setSort(null)} className="px-4 py-3"
                values={distinctInc('statut')} allowed={colFilters.statut} onToggle={onColToggle} onOnly={onColOnly} onClearFilter={onColClear} />
              <th className="px-4 py-3">{n.colDora}</th>
              <th className="px-4 py-3">{n.colNotifs}</th>
              {canQualify && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={9} className="px-4 py-6 text-gray-400">…</td></tr>
              : visibleIncidents.length === 0 ? <tr><td colSpan={9} className="px-4 py-6 text-center text-gray-400 italic">{n.empty}</td></tr>
              : visibleIncidents.map(i => (
                <tr key={i.id} className="border-b border-gray-100 dark:border-gray-800 align-top">
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">
                    {i.intitule}
                    {i.doublons && i.doublons.length > 0 && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 px-1.5 py-px text-[10px] font-medium align-middle"
                        title={`${n.dedup.badgeHint} : ${i.doublons.map(d => d.intitule).join(' · ')}`}>
                        <Copy size={9} aria-hidden="true" /> {n.dedup.badge} ({i.doublons.length})
                      </span>
                    )}
                    {i.typeEvenement && <span className="ml-1.5 inline-block rounded-full bg-gray-100 dark:bg-gray-700 px-1.5 py-px text-[10px] font-medium text-gray-600 dark:text-gray-300 align-middle">{cfg?.typesEvenement.find(x => x.code === i.typeEvenement)?.label ?? (n.typesEvenement as Record<string, string>)[i.typeEvenement] ?? i.typeEvenement}</span>}
                    {i.quasiIncident && <span className="ml-1.5 inline-block rounded-full bg-sky-100 dark:bg-sky-500/15 px-1.5 py-px text-[10px] font-medium text-sky-800 dark:text-sky-300 align-middle">{n.quasiIncident.split(' (')[0]}</span>}
                    {i.l1?.seuils.grandePerte && <span className="ml-1.5 inline-block rounded-full bg-red-100 dark:bg-red-500/20 px-1.5 py-px text-[10px] font-medium text-red-700 dark:text-red-300 align-middle">{n.grandePerte}</span>}
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
                  <td className="px-4 py-3">
                    {i.l1 && i.l1.horloges.length > 0 ? (
                      <button onClick={() => setNotifId(i.id)} className="hover:underline focus:underline" title={n.notifTitle}>
                        {i.l1.nbEnRetard > 0
                          ? <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300 whitespace-nowrap">⚠ {n.notifEnRetard.replace('{n}', String(i.l1.nbEnRetard))}</span>
                          : <span className="text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">{i.l1.horloges.length} · {n.notifTitle}</span>}
                      </button>
                    ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                  </td>
                  {canQualify && (
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      {qualId === i.id ? (
                        <span className="text-xs text-gray-400">…</span>
                      ) : (
                        <>
                          <button onClick={() => setDeclId(i.id)} className="text-xs text-ebios-600 hover:underline mr-2">{n.decl.button}</button>
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
            {i.doublons && i.doublons.length > 0 && (
              <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                <p className="font-semibold flex items-center gap-1.5"><Copy size={13} aria-hidden="true" /> {n.dedup.qualTitle}</p>
                <ul className="mt-1 space-y-0.5">
                  {i.doublons.map(d => <li key={d.id}>• {d.intitule} <span className="text-amber-600 dark:text-amber-300">({(n.statuts as Record<string, string>)[d.statut] ?? d.statut})</span></li>)}
                </ul>
                {transitionAutorisee(depuis, 'REJETE') && (
                  <button type="button"
                    onClick={() => setQual(f => ({ ...f, statut: 'REJETE', clotureCommentaire: f.clotureCommentaire || `${n.dedup.commentPrefix} ${i.doublons![0].intitule}` }))}
                    className="mt-1.5 text-[11px] font-medium text-amber-800 dark:text-amber-200 underline hover:no-underline">
                    {n.dedup.markDuplicate}
                  </button>
                )}
              </div>
            )}
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
            </div>
            <L1FieldsBlock v={qual} set={patch => setQual(f => ({ ...f, ...patch }))} cfg={cfg} n={n} inp={inp} />
            <ChampsPersonnalisesFields defs={defsChamps} values={qual.champs} onChange={v => setQual(f => ({ ...f, champs: v }))} />
            <IncidentAnalysePanel value={analyse} onChange={setAnalyse} />
            {!qual.quasiIncident && cfg && (
              <PertesEditor pertes={qualPertes.pertes} recups={qualPertes.recups} onChange={setQualPertes}
                config={{ deviseReference: cfg.deviseReference, taux: cfg.taux, typesPerte: cfg.typesPerte }} />
            )}
            <label className="text-xs text-gray-500 dark:text-gray-400 block">{n.dateReglement}
              <input type="date" value={qual.dateReglement} onChange={e => setQual(f => ({ ...f, dateReglement: e.target.value }))} className={`${inp} block mt-1`} />
            </label>
            {(qual.statut === 'REJETE' || qual.statut === 'CLOTURE') && (
              <input value={qual.clotureCommentaire} onChange={e => setQual(f => ({ ...f, clotureCommentaire: e.target.value }))}
                placeholder={qual.statut === 'REJETE' ? n.dedup.rejetPlaceholder : n.cloturePlaceholder} className={`${inp} w-full`} />
            )}
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

      {/* Notifications à suivre (NIS2, RGPD, interne, personnalisés…) */}
      {notifId && (() => {
        const i = incidents.find(x => x.id === notifId)
        if (!i?.l1) return null
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setNotifId(null)}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-5 space-y-3" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{n.notifTitle}</p><p className="text-xs text-gray-500 dark:text-gray-400">{i.intitule}</p></div>
                <button onClick={() => setNotifId(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none" aria-label={n.cancel}>×</button>
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <NotificationsPanel horloges={i.l1.horloges} canQualify={canQualify} busy={busy}
                onMark={(r, ph, ref) => marquerNotification(i.id, r, ph, ref)} onUnmark={(r, ph) => annulerNotification(i.id, r, ph)} />
            </div>
          </div>
        )
      })()}

      {/* Déclaration réglementaire (DORA + régimes activés) */}
      {declId && (() => {
        const i = incidents.find(x => x.id === declId)
        if (!i) return null
        return <DeclarationModal incident={{ id: i.id, intitule: i.intitule, dora: i.doraReporting ?? null, horloges: i.l1?.horloges ?? [], attributs: i.attributs, catalogueKey: i.catalogueKey ?? null }}
          available={(cfg?.regimes ?? []).filter(r => r.actif).map(r => ({ code: r.code, label: r.label, labelKey: r.labelKey, autorite: r.autorite }))}
          canQualify={canQualify} onClose={() => setDeclId(null)} onChanged={() => { void reload() }} />
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

// Champs du lot L1 partagés entre déclaration et qualification : type d'événement,
// quasi-incident et obligations de notification (attributs pilotant les régimes).
type L1Fields = { typeEvenement: string; quasiIncident: boolean; significatif: boolean; donneesPersonnelles: boolean; contractuel: boolean }
function L1FieldsBlock<T extends L1Fields>({ v, set, cfg, n, inp }: { v: T; set: (patch: Partial<L1Fields>) => void; cfg: IncidentsConfig | null; n: Record<string, unknown>; inp: string }) {
  const nn = n as Record<string, string> & { typesEvenement: Record<string, string> }
  const types = (cfg?.typesEvenement ?? []).filter(x => x.actif || x.code === v.typeEvenement)
  const label = (x: { code: string; label?: string }) => x.label ?? nn.typesEvenement[x.code] ?? x.code
  return (
    <div className="space-y-2">
      {types.length > 0 && (
        <label className="text-xs text-gray-500 dark:text-gray-400 block">{nn.typeEvenement}
          <select value={v.typeEvenement} onChange={e => set({ typeEvenement: e.target.value })} className={`${inp} w-full mt-1`}>
            <option value="">—</option>
            {types.map(x => <option key={x.code} value={x.code}>{label(x)}</option>)}
          </select>
        </label>
      )}
      <fieldset className="text-xs text-gray-600 dark:text-gray-300">
        <legend className="font-medium mb-1">{nn.attributsTitle}</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={v.significatif} onChange={e => set({ significatif: e.target.checked })} />{nn.attrSignificatif}</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={v.donneesPersonnelles} onChange={e => set({ donneesPersonnelles: e.target.checked })} />{nn.attrDonnees}</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={v.contractuel} onChange={e => set({ contractuel: e.target.checked })} />{nn.attrContractuel}</label>
        </div>
      </fieldset>
      <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300" title={nn.quasiHint}>
        <input type="checkbox" checked={v.quasiIncident} onChange={e => set({ quasiIncident: e.target.checked })} />{nn.quasiIncident}
      </label>
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
