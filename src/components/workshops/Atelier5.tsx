'use client'

/**
 * Atelier5 — Traitement du risque (EBIOS RM Workshop 5)
 *
 * The final workshop: turns the risk landscape built in A1–A4 into an
 * actionable treatment plan.
 *
 * Three tabs:
 *  - **Risques** : consolidated risk register (one row per strategic scenario)
 *    with residual gravity, likelihood, risk level, and treatment strategy
 *    (REDUIRE / ACCEPTER / TRANSFERER / REFUSER / SURVEILLER)
 *  - **Mesures** : security measures catalogue.  Each measure has a type
 *    (PREVENTIVE / DETECTIVE / CORRECTIVE / DISSUASIVE / ORGANISATIONNELLE /
 *    TECHNIQUE), an owner, a deadline, a status (A_FAIRE / EN_COURS / REALISE /
 *    REPORTE), and optional links to a cybersecurity framework control
 *    (ISO 27001, NIS2, NIST CSF …) via `FrameworkControlsPanel`.
 *  - **Synthèse** : read-only risk matrix (`RiskMatrix` component) showing
 *    residual risks, followed by export buttons (PDF / JSON).
 *
 * Treatment strategies are colour-coded via `stratColors`.
 * Example measures are seeded from `MESURES_SECURITE_EXEMPLES` (ebios-data).
 *
 * Auto-saves via `useAutoSave`.
 *
 * Props:
 *  - analyseId   : Prisma cuid of the parent Analyse
 *  - initialData : `{ risques, mesures }` pre-fetched from DB
 *  - analyse     : parent Analyse (provides strategic scenario names for the
 *                  risk register dropdown)
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/context'
import ConfirmDialog from '@/components/ConfirmDialog'
import AutoSaveBadge from '@/components/AutoSaveBadge'
import { useAutoSave } from '@/lib/useAutoSave'
import { getNiveauRisqueLabel } from '@/lib/ebios-data'
import { useEbiosData } from '@/lib/i18n/use-ebios-data'
import RiskMatrix from '@/components/RiskMatrix'
import { getRiskTier, type ScaleConfig } from '@/lib/risk-scale'
import ExportButtons from '@/components/ExportButtons'
import FrameworkControlsPanel from '@/components/FrameworkControlsPanel'
import { FRAMEWORK_META, recommendedFrameworksForSector, type FrameworkControl, type FrameworkId } from '@/lib/frameworks-data'
import { nis2CoverageForFramework } from '@/lib/nis2-mapping'
import { detectRgpdArt9 } from '@/lib/rgpd-sensitive'

interface Props {
  analyseId: string
  initialData?: { risques: any[]; mesures: any[] }
  analyse: any
  /** Onglet à afficher au chargement (ex: "mesures" depuis un deep-link /actions) */
  initialTab?: string
  /** Mode « Flash » (Club EBIOS) — parcours rapide complet (A4 réalisé) */
  flashMode?: boolean
  /** Échelle/seuils configurés (admin) pour la matrice des risques */
  scaleConfig?: ScaleConfig | null
}

function uid() { return Math.random().toString(36).slice(2, 9) }

/** Date par défaut : aujourd'hui + 3 mois, format YYYY-MM-DD */
function defaultEcheance(): string {
  const d = new Date()
  d.setMonth(d.getMonth() + 3)
  return d.toISOString().slice(0, 10)
}

const stratColors: Record<string, string> = {
  REDUIRE:    'bg-blue-100 text-blue-700',
  ACCEPTER:   'bg-green-100 text-green-700',
  TRANSFERER: 'bg-yellow-100 text-yellow-700',
  REFUSER:    'bg-red-100 text-red-700',
  SURVEILLER: 'bg-purple-100 text-purple-700',
}

export default function Atelier5({ analyseId, initialData, analyse, initialTab, flashMode, scaleConfig }: Props) {
  const router = useRouter()
  const { t } = useTranslation()
  const { STRATEGIES_TRAITEMENT, NIVEAUX_GRAVITE, NIVEAUX_VRAISEMBLANCE } = useEbiosData()

  const TYPES_MESURE = [
    { value: 'PREVENTIVE',        label: t.workshop.a5.measureTypes.PREVENTIVE },
    { value: 'DETECTIVE',         label: t.workshop.a5.measureTypes.DETECTIVE },
    { value: 'CORRECTIVE',        label: t.workshop.a5.measureTypes.CORRECTIVE },
    { value: 'DISSUASIVE',        label: t.workshop.a5.measureTypes.DISSUASIVE },
    { value: 'ORGANISATIONNELLE', label: t.workshop.a5.measureTypes.ORGANISATIONNELLE },
    { value: 'TECHNIQUE',         label: t.workshop.a5.measureTypes.TECHNIQUE },
  ]

  const STATUTS_MESURE = [
    { value: 'A_FAIRE',  label: t.workshop.a5.measureStatuses.A_FAIRE.label,  color: t.workshop.a5.measureStatuses.A_FAIRE.color },
    { value: 'EN_COURS', label: t.workshop.a5.measureStatuses.EN_COURS.label, color: t.workshop.a5.measureStatuses.EN_COURS.color },
    { value: 'REALISE',  label: t.workshop.a5.measureStatuses.REALISE.label,  color: t.workshop.a5.measureStatuses.REALISE.color },
    { value: 'REPORTE',  label: t.workshop.a5.measureStatuses.REPORTE.label,  color: t.workshop.a5.measureStatuses.REPORTE.color },
  ]

  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{ msg: string; action: () => void } | null>(null)

  const validTab = (s?: string): 'risques' | 'mesures' | 'synthese' =>
    s === 'mesures' ? 'mesures' : s === 'synthese' ? 'synthese' : 'risques'

  const [tab, setTab] = useState<'risques' | 'mesures' | 'synthese'>(() => validTab(initialTab))
  // ID de la mesure à mettre en évidence après navigation depuis /actions
  const [highlightId, setHighlightId] = useState<string | null>(null)

  // Scroll vers la mesure ciblée via le hash URL (#mesure-xxx)
  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash.slice(1) : ''
    if (!hash.startsWith('mesure-')) return
    setHighlightId(hash)
    // Délai court pour laisser le DOM s'afficher après le changement d'onglet
    const t1 = setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 250)
    // Retire le highlight après 2,5 s
    const t2 = setTimeout(() => setHighlightId(null), 2750)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Référentiel actif dans le panel multi-framework — initialisé depuis l'atelier 1
  const [activeFramework, setActiveFramework] = useState<FrameworkId | null>(
    () => (analyse?.referentielMesures as FrameworkId) ?? null
  )
  // Référentiels recommandés selon le secteur (suggestion non bloquante, cf. Atelier 1)
  const recommendedFw = recommendedFrameworksForSector(analyse?.secteur)
  // Couverture NIS2 Art. 21 du référentiel actif (différenciateur EEI/OSE)
  const nis2Coverage = useMemo(
    () => (activeFramework ? nis2CoverageForFramework(activeFramework) : []),
    [activeFramework],
  )
  const nis2CoveredCnt = nis2Coverage.filter(m => m.covered).length
  const [showNis2, setShowNis2] = useState(false)
  // Reconstruire scenarioOpNom depuis scenarioOpId au chargement depuis DB
  const [risques, setRisques] = useState<any[]>(() => {
    const allSO = analyse?.scenariosOperationnels || []
    return (initialData?.risques || []).map((r: any) => {
      if (!r.scenarioOpNom && r.scenarioOpId) {
        const so = allSO.find((x: any) => x.id === r.scenarioOpId)
        if (so) return { ...r, scenarioOpNom: so.nom }
      }
      return r
    })
  })
  const [mesures, setMesures] = useState<any[]>(initialData?.mesures || [])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // ── Entités responsables (liste configurable depuis l'admin) ──────────────
  const [entitesOrg, setEntitesOrg] = useState<string[]>([])
  // Options de traitement configurées par l'organisation (repli : défauts ebios-data)
  const [strategies, setStrategies] = useState(STRATEGIES_TRAITEMENT as readonly { value: string; label: string; color: string; description: string; conseil: string }[])
  useEffect(() => {
    fetch('/api/admin/organization-config')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.entitesMesures)) setEntitesOrg(data.entitesMesures)
        if (Array.isArray(data.strategiesTraitement) && data.strategiesTraitement.length) setStrategies(data.strategiesTraitement)
      })
      .catch(() => {})
  }, [])

  // ── Auto-save ─────────────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const autoSaveData = useMemo(() => ({ risques, mesures }), [risques, mesures])
  const { status: autoStatus, lastSaved, error: autoError, saveNow } = useAutoSave(
    autoSaveData,
    async (data) => {
      const res = await fetch(`/api/analyses/${analyseId}/workshop/5`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Sauvegarde échouée')
    },
    { delay: 1500 }
  )

  // Scénarios opérationnels pour lien de traçabilité
  const scenariosOp: any[] = analyse?.scenariosOperationnels || []
  // Événements redoutés de l'atelier 1
  const evenementsRedoutes: any[] = analyse?.cadrage?.evenementsRedoutes || []
  // EBIOS RM peut valoir AIPD (RGPD art. 35) si données particulières (art. 9) en jeu
  const aipdPertinente = detectRgpdArt9(analyse?.cadrage?.valeursMetier || []).length > 0

  function addRisque(fromScenario?: any) {
    const id = uid()
    const defaultSO = fromScenario ?? scenariosOp[0]
    setRisques(prev => [...prev, {
      id,
      nom: defaultSO ? `${t.workshop.a5.riskFromScenPrefix} ${defaultSO.nom}` : '',
      description: '',
      scenarioOpId: defaultSO?.id || '',
      scenarioOpNom: defaultSO?.nom || '',
      evenementRedouteRef: defaultSO?.evenementRedouteRef || '',
      gravite: defaultSO?.gravite || 3,
      vraisemblance: defaultSO?.vraisemblance || 2,
      niveauRisque: (defaultSO?.gravite || 3) * (defaultSO?.vraisemblance || 2),
      strategie: 'REDUIRE',
      vulnerabilitesResiduelles: [],
      facteursAggravants: [],
      graviteResiduelle: 2,
      vraisemblanceResiduelle: 1,
      niveauResiduel: 2,
      justificationResiduelle: '',
    }])
    setExpandedId(id)
  }

  function updateRisque(id: string, field: string, value: any) {
    setRisques(prev => prev.map(r => {
      if (r.id !== id) return r
      const up = { ...r, [field]: value }
      if (field === 'gravite' || field === 'vraisemblance') {
        up.niveauRisque = up.gravite * up.vraisemblance
      }
      if (field === 'graviteResiduelle' || field === 'vraisemblanceResiduelle') {
        up.niveauResiduel = (up.graviteResiduelle || 1) * (up.vraisemblanceResiduelle || 1)
      }
      // lien avec scénario op
      if (field === 'scenarioOpId') {
        const so = scenariosOp.find((s: any) => s.id === value)
        if (so) {
          up.scenarioOpNom = so.nom
          up.gravite = so.gravite
          up.vraisemblance = so.vraisemblance
          up.niveauRisque = so.gravite * so.vraisemblance
        }
      }
      return up
    }))
  }

  function addVulnResiduelle(risqueId: string) {
    setRisques(prev => prev.map(r => {
      if (r.id !== risqueId) return r
      return { ...r, vulnerabilitesResiduelles: [...(r.vulnerabilitesResiduelles || []), { id: uid(), description: '', niveau: 2 }] }
    }))
  }

  function updateVulnResiduelle(risqueId: string, vulnId: string, field: string, value: any) {
    setRisques(prev => prev.map(r => {
      if (r.id !== risqueId) return r
      return { ...r, vulnerabilitesResiduelles: r.vulnerabilitesResiduelles.map((v: any) => v.id === vulnId ? { ...v, [field]: value } : v) }
    }))
  }

  function addFacteurAggravant(risqueId: string) {
    setRisques(prev => prev.map(r => {
      if (r.id !== risqueId) return r
      return { ...r, facteursAggravants: [...(r.facteursAggravants || []), { id: uid(), description: '' }] }
    }))
  }

  function addMesure(exemple?: any) {
    setMesures(prev => [...prev, {
      id: uid(),
      nom: exemple?.nom || '',
      description: exemple?.description || '',
      type: exemple?.type || 'TECHNIQUE',
      priorite: exemple?.prioriteDefaut || 2,
      statut: 'A_FAIRE',
      responsable: '',
      entite: '',
      echeance: defaultEcheance(),
      cout: '',
      efficacite: 3,
      risqueId: exemple?.risqueId || risques[0]?.id || '',
    }])
  }

  function addMesureISO27001(controle: FrameworkControl) {
    setMesures(prev => [...prev, {
      id: uid(),
      nom: `[${controle.ref}] ${controle.nom}`,
      description: controle.description,
      type: controle.type === 'HUMAINE'       ? 'ORGANISATIONNELLE'
           : controle.type === 'TECHNOLOGIQUE' ? 'TECHNIQUE'
           : controle.type === 'PHYSIQUE'      ? 'ORGANISATIONNELLE'
           : controle.type,
      priorite: 2,
      statut: 'A_FAIRE',
      responsable: '',
      entite: '',
      echeance: defaultEcheance(),
      cout: '',
      efficacite: 3,
      risqueId: risques[0]?.id || '',
    }])
    // Ne pas fermer le panel : l'utilisateur peut ajouter plusieurs mesures d'affilée
  }

  function updateMesure(id: string, field: string, value: any) {
    setMesures(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m))
  }

  async function save(redirect = true) {
    setSaving(true)
    await saveNow()
    await fetch(`/api/analyses/${analyseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: 'TERMINE' }),
    })
    setSaving(false)
    if (redirect) router.push(`/analyses/${analyseId}`)
  }

  return (
    <div className="space-y-6">
      <div className="bg-green-50 border border-green-200 rounded-xl p-5">
        <div className="flex gap-3">
          <span className="text-2xl">🛡️</span>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              {/* h3 commenté : titre déjà affiché en h1 par la page atelier */}
              {/* <h3 className="font-semibold text-green-900">{t.workshop.a5.title}</h3> */}
              <AutoSaveBadge status={autoStatus} lastSaved={lastSaved} error={autoError} />
            </div>
            <p className="text-sm text-green-800">{t.workshop.a5.desc}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
        {[
          { id: 'risques',  label: `⚠️ ${t.workshop.a5.tabRisques} (${risques.length})` },
          { id: 'mesures',  label: `🛡️ ${t.workshop.a5.tabMesures} (${mesures.length})` },
          { id: 'synthese', label: `📊 ${t.workshop.a5.tabPlan}` },
        ].map(tabItem => (
          <button key={tabItem.id} onClick={() => setTab(tabItem.id as any)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${tab === tabItem.id ? 'bg-white shadow-sm text-ebios-700' : 'text-gray-600'}`}>
            {tabItem.label}
          </button>
        ))}
      </div>

      {/* ── RISQUES ─────────────────────────────────────────────────────── */}
      {tab === 'risques' && (
        <div className="space-y-4">
          {/* Import depuis scénarios opérationnels (A4 réalisé, y compris en mode Flash) */}
          {scenariosOp.length > 0 && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                {t.workshop.a5.soImportTitle}
              </h3>
              <div className="space-y-2">
                {scenariosOp.map((so: any) => {
                  const alreadyLinked = risques.some(r => r.scenarioOpId === so.id)
                  return (
                    <div key={so.id} className={`flex items-center gap-3 p-3 rounded-lg border ${alreadyLinked ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                      <span className="text-sm font-medium text-gray-700 flex-1">{so.nom}</span>
                      <span className="text-xs text-gray-500">{(so.vraisemblance || 2) * (so.gravite || 3)}/16</span>
                      {alreadyLinked ? (
                        <span className="text-xs text-green-600 font-medium">{t.workshop.a5.soImported}</span>
                      ) : (
                        <button onClick={() => addRisque(so)}
                          className="text-xs px-3 py-1 bg-ebios-600 text-white rounded hover:bg-ebios-700">
                          {t.workshop.a5.soImportBtn}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">{t.workshop.a5.riskListTitle} ({risques.length})</h3>
              <button onClick={() => addRisque()} className="btn-primary text-sm py-1.5">{t.workshop.a5.riskAddBtn}</button>
            </div>

            {risques.length === 0 && (
              <p className="text-sm text-gray-500 italic text-center py-8">
                {t.workshop.a5.riskEmpty}
              </p>
            )}

            <div className="space-y-3">
              {risques.map(r => {
                const niveau = getNiveauRisqueLabel(r.niveauRisque)
                const niveauResiduel = r.niveauResiduel ? getNiveauRisqueLabel(r.niveauResiduel) : null
                const reduction = r.niveauResiduel ? Math.round(((r.niveauRisque - r.niveauResiduel) / r.niveauRisque) * 100) : 0

                return (
                  <div key={r.id} className="border border-gray-200 rounded-xl overflow-hidden">
                    <div
                      role="button"
                      tabIndex={0}
                      className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50"
                      aria-expanded={expandedId === r.id}
                      onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedId(expandedId === r.id ? null : r.id) } }}
                    >
                      <span className="font-medium text-gray-800 flex-1 min-w-0 truncate">
                        {r.nom || <em className="text-gray-500">{t.workshop.a5.riskNoTitle}</em>}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${niveau.bg} ${niveau.color}`}>
                        {niveau.label} ({r.niveauRisque})
                      </span>
                      {niveauResiduel && (
                        <>
                          <span className="text-gray-500 text-xs">→</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${niveauResiduel.bg} ${niveauResiduel.color}`}>
                            {niveauResiduel.label} ({r.niveauResiduel})
                          </span>
                          {reduction > 0 && <span className="text-xs text-green-600 font-medium">-{reduction}%</span>}
                        </>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stratColors[r.strategie] || ''}`}>
                        {t.workshop.a5.stratLabels[r.strategie as keyof typeof t.workshop.a5.stratLabels]}
                      </span>
                      <span className="text-gray-500" aria-hidden="true">{expandedId === r.id ? '▲' : '▼'}</span>
                      <button aria-label="Supprimer" onClick={e => { e.stopPropagation(); setPendingDelete({ msg: t.deleteDialog.risque, action: () => setRisques(prev => prev.filter(x => x.id !== r.id)) }) }}
                        className="text-gray-500 hover:text-red-500"><span aria-hidden="true">✕</span></button>
                    </div>

                    {expandedId === r.id && (
                      <div className="p-4 border-t border-gray-100 bg-gray-50 space-y-4">
                        {/* Traçabilité */}
                        <div className="grid gap-3 border border-green-200 rounded-lg p-3 bg-green-50 grid-cols-1 sm:grid-cols-2">
                          <div>
                            <label className="label text-xs" htmlFor={`r-so-${r.id}`}>{t.workshop.a5.traceSOLabel}</label>
                            {scenariosOp.length > 0 ? (
                              <select id={`r-so-${r.id}`} value={r.scenarioOpId || ''}
                                onChange={e => updateRisque(r.id, 'scenarioOpId', e.target.value)}
                                className="input text-xs">
                                <option value="">{t.workshop.a5.selectSOPh}</option>
                                {scenariosOp.map((so: any) => (
                                  <option key={so.id} value={so.id}>{so.nom}</option>
                                ))}
                              </select>
                            ) : null}
                          </div>
                          <div>
                            <label className="label text-xs" htmlFor={`r-er-${r.id}`}>{t.workshop.a5.traceERLabel}</label>
                            {evenementsRedoutes.length > 0 ? (
                              <select id={`r-er-${r.id}`} value={r.evenementRedouteRef || ''}
                                onChange={e => updateRisque(r.id, 'evenementRedouteRef', e.target.value)}
                                className="input text-xs">
                                <option value="">{t.workshop.a5.selectERPh}</option>
                                {evenementsRedoutes.map((er: any) => (
                                  <option key={er.id} value={er.id}>{er.description}</option>
                                ))}
                              </select>
                            ) : <p className="text-xs text-gray-500 italic">{t.workshop.a5.completeA1}</p>}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="label" htmlFor={`r-nom-${r.id}`}>{t.workshop.nameLabel}</label>
                            <input id={`r-nom-${r.id}`} value={r.nom} onChange={e => updateRisque(r.id, 'nom', e.target.value)}
                              className="input text-sm" placeholder={t.ph.a5Feared} />
                          </div>
                          <div>
                            <label className="label" htmlFor={`r-strat-${r.id}`}>{t.workshop.a5.stratLabel}</label>
                            <select id={`r-strat-${r.id}`} value={r.strategie} onChange={e => updateRisque(r.id, 'strategie', e.target.value)}
                              className="input text-sm">
                              {strategies.map(s => (
                                <option key={s.value} value={s.value}>
                                  {t.workshop.a5.stratLabels[s.value as keyof typeof t.workshop.a5.stratLabels] ?? s.label} — {s.description}
                                </option>
                              ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">
                              {t.workshop.a5.stratConseil[r.strategie as keyof typeof t.workshop.a5.stratConseil]}
                            </p>
                          </div>
                        </div>

                        <div>
                          <label className="label" htmlFor={`r-desc-${r.id}`}>{t.workshop.a5.riskDescLabel}</label>
                          <textarea id={`r-desc-${r.id}`} value={r.description} onChange={e => updateRisque(r.id, 'description', e.target.value)}
                            className="input text-sm resize-none" rows={2} placeholder={t.workshop.a5.riskDescPh} />
                        </div>

                        {/* Risque initial & résiduel */}
                        <div className="grid grid-cols-2 gap-4 p-4 bg-white rounded-lg border border-gray-200">
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-3">{t.workshop.a5.initialRiskTitle}</h4>
                            <div className="space-y-2">
                              <div>
                                <label className="label text-xs">{t.workshop.a5.graviteLabel} G{r.gravite} — {NIVEAUX_GRAVITE[r.gravite - 1]?.label}</label>
                                <input type="range" min={1} max={4} value={r.gravite}
                                  onChange={e => updateRisque(r.id, 'gravite', parseInt(e.target.value))}
                                  className="w-full accent-red-500" />
                              </div>
                              <div>
                                <label className="label text-xs">{t.workshop.a5.vraisLabel} V{r.vraisemblance} — {NIVEAUX_VRAISEMBLANCE[r.vraisemblance - 1]?.label}</label>
                                <input type="range" min={1} max={4} value={r.vraisemblance}
                                  onChange={e => updateRisque(r.id, 'vraisemblance', parseInt(e.target.value))}
                                  className="w-full accent-ebios-600" />
                              </div>
                              <div className={`text-sm font-bold ${niveau.color} mt-2`}>
                                {r.niveauRisque}/16 — {niveau.label}
                              </div>
                            </div>
                          </div>

                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-3">{t.workshop.a5.residualRiskTitle}</h4>
                            <div className="space-y-2">
                              <div>
                                <label className="label text-xs">{t.workshop.a5.graviteResLabel} G{r.graviteResiduelle || 2}</label>
                                <input type="range" min={1} max={4} value={r.graviteResiduelle || 2}
                                  onChange={e => updateRisque(r.id, 'graviteResiduelle', parseInt(e.target.value))}
                                  className="w-full accent-red-300" />
                              </div>
                              <div>
                                <label className="label text-xs">{t.workshop.a5.vraisResLabel} V{r.vraisemblanceResiduelle || 1}</label>
                                <input type="range" min={1} max={4} value={r.vraisemblanceResiduelle || 1}
                                  onChange={e => updateRisque(r.id, 'vraisemblanceResiduelle', parseInt(e.target.value))}
                                  className="w-full accent-indigo-300" />
                              </div>
                              {niveauResiduel && (
                                <div className={`text-sm font-bold ${niveauResiduel.color}`}>
                                  {r.niveauResiduel}/16 — {niveauResiduel.label}
                                  {reduction > 0 && <span className="ml-2 text-xs text-green-600">(-{reduction}%)</span>}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Vulnérabilités résiduelles & Facteurs aggravants (FM) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="p-3 bg-white border border-gray-200 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-xs font-semibold text-gray-700">{t.workshop.a5.vulnResTitle}</h4>
                              <button onClick={() => addVulnResiduelle(r.id)} className="text-xs text-ebios-600 hover:underline">{t.workshop.a5.addBtn}</button>
                            </div>
                            <p className="text-xs text-gray-500 mb-2">{t.workshop.a5.vulnResDesc}</p>
                            <div className="space-y-1">
                              {(r.vulnerabilitesResiduelles || []).map((v: any) => (
                                <div key={v.id} className="flex gap-2">
                                  <input value={v.description}
                                    onChange={e => updateVulnResiduelle(r.id, v.id, 'description', e.target.value)}
                                    className="input text-xs flex-1" placeholder={t.workshop.a5.vulnResPh} />
                                  <button aria-label="Supprimer" onClick={() => setRisques(prev => prev.map(rr => rr.id === r.id ? {
                                    ...rr, vulnerabilitesResiduelles: rr.vulnerabilitesResiduelles.filter((x: any) => x.id !== v.id)
                                  } : rr))} className="text-gray-500 hover:text-red-500"><span aria-hidden="true">✕</span></button>
                                </div>
                              ))}
                              {!(r.vulnerabilitesResiduelles?.length) && <p className="text-xs text-gray-500 italic">{t.workshop.a5.vulnResNone}</p>}
                            </div>
                          </div>

                          <div className="p-3 bg-white border border-gray-200 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-xs font-semibold text-gray-700">{t.workshop.a5.facteurTitle}</h4>
                              <button onClick={() => addFacteurAggravant(r.id)} className="text-xs text-ebios-600 hover:underline">{t.workshop.a5.addBtn}</button>
                            </div>
                            <p className="text-xs text-gray-500 mb-2">{t.workshop.a5.facteurDesc}</p>
                            <div className="space-y-1">
                              {(r.facteursAggravants || []).map((f: any) => (
                                <div key={f.id} className="flex gap-2">
                                  <input value={f.description}
                                    onChange={e => setRisques(prev => prev.map(rr => rr.id === r.id ? {
                                      ...rr, facteursAggravants: rr.facteursAggravants.map((x: any) => x.id === f.id ? { ...x, description: e.target.value } : x)
                                    } : rr))}
                                    className="input text-xs flex-1" placeholder={t.workshop.a5.facteurPh} />
                                  <button aria-label="Supprimer" onClick={() => setRisques(prev => prev.map(rr => rr.id === r.id ? {
                                    ...rr, facteursAggravants: rr.facteursAggravants.filter((x: any) => x.id !== f.id)
                                  } : rr))} className="text-gray-500 hover:text-red-500"><span aria-hidden="true">✕</span></button>
                                </div>
                              ))}
                              {!(r.facteursAggravants?.length) && <p className="text-xs text-gray-500 italic">{t.workshop.a5.facteurNone}</p>}
                            </div>
                          </div>
                        </div>

                        {/* Justification de l'acceptation du risque résiduel */}
                        <div>
                          <label className="label" htmlFor={`r-justif-${r.id}`}>{t.workshop.a5.justifLabel}</label>
                          <textarea id={`r-justif-${r.id}`} value={r.justificationResiduelle || ''}
                            onChange={e => updateRisque(r.id, 'justificationResiduelle', e.target.value)}
                            className="input text-sm resize-none" rows={2}
                            placeholder={t.workshop.a5.justifPh} />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          <button onClick={() => setTab('mesures')} className="btn-primary">{`${t.workshop.a5.mesuresTitle} →`}</button>
        </div>
      )}

      {/* ── MESURES ─────────────────────────────────────────────────────── */}
      {tab === 'mesures' && (
        <div className="space-y-4">
          {aipdPertinente && (
            <div className="bg-violet-50 border border-violet-300 rounded-xl p-4">
              <p className="text-sm font-semibold text-violet-900">📄 {t.workshop.a5.aipdTitle}</p>
              <p className="text-sm text-violet-800 mt-1">{t.workshop.a5.aipdText}</p>
            </div>
          )}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="font-semibold text-gray-800">{t.workshop.a5.measRecoTitle}</h3>
              {activeFramework && (
                <button
                  onClick={() => setActiveFramework(null)}
                  className="text-xs text-green-700 hover:text-green-900 underline"
                >
                  {t.workshop.a5.measRefHide}
                </button>
              )}
            </div>

            {/* ── Onglets référentiels multi-frameworks ── */}
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-2">{t.workshop.a5.chooseRef}</p>
              {analyse?.secteur && recommendedFw.length > 0 && (
                <p className="text-xs text-indigo-700 mb-2">
                  ⭐ {t.workshop.a1.recommendedBadge} ({analyse.secteur}) : {recommendedFw.map(fid => FRAMEWORK_META[fid].nom).join(', ')}
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(FRAMEWORK_META) as FrameworkId[])
                  .filter(id => id !== 'CUSTOM')
                  .map(fid => {
                    const meta = FRAMEWORK_META[fid]
                    const isActive = activeFramework === fid
                    const isReco = recommendedFw.includes(fid)
                    return (
                      <button
                        key={fid}
                        onClick={() => setActiveFramework(isActive ? null : fid)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                          isActive
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : isReco
                              ? 'bg-white text-indigo-700 border-indigo-300 hover:border-indigo-400'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-400 hover:text-indigo-600'
                        }`}
                      >
                        {isReco && !isActive && <span title={t.workshop.a1.recommendedBadge}>⭐</span>}
                        <span>{meta.icon}</span>
                        <span>{meta.nom}</span>
                      </button>
                    )
                  })}
              </div>
            </div>

            {/* Panel référentiel sélectionné */}
            {activeFramework && (
              <div className="mt-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-gray-700">
                    {FRAMEWORK_META[activeFramework].icon} {FRAMEWORK_META[activeFramework].nom}
                  </span>
                  <span className="text-xs text-gray-400">{FRAMEWORK_META[activeFramework].version}</span>
                </div>
                <p className="text-xs text-gray-500 mb-2">
                  {t.workshop.a5.frameworkAddDesc}
                </p>
                <FrameworkControlsPanel
                  frameworkId={activeFramework}
                  customControles={analyse?.cadrage?.customControles}
                  onSelect={addMesureISO27001}
                  actionLabel={t.workshop.addExample}
                />
              </div>
            )}

            {/* Couverture NIS2 Art. 21 — mapping indicatif du référentiel actif */}
            {activeFramework && activeFramework !== 'CUSTOM' && (
              <div className="mt-4 border border-emerald-200 rounded-lg bg-emerald-50/50 p-3">
                <button
                  type="button"
                  onClick={() => setShowNis2(v => !v)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <span className="text-sm font-semibold text-emerald-900">
                    🇪🇺 {t.workshop.a5.nis2Title} — {nis2CoveredCnt}/10
                  </span>
                  <span className="text-xs text-emerald-700 underline">
                    {showNis2 ? t.workshop.hideExamples : t.workshop.showExamples}
                  </span>
                </button>
                {showNis2 && (
                  <div className="mt-2">
                    <p className="text-xs text-emerald-800 mb-2">{t.workshop.a5.nis2Intro}</p>
                    <ul className="space-y-1">
                      {nis2Coverage.map(m => (
                        <li key={m.id} className="flex items-start gap-2 text-xs">
                          <span className={m.covered ? 'text-emerald-600' : 'text-gray-400'}>
                            {m.covered ? '✓' : '○'}
                          </span>
                          <span className={m.covered ? 'text-gray-700' : 'text-gray-400'}>
                            <span className="font-semibold uppercase">{m.id})</span> {m.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <button onClick={() => addMesure()} className="mt-3 btn-secondary text-sm py-1.5">{t.workshop.a5.measAddCustomBtn}</button>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-gray-800 mb-4">{t.workshop.a5.measPlanTitle} ({mesures.length})</h3>
            {mesures.length === 0 && (
              <p className="text-sm text-gray-500 italic text-center py-8">{t.workshop.a5.measEmpty}</p>
            )}
            <div className="space-y-2">
              {[...mesures].sort((a, b) => a.priorite - b.priorite).map(m => {
                return (
                  <div
                    key={m.id}
                    id={`mesure-${m.id}`}
                    className={`p-3 rounded-lg border scroll-mt-20 transition-all duration-500 ${
                      highlightId === `mesure-${m.id}`
                        ? 'bg-ebios-50 border-ebios-400 shadow-md ring-2 ring-ebios-300'
                        : 'bg-gray-50 border-gray-100'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 space-y-2">
                        <div className="flex gap-2 items-center flex-wrap">
                          <input value={m.nom} onChange={e => updateMesure(m.id, 'nom', e.target.value)}
                            aria-label={t.workshop.a5.measNamePh}
                            className="input text-sm flex-1 min-w-48" placeholder={t.workshop.a5.measNamePh} />
                          <select value={m.type} onChange={e => updateMesure(m.id, 'type', e.target.value)}
                            aria-label="Type de mesure"
                            className="input text-xs w-36">
                            {TYPES_MESURE.map(tm => <option key={tm.value} value={tm.value}>{tm.label}</option>)}
                          </select>
                          <div className="flex gap-1" role="group" aria-label="Statut de la mesure">
                            {STATUTS_MESURE.map(s => (
                              <button
                                key={s.value}
                                type="button"
                                onClick={() => updateMesure(m.id, 'statut', s.value)}
                                className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                                  m.statut === s.value
                                    ? `${s.color} border-transparent font-semibold`
                                    : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'
                                }`}
                                title={s.label}
                              >
                                {s.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2 items-center flex-wrap">
                          {/* Lien vers risque */}
                          {risques.length > 0 && (
                            <select value={m.risqueId || ''} onChange={e => updateMesure(m.id, 'risqueId', e.target.value)}
                              aria-label={t.workshop.a5.measRisquePh}
                              className="input text-xs w-48">
                              <option value="">{t.workshop.a5.measRisquePh}</option>
                              {risques.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
                            </select>
                          )}
                          {/* Responsable, entité et échéance — masqués si la mesure est REALISE */}
                          {m.statut !== 'REALISE' && (
                            <>
                              <input value={m.responsable ?? ''} onChange={e => updateMesure(m.id, 'responsable', e.target.value)}
                                aria-label={t.workshop.a5.measResponsablePh}
                                className="input text-xs w-36" placeholder={t.workshop.a5.measResponsablePh} />
                              <>
                                <input
                                  list={`entites-${m.id}`}
                                  value={m.entite ?? ''}
                                  onChange={e => updateMesure(m.id, 'entite', e.target.value)}
                                  aria-label={t.workshop.a5.measEntitePh}
                                  className="input text-xs w-32"
                                  placeholder={t.workshop.a5.measEntitePh}
                                />
                                <datalist id={`entites-${m.id}`}>
                                  {entitesOrg.map(e => <option key={e} value={e} />)}
                                </datalist>
                              </>
                              <input type="date" value={m.echeance ?? ''} onChange={e => updateMesure(m.id, 'echeance', e.target.value)}
                                aria-label="Échéance de la mesure"
                                className="input text-xs w-36" />
                            </>
                          )}
                          {m.statut !== 'REALISE' && (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-500" aria-hidden="true">P:</span>
                              <input type="range" min={1} max={4} value={m.priorite}
                                aria-label={`Priorité de la mesure P${m.priorite}`}
                                onChange={e => updateMesure(m.id, 'priorite', parseInt(e.target.value))}
                                className="w-20 accent-ebios-600" />
                              <span className={`text-xs font-bold ${
                                m.priorite === 1 ? 'text-red-600' : m.priorite === 2 ? 'text-orange-600' :
                                m.priorite === 3 ? 'text-yellow-600' : 'text-gray-500'
                              }`}>P{m.priorite}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <button aria-label="Supprimer" onClick={() => setPendingDelete({ msg: t.deleteDialog.mesure, action: () => setMesures(prev => prev.filter(x => x.id !== m.id)) })}
                        className="text-gray-500 hover:text-red-500 flex-shrink-0"><span aria-hidden="true">✕</span></button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <button onClick={() => setTab('synthese')} className="btn-primary">{`${t.workshop.a5.planTitle} →`}</button>
        </div>
      )}

      {/* ── SYNTHÈSE ─────────────────────────────────────────────────────── */}
      {tab === 'synthese' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: t.workshop.a5.synthStatRisks,    value: risques.length, color: 'text-gray-800' },
              { label: t.workshop.a5.synthStatCritical, value: risques.filter(r => getRiskTier(r.niveauRisque) === 'critique').length, color: 'text-red-600' },
              { label: t.workshop.a5.synthStatMeas,     value: mesures.length, color: 'text-blue-600' },
              { label: t.workshop.a5.synthStatP1,       value: mesures.filter(m => m.priorite === 1).length, color: 'text-orange-600' },
            ].map((s, i) => (
              <div key={i} className="card p-4 text-center">
                <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Réduction des risques */}
          {risques.length > 0 && risques.some(r => r.niveauResiduel) && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-800 mb-3">{t.workshop.a5.reductionTitle}</h3>
              <div className="space-y-2">
                {risques.map(r => {
                  const initial = getNiveauRisqueLabel(r.niveauRisque)
                  const residuel = r.niveauResiduel ? getNiveauRisqueLabel(r.niveauResiduel) : null
                  const reduction = r.niveauResiduel ? Math.round(((r.niveauRisque - r.niveauResiduel) / r.niveauRisque) * 100) : 0
                  return (
                    <div key={r.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-700 flex-1 min-w-0 truncate">{r.nom}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${initial.bg} ${initial.color}`}>
                        {r.niveauRisque}/16
                      </span>
                      <span className="text-gray-500 text-xs">→</span>
                      {residuel ? (
                        <>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${residuel.bg} ${residuel.color}`}>
                            {r.niveauResiduel}/16
                          </span>
                          <span className={`text-xs font-bold ${reduction > 50 ? 'text-green-600' : reduction > 0 ? 'text-yellow-600' : 'text-gray-500'}`}>
                            {reduction > 0 ? `-${reduction}%` : '±0%'}
                          </span>
                        </>
                      ) : <span className="text-xs text-gray-500">{t.workshop.a5.notEvaluated}</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${stratColors[r.strategie] || ''}`}>
                        {t.workshop.a5.stratLabels[r.strategie as keyof typeof t.workshop.a5.stratLabels]}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {risques.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="card p-5">
                <h3 className="font-semibold text-gray-800 mb-4">{t.workshop.a5.matrixInitialTitle}</h3>
                <RiskMatrix config={scaleConfig} risks={risques.map(r => ({ nom: r.nom, vraisemblance: r.vraisemblance, gravite: r.gravite }))} />
              </div>
              <div className="card p-5">
                <h3 className="font-semibold text-gray-800 mb-4">{t.workshop.a5.matrixResidualTitle}</h3>
                <RiskMatrix config={scaleConfig} risks={risques.map(r => ({
                  nom: r.nom,
                  vraisemblance: r.vraisemblanceResiduelle || r.vraisemblance,
                  gravite: r.graviteResiduelle || r.gravite,
                }))} />
              </div>
            </div>
          )}

          <div className="card p-5">
            <h3 className="font-semibold text-gray-800 mb-4">{t.workshop.a5.stratRepartTitle}</h3>
            <div className="flex flex-wrap gap-3">
              {strategies.map(s => {
                const count = risques.filter(r => r.strategie === s.value).length
                return (
                  <div key={s.value} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${s.color}`}>
                    <span className="text-lg font-bold">{count}</span>
                    <span className="text-sm font-medium">
                      {t.workshop.a5.stratLabels[s.value as keyof typeof t.workshop.a5.stratLabels] ?? s.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Plan d'action prioritaire */}
          {mesures.filter(m => m.priorite <= 2).length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-800 mb-3">{t.workshop.a5.actionPlanTitle}</h3>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-600">
                  <tr>
                    <th className="text-left p-2">{t.workshop.a5.thMesure}</th>
                    <th className="text-center p-2">{t.workshop.a5.thPriorite}</th>
                    <th className="text-left p-2">{t.workshop.a5.thResponsable}</th>
                    <th className="text-left p-2">{t.workshop.a5.thEntite}</th>
                    <th className="text-left p-2">{t.workshop.a5.thEcheance}</th>
                    <th className="text-left p-2">{t.workshop.a5.thStatut}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[...mesures].filter(m => m.priorite <= 2).sort((a, b) => a.priorite - b.priorite).map(m => (
                    <tr key={m.id}>
                      <td className="p-2 text-gray-800">{m.nom}</td>
                      <td className="p-2 text-center">
                        <span className={`text-xs font-bold ${m.priorite === 1 ? 'text-red-600' : 'text-orange-600'}`}>P{m.priorite}</span>
                      </td>
                      <td className="p-2 text-gray-600">{m.responsable || '—'}</td>
                      <td className="p-2 text-gray-600">{m.entite || '—'}</td>
                      <td className="p-2 text-gray-600">
                        {m.echeance
                          ? (m.echeance instanceof Date ? m.echeance.toISOString().slice(0, 10) : String(m.echeance))
                          : '—'}
                      </td>
                      <td className="p-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${STATUTS_MESURE.find(s => s.value === m.statut)?.color || ''}`}>
                          {STATUTS_MESURE.find(s => s.value === m.statut)?.label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <ExportButtons analyseId={analyseId} analyseName={analyse.nom} />

          <button onClick={() => save(true)} disabled={saving} className="btn-primary w-full text-base py-3">
            {saving ? t.workshop.saving : t.workshop.saveDone}
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
