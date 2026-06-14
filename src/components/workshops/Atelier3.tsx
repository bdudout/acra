'use client'

/**
 * Atelier3 — Scénarios stratégiques (EBIOS RM Workshop 3)
 *
 * Analyses the attack paths through the organisation's ecosystem:
 *  - Parties prenantes : third-party stakeholders (suppliers, partners, clients…)
 *    with dependency level and cyber exposure score
 *  - Scénarios stratégiques : high-level attack paths linking a SR/OV couple
 *    to a business value via a stakeholder, with gravité and likelihood scores
 *  - Mesures écosystème : security measures for at-risk stakeholders,
 *    selectable from the active security framework (ISO 27001, NIST CSF, etc.)
 *
 * Auto-saves via `useAutoSave`. Scenario suggestions are generated from
 * `SCENARIOS_STRATEGIQUES_EXEMPLES` filtered by DICT criteria.
 *
 * Props:
 *  - analyseId   : Prisma cuid of the parent Analyse
 *  - initialData : { partiesPrenantes, scenariosStrategiques } from DB
 *  - analyse     : parent Analyse (used for referentiel and source names)
 */

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/context'
import ConfirmDialog from '@/components/ConfirmDialog'
import AutoSaveBadge from '@/components/AutoSaveBadge'
import { useAutoSave } from '@/lib/useAutoSave'
import { useAddedFeedback } from '@/lib/useAddedFeedback'
import { NIVEAUX_VRAISEMBLANCE, NIVEAUX_GRAVITE } from '@/lib/ebios-data'
import { resolveExemples } from '@/lib/exemples-ateliers'
import { defaultExemplesFor, type ExemplesTranslations } from '@/lib/exemples-defaults'
import { getRiskTier, type RiskTier } from '@/lib/risk-scale'
import FrameworkControlsPanel from '@/components/FrameworkControlsPanel'
import { FRAMEWORK_META, type FrameworkControl, type FrameworkId } from '@/lib/frameworks-data'

interface Props {
  analyseId: string
  initialData?: { partiesPrenantes: any[]; scenariosStrategiques: any[] }
  analyse: any
}

function uid() { return Math.random().toString(36).slice(2, 9) }

// Vulnerability color map (static — labels are translated inside component)
function getVulnerabiliteColor(v: number) {
  if (v >= 4) return { color: 'text-red-600', bg: 'bg-red-50 border-red-200' }
  if (v >= 3) return { color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' }
  if (v >= 2) return { color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' }
  return { color: 'text-green-600', bg: 'bg-green-50 border-green-200' }
}

const NIVEAU_RISQUE_COLOR: Record<RiskTier, string> = {
  critique: 'bg-red-100 text-red-700 border-red-200',
  eleve:    'bg-orange-100 text-orange-700 border-orange-200',
  modere:   'bg-yellow-100 text-yellow-700 border-yellow-200',
  faible:   'bg-green-100 text-green-700 border-green-200',
}
function getNiveauRisqueColor(score: number) {
  return NIVEAU_RISQUE_COLOR[getRiskTier(score)]
}

export default function Atelier3({ analyseId, initialData, analyse }: Props) {
  const router = useRouter()
  const { t } = useTranslation()

  // Translated arrays (re-derived on locale change)
  const TYPES_PP = [
    { value: 'FOURNISSEUR',          label: t.workshop.a3.ppTypes.FOURNISSEUR },
    { value: 'CLIENT',               label: t.workshop.a3.ppTypes.CLIENT },
    { value: 'PARTENAIRE',           label: t.workshop.a3.ppTypes.PARTENAIRE },
    { value: 'PRESTATAIRE',          label: t.workshop.a3.ppTypes.PRESTATAIRE },
    { value: 'SOUS_TRAITANT',        label: t.workshop.a3.ppTypes.SOUS_TRAITANT },
    { value: 'ORGANISME_REGULATION', label: t.workshop.a3.ppTypes.ORGANISME_REGULATION },
    { value: 'AUTRE',                label: t.workshop.a3.ppTypes.AUTRE },
  ]
  const MESURES_ECOSYSTEME_TYPES: string[] = t.workshop.a3.measTypesList as unknown as string[]

  function getVulnerabiliteLabel(v: number) {
    const colors = getVulnerabiliteColor(v)
    if (v >= 4) return { label: t.workshop.a3.vulnLabels.veryHigh, ...colors }
    if (v >= 3) return { label: t.workshop.a3.vulnLabels.high, ...colors }
    if (v >= 2) return { label: t.workshop.a3.vulnLabels.moderate, ...colors }
    return { label: t.workshop.a3.vulnLabels.low, ...colors }
  }

  // Exemples : override organisation si présent, sinon défauts (ebios-data)
  const [exOverride, setExOverride] = useState<Record<string, any[]>>({})
  useEffect(() => {
    fetch('/api/admin/organization-config').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.exemplesAteliers && typeof d.exemplesAteliers === 'object' && !Array.isArray(d.exemplesAteliers)) setExOverride(d.exemplesAteliers)
    }).catch(() => {})
  }, [])
  const tEx = t as unknown as ExemplesTranslations
  const ppExamples = useMemo(() => resolveExemples(exOverride.partiesPrenantes, defaultExemplesFor('partiesPrenantes', tEx)) as any[], [t, exOverride]) // eslint-disable-line react-hooks/exhaustive-deps
  const scExamples = useMemo(() => resolveExemples(exOverride.scenariosStrategiques, defaultExemplesFor('scenariosStrategiques', tEx)) as any[], [t, exOverride]) // eslint-disable-line react-hooks/exhaustive-deps
  const meExamples = useMemo(() => resolveExemples(exOverride.mesuresEcosysteme, defaultExemplesFor('mesuresEcosysteme', tEx)) as any[], [t, exOverride]) // eslint-disable-line react-hooks/exhaustive-deps

  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{ msg: string; action: () => void } | null>(null)
  const [tab, setTab] = useState<'pp' | 'scenarios' | 'mesures'>('pp')

  const { flash: flashMesEco, isAdded: isMesEcoAdded } = useAddedFeedback()

  // ── Auto-save (defined after state declarations below) ───────────────────
  const [showPpExamples, setShowPpExamples] = useState(true)
  const [showScenExamples, setShowScenExamples] = useState(true)
  // Exemples ISO27005 masqués par défaut : le référentiel A1 est présenté en priorité
  const [showMesEcoEx, setShowMesEcoEx] = useState(false)
  const [showISO27001Eco, setShowISO27001Eco] = useState<string | null>(null) // stores scenario id

  const [parties, setParties] = useState<any[]>(initialData?.partiesPrenantes || [])
  // Reconstruire coupleLabel depuis sourceRisqueId + objectifVise au chargement depuis DB
  // (coupleLabel est un champ UI-only non persisté en base)
  const [scenarios, setScenarios] = useState<any[]>(() => {
    const allSR = analyse?.sourcesRisque?.filter((s: any) => s.retenu) || []
    return (initialData?.scenariosStrategiques || []).map((s: any) => {
      if (!s.coupleLabel && s.sourceRisqueId && s.objectifVise) {
        const sr = allSR.find((x: any) => x.id === s.sourceRisqueId)
        if (sr) return { ...s, coupleLabel: `${sr.nom} → ${s.objectifVise}` }
      }
      return s
    })
  })
  const [expanded, setExpanded] = useState<string | null>(null)

  // ── Auto-save ─────────────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const autoSaveData = useMemo(() => ({ partiesPrenantes: parties, scenariosStrategiques: scenarios }), [parties, scenarios])
  const { status: autoStatus, lastSaved, error: autoError, saveNow } = useAutoSave(
    autoSaveData,
    async (data) => {
      const res = await fetch(`/api/analyses/${analyseId}/workshop/3`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Sauvegarde échouée')
    },
    { delay: 1500 }
  )

  // Récupérer les couples SR/OV depuis l'analyse si disponibles
  const sourcesRisque: any[] = analyse?.sourcesRisque?.filter((s: any) => s.retenu) || []
  const couplesDisponibles = sourcesRisque.flatMap((sr: any) =>
    (sr.objectifsVises || []).map((ov: any) => ({
      id: `${sr.id}-${ov.id}`,
      label: `${sr.nom} → ${ov.nom}`,
      priorite: ov.priorite || 'P2',
      srId: sr.id,
      srNom: sr.nom,
      ovNom: ov.nom,
    }))
  )

  // Événements redoutés disponibles depuis l'atelier 1
  const evenementsRedoutes: any[] = analyse?.cadrage?.evenementsRedoutes || []

  function addPP(exemple?: any) {
    setParties(prev => [...prev, {
      id: uid(),
      nom: exemple?.nom || '',
      type: exemple?.type || 'PRESTATAIRE',
      description: exemple?.description || '',
      exposition: exemple?.exposition || 2,
      fiabilite: exemple?.fiabilite || 3,
      vulnerabilite: Math.ceil(((exemple?.exposition || 2) * (5 - (exemple?.fiabilite || 3))) / 4),
    }])
  }

  function updatePP(id: string, field: string, value: any) {
    setParties(prev => prev.map(p => {
      if (p.id !== id) return p
      const up = { ...p, [field]: value }
      up.vulnerabilite = Math.max(1, Math.min(4, Math.ceil((up.exposition * (5 - up.fiabilite)) / 4)))
      return up
    }))
  }

  function addScenario(exemple?: any) {
    const id = uid()
    const vr = exemple?.vraisemblanceDefaut ?? 2
    const gr = exemple?.graviteDefaut ?? 3
    const defaultCouple = couplesDisponibles[0]
    const defaultEr = evenementsRedoutes[0]
    setScenarios(prev => [...prev, {
      id,
      nom: exemple?.nom || '',
      sourceRisqueId: exemple?.sourceRisqueId || defaultCouple?.srId || '',
      objectifVise:   exemple?.objectifVise   || defaultCouple?.ovNom || '',
      coupleLabel:    exemple?.coupleLabel    || defaultCouple?.label || '',
      description: exemple?.description || '',
      evenementRedouteRef: exemple?.evenementRedouteRef || defaultEr?.description || '',
      cheminAttaque: [],
      mesuresEcosysteme: [],
      vraisemblance: vr, gravite: gr, niveauRisque: vr * gr, retenu: true,
    }])
    setExpanded(id)
    // Passer automatiquement à l'onglet scénarios si on était ailleurs
    setTab('scenarios')
  }

  function updateScenario(id: string, field: string, value: any) {
    setScenarios(prev => prev.map(s => {
      if (s.id !== id) return s
      const up = { ...s, [field]: value }
      if (field === 'vraisemblance' || field === 'gravite') {
        up.niveauRisque = up.vraisemblance * up.gravite
      }
      // Si on choisit un couple SR/OV, pré-remplir sourceRisqueId et objectifVise
      if (field === 'coupleLabel') {
        const couple = couplesDisponibles.find(c => c.label === value)
        if (couple) {
          up.sourceRisqueId = couple.srId
          up.objectifVise = couple.ovNom
        }
      }
      return up
    }))
  }

  function addMesureEcosysteme(scenarioId: string, ppNom?: string, mesure?: string) {
    setScenarios(prev => prev.map(s => {
      if (s.id !== scenarioId) return s
      return {
        ...s,
        mesuresEcosysteme: [
          ...(s.mesuresEcosysteme || []),
          { id: uid(), partiePrenante: ppNom || '', mesure: mesure || '', type: 'ORGANISATIONNELLE', statut: 'A_FAIRE' },
        ],
      }
    }))
  }

  function addMesureEcosystemeISO27001(scenarioId: string, controle: FrameworkControl) {
    setScenarios(prev => prev.map(s => {
      if (s.id !== scenarioId) return s
      return {
        ...s,
        mesuresEcosysteme: [
          ...(s.mesuresEcosysteme || []),
          {
            id: uid(),
            partiePrenante: '',
            mesure: `[${controle.ref}] ${controle.nom}`,
            type: controle.type === 'HUMAINE'       ? 'ORGANISATIONNELLE'
                : controle.type === 'PHYSIQUE'       ? 'ORGANISATIONNELLE'
                : controle.type === 'TECHNOLOGIQUE'  ? 'TECHNIQUE'
                : controle.type,
            statut: 'A_FAIRE',
          },
        ],
      }
    }))
    // Ne pas fermer le panel : l'utilisateur peut ajouter plusieurs mesures d'affilée
    // setShowISO27001Eco(null)  ← commenté intentionnellement
  }

  function updateMesure(scenarioId: string, mesureId: string, field: string, value: string) {
    setScenarios(prev => prev.map(s => {
      if (s.id !== scenarioId) return s
      return {
        ...s,
        mesuresEcosysteme: s.mesuresEcosysteme.map((m: any) => m.id === mesureId ? { ...m, [field]: value } : m),
      }
    }))
  }

  function removeMesure(scenarioId: string, mesureId: string) {
    setScenarios(prev => prev.map(s => {
      if (s.id !== scenarioId) return s
      return { ...s, mesuresEcosysteme: s.mesuresEcosysteme.filter((m: any) => m.id !== mesureId) }
    }))
  }

  async function save() {
    setSaving(true)
    await saveNow()
    setSaving(false)
    router.push(`/analyses/${analyseId}/atelier/4`)
  }

  const retained = scenarios.filter(s => s.retenu)

  // Zones de dangerosité (FM5)
  const ppByZone = {
    danger: parties.filter(p => p.vulnerabilite >= 4),
    controle: parties.filter(p => p.vulnerabilite === 3),
    veille: parties.filter(p => p.vulnerabilite <= 2),
  }

  return (
    <div className="space-y-6">
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
        <div className="flex gap-3">
          <span className="text-2xl">🗺️</span>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              {/* h3 commenté : titre déjà affiché en h1 par la page atelier */}
              {/* <h3 className="font-semibold text-orange-900">{t.workshop.a3.title}</h3> */}
              <AutoSaveBadge status={autoStatus} lastSaved={lastSaved} error={autoError} />
            </div>
            <p className="text-sm text-orange-800">{t.workshop.a3.desc}</p>
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {[
          { id: 'pp',        label: `🤝 ${t.workshop.a3.tabEco} (${parties.length})` },
          { id: 'scenarios', label: `📋 ${t.workshop.a3.tabScen} (${scenarios.length})` },
          { id: 'mesures',   label: `🛡️ ${t.workshop.a3.ecoMeasLabel}` },
        ].map(tabItem => (
          <button key={tabItem.id} onClick={() => setTab(tabItem.id as any)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === tabItem.id ? 'bg-white shadow-sm text-ebios-700' : 'text-gray-600 hover:text-gray-900'}`}>
            {tabItem.label}
          </button>
        ))}
      </div>

      {/* ── PARTIES PRENANTES ─────────────────────────────────────────────── */}
      {tab === 'pp' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-800">{t.workshop.a3.ppInfoText}</p>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">{t.workshop.a3.ecoExTitle}</h3>
              <button
                onClick={() => setShowPpExamples(v => !v)}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                {showPpExamples ? t.workshop.hideExamples : t.workshop.showExamples}
              </button>
            </div>
            {showPpExamples && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                {ppExamples.map((p: any, i) => {
                  const vuln = Math.max(1, Math.min(4, Math.ceil((p.exposition * (5 - p.fiabilite)) / 4)))
                  const { color } = getVulnerabiliteLabel(vuln)
                  const added = parties.some((x: any) => x.nom === p.nom)
                  return (
                    <button key={i} onClick={() => { if (!added) addPP(p) }}
                      className={`text-left p-3 border rounded-lg transition-all ${
                        added
                          ? 'border-green-400 bg-green-50 opacity-70 cursor-default'
                          : 'border-dashed border-gray-300 hover:border-ebios-300 hover:bg-ebios-50'
                      }`}>
                      {added && <div className="text-xs text-green-600 font-semibold mb-1">{t.workshop.addedLabel}</div>}
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700">{p.nom}</span>
                        <span className={`text-xs font-bold ${color}`}>{vuln}/4</span>
                      </div>
                      <div className="text-xs text-gray-500">{t.workshop.a3.ppExpLabel} : {p.exposition}/4 · {t.workshop.a3.ppFiabLabel} : {p.fiabilite}/4</div>
                    </button>
                  )
                })}
              </div>
            )}
            <button onClick={() => addPP()} className="btn-secondary text-sm py-1.5">{t.workshop.a3.ppAddManual}</button>
          </div>

          {/* Cartographie des zones de dangerosité FM5 */}
          {parties.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-800 mb-3">🗺️ {t.workshop.a3.ppMapTitle}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="border border-red-200 rounded-lg p-3 bg-red-50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-3 h-3 rounded-full bg-red-500"></span>
                    <span className="text-sm font-semibold text-red-800">{t.workshop.a3.zoneDangerTitle}</span>
                  </div>
                  <p className="text-xs text-red-600 mb-2">{t.workshop.a3.zoneDangerDesc}</p>
                  {ppByZone.danger.length === 0 ? <p className="text-xs text-gray-500 italic">{t.workshop.a3.zoneEmpty}</p> :
                    ppByZone.danger.map(p => <PPZoneCard key={p.id} pp={p} getVulLabel={getVulnerabiliteLabel} />)
                  }
                </div>
                <div className="border border-yellow-200 rounded-lg p-3 bg-yellow-50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                    <span className="text-sm font-semibold text-yellow-800">{t.workshop.a3.zoneControleTitle}</span>
                  </div>
                  <p className="text-xs text-yellow-600 mb-2">{t.workshop.a3.zoneControleDesc}</p>
                  {ppByZone.controle.length === 0 ? <p className="text-xs text-gray-500 italic">{t.workshop.a3.zoneEmpty}</p> :
                    ppByZone.controle.map(p => <PPZoneCard key={p.id} pp={p} getVulLabel={getVulnerabiliteLabel} />)
                  }
                </div>
                <div className="border border-green-200 rounded-lg p-3 bg-green-50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-3 h-3 rounded-full bg-green-500"></span>
                    <span className="text-sm font-semibold text-green-800">{t.workshop.a3.zoneVeilleTitle}</span>
                  </div>
                  <p className="text-xs text-green-600 mb-2">{t.workshop.a3.zoneVeilleDesc}</p>
                  {ppByZone.veille.length === 0 ? <p className="text-xs text-gray-500 italic">{t.workshop.a3.zoneEmpty}</p> :
                    ppByZone.veille.map(p => <PPZoneCard key={p.id} pp={p} getVulLabel={getVulnerabiliteLabel} />)
                  }
                </div>
              </div>
            </div>
          )}

          <div className="card p-5">
            <h3 className="font-semibold text-gray-800 mb-4">{t.workshop.a3.ppEvalTitle} ({parties.length})</h3>
            {parties.length === 0 && (
              <p className="text-sm text-gray-500 italic text-center py-8">{t.workshop.a3.ppEmpty}</p>
            )}
            <div className="space-y-2">
              {parties.map(p => {
                const { label, color } = getVulnerabiliteLabel(p.vulnerabilite)
                return (
                  <div key={p.id} className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <input value={p.nom} onChange={e => updatePP(p.id, 'nom', e.target.value)}
                        className="input text-sm col-span-2 sm:col-span-1" placeholder="Nom" />
                      <select value={p.type} onChange={e => updatePP(p.id, 'type', e.target.value)} className="input text-sm">
                        {TYPES_PP.map(tp => <option key={tp.value} value={tp.value}>{tp.label}</option>)}
                      </select>
                      <div>
                        <div className="text-xs text-gray-500 mb-0.5">{t.workshop.a3.ppExpLabel} <span className="font-medium text-gray-700">{p.exposition}/4</span></div>
                        <input type="range" min={1} max={4} value={p.exposition}
                          onChange={e => updatePP(p.id, 'exposition', parseInt(e.target.value))}
                          className="w-full accent-ebios-600" />
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-0.5">{t.workshop.a3.ppFiabLabel} <span className="font-medium text-gray-700">{p.fiabilite}/4</span></div>
                        <input type="range" min={1} max={4} value={p.fiabilite}
                          onChange={e => updatePP(p.id, 'fiabilite', parseInt(e.target.value))}
                          className="w-full accent-green-600" />
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-500 mb-0.5">{t.workshop.a3.ppDangLabel}</div>
                        <div className={`text-sm font-bold ${color}`}>{label} ({p.vulnerabilite}/4)</div>
                      </div>
                    </div>
                    <button aria-label="Supprimer" onClick={() => setPendingDelete({ msg: t.deleteDialog.pp, action: () => setParties(prev => prev.filter(x => x.id !== p.id)) })}
                      className="text-gray-500 hover:text-red-500 mt-1"><span aria-hidden="true">✕</span></button>
                  </div>
                )
              })}
            </div>
          </div>
          <button onClick={() => setTab('scenarios')} className="btn-primary">{t.workshop.a3.ppNextBtn}</button>
        </div>
      )}

      {/* ── SCÉNARIOS STRATÉGIQUES ───────────────────────────────────────── */}
      {tab === 'scenarios' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-800">
              {t.workshop.a3.scenDesc}
              {couplesDisponibles.length === 0 && <strong className="text-orange-700"> {t.workshop.a3.scenNoCouples}</strong>}
            </p>
          </div>

          {/* ── Propositions par critère DICT ─────────────────────────── */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-800">💡 {t.workshop.a3.scenExTitle}</h3>
              <button
                onClick={() => setShowScenExamples(v => !v)}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                {showScenExamples ? t.workshop.hideExamples : t.workshop.showExamples}
              </button>
            </div>
            {showScenExamples && (
              <>
                <p className="text-xs text-gray-500 mb-3">{t.workshop.a3.scenExInfo}</p>
                {(['D', 'I', 'C', 'T'] as const).map(critere => {
                  const critColors: Record<string, string> = {
                    D: 'border-green-200 bg-green-50',
                    I: 'border-blue-200 bg-blue-50',
                    C: 'border-red-200 bg-red-50',
                    T: 'border-yellow-200 bg-yellow-50',
                  }
                  const critLabels: Record<string, string> = {
                    D: '🟢 D — Disponibilité',
                    I: '🔵 I — Intégrité',
                    C: '🔴 C — Confidentialité',
                    T: '🟡 T — Traçabilité',
                  }
                  const exemples = scExamples.filter(e => e.critere === critere)
                  const alreadyHas = scenarios.some(s => s.nom && exemples.some(e => e.nom === s.nom))
                  return (
                    <div key={critere} className={`mb-3 border rounded-lg p-3 ${critColors[critere]}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-700">{critLabels[critere]}</span>
                        {alreadyHas && <span className="text-xs text-green-600 font-medium">✓ {t.workshop.a3.scenExCritere} couvert</span>}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {exemples.map((ex, i) => {
                          const alreadyAdded = scenarios.some(s => s.nom === ex.nom)
                          return (
                            <button
                              key={i}
                              onClick={() => !alreadyAdded && addScenario(ex)}
                              disabled={alreadyAdded}
                              className={`text-left p-2.5 rounded-lg border transition-colors text-xs ${
                                alreadyAdded
                                  ? 'border-gray-200 bg-white opacity-50 cursor-not-allowed'
                                  : 'border-dashed border-gray-300 bg-white hover:border-ebios-400 hover:bg-ebios-50 cursor-pointer'
                              }`}
                            >
                              <div className="font-medium text-gray-700 mb-1 leading-tight">{ex.nom}</div>
                              <div className="text-gray-500 leading-tight">{ex.description.slice(0, 80)}…</div>
                              <div className="flex gap-2 mt-1.5">
                                <span className="text-gray-500">V{ex.vraisemblanceDefaut}</span>
                                <span className="text-gray-500">G{ex.graviteDefaut}</span>
                                <span className={`font-medium ${ex.vraisemblanceDefaut * ex.graviteDefaut >= 8 ? 'text-red-600' : 'text-yellow-600'}`}>
                                  ={ex.vraisemblanceDefaut * ex.graviteDefaut}
                                </span>
                                {alreadyAdded && <span className="text-green-600 ml-auto">✓ ajouté</span>}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">{t.workshop.a3.scenTitle} ({scenarios.length})</h3>
              <button onClick={() => addScenario()} className="btn-primary text-sm py-1.5">{t.workshop.a3.scenAddBtn}</button>
            </div>

            {scenarios.length === 0 && (
              <p className="text-sm text-gray-500 italic text-center py-8">
                {t.workshop.a3.scenEmpty}
              </p>
            )}

            <div className="space-y-3">
              {scenarios.map(s => (
                <div key={s.id} className={`border rounded-xl overflow-hidden ${s.retenu ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                  <div
                    role="button"
                    tabIndex={0}
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50"
                    aria-expanded={expanded === s.id}
                    onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(expanded === s.id ? null : s.id) } }}
                  >
                    <input type="checkbox" checked={s.retenu}
                      onChange={e => { e.stopPropagation(); updateScenario(s.id, 'retenu', e.target.checked) }}
                      className="w-4 h-4 accent-ebios-600" />
                    <span className="font-medium text-gray-800 flex-1">
                      {s.nom || <em className="text-gray-500">{t.workshop.a3.scenNoTitle}</em>}
                    </span>
                    {s.coupleLabel && (
                      <span className="text-xs text-gray-500 hidden sm:block max-w-xs truncate">{s.coupleLabel}</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${getNiveauRisqueColor(s.niveauRisque)}`}>
                      {t.workshop.a3.scenRiskBadge} {s.niveauRisque}/16
                    </span>
                    <span className="text-gray-500" aria-hidden="true">{expanded === s.id ? '▲' : '▼'}</span>
                    <button aria-label="Supprimer" onClick={e => { e.stopPropagation(); setPendingDelete({ msg: t.deleteDialog.scenStrat, action: () => setScenarios(prev => prev.filter(x => x.id !== s.id)) }) }}
                      className="text-gray-500 hover:text-red-500"><span aria-hidden="true">✕</span></button>
                  </div>

                  {expanded === s.id && (
                    <div className="p-4 border-t border-gray-100 bg-gray-50 space-y-4">
                      {/* Traçabilité vers Atelier 2 */}
                      <div className="border border-indigo-200 rounded-lg p-3 bg-indigo-50">
                        <h4 className="text-xs font-semibold text-indigo-700 mb-2">{t.workshop.a3.traceTitle}</h4>
                        {couplesDisponibles.length > 0 ? (
                          <select value={s.coupleLabel || ''}
                            onChange={e => updateScenario(s.id, 'coupleLabel', e.target.value)}
                            className="input text-sm">
                            <option value="">{t.workshop.a3.selectCouplePh}</option>
                            {couplesDisponibles.map(c => (
                              <option key={c.id} value={c.label}>
                                {c.priorite === 'P1' ? '⭐ P1 ' : 'P2 '}{c.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <p className="text-xs text-indigo-600 italic">{t.workshop.a3.scenCompleteA2}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="label" htmlFor={`ss-nom-${s.id}`}>{t.workshop.nameLabel}</label>
                          <input value={s.nom} onChange={e => updateScenario(s.id, 'nom', e.target.value)}
                        id={`ss-nom-${s.id}`}
                            className="input text-sm" placeholder={t.ph.a3Scenario} />
                        </div>
                        <div>
                          <label className="label" htmlFor={`ss-ov-${s.id}`}>{t.workshop.a3.scenOVLabel}</label>
                          <input value={s.objectifVise} onChange={e => updateScenario(s.id, 'objectifVise', e.target.value)}
                        id={`ss-ov-${s.id}`}
                            className="input text-sm" placeholder={t.ph.a3Feared} />
                        </div>
                      </div>

                      {/* Lien vers Atelier 1 — ER */}
                      {evenementsRedoutes.length > 0 && (
                        <div>
                          <label className="label" htmlFor={`ss-er-${s.id}`}>{t.workshop.a3.erLinkLabel}</label>
                          <select value={s.evenementRedouteRef || ''}
                        id={`ss-er-${s.id}`}
                            onChange={e => updateScenario(s.id, 'evenementRedouteRef', e.target.value)}
                            className="input text-sm">
                            <option value="">{t.workshop.a3.selectErPh}</option>
                            {evenementsRedoutes.map((er: any) => (
                              <option key={er.id} value={er.id}>{er.description}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="label" htmlFor={`ss-desc-${s.id}`}>{t.workshop.a3.attackPathLabel}</label>
                        <textarea value={s.description} onChange={e => updateScenario(s.id, 'description', e.target.value)}
                        id={`ss-desc-${s.id}`}
                          className="input text-sm resize-none" rows={3}
                          placeholder={t.ph.a3Desc} />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="label" htmlFor={`ss-vrais-${s.id}`}>{t.workshop.a3.vraisLabel} V{s.vraisemblance} — {NIVEAUX_VRAISEMBLANCE[s.vraisemblance - 1]?.label}</label>
                          <input type="range" min={1} max={4} value={s.vraisemblance}
                          aria-label={`ss-vrais-${s.id}`}
                            onChange={e => updateScenario(s.id, 'vraisemblance', parseInt(e.target.value))}
                            className="w-full accent-ebios-600" />
                          <p className="text-xs text-gray-500 mt-1">{NIVEAUX_VRAISEMBLANCE[s.vraisemblance - 1]?.description}</p>
                        </div>
                        <div>
                          <label className="label" htmlFor={`ss-grav-${s.id}`}>{t.workshop.a3.scenGLabel} G{s.gravite} — {NIVEAUX_GRAVITE[s.gravite - 1]?.label}</label>
                          <input type="range" min={1} max={4} value={s.gravite}
                          aria-label={`ss-grav-${s.id}`}
                            onChange={e => updateScenario(s.id, 'gravite', parseInt(e.target.value))}
                            className="w-full accent-red-500" />
                          <p className="text-xs text-gray-500 mt-1">{NIVEAUX_GRAVITE[s.gravite - 1]?.description}</p>
                        </div>
                      </div>
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border ${getNiveauRisqueColor(s.niveauRisque)}`}>
                        {t.workshop.a3.riskNiveauLabel} {s.niveauRisque}/16
                        {getRiskTier(s.niveauRisque) === 'critique' && ` — ${t.workshop.a3.riskCritique}`}
                        {getRiskTier(s.niveauRisque) === 'eleve' && ` — ${t.workshop.a3.riskEleve}`}
                        {getRiskTier(s.niveauRisque) === 'modere' && ` — ${t.workshop.a3.riskModere}`}
                        {getRiskTier(s.niveauRisque) === 'faible' && ` — ${t.workshop.a3.riskFaible}`}
                      </div>

                      {/* Mesures écosystème inline */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="label mb-0">{t.workshop.a3.measEcoSectionLabel}</label>
                          <button onClick={() => addMesureEcosysteme(s.id)} className="text-xs text-ebios-600 hover:underline">{t.workshop.a3.measAddBtn}</button>
                        </div>

                        {/* Propositions ISO 27005 / ISO 27001 */}
                        <div className="mb-3 border border-dashed border-blue-200 rounded-lg">
                          <div className="flex items-center justify-between px-3 py-2 bg-blue-50 rounded-t-lg flex-wrap gap-2">
                            <span className="text-xs font-semibold text-blue-800">{t.workshop.a3.measEcoExTitle}</span>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => setShowISO27001Eco(showISO27001Eco === s.id ? null : s.id)}
                                className={`text-xs underline font-medium transition-colors ${showISO27001Eco === s.id ? 'text-indigo-700 hover:text-indigo-900' : 'text-indigo-600 hover:text-indigo-800'}`}
                              >
                                {showISO27001Eco === s.id
                                  ? `${t.workshop.a5.measRefHide} — ${FRAMEWORK_META[analyse?.referentielMesures as FrameworkId]?.nom ?? ''}`
                                  : `▼ ${FRAMEWORK_META[analyse?.referentielMesures as FrameworkId]?.nom ?? t.workshop.a5.chooseRef}`}
                              </button>
                              <button
                                onClick={() => setShowMesEcoEx(v => !v)}
                                className="text-xs text-blue-600 hover:text-blue-800 underline"
                              >
                                {showMesEcoEx ? t.workshop.hideExamples : t.workshop.showExamples}
                              </button>
                            </div>
                          </div>
                          {showMesEcoEx && (
                            <>
                              <p className="text-xs text-blue-700 px-3 py-1.5 border-b border-blue-100">{t.workshop.a3.measEcoExInfo}</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-2">
                                {meExamples.map((ex, i) => {
                                  const added = (s.mesuresEcosysteme || []).some((x: any) => x.mesure === ex.mesure)
                                  return (
                                  <button key={i}
                                    onClick={() => { if (!added) addMesureEcosysteme(s.id, '', ex.mesure) }}
                                    className={`text-left p-2 border rounded transition-all ${
                                      added
                                        ? 'bg-green-50 border-green-400 opacity-70 cursor-default'
                                        : 'bg-white border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                                    }`}>
                                    {added && <div className="text-xs text-green-600 font-semibold mb-0.5">{t.workshop.addedLabel}</div>}
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                      <span className={`text-xs px-1 py-0.5 rounded font-medium ${
                                        ex.type === 'TECHNIQUE' ? 'bg-blue-100 text-blue-700' :
                                        ex.type === 'DETECTIVE' ? 'bg-teal-100 text-teal-700' :
                                        ex.type === 'PHYSIQUE'  ? 'bg-amber-100 text-amber-700' :
                                        'bg-purple-100 text-purple-700'
                                      }`}>{ex.type}</span>
                                      <span className="text-xs text-gray-500">{t.workshop.a3.measEcoExRef} {ex.iso27005}</span>
                                    </div>
                                    <div className="text-xs font-medium text-gray-700">{ex.mesure}</div>
                                  </button>
                                  )
                                })}
                              </div>
                            </>
                          )}
                          {showISO27001Eco === s.id && (
                            <div className="p-2 border-t border-blue-100">
                              <p className="text-xs text-gray-500 mb-2 px-1">
                                {t.workshop.a5.frameworkAddDesc}
                              </p>
                              <FrameworkControlsPanel
                                frameworkId={analyse?.referentielMesures || 'ISO27001'}
                                customControles={analyse?.cadrage?.customControles}
                                onSelect={controle => addMesureEcosystemeISO27001(s.id, controle)}
                              />
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-1 mb-2">
                          {MESURES_ECOSYSTEME_TYPES.map((m, i) => {
                            const key = `mestype-${s.id}-${i}`
                            const added = isMesEcoAdded(key)
                            return (
                            <button key={i} onClick={() => { addMesureEcosysteme(s.id, '', m); flashMesEco(key) }}
                              className={`text-xs px-2 py-0.5 border rounded transition-all ${
                                added
                                  ? 'bg-green-50 border-green-400 text-green-700 opacity-70 cursor-default'
                                  : 'bg-white border-dashed border-gray-200 hover:border-ebios-400 hover:bg-ebios-50'
                              }`}>
                              {added ? '✓' : '+'} {m}
                            </button>
                            )
                          })}
                        </div>
                        {(s.mesuresEcosysteme || []).length > 0 && (
                          <div className="space-y-1">
                            {s.mesuresEcosysteme.map((m: any) => (
                              <div key={m.id} className="flex gap-2 items-center p-2 bg-white border border-gray-100 rounded">
                                <input value={m.mesure}
                                  onChange={e => updateMesure(s.id, m.id, 'mesure', e.target.value)}
                                  className="input text-xs flex-1" placeholder={t.workshop.a3.measPh} />
                                <input value={m.partiePrenante}
                                  onChange={e => updateMesure(s.id, m.id, 'partiePrenante', e.target.value)}
                                  className="input text-xs w-36" placeholder={t.workshop.a3.measPPPh} />
                                <select value={m.statut}
                                  onChange={e => updateMesure(s.id, m.id, 'statut', e.target.value)}
                                  className="input text-xs w-28">
                                  <option value="A_FAIRE">{t.workshop.a3.statutFaire}</option>
                                  <option value="EN_COURS">{t.workshop.a3.statutEnCours}</option>
                                  <option value="REALISE">{t.workshop.a3.statutRealise}</option>
                                </select>
                                <button aria-label="Supprimer" onClick={() => setPendingDelete({ msg: t.deleteDialog.mesureEco, action: () => removeMesure(s.id, m.id) })} className="text-gray-500 hover:text-red-500"><span aria-hidden="true">✕</span></button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-800">
              <strong>✅ {retained.length}</strong> {t.workshop.a3.scenSummaryRetenu} {scenarios.length} {t.workshop.a3.scenSummaryTotal}
            </p>
          </div>

          <button onClick={() => setTab('mesures')} className="btn-primary w-full text-base py-3">
            {t.workshop.a3.nextMesures}
          </button>
        </div>
      )}

      {/* ── MESURES ÉCOSYSTÈME (vue consolidée) ─────────────────────────── */}
      {tab === 'mesures' && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-sm text-green-800">{t.workshop.a3.measEcoDesc}</p>
          </div>

          {scenarios.filter(s => (s.mesuresEcosysteme || []).length > 0).length === 0 && (
            <div className="card p-8 text-center text-gray-500 italic">
              {t.workshop.a3.measEcoEmpty}
            </div>
          )}

          {scenarios.filter(s => (s.mesuresEcosysteme || []).length > 0).map(s => (
            <div key={s.id} className="card p-5">
              <h3 className="font-semibold text-gray-800 mb-1">{s.nom || t.workshop.a3.scenNoTitle}</h3>
              {s.coupleLabel && <p className="text-xs text-gray-500 mb-3">{t.workshop.a3.coupleLabel} {s.coupleLabel}</p>}
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-2 text-xs font-medium text-gray-600">{t.workshop.a3.measThMesure}</th>
                    <th className="text-left p-2 text-xs font-medium text-gray-600">{t.workshop.a3.measThPP}</th>
                    <th className="text-left p-2 text-xs font-medium text-gray-600">{t.workshop.a3.measThStatut}</th>
                  </tr>
                </thead>
                <tbody>
                  {s.mesuresEcosysteme.map((m: any) => (
                    <tr key={m.id} className="border-t border-gray-100">
                      <td className="p-2 text-gray-800">{m.mesure}</td>
                      <td className="p-2 text-gray-600">{m.partiePrenante || '—'}</td>
                      <td className="p-2">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                          m.statut === 'REALISE' ? 'bg-green-100 text-green-700' :
                          m.statut === 'EN_COURS' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {m.statut === 'REALISE' ? `✓ ${t.workshop.a3.statutRealise}` : m.statut === 'EN_COURS' ? `⏳ ${t.workshop.a3.statutEnCours}` : t.workshop.a3.statutFaire}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          <button onClick={save} disabled={saving} className="btn-primary w-full text-base py-3">
            {saving ? t.workshop.saving : t.workshop.saveNext}
          </button>
        </div>
      )}

      {pendingDelete && (
        <ConfirmDialog
          message={pendingDelete.msg}
          onConfirm={() => { pendingDelete.action(); setPendingDelete(null) }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}

function PPZoneCard({ pp, getVulLabel }: { pp: any; getVulLabel: (v: number) => { color: string } }) {
  const { color } = getVulLabel(pp.vulnerabilite)
  return (
    <div className="flex items-center justify-between p-2 bg-white rounded border border-gray-100 mb-1">
      <span className="text-xs font-medium text-gray-700">{pp.nom}</span>
      <span className={`text-xs font-bold ${color}`}>{pp.vulnerabilite}/4</span>
    </div>
  )
}
