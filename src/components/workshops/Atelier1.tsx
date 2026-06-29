'use client'

/**
 * Atelier1 — Cadrage et socle de sécurité (EBIOS RM Workshop 1)
 *
 * Covers the scoping and security baseline phase of EBIOS RM:
 *  - Périmètre : organisation missions and scope description
 *  - Valeurs métier : business values with DICT criteria
 *    (Disponibilité / Intégrité / Confidentialité / Traçabilité, scored 0–4)
 *  - Biens supports : supporting assets linked to business values, categorised
 *    (applications, servers, network, people, premises…)
 *  - Événements redoutés : dreaded events with feared impacts (gravité 1–4)
 *  - Socle de sécurité : applicable security standards and compliance references
 *
 * Auto-saves via `useAutoSave` on every state change (1.5 s debounce).
 * Navigates to Atelier 2 (or Atelier 2 with `?mode=flash`) on validate.
 *
 * Props:
 *  - analyseId   : Prisma cuid of the parent Analyse
 *  - initialData : Cadrage record from the DB (may be null on first visit)
 *  - analyse     : parent Analyse object (used for referentielMesures)
 *  - flashMode   : mode « Flash » (Club EBIOS) — parcours rapide guidé, conserve le flag dans l'URL
 */

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/context'
import ConfirmDialog from '@/components/ConfirmDialog'
import AutoSaveBadge from '@/components/AutoSaveBadge'
import { useAutoSave } from '@/lib/useAutoSave'
import { useEbiosData } from '@/lib/i18n/use-ebios-data'
import { resolveExemples } from '@/lib/exemples-ateliers'
import { defaultExemplesFor, type ExemplesTranslations } from '@/lib/exemples-defaults'
import { rankExemples, keywordsFromAnswers } from '@/lib/exemples-context'
import { withSectorExemples } from '@/lib/exemples-sectoriels'
import { detectRgpdArt9 } from '@/lib/rgpd-sensitive'
import { bienValeurMetierIds, normalizeBienVmLinks } from '@/lib/biens-supports'
import { FRAMEWORK_IDS, FRAMEWORK_META, getFrameworkControles, recommendedFrameworksForSector, TAILLES_ANALYSE, type TailleAnalyse, type FrameworkId, type FrameworkControl } from '@/lib/frameworks-data'
import ConformiteGrid from '@/components/ConformiteGrid'
import type { ConformiteEntry } from '@/lib/conformite'

interface Props {
  analyseId: string
  initialData?: any
  analyse: any
  flashMode?: boolean
}

function uid() { return Math.random().toString(36).slice(2, 9) }

// Couleur selon niveau DICT (0–4)
function getDictColor(v: number) {
  if (v === 0) return 'bg-gray-100 text-gray-500'
  if (v === 1) return 'bg-green-100 text-green-700'
  if (v === 2) return 'bg-yellow-100 text-yellow-700'
  if (v === 3) return 'bg-orange-100 text-orange-700'
  return 'bg-red-100 text-red-700'
}

export default function Atelier1({ analyseId, initialData, analyse, flashMode }: Props) {
  const router = useRouter()
  const { t, locale } = useTranslation()
  const {
    CATEGORIES_BIENS_SUPPORTS, NIVEAUX_GRAVITE, REFERENTIELS_SECURITE,
    TYPES_BIEN_SUPPORT, NIVEAUX_DICT,
  } = useEbiosData()

  // Translated arrays (derived from t so they re-render on locale change)
  // Config organisation (#8) — types d'impacts + référentiels actifs ; null tant que non chargé
  const [orgImpacts, setOrgImpacts] = useState<{ id: string; label: string; icon: string }[] | null>(null)
  const [orgReferentiels, setOrgReferentiels] = useState<{ nom: string; description: string }[] | null>(null)
  // Exemples personnalisés par l'organisation (override par catégorie) ; vide = défauts
  const [exOverride, setExOverride] = useState<Record<string, any[]>>({})
  useEffect(() => {
    fetch('/api/admin/organization-config')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        if (Array.isArray(d.typesImpacts)) setOrgImpacts(d.typesImpacts)
        if (Array.isArray(d.referentielsActifs)) {
          setOrgReferentiels(d.referentielsActifs.filter((r: any) => r.actif !== false).map((r: any) => ({ nom: r.nom, description: r.description })))
        }
        if (d.exemplesAteliers && typeof d.exemplesAteliers === 'object' && !Array.isArray(d.exemplesAteliers)) {
          setExOverride(d.exemplesAteliers)
        }
        setConformiteActive(Boolean(d.conformiteActive))
      })
      .catch(() => {})
  }, [])

  // Types d'impacts par défaut (i18n) — utilisés si l'organisation n'en a pas configuré (#8)
  const BUILTIN_IMPACTS = [
    { id: 'missions',    label: t.workshop.a1.impactCats.missions.label,    icon: '🏢', description: t.workshop.a1.impactCats.missions.desc },
    { id: 'humain',      label: t.workshop.a1.impactCats.humain.label,      icon: '👥', description: t.workshop.a1.impactCats.humain.desc },
    { id: 'gouvernance', label: t.workshop.a1.impactCats.gouvernance.label, icon: '⚖️', description: t.workshop.a1.impactCats.gouvernance.desc },
    { id: 'financier',   label: t.workshop.a1.impactCats.financier.label,   icon: '💰', description: t.workshop.a1.impactCats.financier.desc },
    { id: 'juridique',   label: t.workshop.a1.impactCats.juridique.label,   icon: '📋', description: t.workshop.a1.impactCats.juridique.desc },
    { id: 'image',       label: t.workshop.a1.impactCats.image.label,       icon: '📣', description: t.workshop.a1.impactCats.image.desc },
  ]
  // Types d'impacts configurés par l'organisation (chargés depuis l'API), sinon défauts
  const CATEGORIES_IMPACTS: { id: string; label: string; icon: string; description?: string }[] =
    orgImpacts && orgImpacts.length ? orgImpacts : BUILTIN_IMPACTS
  const TYPES_VALEUR_METIER = [
    { value: 'PROCESSUS',   label: t.workshop.a1.vmTypeProcess.replace('⚙️ ', '') },
    { value: 'INFORMATION', label: t.workshop.a1.vmTypeInfo.replace('📊 ', '') },
  ]

  // Exemples : override organisation si présent, sinon défauts traduits (ebios-data + i18n)
  const tEx = t as unknown as ExemplesTranslations
  const vmExamples = useMemo(
    () => resolveExemples(exOverride.valeursMetier, defaultExemplesFor('valeursMetier', tEx, locale)) as any[],
    [t, exOverride] // eslint-disable-line react-hooks/exhaustive-deps
  )
  // Exemples contextuels : remonter les valeurs métier pertinentes pour le secteur
  const vmExamplesRanked = useMemo(
    () => rankExemples(withSectorExemples(vmExamples, analyse?.secteur, 'valeursMetier', locale), { secteur: analyse?.secteur }),
    [vmExamples, analyse?.secteur, locale]
  )
  const erExamples = useMemo(
    () => resolveExemples(exOverride.evenementsRedoutes, defaultExemplesFor('evenementsRedoutes', tEx, locale)) as any[],
    [t, exOverride] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const bsExamples = useMemo(
    () => resolveExemples(exOverride.biensSupports, defaultExemplesFor('biensSupports', tEx, locale)) as any[],
    [t, exOverride] // eslint-disable-line react-hooks/exhaustive-deps
  )


  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{ msg: string; action: () => void } | null>(null)
  // Confirmation non bloquante avant de passer à l'Atelier 2 si données minimales manquantes
  const [pendingProceed, setPendingProceed] = useState(false)
  const [activeTab, setActiveTab] = useState<'perimetre' | 'vm' | 'biens' | 'er' | 'socle'>('perimetre')
  const [showVmExamples, setShowVmExamples] = useState(true)
  const [showBsExamples, setShowBsExamples] = useState(true)
  const [showErExamples, setShowErExamples] = useState(true)

  // Périmètre et missions
  const [perimetre, setPerimetre] = useState(initialData?.perimetre || '')
  const [objectifs, setObjectifs] = useState(initialData?.objectifsEtude || '')
  const [missions, setMissions] = useState(initialData?.missions || '')

  // Valeurs métier
  const [vms, setVms] = useState<any[]>(initialData?.valeursMetier || [])

  // Biens supports
  // Biens supports : normalisés au format N‑N (valeurMetierIds) — absorbe l'ancien
  // champ singulier valeurMetierId des analyses existantes (issue #1).
  const [biens, setBiens] = useState<any[]>(() => (initialData?.biensSupports || []).map(normalizeBienVmLinks))

  // Exemples contextuels : biens supports pertinents selon le secteur ET les
  // valeurs métier déjà saisies (réponses précédentes → mots-clés).
  const bsExamplesRanked = useMemo(
    () => rankExemples(withSectorExemples(bsExamples, analyse?.secteur, 'biensSupports', locale), {
      secteur: analyse?.secteur,
      extraKeywords: keywordsFromAnswers(vms),
    }),
    [bsExamples, analyse?.secteur, vms, locale]
  )

  // Exemples contextuels : événements redoutés pertinents selon le secteur et
  // les valeurs métier déjà saisies.
  // Alerte RGPD Art. 9 : données particulières détectées dans les valeurs métier
  const rgpdArt9 = useMemo(() => detectRgpdArt9(vms), [vms])

  const erExamplesRanked = useMemo(
    () => rankExemples(withSectorExemples(erExamples, analyse?.secteur, 'evenementsRedoutes', locale), {
      secteur: analyse?.secteur,
      extraKeywords: keywordsFromAnswers(vms),
    }),
    [erExamples, analyse?.secteur, vms, locale]
  )

  // Événements redoutés
  const [ers, setErs] = useState<any[]>(initialData?.evenementsRedoutes || [])

  // Socle
  const [referentiels, setReferentiels] = useState<any[]>(initialData?.referentiels || [])

  // Conformité au socle (fonctionnalité optionnelle) — stockée dans Cadrage.socleSecurite
  const [conformiteActive, setConformiteActive] = useState(false)
  const [socleSecurite, setSocleSecurite] = useState<ConformiteEntry[]>(
    Array.isArray(initialData?.socleSecurite) ? initialData.socleSecurite : []
  )

  // Secteur OT/ICS → glossaire contextuel (ICS, SCADA, PLC…) pour non-experts
  const isOtSector = /(énergie|energie|industrie|industry|transport|eau|utilities|scada|manufactur)/i.test(analyse?.secteur || '')
  const [showOtGlossary, setShowOtGlossary] = useState(false)

  // Profil de dimensionnement (taille/maturité) — facultatif, défaut « Analyse standard »
  const [tailleAnalyse, setTailleAnalyse] = useState<TailleAnalyse>(
    (initialData?.tailleAnalyse as TailleAnalyse) || 'STANDARD'
  )
  // Référentiel de mesures (Ateliers 3 & 5) — stocké sur Analyse, envoyé via workshop/1
  const [referentielMesures, setReferentielMesures] = useState<string>(analyse?.referentielMesures || 'ISO27001')
  // Référentiels recommandés selon le secteur + la taille (suggestion non bloquante)
  const recommendedFw = recommendedFrameworksForSector(analyse?.secteur, tailleAnalyse)
  // Filtrage du sélecteur de référentiels par secteur (réduit la charge cognitive
  // pour un non-expert) — par défaut on n'affiche que les pertinents + CUSTOM + la
  // sélection courante ; « Afficher tous » dévoile le catalogue complet.
  const [showAllFw, setShowAllFw] = useState(false)
  const filterFw = !!analyse?.secteur && recommendedFw.length > 0 && !showAllFw
  const visibleFw = filterFw
    ? FRAMEWORK_IDS.filter(fid => recommendedFw.includes(fid) || fid === referentielMesures || fid === 'CUSTOM')
    : FRAMEWORK_IDS
  const hiddenFwCount = FRAMEWORK_IDS.length - visibleFw.length

  // Contrôles custom (si référentiel CUSTOM) — stockés dans Cadrage.customControles
  const [customControles, setCustomControles] = useState<FrameworkControl[]>(
    Array.isArray(initialData?.customControles) ? initialData.customControles : []
  )
  const [newCustom, setNewCustom] = useState({ ref: '', nom: '', description: '', type: 'ORGANISATIONNELLE' as FrameworkControl['type'] })

  // ── Auto-save ─────────────────────────────────────────────────────────────
  const autoSaveData = useMemo(
    () => ({ perimetre, objectifsEtude: objectifs, missions, valeursMetier: vms, biensSupports: biens, evenementsRedoutes: ers, referentiels, referentielMesures, customControles, socleSecurite, tailleAnalyse }),
    [perimetre, objectifs, missions, vms, biens, ers, referentiels, referentielMesures, customControles, socleSecurite, tailleAnalyse]
  )
  const { status: autoStatus, lastSaved, error: autoError, saveNow } = useAutoSave(
    autoSaveData,
    async (data) => {
      const res = await fetch(`/api/analyses/${analyseId}/workshop/1`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Sauvegarde échouée')
    },
    { delay: 1500 }
  )

  // ── Valeurs métier ────────────────────────────────────────────────────────
  function addVm(exemple?: any) {
    setVms(prev => [...prev, {
      id: uid(),
      nom: exemple?.nom || '',
      type: exemple?.type || 'PROCESSUS',
      description: exemple?.description || '',
      responsable: exemple?.responsable || '',
      disponibilite:   exemple?.disponibilite   ?? 2,
      integrite:       exemple?.integrite       ?? 2,
      confidentialite: exemple?.confidentialite ?? 2,
      tracabilite:     exemple?.tracabilite     ?? 2,
    }])
  }

  function updateVm(id: string, field: string, value: string | number) {
    setVms(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v))
  }

  function removeVm(id: string) {
    setVms(prev => prev.filter(v => v.id !== id))
  }

  // ── Biens supports ────────────────────────────────────────────────────────
  function addBien(exemple?: any) {
    const exIds = bienValeurMetierIds(exemple)
    setBiens(prev => [...prev, {
      id: uid(),
      nom: exemple?.nom || '',
      type: exemple?.type || 'MATERIEL',
      description: exemple?.description || '',
      // N‑N : rattachement à plusieurs valeurs métier ; défaut = la 1re VM si dispo
      valeurMetierIds: exIds.length ? exIds : (vms[0]?.id ? [vms[0].id] : []),
    }])
  }

  /** Bascule le rattachement d'un bien support à une valeur métier (N‑N). */
  function toggleBienVm(bienId: string, vmId: string) {
    setBiens(prev => prev.map(b => {
      if (b.id !== bienId) return b
      const ids = bienValeurMetierIds(b)
      const next = ids.includes(vmId) ? ids.filter(x => x !== vmId) : [...ids, vmId]
      return { ...b, valeurMetierIds: next }
    }))
  }

  function updateBien(id: string, field: string, value: string) {
    setBiens(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b))
  }

  function removeBien(id: string) {
    setBiens(prev => prev.filter(b => b.id !== id))
  }

  // ── Événements redoutés ───────────────────────────────────────────────────
  function addEr(exemple?: any) {
    setErs(prev => [...prev, {
      id: uid(),
      description: exemple?.description || '',
      impacts: exemple?.impacts?.join(', ') || '',
      categoriesImpacts: [],
      valeurMetierId: exemple?.valeurMetierId || vms[0]?.id || '',
      gravite: exemple?.graviteDefaut || 3,
    }])
  }

  function updateEr(id: string, field: string, value: any) {
    setErs(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e))
  }

  function toggleErCategorie(erId: string, catId: string) {
    setErs(prev => prev.map(e => {
      if (e.id !== erId) return e
      const cats = e.categoriesImpacts || []
      return { ...e, categoriesImpacts: cats.includes(catId) ? cats.filter((c: string) => c !== catId) : [...cats, catId] }
    }))
  }

  function removeEr(id: string) {
    setErs(prev => prev.filter(e => e.id !== id))
  }

  // ── Socle de sécurité ─────────────────────────────────────────────────────
  function toggleReferentiel(nom: string) {
    setReferentiels(prev => {
      const exists = prev.find(r => r.nom === nom)
      if (exists) return prev.filter(r => r.nom !== nom)
      return [...prev, { nom, applicable: true, ecarts: '' }]
    })
  }

  async function doSave() {
    setSaving(true)
    await saveNow()
    setSaving(false)
    router.push(`/analyses/${analyseId}/atelier/2${flashMode ? '?mode=flash' : ''}`)
  }

  // Garde-fou : sans valeur métier ni bien support, les scénarios des ateliers
  // suivants seront incohérents → on demande confirmation (non bloquant).
  function save() {
    if (vms.length === 0 || biens.length === 0) { setPendingProceed(true); return }
    doSave()
  }

  const tabs = [
    { id: 'perimetre' as const, label: `1. ${t.workshop.a1.tabScope}`, icon: '🎯' },
    { id: 'vm'        as const, label: `2. ${t.workshop.a1.tabVM}`,    icon: '💼' },
    { id: 'biens'     as const, label: `3. ${t.workshop.a1.tabBS}`,    icon: '🖥️' },
    { id: 'er'        as const, label: `4. ${t.workshop.a1.tabER}`,    icon: '⚠️' },
    { id: 'socle'     as const, label: `5. ${t.workshop.a1.tabSocle}`, icon: '🔒' },
  ]

  const completionSteps = [
    perimetre.length > 10,
    vms.length > 0,
    biens.length > 0,
    ers.length > 0,
    referentiels.length > 0,
  ]
  const completionCount = completionSteps.filter(Boolean).length

  return (
    <div className="space-y-6">
      {/* Explication + progression */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
        <div className="flex gap-3">
          <span className="text-2xl">💡</span>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              {/* h3 commenté : titre déjà affiché en h1 par la page atelier */}
              {/* <h3 className="font-semibold text-indigo-900">{t.workshop.a1.title}</h3> */}
              <AutoSaveBadge status={autoStatus} lastSaved={lastSaved} error={autoError} />
            </div>
            <p className="text-sm text-indigo-800 mb-3">{t.workshop.a1.desc}</p>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {completionSteps.map((done, i) => (
                  <div key={i} className={`h-2 w-8 rounded-full ${done ? 'bg-indigo-600' : 'bg-indigo-200'}`} />
                ))}
              </div>
              <span className="text-xs text-indigo-700">{completionCount}/5 {t.workshop.a1.sectionsOf}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id ? 'bg-white shadow-sm text-ebios-700' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span>{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>

      {/* ── PÉRIMÈTRE ────────────────────────────────────────────────────── */}
      {activeTab === 'perimetre' && (
        <div className="card p-6 space-y-5">
          <div>
            <h3 className="font-semibold text-gray-800 mb-1">{t.workshop.a1.tailleTitle}</h3>
            <p className="text-sm text-gray-500 mb-3">{t.workshop.a1.tailleDesc}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {([
                { value: 'STANDARD', label: t.workshop.a1.tailleStandardLabel, impact: t.workshop.a1.tailleStandardImpact },
                { value: 'TPE', label: t.workshop.a1.tailleTpeLabel, impact: t.workshop.a1.tailleTpeImpact },
                { value: 'PME', label: t.workshop.a1.taillePmeLabel, impact: t.workshop.a1.taillePmeImpact },
                { value: 'ETI_GE', label: t.workshop.a1.tailleEtiLabel, impact: t.workshop.a1.tailleEtiImpact },
              ] as { value: TailleAnalyse; label: string; impact: string }[]).map(opt => {
                const on = tailleAnalyse === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTailleAnalyse(opt.value)}
                    className={`text-left p-3 rounded-lg border-2 transition-all ${
                      on ? 'border-ebios-500 bg-ebios-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className={`text-sm font-semibold ${on ? 'text-ebios-800' : 'text-gray-800'}`}>
                      {on ? '✓ ' : ''}{opt.label}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 leading-tight">{opt.impact}</div>
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 mb-1">{t.workshop.a1.missionsTitle}</h3>
            <p className="text-sm text-gray-500 mb-3">{t.workshop.a1.missionsDesc}</p>
            <textarea
              value={missions}
              onChange={e => setMissions(e.target.value)}
              rows={3}
              className="input resize-none"
              placeholder={t.workshop.a1.missionsExPh}
            />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 mb-1">{t.workshop.a1.scopeTitle}</h3>
            <p className="text-sm text-gray-500 mb-3">{t.workshop.a1.scopeDesc}</p>
            <textarea
              value={perimetre}
              onChange={e => setPerimetre(e.target.value)}
              rows={3}
              className="input resize-none"
              placeholder={t.workshop.a1.scopeExPh}
            />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 mb-1">{t.workshop.a1.objectivesTitle}</h3>
            <p className="text-sm text-gray-500 mb-3">{t.workshop.a1.objectivesDesc}</p>
            <textarea
              value={objectifs}
              onChange={e => setObjectifs(e.target.value)}
              rows={3}
              className="input resize-none"
              placeholder={t.workshop.a1.objectivesExPh}
            />
          </div>
          <button onClick={() => setActiveTab('vm')} className="btn-primary">
            {t.workshop.a1.nextScopeBtn}
          </button>
        </div>
      )}

      {/* ── VALEURS MÉTIER (FM1) ─────────────────────────────────────────── */}
      {activeTab === 'vm' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-800">{t.workshop.a1.vmInfoText}</p>
          </div>

          {rgpdArt9.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
              <p className="text-sm font-semibold text-amber-900">⚠️ {t.workshop.a1.rgpdArt9Title}</p>
              <p className="text-sm text-amber-800 mt-1">{t.workshop.a1.rgpdArt9Text}</p>
            </div>
          )}

          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">{t.workshop.a1.vmExamplesTitle}</h3>
              <button
                onClick={() => setShowVmExamples(v => !v)}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                {showVmExamples ? t.workshop.hideExamples : t.workshop.showExamples}
              </button>
            </div>
            {showVmExamples && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                {vmExamplesRanked.map((vm, i) => {
                  const added = vms.some((x: any) => x.nom === vm.nom)
                  return (
                  <button
                    key={i}
                    onClick={() => { if (!added) addVm(vm) }}
                    className={`text-left p-3 border rounded-lg transition-all ${
                      added
                        ? 'border-green-400 bg-green-50 opacity-70 cursor-default'
                        : vm.pertinent
                          ? 'border-ebios-300 bg-ebios-50/40 hover:border-ebios-400 hover:bg-ebios-50'
                          : 'border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                    }`}
                  >
                    {added && <div className="text-xs text-green-600 font-semibold mb-1">{t.workshop.addedLabel}</div>}
                    {!added && vm.pertinent && <div className="text-xs text-ebios-700 font-semibold mb-1">⭐ {t.workshop.relevantLabel}</div>}
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                        vm.type === 'PROCESSUS' ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'
                      }`}>
                        {vm.type === 'PROCESSUS' ? t.workshop.a1.vmTypeProcess : t.workshop.a1.vmTypeInfo}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-gray-700">{vm.nom}</div>
                    <div className="text-xs text-gray-500 mt-0.5 mb-2">{vm.description}</div>
                    {/* Mini badges DICT */}
                    <div className="flex gap-1 flex-wrap">
                      {[
                        { k: 'D', v: vm.disponibilite },
                        { k: 'I', v: vm.integrite },
                        { k: 'C', v: vm.confidentialite },
                        ...(vm.type === 'PROCESSUS' ? [{ k: 'T', v: vm.tracabilite }] : []),
                      ].map(({ k, v }) => (
                        <span key={k} className={`text-xs px-1.5 py-0.5 rounded font-mono font-bold ${getDictColor(v)}`}>
                          {k}{v}
                        </span>
                      ))}
                    </div>
                  </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">{t.workshop.a1.vmListTitle} ({vms.length})</h3>
              <button onClick={() => addVm()} className="btn-secondary text-sm py-1.5">{t.workshop.a1.vmAddBtn}</button>
            </div>
            {vms.length === 0 && (
              <p className="text-sm text-gray-500 italic text-center py-6">{t.workshop.a1.vmEmpty}</p>
            )}
            <div className="space-y-3">
              {vms.map(vm => (
                <div key={vm.id} className="p-4 bg-gray-50 rounded-lg space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="label" htmlFor={`vm-nom-${vm.id}`}>{t.workshop.a1.vmNamePh}</label>
                      <input
                         id={`vm-nom-${vm.id}`}
                        value={vm.nom}
                        onChange={e => updateVm(vm.id, 'nom', e.target.value)}
                        className="input text-sm"
                        placeholder={t.workshop.a1.vmNameExPh}
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor={`vm-type-${vm.id}`}>{t.workshop.typeLabel}</label>
                      <select
                         id={`vm-type-${vm.id}`}
                        value={vm.type}
                        onChange={e => updateVm(vm.id, 'type', e.target.value)}
                        className="input text-sm"
                      >
                        {TYPES_VALEUR_METIER.map(tv => (
                          <option key={tv.value} value={tv.value}>{tv.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label" htmlFor={`vm-desc-${vm.id}`}>{t.workshop.descLabel}</label>
                      <input
                         id={`vm-desc-${vm.id}`}
                        value={vm.description}
                        onChange={e => updateVm(vm.id, 'description', e.target.value)}
                        className="input text-sm"
                        placeholder={t.workshop.a1.vmDescPh}
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor={`vm-owner-${vm.id}`}>{t.workshop.a1.vmOwnerPh}</label>
                      <input
                         id={`vm-owner-${vm.id}`}
                        value={vm.responsable}
                        onChange={e => updateVm(vm.id, 'responsable', e.target.value)}
                        className="input text-sm"
                        placeholder={t.workshop.a1.vmOwnerExPh}
                      />
                    </div>
                    <div className="flex items-end">
                      <button onClick={() => setPendingDelete({ msg: t.deleteDialog.vm, action: () => removeVm(vm.id) })} className="btn-danger text-sm py-2 w-full">
                        {t.workshop.deleteBtn}
                      </button>
                    </div>
                  </div>

                  {/* ── Critères DICT / DIC ─────────────────────────────── */}
                  <div className="border-t border-gray-200 pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        {vm.type === 'PROCESSUS' ? t.workshop.dictAcronymProcess : t.workshop.dictAcronymInfo} — {t.workshop.a1.vmDictTitle}
                      </span>
                      <span className="text-xs text-gray-500 italic">{t.workshop.a1.vmDictInfo}</span>
                    </div>
                    <div className={`grid gap-3 ${vm.type === 'PROCESSUS' ? 'grid-cols-4' : 'grid-cols-3'}`}>
                      {[
                        { key: 'disponibilite',   label: t.workshop.a1.vmDictD, show: true },
                        { key: 'integrite',       label: t.workshop.a1.vmDictI, show: true },
                        { key: 'confidentialite', label: t.workshop.a1.vmDictC, show: true },
                        { key: 'tracabilite',     label: t.workshop.a1.vmDictT, show: vm.type === 'PROCESSUS' },
                      ].filter(c => c.show).map(crit => {
                        const val = vm[crit.key] ?? 2
                        const niveau = NIVEAUX_DICT.find(n => n.value === val)
                        return (
                          <div key={crit.key} className="text-center">
                            <label className="text-xs text-gray-500 block mb-1">{crit.label}</label>
                            <select
                              value={val}
                              onChange={e => updateVm(vm.id, crit.key, Number(e.target.value))}
                              className={`w-full text-xs font-semibold rounded px-2 py-1 border-0 cursor-pointer ${getDictColor(val)}`}
                            >
                              {NIVEAUX_DICT.map(n => (
                                <option key={n.value} value={n.value}>{n.value} – {n.label}</option>
                              ))}
                            </select>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button onClick={() => setActiveTab('biens')} className="btn-primary">{t.workshop.a1.nextVMBtn}</button>
        </div>
      )}

      {/* ── BIENS SUPPORTS ───────────────────────────────────────────────── */}
      {activeTab === 'biens' && (
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <p className="text-sm text-yellow-800">
              {t.workshop.a1.bsInfoText}
              {vms.length === 0 && <strong> {t.workshop.a1.bsNoVmWarning}</strong>}
            </p>
          </div>

          {/* Glossaire OT contextuel (secteurs industriels) */}
          {isOtSector && (
            <div className="border border-amber-200 rounded-xl bg-amber-50/50 p-3">
              <button
                type="button"
                onClick={() => setShowOtGlossary(v => !v)}
                className="flex items-center justify-between w-full text-left"
              >
                <span className="text-sm font-semibold text-amber-900">🏭 {t.workshop.a1.otGlossaryTitle}</span>
                <span className="text-xs text-amber-700 underline">
                  {showOtGlossary ? t.workshop.hideExamples : t.workshop.showExamples}
                </span>
              </button>
              {showOtGlossary && (
                <dl className="mt-2 space-y-1.5">
                  {[
                    ['OT', t.workshop.a1.otGlossaryOT],
                    ['ICS', t.workshop.a1.otGlossaryICS],
                    ['SCADA', t.workshop.a1.otGlossarySCADA],
                    ['Automate (PLC)', t.workshop.a1.otGlossaryPLC],
                    ['IHM (HMI)', t.workshop.a1.otGlossaryHMI],
                    ['Bus de terrain', t.workshop.a1.otGlossaryFieldbus],
                    ['SIS', t.workshop.a1.otGlossarySIS],
                  ].map(([term, def]) => (
                    <div key={term} className="text-xs">
                      <dt className="inline font-semibold text-amber-900">{term} — </dt>
                      <dd className="inline text-amber-800">{def}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}

          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">{t.workshop.a1.bsExamplesTitle}</h3>
              <button
                onClick={() => setShowBsExamples(v => !v)}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                {showBsExamples ? t.workshop.hideExamples : t.workshop.showExamples}
              </button>
            </div>
            {showBsExamples && (
              <div className="space-y-4">
                {CATEGORIES_BIENS_SUPPORTS.map(cat => {
                  const items = bsExamplesRanked.filter((b: any) => b.type === cat.value)
                  if (!items.length) return null
                  return (
                    <div key={cat.value}>
                      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold mb-2 border ${cat.color}`}>
                        <span>{cat.emoji}</span>
                        <span>{cat.label}</span>
                        <span className="opacity-60">({items.length})</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                        {items.map((b, i) => {
                          // "Ajouté" dérivé de la présence réelle dans la liste (persiste après auto-save)
                          const added = biens.some((x: any) => x.nom === b.nom)
                          return (
                          <button
                            key={i}
                            onClick={() => { if (!added) addBien(b) }}
                            className={`text-left p-2.5 border rounded-lg transition-all ${
                              added
                                ? 'border-green-400 bg-green-50 opacity-70 cursor-default shadow-none'
                                : `hover:shadow-sm group ${cat.color} border-opacity-60 hover:border-opacity-100`
                            }`}
                          >
                            {added && <div className="text-xs text-green-600 font-semibold mb-0.5">{t.workshop.addedLabel}</div>}
                            {!added && b.pertinent && <div className="text-xs text-ebios-700 font-semibold mb-0.5">⭐ {t.workshop.relevantLabel}</div>}
                            <div className="text-xs font-medium">{b.nom}</div>
                            <div className="text-xs opacity-60 mt-0.5 line-clamp-1">{b.description}</div>
                          </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">{t.workshop.a1.bsListTitle} ({biens.length})</h3>
              <button onClick={() => addBien()} className="btn-secondary text-sm py-1.5">{t.workshop.a1.bsAddManual}</button>
            </div>
            {biens.length === 0 && (
              <p className="text-sm text-gray-500 italic text-center py-6">{t.workshop.a1.bsEmpty}</p>
            )}
            <div className="space-y-3">
              {biens.map(b => (
                <div key={b.id} className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <input
                      value={b.nom} onChange={e => updateBien(b.id, 'nom', e.target.value)}
                      className="input text-sm" placeholder={t.workshop.a1.bsNamePh}
                    />
                    <select
                      value={b.type} onChange={e => updateBien(b.id, 'type', e.target.value)}
                      className="input text-sm"
                    >
                      {TYPES_BIEN_SUPPORT.map(tbs => (
                        <option key={tbs.value} value={tbs.value}>{tbs.emoji} {tbs.label}</option>
                      ))}
                    </select>
                    {vms.length > 0 && (() => {
                      const linked = bienValeurMetierIds(b)
                      return (
                        <div className="sm:col-span-1">
                          <div className="text-[11px] text-gray-400 mb-0.5">{t.workshop.a1.bsVmSelect}</div>
                          <div className="flex flex-wrap gap-1">
                            {vms.map(vm => {
                              const on = linked.includes(vm.id)
                              return (
                                <button
                                  key={vm.id}
                                  type="button"
                                  onClick={() => toggleBienVm(b.id, vm.id)}
                                  title={vm.nom}
                                  className={`text-[11px] px-1.5 py-0.5 rounded border transition-colors max-w-[140px] truncate ${
                                    on
                                      ? 'bg-ebios-100 border-ebios-300 text-ebios-800 font-medium'
                                      : 'bg-white border-gray-200 text-gray-500 hover:border-ebios-300'
                                  }`}
                                >
                                  {on ? '✓ ' : ''}{vm.nom}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })()}
                    <input
                      value={b.description} onChange={e => updateBien(b.id, 'description', e.target.value)}
                      className="input text-sm" placeholder={t.workshop.a1.bsDescPh}
                    />
                  </div>
                  <button aria-label={t.workshop.deleteBtn} onClick={() => setPendingDelete({ msg: t.deleteDialog.bien, action: () => removeBien(b.id) })} className="text-gray-500 hover:text-red-500 mt-2"><span aria-hidden="true">✕</span></button>
                </div>
              ))}
            </div>
          </div>
          <button onClick={() => setActiveTab('er')} className="btn-primary">{t.workshop.a1.nextBSBtn}</button>
        </div>
      )}

      {/* ── ÉVÉNEMENTS REDOUTÉS ──────────────────────────────────────────── */}
      {activeTab === 'er' && (
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <p className="text-sm text-yellow-800">{t.workshop.a1.erInfoText}</p>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">{t.workshop.a1.erExamplesTitle}</h3>
              <button
                onClick={() => setShowErExamples(v => !v)}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                {showErExamples ? t.workshop.hideExamples : t.workshop.showExamples}
              </button>
            </div>
            {showErExamples && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {erExamplesRanked.map((er, i) => {
                  const added = ers.some((x: any) => x.description === er.description)
                  return (
                  <button
                    key={i}
                    onClick={() => { if (!added) addEr(er) }}
                    className={`text-left p-3 border rounded-lg transition-all ${
                      added
                        ? 'border-green-400 bg-green-50 opacity-70 cursor-default'
                        : 'border-dashed border-gray-300 hover:border-red-300 hover:bg-red-50'
                    }`}
                  >
                    {added && <div className="text-xs text-green-600 font-semibold mb-1">{t.workshop.addedLabel}</div>}
                    {!added && er.pertinent && <div className="text-xs text-ebios-700 font-semibold mb-1">⭐ {t.workshop.relevantLabel}</div>}
                    <div className="text-xs font-medium text-gray-700">{er.description}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        NIVEAUX_GRAVITE[er.graviteDefaut - 1]?.bg} ${NIVEAUX_GRAVITE[er.graviteDefaut - 1]?.color}`
                      }>
                        G{er.graviteDefaut} — {NIVEAUX_GRAVITE[er.graviteDefaut - 1]?.label}
                      </span>
                    </div>
                  </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">{t.workshop.a1.erListTitle} ({ers.length})</h3>
              <button onClick={() => addEr()} className="btn-secondary text-sm py-1.5">{t.workshop.a1.erAddBtn}</button>
            </div>
            {ers.length === 0 && (
              <p className="text-sm text-gray-500 italic text-center py-6">{t.workshop.a1.erEmpty}</p>
            )}
            <div className="space-y-4">
              {ers.map(er => (
                <div key={er.id} className="p-4 bg-gray-50 rounded-lg space-y-3">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="label" htmlFor={`er-desc-${er.id}`}>{t.workshop.a1.erDescPh}</label>
                      <input
                         id={`er-desc-${er.id}`}
                        value={er.description}
                        onChange={e => updateEr(er.id, 'description', e.target.value)}
                        className="input text-sm"
                        placeholder={t.workshop.a1.erExPh}
                      />
                    </div>
                    <button aria-label={t.workshop.deleteBtn} onClick={() => setPendingDelete({ msg: t.deleteDialog.er, action: () => removeEr(er.id) })} className="text-gray-500 hover:text-red-500 mt-6"><span aria-hidden="true">✕</span></button>
                  </div>

                  {/* Lien valeur métier */}
                  {vms.length > 0 && (
                    <div>
                      <label className="label" htmlFor={`er-vm-${er.id}`}>{t.workshop.a1.erVmLabel}</label>
                      <select
                         id={`er-vm-${er.id}`}
                        value={er.valeurMetierId || ''}
                        onChange={e => updateEr(er.id, 'valeurMetierId', e.target.value)}
                        className="input text-sm"
                      >
                        <option value="">{t.workshop.a1.erVmSelect}</option>
                        {vms.map(vm => (
                          <option key={vm.id} value={vm.id}>{vm.nom}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Catégories d'impacts FM3 */}
                  <div>
                    <label className="label">{t.workshop.a1.erImpactsTitle}</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {CATEGORIES_IMPACTS.map(cat => {
                        const selected = (er.categoriesImpacts || []).includes(cat.id)
                        return (
                          <button
                            key={cat.id}
                            onClick={() => toggleErCategorie(er.id, cat.id)}
                            className={`text-left p-2 rounded-lg border text-xs transition-colors ${
                              selected ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <span>{cat.icon} </span>
                            <strong>{cat.label}</strong>
                            <div className="text-gray-500 mt-0.5">{cat.description}</div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label" htmlFor={`er-impacts-${er.id}`}>{t.workshop.a1.erImpactsPh}</label>
                      <input
                         id={`er-impacts-${er.id}`}
                        value={er.impacts}
                        onChange={e => updateEr(er.id, 'impacts', e.target.value)}
                        className="input text-sm"
                        placeholder={t.workshop.a1.erImpactsExPh}
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor={`er-grav-${er.id}`}>{t.workshop.a1.erGravityLabel} (G1 à G{NIVEAUX_GRAVITE.length})</label>
                      <select
                         id={`er-grav-${er.id}`}
                        value={er.gravite}
                        onChange={e => updateEr(er.id, 'gravite', parseInt(e.target.value))}
                        className="input text-sm"
                      >
                        {NIVEAUX_GRAVITE.map(n => (
                          <option key={n.value} value={n.value}>G{n.value} — {n.label}</option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        {NIVEAUX_GRAVITE[er.gravite - 1]?.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button onClick={() => setActiveTab('socle')} className="btn-primary">{t.workshop.a1.nextERBtn}</button>
        </div>
      )}

      {/* ── SOCLE DE SÉCURITÉ ────────────────────────────────────────────── */}
      {activeTab === 'socle' && (
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <p className="text-sm text-yellow-800">{t.workshop.a1.socleInfoText}</p>
          </div>

          {/* ── Référentiel de mesures ──────────────────────────────────── */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-800 mb-1">{t.workshop.a1.referentielMesTitle}</h3>
            <p className="text-xs text-gray-500 mb-3">{t.workshop.a1.referentielMesDesc}</p>
            {analyse?.secteur && recommendedFw.length > 0 && (
              <p className="text-xs text-indigo-700 mb-3">
                ⭐ {t.workshop.a1.recommendedBadge} ({analyse.secteur}) : {recommendedFw.map(fid => FRAMEWORK_META[fid].nom).join(', ')}
              </p>
            )}
            {recommendedFw.includes('HDS') && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mb-3">
                ℹ️ {t.workshop.a1.hdsNote}
              </p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
              {visibleFw.map(fid => {
                const m = FRAMEWORK_META[fid]
                const selected = referentielMesures === fid
                const isReco = recommendedFw.includes(fid)
                return (
                  <button
                    key={fid}
                    type="button"
                    onClick={() => setReferentielMesures(fid)}
                    className={`relative text-left p-3 rounded-xl border-2 transition-all ${
                      selected
                        ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                        : isReco
                          ? 'border-indigo-200 hover:border-indigo-300 bg-white'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    {isReco && !selected && (
                      <span className="absolute top-1.5 right-1.5 text-[10px] font-semibold text-indigo-700" title={t.workshop.a1.recommendedBadge}>⭐</span>
                    )}
                    <div className="text-lg mb-0.5">{m.icon}</div>
                    <div className={`text-xs font-semibold leading-tight ${selected ? 'text-indigo-800' : 'text-gray-800'}`}>
                      {m.nom}
                    </div>
                    {m.version && (
                      <div className="text-xs text-gray-400 mt-0.5">{m.version}</div>
                    )}
                    <div className="text-xs text-gray-500 mt-1 leading-tight hidden sm:block">{m.cible}</div>
                  </button>
                )
              })}
            </div>
            {/* Afficher tous / seulement les référentiels du secteur */}
            {(filterFw && hiddenFwCount > 0) ? (
              <button
                type="button"
                onClick={() => setShowAllFw(true)}
                className="text-xs text-indigo-600 hover:text-indigo-800 underline mb-4"
              >
                {t.workshop.a1.showAllFrameworks} ({hiddenFwCount})
              </button>
            ) : (!!analyse?.secteur && recommendedFw.length > 0 && showAllFw) ? (
              <button
                type="button"
                onClick={() => setShowAllFw(false)}
                className="text-xs text-indigo-600 hover:text-indigo-800 underline mb-4"
              >
                {t.workshop.a1.showRecommendedFrameworks}
              </button>
            ) : <div className="mb-4" />}

            {/* Custom controls management */}
            {referentielMesures === 'CUSTOM' && (
              <div className="border border-dashed border-gray-300 rounded-xl p-4 mt-2 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-700">{t.workshop.a1.customTitle} ({customControles.length})</h4>
                </div>

                {/* Existing controls */}
                {customControles.length > 0 && (
                  <div className="space-y-1">
                    {customControles.map((c, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
                        <span className="text-xs font-mono font-semibold text-indigo-700 w-16 flex-shrink-0">{c.ref}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-800">{c.nom}</div>
                          {c.description && (
                            <div className="text-xs text-gray-500 line-clamp-1">{c.description}</div>
                          )}
                        </div>
                        <button
                          type="button"
                          aria-label={t.workshop.a1.customDeleteAriaLabel}
                          onClick={() => setCustomControles(prev => prev.filter((_, j) => j !== i))}
                          className="text-gray-400 hover:text-red-500 flex-shrink-0 text-sm"
                        >✕</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add custom control */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    value={newCustom.ref}
                    onChange={e => setNewCustom(p => ({ ...p, ref: e.target.value }))}
                    className="input text-sm"
                    placeholder={t.workshop.a1.customRefPh}
                  />
                  <input
                    value={newCustom.nom}
                    onChange={e => setNewCustom(p => ({ ...p, nom: e.target.value }))}
                    className="input text-sm"
                    placeholder={t.workshop.a1.customNamePh}
                  />
                  <input
                    value={newCustom.description}
                    onChange={e => setNewCustom(p => ({ ...p, description: e.target.value }))}
                    className="input text-sm sm:col-span-1"
                    placeholder={t.workshop.a1.customDescPh}
                  />
                  <select
                    value={newCustom.type}
                    onChange={e => setNewCustom(p => ({ ...p, type: e.target.value as FrameworkControl['type'] }))}
                    className="input text-sm"
                  >
                    <option value="ORGANISATIONNELLE">{t.workshop.a1.customTypeOrga}</option>
                    <option value="TECHNOLOGIQUE">{t.workshop.a1.customTypeTech}</option>
                    <option value="PHYSIQUE">{t.workshop.a1.customTypePhys}</option>
                    <option value="HUMAINE">{t.workshop.a1.customTypeHum}</option>
                  </select>
                </div>
                <button
                  type="button"
                  disabled={!newCustom.ref.trim() || !newCustom.nom.trim()}
                  onClick={() => {
                    if (!newCustom.ref.trim() || !newCustom.nom.trim()) return
                    setCustomControles(prev => [...prev, { ...newCustom, categorie: 'CUSTOM' }])
                    setNewCustom({ ref: '', nom: '', description: '', type: 'ORGANISATIONNELLE' })
                  }}
                  className="btn-secondary text-sm py-1.5 disabled:opacity-40"
                >
                  {t.workshop.a1.customAddBtn}
                </button>
              </div>
            )}
          </div>

          {/* ── Grille de conformité au référentiel (fonctionnalité optionnelle) ── */}
          {conformiteActive && (
            <div className="card p-5">
              <ConformiteGrid
                controles={getFrameworkControles(referentielMesures, customControles)}
                entries={socleSecurite}
                onChange={setSocleSecurite}
              />
            </div>
          )}

          {/* ── Socle de sécurité existant ───────────────────────────────── */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-800 mb-3">{t.workshop.a1.socleTitle}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              {(orgReferentiels ?? REFERENTIELS_SECURITE).map(r => {
                const selected = referentiels.some(x => x.nom === r.nom)
                return (
                  <button
                    key={r.nom}
                    onClick={() => toggleReferentiel(r.nom)}
                    className={`text-left p-3 border rounded-lg transition-colors ${
                      selected ? 'border-ebios-500 bg-ebios-50' : 'border-gray-200 hover:border-ebios-300 hover:bg-ebios-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${
                        selected ? 'bg-ebios-600 border-ebios-600 text-white' : 'border-gray-400'
                      }`}>{selected ? '✓' : ''}</span>
                      <div>
                        <div className="text-sm font-medium text-gray-800">{r.nom}</div>
                        <div className="text-xs text-gray-500">{r.description}</div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            {referentiels.length > 0 && (
              <div className="space-y-2 mt-4">
                <h4 className="text-sm font-medium text-gray-700">{t.workshop.a1.socleSelectedTitle}</h4>
                {referentiels.map(r => (
                  <div key={r.nom} className="flex gap-3 items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700 w-40 flex-shrink-0">{r.nom}</span>
                    <input
                      value={r.ecarts || ''}
                      onChange={e => setReferentiels(prev => prev.map(x => x.nom === r.nom ? { ...x, ecarts: e.target.value } : x))}
                      className="input text-sm flex-1"
                      placeholder={t.workshop.a1.socleGapPh}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

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
      {pendingProceed && (
        <ConfirmDialog
          title={t.workshop.a1.proceedWarnTitle}
          message={t.workshop.a1.proceedWarnMsg}
          confirmLabel={t.workshop.a1.proceedAnyway}
          icon="⚠️"
          variant="warning"
          onConfirm={() => { setPendingProceed(false); doSave() }}
          onCancel={() => setPendingProceed(false)}
        />
      )}
    </div>
  )
}
