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
import { useEbiosData } from '@/lib/i18n/use-ebios-data'
import { resolveExemples } from '@/lib/exemples-ateliers'
import { rankExemples } from '@/lib/exemples-context'
import { withSectorExemples } from '@/lib/exemples-sectoriels'
import { PRIORITES_MESURE, comparePriorite, measuresApplyingTo } from '@/lib/ecosystem-measures'
import { defaultExemplesFor, type ExemplesTranslations } from '@/lib/exemples-defaults'
import { getRiskTier, type RiskTier } from '@/lib/risk-scale'
import FrameworkControlsPanel from '@/components/FrameworkControlsPanel'
import EcosystemRadar from '@/components/EcosystemRadar'
import { menace as menaceOf, zoneOf, type EcosystemZone } from '@/lib/ecosystem-radar'
import { resolveEchelles, maxValeur, nomNiveau, type EchellesEcosysteme } from '@/lib/ecosystem-echelles'
import { graviteHeritee, risqueSurevaluation, valeursMetierConcernees } from '@/lib/ebios-gravite'
import { FRAMEWORK_META, type FrameworkControl, type FrameworkId } from '@/lib/frameworks-data'

interface Props {
  analyseId: string
  initialData?: { partiesPrenantes: any[]; scenariosStrategiques: any[] }
  analyse: any
  /** Mode « Flash » (Club EBIOS) — parcours rapide guidé, propage le flag */
  flashMode?: boolean
}

function uid() { return Math.random().toString(36).slice(2, 9) }

// Couleur par zone de dangerosité (statique, 3 zones : danger=orange, contrôle=jaune, veille=vert).
const ZONE_COLOR: Record<EcosystemZone, { color: string; dot: string }> = {
  danger:   { color: 'text-orange-600', dot: 'bg-orange-500' },
  controle: { color: 'text-yellow-600', dot: 'bg-yellow-500' },
  veille:   { color: 'text-green-600',  dot: 'bg-green-500' },
}

/**
 * Valeurs dérivées d'une partie prenante (méthode Club EBIOS) :
 *   exposition = dépendance × pénétration · fiabilité = maturité × confiance
 *   menace     = exposition / fiabilité   → zone.
 * Tolère les anciens objets (sans sous-critères) via des défauts.
 */
function ppDerived(p: any) {
  const dependance  = Number(p?.dependance  ?? 2)
  const penetration = Number(p?.penetration ?? 2)
  const maturite    = Number(p?.maturite    ?? 3)
  const confiance   = Number(p?.confiance   ?? 3)
  const exposition  = dependance * penetration
  const fiabilite   = maturite * confiance
  const m           = menaceOf(exposition, fiabilite)
  return { dependance, penetration, maturite, confiance, exposition, fiabilite, menace: m, zone: zoneOf(m) }
}

// Curseur d'un sous-critère sur son échelle (1..max, pas fin) ; affiche le nom du niveau.
function CritereSlider({ label, value, max, levelName, accent, onChange }: {
  label: string; value: number; max: number; levelName: string; accent: string; onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-0.5">
        {label} <span className="font-medium text-gray-700">{levelName}</span>
        <span className="text-gray-400"> ({Number(value).toFixed(1)})</span>
      </div>
      <input type="range" min={1} max={max} step={0.1} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className={`w-full ${accent}`} />
    </div>
  )
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

export default function Atelier3({ analyseId, initialData, analyse, flashMode }: Props) {
  const router = useRouter()
  const { t, locale } = useTranslation()
  const { NIVEAUX_VRAISEMBLANCE, NIVEAUX_GRAVITE, SOUS_SECTEURS } = useEbiosData()
  const sousSecteurLabel = SOUS_SECTEURS.find((s: { id: string }) => s.id === analyse?.sousSecteur)?.label ?? null

  // Translated arrays (re-derived on locale change)
  const TYPES_PP = [
    { value: 'FOURNISSEUR',          label: t.workshop.a3.ppTypes.FOURNISSEUR },
    { value: 'CLIENT',               label: t.workshop.a3.ppTypes.CLIENT },
    { value: 'PARTENAIRE',           label: t.workshop.a3.ppTypes.PARTENAIRE },
    { value: 'PRESTATAIRE',          label: t.workshop.a3.ppTypes.PRESTATAIRE },
    { value: 'ORGANISME_REGULATION', label: t.workshop.a3.ppTypes.ORGANISME_REGULATION },
    { value: 'AUTRE',                label: t.workshop.a3.ppTypes.AUTRE },
  ]
  const MESURES_ECOSYSTEME_TYPES: string[] = t.workshop.a3.measTypesList as unknown as string[]

  function getZoneLabel(zone: EcosystemZone) {
    return { label: t.workshop.a3.zoneLabels[zone], ...ZONE_COLOR[zone] }
  }

  // Exemples : override organisation si présent, sinon défauts (ebios-data)
  const [exOverride, setExOverride] = useState<Record<string, any[]>>({})
  // Échelles de cotation des 4 sous-critères (configurables) — défauts si non personnalisées.
  const [echelles, setEchelles] = useState<EchellesEcosysteme>(() => resolveEchelles(null))
  // Noms de tiers déjà connus (autres analyses) → auto-complétion à la saisie (issue #46)
  const [knownTierNames, setKnownTierNames] = useState<string[]>([])
  useEffect(() => {
    fetch('/api/admin/organization-config').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.exemplesAteliers && typeof d.exemplesAteliers === 'object' && !Array.isArray(d.exemplesAteliers)) setExOverride(d.exemplesAteliers)
      setEchelles(resolveEchelles(d?.echellesEcosysteme))
    }).catch(() => {})
    fetch('/api/tiers/names').then(r => r.ok ? r.json() : null).then(d => {
      if (Array.isArray(d?.noms)) setKnownTierNames(d.noms)
    }).catch(() => {})
  }, [])
  const tEx = t as unknown as ExemplesTranslations
  const ppExamples = useMemo(() => resolveExemples(exOverride.partiesPrenantes, defaultExemplesFor('partiesPrenantes', tEx, locale)) as any[], [t, exOverride]) // eslint-disable-line react-hooks/exhaustive-deps
  // Parties prenantes sectorielles (ex. autorités santé ANS/CERT Santé/ARS) en tête (issue #81)
  const ppExamplesSector = useMemo(
    () => withSectorExemples(ppExamples, analyse?.secteur, 'partiesPrenantes', locale, analyse?.sousSecteur) as any[],
    [ppExamples, analyse?.secteur, sousSecteurLabel, locale] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const scExamples = useMemo(() => resolveExemples(exOverride.scenariosStrategiques, defaultExemplesFor('scenariosStrategiques', tEx, locale)) as any[], [t, exOverride]) // eslint-disable-line react-hooks/exhaustive-deps
  // Exemples contextuels : scénarios stratégiques sectoriels remontés en tête
  const scExamplesRanked = useMemo(
    () => rankExemples(withSectorExemples(scExamples, analyse?.secteur, 'scenariosStrategiques', locale, analyse?.sousSecteur), { secteur: analyse?.secteur, sousSecteur: sousSecteurLabel }),
    [scExamples, analyse?.secteur, sousSecteurLabel, locale]
  )
  const meExamples = useMemo(() => resolveExemples(exOverride.mesuresEcosysteme, defaultExemplesFor('mesuresEcosysteme', tEx, locale)) as any[], [t, exOverride]) // eslint-disable-line react-hooks/exhaustive-deps

  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{ msg: string; action: () => void } | null>(null)
  const [tab, setTab] = useState<'pp' | 'scenarios' | 'mesures'>('pp')
  // Partie prenante mise en évidence après un clic sur le radar (surlignage temporaire)
  const [highlightPP, setHighlightPP] = useState<string | null>(null)
  // PP survolée sur le radar → surlignage temporaire de la ligne du tableau
  const [hoverPP, setHoverPP] = useState<string | null>(null)

  // Clic sur un point du radar → défile vers la carte de la PP et la surligne brièvement
  function focusPartiePrenante(id: string) {
    setTab('pp')
    setHighlightPP(id)
    requestAnimationFrame(() => {
      document.getElementById(`pp-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    window.setTimeout(() => setHighlightPP(prev => (prev === id ? null : prev)), 2000)
  }

  // Arrivée depuis le radar de la synthèse (lien « Modifier les tiers ») avec un hash
  // #pp-<id> → défile et surligne le tiers concerné.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const m = window.location.hash.match(/^#pp-(.+)$/)
    if (!m) return
    const tid = window.setTimeout(() => focusPartiePrenante(decodeURIComponent(m[1])), 350)
    return () => window.clearTimeout(tid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { flash: flashMesEco, isAdded: isMesEcoAdded } = useAddedFeedback()

  // ── Auto-save (defined after state declarations below) ───────────────────
  const [showPpExamples, setShowPpExamples] = useState(true)
  const [showScenExamples, setShowScenExamples] = useState(true)
  // Exemples ISO27005 masqués par défaut : le référentiel A1 est présenté en priorité
  const [showMesEcoEx, setShowMesEcoEx] = useState(false)
  const [showISO27001Eco, setShowISO27001Eco] = useState<string | null>(null) // stores scenario id

  // Chaque PP reçoit une clé stable (cle) — générée si absente (legacy) — pour relier
  // les PP connexes (rangs 2/3) indépendamment de l'id DB régénéré à chaque sauvegarde.
  const [parties, setParties] = useState<any[]>(() =>
    (initialData?.partiesPrenantes || []).map((p: any) => ({ ...p, cle: p.cle || uid(), rang: p.rang || 1 })))
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
  const valeursMetier: any[] = analyse?.cadrage?.valeursMetier || []
  const vmLabel = (id: string) => valeursMetier.find((v: any) => v.id === id)?.nom || id
  // Liste d'ids ER liés à un scénario (nouveau champ ; repli sur l'ancien ref unique)
  const erIdsOf = (s: any): string[] =>
    Array.isArray(s.evenementsRedoutesIds) ? s.evenementsRedoutesIds
    : (s.evenementRedouteRef ? [s.evenementRedouteRef] : [])

  function addPP(exemple?: any, parent?: any) {
    const dependance  = exemple?.dependance  ?? 2
    const penetration = exemple?.penetration ?? 2
    const maturite    = exemple?.maturite    ?? 3
    const confiance   = exemple?.confiance   ?? 3
    const nouvelle = {
      id: uid(),
      cle: uid(),
      nom: exemple?.nom || '',
      type: exemple?.type || (parent ? parent.type : 'PRESTATAIRE'),
      description: exemple?.description || '',
      dependance, penetration, maturite, confiance,
      exposition: dependance * penetration, // dérivé (1-N²)
      fiabilite:  maturite * confiance,      // dérivé (1-N²)
      critique:   !!exemple?.critique,
      // PP connexe (rang 2/3) si créée depuis une PP parente.
      rang:       parent ? Math.min(3, (parent.rang || 1) + 1) : 1,
      parentCle:  parent ? parent.cle : undefined,
    }
    // Insère une PP connexe juste après sa parente (regroupement visuel).
    setParties(prev => {
      if (!parent) return [...prev, nouvelle]
      const i = prev.findIndex(x => x.id === parent.id)
      if (i < 0) return [...prev, nouvelle]
      return [...prev.slice(0, i + 1), nouvelle, ...prev.slice(i + 1)]
    })
  }

  function updatePP(id: string, field: string, value: any) {
    setParties(prev => prev.map(p => {
      if (p.id !== id) return p
      const up = { ...p, [field]: value }
      // Recalcule les dérivés depuis les 4 sous-critères.
      up.exposition = (Number(up.dependance) || 2) * (Number(up.penetration) || 2)
      up.fiabilite  = (Number(up.maturite) || 3)   * (Number(up.confiance) || 3)
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
      // Lien ER id-based (fiche Club EBIOS) ; pas d'auto-lien à la création :
      // l'analyste relie les ER de l'objectif visé → la gravité s'hérite alors.
      evenementRedouteRef: exemple?.evenementRedouteRef || '',
      evenementsRedoutesIds: Array.isArray(exemple?.evenementsRedoutesIds) ? exemple.evenementsRedoutesIds : [],
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
      // Héritage de gravité (fiche Club EBIOS A3) : quand les ER liés changent,
      // la gravité = max des gravités des ER liés (sinon on garde la valeur courante).
      if (field === 'evenementsRedoutesIds') {
        const ids: string[] = Array.isArray(value) ? value : []
        up.evenementRedouteRef = ids[0] || '' // garde l'ancien champ synchronisé (ER primaire)
        if (ids.length > 0) {
          up.gravite = graviteHeritee(ids, evenementsRedoutes, up.gravite)
          up.niveauRisque = up.vraisemblance * up.gravite
        }
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

  // Coche/décoche un ER lié à un scénario (multi-sélection → héritage du max)
  function toggleEr(scenarioId: string, erId: string) {
    const sc = scenarios.find(s => s.id === scenarioId)
    const current = erIdsOf(sc)
    const next = current.includes(erId) ? current.filter(x => x !== erId) : [...current, erId]
    updateScenario(scenarioId, 'evenementsRedoutesIds', next)
  }

  // Garde-fou anti-surévaluation : scinder un SS en un scénario par valeur métier ciblée,
  // chacun héritant de la gravité (max) de SES ER. Évite de retenir un max trop élevé.
  function scinderScenario(id: string) {
    const sc = scenarios.find(s => s.id === id)
    if (!sc) return
    const ids = erIdsOf(sc)
    const byVm = new Map<string, string[]>()
    for (const er of evenementsRedoutes) {
      if (ids.includes(er.id) && er.valeurMetierId) {
        if (!byVm.has(er.valeurMetierId)) byVm.set(er.valeurMetierId, [])
        byVm.get(er.valeurMetierId)!.push(er.id)
      }
    }
    if (byVm.size < 2) return
    const fragments = [...byVm.entries()].map(([vmId, erIds]) => {
      const g = graviteHeritee(erIds, evenementsRedoutes, sc.gravite)
      return {
        ...sc, id: uid(),
        nom: `${sc.nom} — ${vmLabel(vmId)}`,
        evenementsRedoutesIds: erIds,
        evenementRedouteRef: erIds[0] || '',
        gravite: g, niveauRisque: sc.vraisemblance * g,
      }
    })
    setScenarios(prev => prev.flatMap(s => (s.id === id ? fragments : [s])))
    setExpanded(fragments[0]?.id ?? null)
  }

  function addMesureEcosysteme(scenarioId: string, ppNom?: string, mesure?: string) {
    setScenarios(prev => prev.map(s => {
      if (s.id !== scenarioId) return s
      return {
        ...s,
        mesuresEcosysteme: [
          ...(s.mesuresEcosysteme || []),
          { id: uid(), partiePrenante: ppNom || '', mesure: mesure || '', description: '', priorite: 'P2', type: 'ORGANISATIONNELLE', statut: 'A_FAIRE' },
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
            description: controle.description || '',
            priorite: 'P2',
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

  /** Mutualise/retire une mesure vers un autre scénario stratégique (issue #2). */
  function toggleMesureScenario(scenarioId: string, mesureId: string, targetScenarioId: string) {
    setScenarios(prev => prev.map(s => {
      if (s.id !== scenarioId) return s
      return {
        ...s,
        mesuresEcosysteme: s.mesuresEcosysteme.map((m: any) => {
          if (m.id !== mesureId) return m
          const ids: string[] = Array.isArray(m.scenarioIds) ? m.scenarioIds : []
          return { ...m, scenarioIds: ids.includes(targetScenarioId) ? ids.filter(x => x !== targetScenarioId) : [...ids, targetScenarioId] }
        }),
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
    router.push(`/analyses/${analyseId}/atelier/4${flashMode ? '?mode=flash' : ''}`)
  }

  const retained = scenarios.filter(s => s.retenu)

  // Zones de dangerosité (FM5)
  const ppByZone: Record<EcosystemZone, any[]> = {
    danger:   parties.filter(p => ppDerived(p).zone === 'danger'),
    controle: parties.filter(p => ppDerived(p).zone === 'controle'),
    veille:   parties.filter(p => ppDerived(p).zone === 'veille'),
  }
  // Métadonnées d'affichage des 3 zones de dangerosité (cartographie FM5).
  const ZONE_INFO: Record<EcosystemZone, { title: string; desc: string; border: string; bg: string; titleColor: string; dot: string }> = {
    danger:   { title: t.workshop.a3.zoneDangerTitle,   desc: t.workshop.a3.zoneDangerDesc,   border: 'border-orange-200', bg: 'bg-orange-50', titleColor: 'text-orange-800', dot: 'bg-orange-500' },
    controle: { title: t.workshop.a3.zoneControleTitle, desc: t.workshop.a3.zoneControleDesc, border: 'border-yellow-200', bg: 'bg-yellow-50', titleColor: 'text-yellow-800', dot: 'bg-yellow-500' },
    veille:   { title: t.workshop.a3.zoneVeilleTitle,   desc: t.workshop.a3.zoneVeilleDesc,   border: 'border-green-200',  bg: 'bg-green-50',  titleColor: 'text-green-800',  dot: 'bg-green-500' },
  }
  const ZONE_ORDER: EcosystemZone[] = ['danger', 'controle', 'veille']
  // Libellés/échelles des 4 sous-critères (échelle configurable).
  const CRIT_META = [
    { key: 'dependance',  label: t.workshop.a3.ppDependanceLabel,  accent: 'accent-ebios-600', echelle: echelles.dependance },
    { key: 'penetration', label: t.workshop.a3.ppPenetrationLabel, accent: 'accent-ebios-600', echelle: echelles.penetration },
    { key: 'maturite',    label: t.workshop.a3.ppMaturiteLabel,    accent: 'accent-green-600', echelle: echelles.maturite },
    { key: 'confiance',   label: t.workshop.a3.ppConfianceLabel,   accent: 'accent-green-600', echelle: echelles.confiance },
  ] as const

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
                {ppExamplesSector.map((p: any, i) => {
                  const d = ppDerived(p)
                  const { label, color } = getZoneLabel(d.zone)
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
                        <span className={`text-xs font-bold ${color}`}>{label}</span>
                      </div>
                      <div className="text-xs text-gray-500">{t.workshop.a3.ppExpLabel} : {d.exposition} · {t.workshop.a3.ppFiabLabel} : {d.fiabilite} · {t.workshop.a3.ppMenaceLabel} : {d.menace.toFixed(2)}</div>
                    </button>
                  )
                })}
              </div>
            )}
            <button onClick={() => addPP()} className="btn-secondary text-sm py-1.5">{t.workshop.a3.ppAddManual}</button>
          </div>

          {/* Radar de menace de l'écosystème (vue polaire) */}
          {parties.length > 0 && (
            <div className="mb-4">
              <EcosystemRadar parties={parties} onSelect={focusPartiePrenante} echelles={echelles}
                onEditShortName={(id, v) => updatePP(id, 'nomCourt', v)} onHover={setHoverPP} />
            </div>
          )}

          {/* Cartographie des zones de dangerosité FM5 */}
          {parties.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-800 mb-3">🗺️ {t.workshop.a3.ppMapTitle}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {ZONE_ORDER.map(zone => {
                  const info = ZONE_INFO[zone]
                  return (
                    <div key={zone} className={`border ${info.border} rounded-lg p-3 ${info.bg}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`w-3 h-3 rounded-full ${info.dot}`}></span>
                        <span className={`text-sm font-semibold ${info.titleColor}`}>{info.title}</span>
                      </div>
                      <p className="text-xs text-gray-600 mb-2">{info.desc}</p>
                      {ppByZone[zone].length === 0 ? <p className="text-xs text-gray-500 italic">{t.workshop.a3.zoneEmpty}</p> :
                        ppByZone[zone].map(p => <PPZoneCard key={p.id} pp={p} getZoneLabel={getZoneLabel} />)
                      }
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="card p-5">
            <h3 className="font-semibold text-gray-800 mb-4">{t.workshop.a3.ppEvalTitle} ({parties.length})</h3>
            {parties.length === 0 && (
              <p className="text-sm text-gray-500 italic text-center py-8">{t.workshop.a3.ppEmpty}</p>
            )}
            {/* Auto-complétion des noms de tiers déjà saisis dans d'autres analyses */}
            <datalist id="acra-tiers-known">
              {knownTierNames.map(n => <option key={n} value={n} />)}
            </datalist>
            <div className="space-y-2">
              {parties.map(p => {
                const d = ppDerived(p)
                const { label, color } = getZoneLabel(d.zone)
                const rang = p.rang || 1
                // Guide ANSSI : on n'approfondit (PP connexes) que les tiers critiques
                // ou en zone danger/contrôle, jusqu'au rang 3.
                const peutConnexe = (d.zone !== 'veille' || p.critique) && rang < 3
                return (
                  <div key={p.id} id={`pp-${p.id}`}
                    style={rang > 1 ? { marginLeft: (rang - 1) * 20 } : undefined}
                    className={`flex gap-3 items-start p-3 rounded-lg transition-colors ${rang > 1 ? 'border-l-2 border-ebios-200 ' : ''}${(highlightPP === p.id || hoverPP === p.id) ? 'bg-ebios-50 ring-2 ring-ebios-400' : 'bg-gray-50'}`}>
                    <div className="flex-1 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input value={p.nom} onChange={e => updatePP(p.id, 'nom', e.target.value)}
                          list="acra-tiers-known"
                          className="input text-sm" placeholder="Nom" />
                        <select value={p.type} onChange={e => updatePP(p.id, 'type', e.target.value)} className="input text-sm">
                          {TYPES_PP.map(tp => <option key={tp.value} value={tp.value}>{tp.label}</option>)}
                        </select>
                        {/* Nom court : libellé affiché sur le radar (sinon réf T1, T2…). */}
                        <input value={p.nomCourt ?? ''} onChange={e => updatePP(p.id, 'nomCourt', e.target.value.slice(0, 12))}
                          maxLength={12} className="input text-sm sm:col-span-2"
                          placeholder={t.workshop.a3.ppNomCourtPlaceholder} />
                      </div>
                      {/* Exposition = dépendance × pénétration · Fiabilité = maturité × confiance */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {CRIT_META.map(cm => (
                          <CritereSlider key={cm.key}
                            label={cm.label}
                            value={d[cm.key]}
                            max={maxValeur(cm.echelle)}
                            levelName={nomNiveau(cm.echelle, d[cm.key])}
                            accent={cm.accent}
                            onChange={v => updatePP(p.id, cm.key, v)} />
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600 pt-1 border-t border-gray-100">
                        {rang > 1 && <span className="rounded bg-ebios-100 text-ebios-700 px-1.5 py-0.5 font-medium">{t.workshop.a3.rangBadge} {rang}</span>}
                        <span>{t.workshop.a3.ppExpLabel} <span className="font-semibold text-gray-800">{d.exposition.toFixed(1)}</span></span>
                        <span>{t.workshop.a3.ppFiabLabel} <span className="font-semibold text-gray-800">{d.fiabilite.toFixed(1)}</span></span>
                        <span>{t.workshop.a3.ppMenaceLabel} <span className="font-semibold text-gray-800">{d.menace.toFixed(2)}</span></span>
                        <span className={`font-bold ${color}`}>{label}</span>
                        {peutConnexe && (
                          <button type="button" onClick={() => addPP(undefined, p)}
                            className="text-ebios-600 hover:text-ebios-800 underline">+ {t.workshop.a3.addConnexe} ({t.workshop.a3.rangBadge} {rang + 1})</button>
                        )}
                        <label className="ml-auto flex items-center gap-1.5 cursor-pointer text-gray-600">
                          <input type="checkbox" checked={!!p.critique} onChange={e => updatePP(p.id, 'critique', e.target.checked)}
                            className="accent-red-600" />
                          <span className={p.critique ? 'font-semibold text-amber-600' : ''}><span className="text-amber-500">★</span> {t.workshop.a3.ppCritiqueLabel}</span>
                        </label>
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
                  const exemples = scExamplesRanked.filter(e => e.critere === critere)
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
                              {!alreadyAdded && ex.pertinent && <div className="text-[11px] text-ebios-700 font-semibold mb-0.5">⭐ {t.workshop.relevantLabel}</div>}
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

                      {/* Lien vers Atelier 1 — ER (multi-sélection → gravité héritée = max, fiche Club EBIOS) */}
                      {evenementsRedoutes.length > 0 && (
                        <div>
                          <label className="label">{t.workshop.a3.erLinkLabel}</label>
                          <div className="space-y-1 rounded-lg border border-gray-200 p-2">
                            {evenementsRedoutes.map((er: any) => {
                              const checked = erIdsOf(s).includes(er.id)
                              const g = er.graviteDefaut ?? er.gravite
                              return (
                                <label key={er.id} className="flex items-start gap-2 text-sm cursor-pointer">
                                  <input type="checkbox" checked={checked}
                                    onChange={() => toggleEr(s.id, er.id)} className="mt-0.5 accent-ebios-600" />
                                  <span className="flex-1">{er.description}</span>
                                  {g != null && <span className="text-xs text-gray-500 shrink-0">G{g}</span>}
                                </label>
                              )
                            })}
                          </div>
                          {erIdsOf(s).length > 0 && (
                            <p className="text-xs text-gray-500 mt-1">{t.workshop.a3.graviteHeriteeHint}</p>
                          )}
                          {risqueSurevaluation(erIdsOf(s), evenementsRedoutes) && (
                            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                              <p className="font-medium">{t.workshop.a3.surevalTitle}</p>
                              <p className="mt-0.5">{t.workshop.a3.surevalDesc.replace('{vms}', valeursMetierConcernees(erIdsOf(s), evenementsRedoutes).map(vmLabel).join(', '))}</p>
                              <button type="button" onClick={() => scinderScenario(s.id)}
                                className="mt-1.5 underline font-medium text-amber-900">{t.workshop.a3.scinderBtn}</button>
                            </div>
                          )}
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
                          <label className="label" htmlFor={`ss-grav-${s.id}`}>{t.workshop.a3.scenGLabel} G{s.gravite} — {NIVEAUX_GRAVITE[s.gravite - 1]?.label}{erIdsOf(s).length > 0 && <span className="ml-1 text-xs text-ebios-600">({t.workshop.a3.graviteHeriteeBadge})</span>}</label>
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
                            {s.mesuresEcosysteme.map((m: any) => {
                              const ppKnown = parties.some((p: any) => p.nom === m.partiePrenante)
                              return (
                              <div key={m.id} className="p-2 bg-white border border-gray-100 rounded space-y-1">
                                <div className="flex gap-2 items-center">
                                  <input value={m.mesure}
                                    onChange={e => updateMesure(s.id, m.id, 'mesure', e.target.value)}
                                    className="input text-xs flex-1" placeholder={t.workshop.a3.measPh} />
                                  <select value={m.priorite || 'P2'}
                                    onChange={e => updateMesure(s.id, m.id, 'priorite', e.target.value)}
                                    className="input text-xs w-32" title={t.workshop.a3.measPrioriteLabel}>
                                    {PRIORITES_MESURE.map(pr => (
                                      <option key={pr} value={pr}>{t.workshop.a3.measPriorites[pr]}</option>
                                    ))}
                                  </select>
                                  <select value={m.statut}
                                    onChange={e => updateMesure(s.id, m.id, 'statut', e.target.value)}
                                    className="input text-xs w-28">
                                    <option value="A_FAIRE">{t.workshop.a3.statutFaire}</option>
                                    <option value="EN_COURS">{t.workshop.a3.statutEnCours}</option>
                                    <option value="REALISE">{t.workshop.a3.statutRealise}</option>
                                  </select>
                                  <button aria-label="Supprimer" onClick={() => setPendingDelete({ msg: t.deleteDialog.mesureEco, action: () => removeMesure(s.id, m.id) })} className="text-gray-500 hover:text-red-500"><span aria-hidden="true">✕</span></button>
                                </div>
                                <div className="flex gap-2 items-center">
                                  <input value={m.description || ''}
                                    onChange={e => updateMesure(s.id, m.id, 'description', e.target.value)}
                                    className="input text-xs flex-1" placeholder={t.workshop.a3.measDescPh} />
                                  <select value={ppKnown ? m.partiePrenante : (m.partiePrenante ? '__legacy__' : '')}
                                    onChange={e => updateMesure(s.id, m.id, 'partiePrenante', e.target.value === '__legacy__' ? m.partiePrenante : e.target.value)}
                                    className="input text-xs w-44" title={t.workshop.a3.measPPPh}>
                                    <option value="">{t.workshop.a3.measPPPh}</option>
                                    {parties.map((p: any) => (
                                      <option key={p.id} value={p.nom}>{p.nom}</option>
                                    ))}
                                    {m.partiePrenante && !ppKnown && (
                                      <option value="__legacy__">{m.partiePrenante}</option>
                                    )}
                                  </select>
                                </div>
                                {scenarios.length > 1 && (
                                  <div className="flex flex-wrap gap-1 items-center">
                                    <span className="text-[11px] text-gray-400">{t.workshop.a3.measAlsoApply}</span>
                                    {scenarios.filter((sc: any) => sc.id !== s.id).map((sc: any) => {
                                      const on = Array.isArray(m.scenarioIds) && m.scenarioIds.includes(sc.id)
                                      return (
                                        <button
                                          key={sc.id}
                                          type="button"
                                          onClick={() => toggleMesureScenario(s.id, m.id, sc.id)}
                                          title={sc.nom}
                                          className={`text-[11px] px-1.5 py-0.5 rounded border transition-colors max-w-[160px] truncate ${
                                            on ? 'bg-ebios-100 border-ebios-300 text-ebios-800 font-medium' : 'bg-white border-gray-200 text-gray-500 hover:border-ebios-300'
                                          }`}
                                        >
                                          {on ? '✓ ' : ''}{sc.nom || '—'}
                                        </button>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                              )
                            })}
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

          {scenarios.filter(s => measuresApplyingTo(scenarios, s.id).length > 0).map(s => (
            <div key={s.id} className="card p-5">
              <h3 className="font-semibold text-gray-800 mb-1">{s.nom || t.workshop.a3.scenNoTitle}</h3>
              {s.coupleLabel && <p className="text-xs text-gray-500 mb-3">{t.workshop.a3.coupleLabel} {s.coupleLabel}</p>}
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-2 text-xs font-medium text-gray-600">{t.workshop.a3.measThMesure}</th>
                    <th className="text-left p-2 text-xs font-medium text-gray-600">{t.workshop.a3.measThPriorite}</th>
                    <th className="text-left p-2 text-xs font-medium text-gray-600">{t.workshop.a3.measThPP}</th>
                    <th className="text-left p-2 text-xs font-medium text-gray-600">{t.workshop.a3.measThStatut}</th>
                  </tr>
                </thead>
                <tbody>
                  {measuresApplyingTo(scenarios, s.id).sort((a, b) => comparePriorite(a, b)).map((m: any) => (
                    <tr key={m.id} className="border-t border-gray-100">
                      <td className="p-2 text-gray-800">
                        {m.mesure}
                        {m._mutualisee ? <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-ebios-100 text-ebios-700 align-middle">{t.workshop.a3.measMutualisee}</span> : null}
                        {m.description ? <span className="block text-xs text-gray-400">{m.description}</span> : null}
                      </td>
                      <td className="p-2 text-gray-600">{m.priorite ? t.workshop.a3.measPriorites[m.priorite as 'P1'] : '—'}</td>
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

function PPZoneCard({ pp, getZoneLabel }: { pp: any; getZoneLabel: (z: EcosystemZone) => { color: string } }) {
  const d = ppDerived(pp)
  const { color } = getZoneLabel(d.zone)
  return (
    <div className="flex items-center justify-between p-2 bg-white rounded border border-gray-100 mb-1">
      <span className="text-xs font-medium text-gray-700">{pp.nom}</span>
      <span className={`text-xs font-bold ${color}`}>{d.menace.toFixed(2)}</span>
    </div>
  )
}
