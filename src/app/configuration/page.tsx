'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Navbar from '@/components/Navbar'
import { useTranslation } from '@/lib/i18n/context'
import { readableTextColor } from '@/lib/contrast-color'
import {
  getRiskLevel,
  buildDefaultQualitativeMatrix,
  type MatriceMode,
  type QualitativeCell,
} from '@/lib/risk-scale'
import type { TypeImpact, ReferentielActif, StrategieTraitement } from '@/lib/org-config-defaults'
import { EXEMPLES_CATEGORIES, getCategoryDef, type CategoryDef, type FieldSchema } from '@/lib/exemples-ateliers'
import { defaultExemplesFor, type ExemplesTranslations } from '@/lib/exemples-defaults'
import { CATEGORIES_BIENS_SUPPORTS } from '@/lib/ebios-data'
import ConfirmDialog from '@/components/ConfirmDialog'

// ─── Types ───────────────────────────────────────────────────────────────────

interface NiveauEchelle {
  niveau: number
  label: string
  description: string
  couleur: string
}

interface SeuilMatrice {
  scoreMin: number
  scoreMax: number
  label: string
  couleur: string
}

interface Config {
  nbNiveaux: number
  echelleGravite: NiveauEchelle[]
  echelleVraisemblance: NiveauEchelle[]
  seuilsMatrice: SeuilMatrice[]
  matriceMode: MatriceMode
  matriceQualitative: QualitativeCell[] | null
}

// ─── Défauts ─────────────────────────────────────────────────────────────────

const DEFAUT_4: Config = {
  nbNiveaux: 4,
  echelleGravite: [
    { niveau: 1, label: 'Mineure',    description: 'Conséquences négligeables. Aucun impact opérationnel.',                couleur: '#22c55e' },
    { niveau: 2, label: 'Limitée',    description: 'Conséquences significatives mais limitées. Mode dégradé.',             couleur: '#f59e0b' },
    { niveau: 3, label: 'Importante', description: 'Conséquences importantes. Forte dégradation, mode très dégradé.',      couleur: '#f97316' },
    { niveau: 4, label: 'Critique',   description: 'Conséquences désastreuses, survie de l\'organisation menacée.',         couleur: '#ef4444' },
  ],
  echelleVraisemblance: [
    { niveau: 1, label: 'Minime',       description: 'L\'événement ne devrait pas se produire. Précédents rares.',         couleur: '#22c55e' },
    { niveau: 2, label: 'Significative',description: 'L\'événement pourrait se produire. Quelques précédents.',            couleur: '#f59e0b' },
    { niveau: 3, label: 'Forte',        description: 'L\'événement devrait se produire. Précédents fréquents.',            couleur: '#f97316' },
    { niveau: 4, label: 'Maximale',     description: 'L\'événement se produira certainement. Attaques en cours.',          couleur: '#ef4444' },
  ],
  seuilsMatrice: [
    { scoreMin: 1,  scoreMax: 4,  label: 'Faible',   couleur: '#22c55e' },
    { scoreMin: 5,  scoreMax: 8,  label: 'Modéré',   couleur: '#f59e0b' },
    { scoreMin: 9,  scoreMax: 12, label: 'Élevé',    couleur: '#f97316' },
    { scoreMin: 13, scoreMax: 25, label: 'Critique',  couleur: '#ef4444' },
  ],
  matriceMode: 'QUANTITATIVE',
  matriceQualitative: null,
}

const DEFAUT_5: Config = {
  nbNiveaux: 5,
  echelleGravite: [
    { niveau: 1, label: 'Mineure',         description: 'Conséquences négligeables. Aucun impact opérationnel.',                        couleur: '#22c55e' },
    { niveau: 2, label: 'Significative',   description: 'Conséquences significatives mais limitées. Mode dégradé.',                    couleur: '#84cc16' },
    { niveau: 3, label: 'Grave',           description: 'Conséquences importantes. Forte dégradation, mode très dégradé.',              couleur: '#f59e0b' },
    { niveau: 4, label: 'Critique',        description: 'Conséquences désastreuses, survie de l\'organisation menacée.',                 couleur: '#ef4444' },
    { niveau: 5, label: 'Catastrophique',  description: 'Conséquences sectorielles ou régaliennes au-delà de l\'organisation.',         couleur: '#7f1d1d' },
  ],
  echelleVraisemblance: [
    { niveau: 1, label: 'Très improbable', description: 'L\'événement ne devrait pas se produire. Aucun précédent.',                   couleur: '#22c55e' },
    { niveau: 2, label: 'Minime',          description: 'L\'événement ne devrait pas se produire. Précédents rares.',                  couleur: '#84cc16' },
    { niveau: 3, label: 'Significative',   description: 'L\'événement pourrait se produire. Quelques précédents.',                     couleur: '#f59e0b' },
    { niveau: 4, label: 'Forte',           description: 'L\'événement devrait se produire. Précédents fréquents.',                     couleur: '#ef4444' },
    { niveau: 5, label: 'Maximale',        description: 'L\'événement se produira certainement. Attaques en cours.',                   couleur: '#7f1d1d' },
  ],
  seuilsMatrice: [
    { scoreMin: 1,  scoreMax: 4,  label: 'Faible',    couleur: '#22c55e' },
    { scoreMin: 5,  scoreMax: 9,  label: 'Modéré',    couleur: '#f59e0b' },
    { scoreMin: 10, scoreMax: 16, label: 'Élevé',     couleur: '#f97316' },
    { scoreMin: 17, scoreMax: 25, label: 'Critique',  couleur: '#ef4444' },
  ],
  matriceMode: 'QUANTITATIVE',
  matriceQualitative: null,
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function ConfigurationPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const { data: session } = useSession()
  const isAdmin = (session?.user as any)?.role === 'ADMIN'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeTab, setActiveTab] = useState<'gravite' | 'vraisemblance' | 'matrice' | 'apercu'>('gravite')
  // Onglet principal de la configuration (3 sections)
  const [section, setSection] = useState<'echelles' | 'options' | 'exemples'>('echelles')

  const [config, setConfig] = useState<Config>(DEFAUT_4)

  // ── Entités responsables de mesures ──────────────────────────────────────
  const [entites, setEntites] = useState<string[]>([])
  const [newEntite, setNewEntite] = useState('')
  const [savingEntites, setSavingEntites] = useState(false)
  const [savedEntites, setSavedEntites] = useState(false)

  // ── Types d'impacts & référentiels (#8) ──────────────────────────────────
  const [typesImpacts, setTypesImpacts] = useState<TypeImpact[]>([])
  const [savingImpacts, setSavingImpacts] = useState(false)
  const [savedImpacts, setSavedImpacts] = useState(false)
  const [referentiels, setReferentiels] = useState<ReferentielActif[]>([])
  const [newRef, setNewRef] = useState('')
  const [savingRef, setSavingRef] = useState(false)
  const [savedRef, setSavedRef] = useState(false)
  // ── Options de traitement (stratégies) ───────────────────────────────────
  const [strategies, setStrategies] = useState<StrategieTraitement[]>([])
  const [savingStrat, setSavingStrat] = useState(false)
  const [savedStrat, setSavedStrat] = useState(false)
  // ── Exemples des ateliers ────────────────────────────────────────────────
  const [exRows, setExRows] = useState<Record<string, Record<string, unknown>[]>>({})
  const [exOverride, setExOverride] = useState<Record<string, boolean>>({})
  const [savingEx, setSavingEx] = useState<string | null>(null)
  const [savedEx, setSavedEx] = useState<string | null>(null)
  const [selectedEx, setSelectedEx] = useState<string | null>(null) // catégorie ouverte (null = damier)
  const [pendingConfirm, setPendingConfirm] = useState<{ message: string; action: () => void } | null>(null)

  useEffect(() => {
    fetch('/api/configuration')
      .then(r => r.json())
      .then(data => {
        if (data && data.echelleGravite) {
          setConfig({
            nbNiveaux: data.nbNiveaux ?? 4,
            echelleGravite: data.echelleGravite,
            echelleVraisemblance: data.echelleVraisemblance,
            seuilsMatrice: data.seuilsMatrice ?? DEFAUT_4.seuilsMatrice,
            matriceMode: data.matriceMode === 'QUALITATIVE' ? 'QUALITATIVE' : 'QUANTITATIVE',
            matriceQualitative: data.matriceQualitative ?? null,
          })
        }
      })
      .finally(() => setLoading(false))
    fetch('/api/admin/organization-config')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.entitesMesures)) setEntites(data.entitesMesures)
        if (Array.isArray(data.typesImpacts)) setTypesImpacts(data.typesImpacts)
        if (Array.isArray(data.referentielsActifs)) setReferentiels(data.referentielsActifs)
        if (Array.isArray(data.strategiesTraitement)) setStrategies(data.strategiesTraitement)
        const ov = (data.exemplesAteliers && typeof data.exemplesAteliers === 'object' && !Array.isArray(data.exemplesAteliers)) ? data.exemplesAteliers : {}
        const rows: Record<string, Record<string, unknown>[]> = {}
        const hasOv: Record<string, boolean> = {}
        for (const c of EXEMPLES_CATEGORIES) {
          const o = Array.isArray(ov[c.key]) ? ov[c.key] : null
          hasOv[c.key] = !!(o && o.length)
          rows[c.key] = (o && o.length) ? o : defaultExemplesFor(c.key, t as unknown as ExemplesTranslations)
        }
        setExRows(rows); setExOverride(hasOv)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Helpers options de traitement ────────────────────────────────────────
  function updateStrat(idx: number, field: 'label' | 'description' | 'conseil', value: string) {
    setStrategies(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s)); setSavedStrat(false)
  }
  async function saveStrategies() {
    setSavingStrat(true); setSavedStrat(false)
    const res = await fetch('/api/admin/organization-config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strategiesTraitement: strategies }),
    })
    setSavingStrat(false)
    if (res.ok) { const d = await res.json(); if (Array.isArray(d.strategiesTraitement)) setStrategies(d.strategiesTraitement); setSavedStrat(true) }
  }

  // ── Helpers exemples des ateliers ────────────────────────────────────────
  function blankRow(def: CategoryDef): Record<string, unknown> {
    const r: Record<string, unknown> = {}
    for (const f of def.fields) {
      if (f.kind === 'enum') r[f.key] = f.options?.[0] ?? ''
      else if (f.kind === 'score') r[f.key] = 3
      else if (f.kind === 'stringList') r[f.key] = []
      else r[f.key] = ''
    }
    return r
  }
  function updateEx(cat: string, idx: number, key: string, value: unknown) {
    setExRows(prev => ({ ...prev, [cat]: (prev[cat] ?? []).map((row, i) => i === idx ? { ...row, [key]: value } : row) }))
    setSavedEx(null)
  }
  function addEx(cat: string) {
    const def = getCategoryDef(cat as never); if (!def) return
    setExRows(prev => ({ ...prev, [cat]: [...(prev[cat] ?? []), blankRow(def)] })); setSavedEx(null)
  }
  function removeEx(cat: string, idx: number) {
    setExRows(prev => ({ ...prev, [cat]: (prev[cat] ?? []).filter((_, i) => i !== idx) })); setSavedEx(null)
  }
  async function saveEx(cat: string) {
    setSavingEx(cat); setSavedEx(null)
    const res = await fetch('/api/admin/organization-config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exemplesAteliers: { [cat]: exRows[cat] ?? [] } }),
    })
    setSavingEx(null)
    if (res.ok) {
      const d = await res.json(); const ov = d.exemplesAteliers ?? {}
      const saved = Array.isArray(ov[cat]) ? ov[cat] : []
      setExOverride(p => ({ ...p, [cat]: saved.length > 0 }))
      if (saved.length > 0) setExRows(p => ({ ...p, [cat]: saved }))
      setSavedEx(cat)
    }
  }
  function resetEx(cat: string) {
    setPendingConfirm({
      message: t.config.exEditor.resetConfirm,
      action: async () => {
        await fetch('/api/admin/organization-config', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ exemplesAteliers: { [cat]: [] } }),
        })
        setExRows(p => ({ ...p, [cat]: defaultExemplesFor(cat as never, t as unknown as ExemplesTranslations) }))
        setExOverride(p => ({ ...p, [cat]: false })); setSavedEx(null)
      },
    })
  }
  // Libellés des valeurs enum (par catégorie+champ)
  // Libellés (FR) des valeurs enum des ateliers 2 à 5 — affichage dans les menus de l'éditeur
  const ENUM_LABELS: Record<string, string> = {
    CYBERCRIMINEL: 'Cybercriminel', ETAT_NATION: 'État / groupe étatique', CONCURRENT: 'Concurrent',
    ACTIVISTE: 'Hacktiviste', EMPLOYE_MALVEILLANT: 'Employé malveillant', PRESTATAIRE: 'Prestataire',
    AMATEUR: 'Amateur', TERRORISTE: 'Terroriste', AUTRE: 'Autre',
    D: 'Disponibilité (D)', I: 'Intégrité (I)', C: 'Confidentialité (C)', T: 'Traçabilité (T)',
    FOURNISSEUR: 'Fournisseur', CLIENT: 'Client', PARTENAIRE: 'Partenaire', SOUS_TRAITANT: 'Sous-traitant',
    ORGANISME_REGULATION: 'Organisme de régulation',
    RECONNAISSANCE: 'Reconnaissance', ACCES_INITIAL: 'Accès initial', PERSISTANCE: 'Persistance',
    ESCALADE_PRIVILEGES: 'Escalade de privilèges', MOUVEMENT_LATERAL: 'Mouvement latéral',
    EXFILTRATION: 'Exfiltration', IMPACT: 'Impact / Destruction',
    ORGANISATIONNELLE: 'Organisationnelle', TECHNIQUE: 'Technique', DETECTIVE: 'Détective', PHYSIQUE: 'Physique',
  }
  const enumLabel = (cat: string, key: string, value: string): string => {
    if (cat === 'biensSupports' && key === 'type') {
      const c = CATEGORIES_BIENS_SUPPORTS.find(x => x.value === value); return c ? `${c.emoji} ${c.label}` : value
    }
    if (cat === 'valeursMetier' && key === 'type') {
      if (value === 'PROCESSUS') return t.workshop.a1.vmTypeProcess
      if (value === 'INFORMATION') return t.workshop.a1.vmTypeInfo
    }
    return ENUM_LABELS[value] ?? value
  }
  const fieldLabel = (key: string): string => (t.config.exEditor.fields as Record<string, string>)[key] ?? key
  const exInputCls = 'w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-ebios-500 focus:border-ebios-500'
  function exFieldWidth(f: FieldSchema): string {
    if (f.kind === 'longtext' || f.kind === 'stringList') return 'basis-full'
    if (f.kind === 'enum') return 'basis-48 grow'
    if (f.kind === 'score') return 'basis-24'
    return 'basis-52 grow'
  }
  function renderExField(cat: string, idx: number, row: Record<string, unknown>, f: FieldSchema) {
    const v = row[f.key]
    if (f.kind === 'enum') {
      const opts = f.options ?? []
      const cur = String(v ?? '')
      return (
        <select value={cur} onChange={e => updateEx(cat, idx, f.key, e.target.value)} className={exInputCls}>
          {!opts.includes(cur) && cur && <option value={cur}>{cur}</option>}
          {opts.map(o => <option key={o} value={o}>{enumLabel(cat, f.key, o)}</option>)}
        </select>
      )
    }
    if (f.kind === 'score') {
      return (
        <input type="number" min={1} max={5} value={Number(v ?? 3)}
          onChange={e => updateEx(cat, idx, f.key, Math.max(1, Math.min(5, parseInt(e.target.value) || 1)))}
          className={exInputCls} />
      )
    }
    if (f.kind === 'stringList') {
      const arr = Array.isArray(v) ? (v as string[]) : []
      return (
        <textarea rows={3} value={arr.join('\n')} placeholder={t.config.exEditor.impactsHint}
          onChange={e => updateEx(cat, idx, f.key, e.target.value.split('\n'))}
          className={exInputCls} />
      )
    }
    if (f.kind === 'longtext') {
      return <textarea rows={2} value={String(v ?? '')} onChange={e => updateEx(cat, idx, f.key, e.target.value)} className={exInputCls} />
    }
    return <input type="text" value={String(v ?? '')} onChange={e => updateEx(cat, idx, f.key, e.target.value)} className={exInputCls} />
  }

  // ── Helpers types d'impacts ──────────────────────────────────────────────
  function updateImpact(idx: number, field: 'label' | 'icon', value: string) {
    setTypesImpacts(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it)); setSavedImpacts(false)
  }
  function addImpact() {
    setTypesImpacts(prev => [...prev, { id: `impact-${Date.now()}`, label: '', icon: '🎯' }]); setSavedImpacts(false)
  }
  function removeImpact(idx: number) {
    setTypesImpacts(prev => prev.filter((_, i) => i !== idx)); setSavedImpacts(false)
  }
  async function saveImpacts() {
    setSavingImpacts(true); setSavedImpacts(false)
    const res = await fetch('/api/admin/organization-config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ typesImpacts: typesImpacts.filter(t => t.label.trim()) }),
    })
    setSavingImpacts(false)
    if (res.ok) { const d = await res.json(); if (Array.isArray(d.typesImpacts)) setTypesImpacts(d.typesImpacts); setSavedImpacts(true) }
  }

  // ── Helpers référentiels ─────────────────────────────────────────────────
  function toggleRef(idx: number) {
    setReferentiels(prev => prev.map((r, i) => i === idx ? { ...r, actif: !r.actif } : r)); setSavedRef(false)
  }
  function removeRef(idx: number) {
    setReferentiels(prev => prev.filter((_, i) => i !== idx)); setSavedRef(false)
  }
  function addRef() {
    const nom = newRef.trim()
    if (!nom || referentiels.some(r => r.nom === nom)) return
    setReferentiels(prev => [...prev, { nom, description: '', actif: true }]); setNewRef(''); setSavedRef(false)
  }
  async function saveReferentiels() {
    setSavingRef(true); setSavedRef(false)
    const res = await fetch('/api/admin/organization-config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referentielsActifs: referentiels }),
    })
    setSavingRef(false)
    if (res.ok) { const d = await res.json(); if (Array.isArray(d.referentielsActifs)) setReferentiels(d.referentielsActifs); setSavedRef(true) }
  }

  function addEntite() {
    const v = newEntite.trim()
    if (!v || entites.includes(v)) return
    setEntites(prev => [...prev, v])
    setNewEntite('')
    setSavedEntites(false)
  }

  function removeEntite(idx: number) {
    setEntites(prev => prev.filter((_, i) => i !== idx))
    setSavedEntites(false)
  }

  async function saveEntites() {
    setSavingEntites(true)
    setSavedEntites(false)
    const res = await fetch('/api/admin/organization-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entitesMesures: entites }),
    })
    setSavingEntites(false)
    if (res.ok) setSavedEntites(true)
  }

  function switchNiveaux(n: 4 | 5) {
    setConfig(n === 5 ? { ...DEFAUT_5 } : { ...DEFAUT_4 })
  }

  function updateGravite(idx: number, field: keyof NiveauEchelle, value: string) {
    setConfig(prev => ({
      ...prev,
      echelleGravite: prev.echelleGravite.map((n, i) =>
        i === idx ? { ...n, [field]: value } : n
      ),
    }))
  }

  function updateVraisemblance(idx: number, field: keyof NiveauEchelle, value: string) {
    setConfig(prev => ({
      ...prev,
      echelleVraisemblance: prev.echelleVraisemblance.map((n, i) =>
        i === idx ? { ...n, [field]: value } : n
      ),
    }))
  }

  function updateSeuil(idx: number, field: keyof SeuilMatrice, value: string | number) {
    setConfig(prev => ({
      ...prev,
      seuilsMatrice: prev.seuilsMatrice.map((s, i) =>
        i === idx ? { ...s, [field]: value } : s
      ),
    }))
  }

  function addSeuil() {
    setConfig(prev => ({
      ...prev,
      seuilsMatrice: [
        ...prev.seuilsMatrice,
        { scoreMin: 0, scoreMax: 0, label: t.config.newThreshold, couleur: '#94a3b8' },
      ],
    }))
  }

  function removeSeuil(idx: number) {
    setConfig(prev => ({
      ...prev,
      seuilsMatrice: prev.seuilsMatrice.filter((_, i) => i !== idx),
    }))
  }

  async function save() {
    setSaving(true)
    setSaved(false)
    const res = await fetch('/api/configuration', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    setSaving(false)
    if (res.ok) setSaved(true)
  }

  async function doResetToDefault() {
    await fetch('/api/configuration', { method: 'DELETE' })
    setConfig({ ...DEFAUT_4 })
    setSaved(true)
  }
  // Confirmation accessible (#1) au lieu de confirm() natif
  function resetToDefault() {
    setPendingConfirm({ message: t.config.resetConfirmLong, action: doResetToDefault })
  }

  // ── Mode d'évaluation de la matrice (quantitatif/qualitatif) ──────────────
  function setMatriceMode(mode: MatriceMode) {
    setConfig(prev => ({
      ...prev,
      matriceMode: mode,
      // À l'activation du qualitatif : initialiser la grille sur les valeurs quantitatives
      matriceQualitative:
        mode === 'QUALITATIVE'
          ? (prev.matriceQualitative?.length ? prev.matriceQualitative : buildDefaultQualitativeMatrix(prev as any))
          : prev.matriceQualitative,
    }))
    setSaved(false)
  }

  function setCellLevel(g: number, v: number, seuilLabel: string) {
    setConfig(prev => {
      const base = prev.matriceQualitative?.length ? prev.matriceQualitative : buildDefaultQualitativeMatrix(prev as any)
      const next = base.map(c => (c.gravite === g && c.vraisemblance === v ? { ...c, seuilLabel } : c))
      return { ...prev, matriceQualitative: next }
    })
    setSaved(false)
  }

  // Couleur/label d'une cellule — respecte le mode (qualitatif ou quantitatif),
  // via la source unique risk-scale.
  function getCellColor(g: number, v: number) {
    return getRiskLevel(g, v, config as any).couleur || '#94a3b8'
  }

  function getLabelForScore(g: number, v: number) {
    return getRiskLevel(g, v, config as any).label || '?'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-64 text-gray-500">{t.loading}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main id="main-content" className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.config.pageTitle}</h1>
            <p className="text-gray-500 mt-1">{t.config.pageSubtitle}</p>
          </div>
          {isAdmin && section === 'echelles' && (
            <div className="flex gap-2">
              <button onClick={resetToDefault} className="btn-secondary text-sm">
                {t.config.resetBtnLabel}
              </button>
              <button onClick={save} disabled={saving} className="btn-primary text-sm">
                {saving ? t.config.savingLabel : saved ? t.config.savedLabel : t.config.saveShort}
              </button>
            </div>
          )}
        </div>

        {/* Bannière lecture seule pour non-ADMIN */}
        {!isAdmin && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
            <span className="text-amber-500 text-xl flex-shrink-0">🔒</span>
            <div>
              <p className="text-sm font-medium text-amber-800">{t.config.readOnlyTitle}</p>
              <p className="text-xs text-amber-700 mt-0.5">{t.config.readOnlyDesc}</p>
            </div>
          </div>
        )}

        {/* ── Sous-navigation : 3 sections de la configuration ──────────────── */}
        <div className="flex flex-wrap gap-1 mb-6 border-b border-gray-200">
          {([
            ['echelles', t.config.tabScales],
            ['options',  t.config.tabOptions],
            ['exemples', t.config.tabExamples],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSection(key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                section === key
                  ? 'border-ebios-500 text-ebios-700'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ═══ Section 1 — Échelles et matrices ═══════════════════════════════ */}
        <div className={section === 'echelles' ? '' : 'hidden'}>

        {/* Choix du nombre de niveaux */}
        <div className="card p-5 mb-6">
          <h2 className="font-semibold text-gray-800 mb-3">{t.config.levelsSectionTitle}</h2>
          <p className="text-sm text-gray-500 mb-4">{t.config.levelsHint}</p>
          <div className="flex gap-3">
            {([4, 5] as const).map(n => (
              <button
                key={n}
                onClick={() => isAdmin && switchNiveaux(n)}
                disabled={!isAdmin}
                className={`flex-1 p-4 rounded-xl border-2 transition-colors text-center ${
                  !isAdmin ? 'cursor-default opacity-80' :
                  config.nbNiveaux === n
                    ? 'border-ebios-500 bg-ebios-50'
                    : 'border-gray-200 hover:border-gray-300'
                } ${config.nbNiveaux === n ? 'border-ebios-500 bg-ebios-50' : 'border-gray-200'}`}
              >
                <div className={`text-2xl font-bold mb-1 ${config.nbNiveaux === n ? 'text-ebios-700' : 'text-gray-700'}`}>
                  {n === 4 ? t.config.level4label : t.config.level5label}
                </div>
                <div className="text-xs text-gray-500">
                  {n === 4 ? t.config.level4desc : t.config.level5desc}
                </div>
                {config.nbNiveaux === n && (
                  <div className="mt-2 text-xs font-medium text-ebios-600">{t.config.selected}</div>
                )}
              </button>
            ))}
          </div>
          <p className="text-xs text-orange-600 mt-3">{t.config.levelWarning}</p>
        </div>

        {/* Onglets */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
          {[
            { id: 'gravite',       label: t.config.tabGravityFull },
            { id: 'vraisemblance', label: t.config.tabProbFull },
            { id: 'matrice',       label: t.config.tabMatrixFull },
            { id: 'apercu',        label: t.config.tabPreview },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id ? 'bg-white shadow-sm text-ebios-700' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* fieldset disable tous les inputs quand non-ADMIN */}
        <fieldset disabled={!isAdmin} className={!isAdmin ? 'opacity-70' : ''}>

        {/* ── GRAVITÉ ─────────────────────────────────────────────────────── */}
        {activeTab === 'gravite' && (
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
              {t.config.gravityInfo}
            </div>
            {config.echelleGravite.map((n, i) => (
              <div key={i} className="card p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 text-center w-12">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg mx-auto"
                      style={{ backgroundColor: n.couleur, color: readableTextColor(n.couleur) }}
                    >
                      G{n.niveau}
                    </div>
                  </div>
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="label">{t.config.labelField}</label>
                      <input
                        value={n.label}
                        onChange={e => updateGravite(i, 'label', e.target.value)}
                        className="input text-sm font-semibold"
                        placeholder={`${t.config.levelCol} ${n.niveau}`}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label">{t.config.descGravField}</label>
                      <textarea
                        value={n.description}
                        onChange={e => updateGravite(i, 'description', e.target.value)}
                        className="input text-sm resize-none"
                        rows={2}
                        placeholder={t.config.descField}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <div>
                        <label className="label">{t.config.colorField}</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={n.couleur}
                            onChange={e => updateGravite(i, 'couleur', e.target.value)}
                            className="w-10 h-9 rounded border border-gray-200 cursor-pointer p-0.5"
                          />
                          <input
                            value={n.couleur}
                            onChange={e => updateGravite(i, 'couleur', e.target.value)}
                            className="input text-xs w-24 font-mono"
                            placeholder="#000000"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── VRAISEMBLANCE ───────────────────────────────────────────────── */}
        {activeTab === 'vraisemblance' && (
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
              {t.config.probInfo}
            </div>
            {config.echelleVraisemblance.map((n, i) => (
              <div key={i} className="card p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 text-center w-12">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg mx-auto"
                      style={{ backgroundColor: n.couleur, color: readableTextColor(n.couleur) }}
                    >
                      V{n.niveau}
                    </div>
                  </div>
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="label">{t.config.labelField}</label>
                      <input
                        value={n.label}
                        onChange={e => updateVraisemblance(i, 'label', e.target.value)}
                        className="input text-sm font-semibold"
                        placeholder={`${t.config.levelCol} ${n.niveau}`}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label">{t.config.descField}</label>
                      <textarea
                        value={n.description}
                        onChange={e => updateVraisemblance(i, 'description', e.target.value)}
                        className="input text-sm resize-none"
                        rows={2}
                        placeholder={t.config.descField}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <div>
                        <label className="label">{t.config.colorField}</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={n.couleur}
                            onChange={e => updateVraisemblance(i, 'couleur', e.target.value)}
                            className="w-10 h-9 rounded border border-gray-200 cursor-pointer p-0.5"
                          />
                          <input
                            value={n.couleur}
                            onChange={e => updateVraisemblance(i, 'couleur', e.target.value)}
                            className="input text-xs w-24 font-mono"
                            placeholder="#000000"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── SEUILS MATRICE ──────────────────────────────────────────────── */}
        {activeTab === 'matrice' && (
          <div className="space-y-4">
            {/* Sélecteur de mode d'évaluation (#2) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => isAdmin && setMatriceMode('QUANTITATIVE')}
                disabled={!isAdmin}
                className={`text-left p-4 rounded-xl border-2 transition-colors ${
                  config.matriceMode === 'QUANTITATIVE'
                    ? 'border-ebios-500 bg-ebios-50'
                    : 'border-gray-200 hover:border-gray-300'
                } ${!isAdmin ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <div className="font-semibold text-gray-800 flex items-center gap-2">
                  <span>✖️</span> {t.config.modeQuantitativeTitle}
                </div>
                <p className="text-xs text-gray-500 mt-1">{t.config.modeQuantitativeDesc}</p>
              </button>
              <button
                type="button"
                onClick={() => isAdmin && setMatriceMode('QUALITATIVE')}
                disabled={!isAdmin}
                className={`text-left p-4 rounded-xl border-2 transition-colors ${
                  config.matriceMode === 'QUALITATIVE'
                    ? 'border-ebios-500 bg-ebios-50'
                    : 'border-gray-200 hover:border-gray-300'
                } ${!isAdmin ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <div className="font-semibold text-gray-800 flex items-center gap-2">
                  <span>🎨</span> {t.config.modeQualitativeTitle}
                </div>
                <p className="text-xs text-gray-500 mt-1">{t.config.modeQualitativeDesc}</p>
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
              {config.matriceMode === 'QUALITATIVE'
                ? t.config.matrixQualitativeInfo
                : <>{t.config.matrixInfo} {t.config.maxScoreLabel} {config.nbNiveaux * config.nbNiveaux}.</>}
            </div>

            <div className="card divide-y divide-gray-100">
              <div className="grid grid-cols-5 gap-2 p-3 bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                <div>{t.config.scoreMinCol}</div>
                <div>{t.config.scoreMaxCol}</div>
                <div>{t.config.labelCol}</div>
                <div>{t.config.colorCol}</div>
                <div></div>
              </div>
              {config.seuilsMatrice.map((s, i) => (
                <div key={i} className="grid grid-cols-5 gap-2 p-3 items-center">
                  <input
                    type="number" min={1} max={config.nbNiveaux * config.nbNiveaux}
                    value={s.scoreMin}
                    onChange={e => updateSeuil(i, 'scoreMin', parseInt(e.target.value))}
                    className="input text-sm"
                  />
                  <input
                    type="number" min={1} max={config.nbNiveaux * config.nbNiveaux}
                    value={s.scoreMax}
                    onChange={e => updateSeuil(i, 'scoreMax', parseInt(e.target.value))}
                    className="input text-sm"
                  />
                  <input
                    value={s.label}
                    onChange={e => updateSeuil(i, 'label', e.target.value)}
                    className="input text-sm"
                    placeholder={t.config.thresholdPh}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={s.couleur}
                      onChange={e => updateSeuil(i, 'couleur', e.target.value)}
                      className="w-9 h-9 rounded border border-gray-200 cursor-pointer p-0.5"
                    />
                    <span
                      className="text-xs px-2 py-1 rounded font-medium"
                      style={{ backgroundColor: s.couleur, color: readableTextColor(s.couleur) }}
                    >
                      {s.label || '?'}
                    </span>
                  </div>
                  <button
                    onClick={() => removeSeuil(i)}
                    className="text-gray-500 hover:text-red-500 text-sm"
                    disabled={config.seuilsMatrice.length <= 2}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="p-3">
                <button onClick={addSeuil} className="btn-secondary text-sm py-1.5">
                  {t.config.addThreshold}
                </button>
              </div>
            </div>

            {/* Éditeur de grille qualitative — chaque case choisit son niveau */}
            {config.matriceMode === 'QUALITATIVE' && (
              <div className="card p-4 overflow-x-auto">
                <h3 className="font-semibold text-gray-800 mb-3 text-sm">{t.config.qualitativeGridTitle}</h3>
                <table className="text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="p-2 text-gray-400 text-left">{t.config.vraiGravLabel}</th>
                      {[...config.echelleGravite].sort((a, b) => a.niveau - b.niveau).map(g => (
                        <th key={g.niveau} className="p-2 text-center text-gray-600 font-medium">{g.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...config.echelleVraisemblance].sort((a, b) => b.niveau - a.niveau).map(v => (
                      <tr key={v.niveau}>
                        <th className="p-2 text-right text-gray-600 font-medium pr-3 whitespace-nowrap">{v.label}</th>
                        {[...config.echelleGravite].sort((a, b) => a.niveau - b.niveau).map(g => {
                          const couleur = getCellColor(g.niveau, v.niveau)
                          return (
                            <td key={g.niveau} className="p-1">
                              <select
                                value={getLabelForScore(g.niveau, v.niveau)}
                                onChange={e => setCellLevel(g.niveau, v.niveau, e.target.value)}
                                disabled={!isAdmin}
                                className="text-xs rounded-md border-2 px-1.5 py-1 font-medium cursor-pointer disabled:cursor-not-allowed"
                                style={{ borderColor: couleur, backgroundColor: `${couleur}22`, color: couleur }}
                                aria-label={`${v.label} / ${g.label}`}
                              >
                                {config.seuilsMatrice.map((s, si) => (
                                  <option key={si} value={s.label}>{s.label}</option>
                                ))}
                              </select>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-gray-400 mt-3">{t.config.qualitativeGridHint}</p>
              </div>
            )}

            {/* Validation — uniquement en mode quantitatif (les seuils de score s'appliquent) */}
            {config.matriceMode === 'QUANTITATIVE' && (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-600">
                <strong>{t.config.maxScoreLabel}</strong> {config.nbNiveaux} × {config.nbNiveaux} = <strong>{config.nbNiveaux * config.nbNiveaux}</strong>
                <br />
                <strong>{t.config.coveredLabel}</strong> {config.seuilsMatrice[0]?.scoreMin || '?'} → {config.seuilsMatrice[config.seuilsMatrice.length - 1]?.scoreMax || '?'}
              </div>
            )}
          </div>
        )}

        {/* ── APERÇU MATRICE ──────────────────────────────────────────────── */}
        {activeTab === 'apercu' && (
          <div className="space-y-4">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600">
              {t.config.previewDesc}
            </div>

            <div className="card p-5 overflow-x-auto">
              <h3 className="font-semibold text-gray-800 mb-4">{t.config.matrixSizeLabel} {config.nbNiveaux}×{config.nbNiveaux}</h3>
              <table className="border-collapse mx-auto">
                <thead>
                  <tr>
                    <th className="w-16 h-12" />
                    {config.echelleVraisemblance.map(v => (
                      <th key={v.niveau} className="w-24 h-12 text-center">
                        <div className="text-xs font-semibold text-gray-600">V{v.niveau}</div>
                        <div
                          className="text-xs font-medium px-1 py-0.5 rounded mt-0.5"
                          style={{ backgroundColor: v.couleur, color: readableTextColor(v.couleur) }}
                        >
                          {v.label}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...config.echelleGravite].reverse().map(g => (
                    <tr key={g.niveau}>
                      <td className="pr-2 text-right">
                        <div className="text-xs font-semibold text-gray-600">G{g.niveau}</div>
                        <div
                          className="text-xs font-medium px-1 py-0.5 rounded text-right"
                          style={{ backgroundColor: g.couleur, color: readableTextColor(g.couleur) }}
                        >
                          {g.label}
                        </div>
                      </td>
                      {config.echelleVraisemblance.map(v => {
                        const score = g.niveau * v.niveau
                        const color = getCellColor(g.niveau, v.niveau)
                        const label = getLabelForScore(g.niveau, v.niveau)
                        return (
                          <td key={v.niveau} className="p-1">
                            <div
                              className="w-24 h-16 rounded-lg flex flex-col items-center justify-center border border-white/30"
                              style={{ backgroundColor: color + '22', borderColor: color }}
                            >
                              <div
                                className="text-lg font-bold"
                                style={{ color }}
                              >
                                {score}
                              </div>
                              <div
                                className="text-xs font-medium px-1.5 py-0.5 rounded mt-0.5"
                                style={{ backgroundColor: color, color: readableTextColor(color) }}
                              >
                                {label}
                              </div>
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Légende */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">{t.config.legendTitle}</h3>
              <div className="grid grid-cols-2 gap-3">
                {config.seuilsMatrice.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: s.couleur + '15' }}>
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold flex-shrink-0"
                      style={{ backgroundColor: s.couleur, color: readableTextColor(s.couleur) }}>
                      {s.scoreMin}–{s.scoreMax}
                    </div>
                    <div>
                      <div className="font-semibold text-sm" style={{ color: s.couleur }}>{s.label}</div>
                      <div className="text-xs text-gray-500">{t.config.scoreRangeLabel} {s.scoreMin} → {s.scoreMax}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cartes échelle gravité */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">{t.config.gravityCardTitle}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {config.echelleGravite.map(n => (
                  <div key={n.niveau} className="p-3 rounded-lg border text-center"
                    style={{ borderColor: n.couleur, backgroundColor: n.couleur + '15' }}>
                    <div className="text-xl font-bold" style={{ color: n.couleur }}>G{n.niveau}</div>
                    <div className="text-xs font-semibold" style={{ color: n.couleur }}>{n.label}</div>
                    <div className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">{n.description}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cartes échelle vraisemblance */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">{t.config.probCardTitle}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {config.echelleVraisemblance.map(n => (
                  <div key={n.niveau} className="p-3 rounded-lg border text-center"
                    style={{ borderColor: n.couleur, backgroundColor: n.couleur + '15' }}>
                    <div className="text-xl font-bold" style={{ color: n.couleur }}>V{n.niveau}</div>
                    <div className="text-xs font-semibold" style={{ color: n.couleur }}>{n.label}</div>
                    <div className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">{n.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        </fieldset>

        </div>{/* ═══ fin Section 1 — Échelles et matrices ═══ */}

        {/* ═══ Section 2 — Référentiels et options ════════════════════════════ */}
        <div className={section === 'options' ? '' : 'hidden'}>

        {/* ── Section entités responsables (ADMIN uniquement) ─────────────── */}
        {isAdmin && (
          <section className="mt-8 card p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-1">{t.config.entitesTitle}</h2>
            <p className="text-sm text-gray-500 mb-4">{t.config.entitesSubtitle}</p>

            {/* Liste des entités existantes */}
            {entites.length === 0 ? (
              <p className="text-sm text-gray-400 italic mb-4">{t.config.entitesEmpty}</p>
            ) : (
              <div className="flex flex-wrap gap-2 mb-4">
                {entites.map((e, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-sm font-medium"
                  >
                    {e}
                    <button
                      type="button"
                      onClick={() => removeEntite(idx)}
                      className="text-indigo-500 hover:text-red-600 transition-colors font-bold leading-none"
                      aria-label={`Supprimer ${e}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Champ ajout */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newEntite}
                onChange={e => setNewEntite(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEntite() } }}
                placeholder={t.config.entitesPh}
                className="input flex-1 text-sm"
              />
              <button
                type="button"
                onClick={addEntite}
                disabled={!newEntite.trim()}
                className="btn-secondary text-sm px-4"
              >
                {t.config.entitesAdd}
              </button>
            </div>

            {/* Bouton sauvegarde entités */}
            <div className="flex items-center gap-3 mt-4">
              {savedEntites && (
                <span className="text-sm text-green-600 font-medium">{t.config.entitesSaved}</span>
              )}
              <button
                type="button"
                onClick={saveEntites}
                disabled={savingEntites}
                className="btn-primary text-sm"
              >
                {savingEntites ? t.config.entitesSaving : t.config.entitesSave}
              </button>
            </div>
          </section>
        )}

        {/* ── Types d'impacts configurables (#8, ADMIN) ───────────────────── */}
        {isAdmin && (
          <section className="mt-8 card p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-1">{t.config.impactsTitle}</h2>
            <p className="text-sm text-gray-500 mb-4">{t.config.impactsSubtitle}</p>

            <div className="space-y-2 mb-4">
              {typesImpacts.map((it, idx) => (
                <div key={it.id} className="flex items-center gap-2">
                  <input
                    value={it.icon}
                    onChange={e => updateImpact(idx, 'icon', e.target.value)}
                    className="input w-14 text-center text-lg"
                    maxLength={4}
                    aria-label="Icône"
                  />
                  <input
                    value={it.label}
                    onChange={e => updateImpact(idx, 'label', e.target.value)}
                    placeholder={t.config.impactsLabelPh}
                    className="input flex-1 text-sm"
                  />
                  <button type="button" onClick={() => removeImpact(idx)} className="text-gray-400 hover:text-red-600 px-2" aria-label="Supprimer">✕</button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addImpact} className="btn-secondary text-sm">{t.config.impactsAdd}</button>

            <div className="flex items-center gap-3 mt-4">
              {savedImpacts && <span className="text-sm text-green-600 font-medium">{t.config.entitesSaved}</span>}
              <button type="button" onClick={saveImpacts} disabled={savingImpacts} className="btn-primary text-sm">
                {savingImpacts ? t.config.entitesSaving : t.config.entitesSave}
              </button>
            </div>
          </section>
        )}

        {/* ── Référentiels par défaut configurables (#8, ADMIN) ───────────── */}
        {isAdmin && (
          <section className="mt-8 card p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-1">{t.config.refsTitle}</h2>
            <p className="text-sm text-gray-500 mb-4">{t.config.refsSubtitle}</p>

            <div className="space-y-1.5 mb-4">
              {referentiels.map((r, idx) => (
                <div key={idx} className={`flex items-center gap-3 p-2 rounded-lg border ${r.actif ? 'border-ebios-200 dark:border-ebios-700 bg-ebios-50/40 dark:bg-ebios-900/20' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
                  <button
                    type="button"
                    onClick={() => toggleRef(idx)}
                    className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${r.actif ? 'bg-ebios-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                    aria-label={r.actif ? t.config.refsDisable : t.config.refsEnable}
                  >
                    <span className={`absolute top-1 left-1 w-4 h-4 bg-[white] rounded-full shadow transition-transform ${r.actif ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800">{r.nom}</div>
                    {r.description && <div className="text-xs text-gray-500 truncate">{r.description}</div>}
                  </div>
                  <button type="button" onClick={() => removeRef(idx)} className="text-gray-400 hover:text-red-600 px-1" aria-label="Supprimer">✕</button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                value={newRef}
                onChange={e => setNewRef(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRef() } }}
                placeholder={t.config.refsPh}
                className="input flex-1 text-sm"
              />
              <button type="button" onClick={addRef} disabled={!newRef.trim()} className="btn-secondary text-sm px-4">{t.config.entitesAdd}</button>
            </div>

            <div className="flex items-center gap-3 mt-4">
              {savedRef && <span className="text-sm text-green-600 font-medium">{t.config.entitesSaved}</span>}
              <button type="button" onClick={saveReferentiels} disabled={savingRef} className="btn-primary text-sm">
                {savingRef ? t.config.entitesSaving : t.config.entitesSave}
              </button>
            </div>
          </section>
        )}

        {/* ── Options de traitement du risque configurables (ADMIN) ───────── */}
        {isAdmin && (
          <section className="mt-8 card p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-1">{t.config.strategiesTitle}</h2>
            <p className="text-sm text-gray-500 mb-4">{t.config.strategiesSubtitle}</p>
            <div className="space-y-3 mb-4">
              {strategies.map((s, idx) => (
                <div key={s.value} className="p-3 rounded-lg border border-gray-200 bg-gray-50/50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.value}</span>
                    <input
                      value={s.label}
                      onChange={e => updateStrat(idx, 'label', e.target.value)}
                      className="input flex-1 text-sm font-medium"
                      placeholder={t.config.strategiesLabelPh}
                    />
                  </div>
                  <input
                    value={s.description}
                    onChange={e => updateStrat(idx, 'description', e.target.value)}
                    className="input w-full text-sm mb-2"
                    placeholder={t.config.strategiesDescPh}
                  />
                  <input
                    value={s.conseil}
                    onChange={e => updateStrat(idx, 'conseil', e.target.value)}
                    className="input w-full text-xs"
                    placeholder={t.config.strategiesAdvicePh}
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              {savedStrat && <span className="text-sm text-green-600 font-medium">{t.config.strategiesSaved}</span>}
              <button type="button" onClick={saveStrategies} disabled={savingStrat} className="btn-primary text-sm">
                {savingStrat ? t.config.strategiesSaving : t.config.strategiesSave}
              </button>
            </div>
          </section>
        )}

        </div>{/* ═══ fin Section 2 — Référentiels et options ═══ */}

        {/* ═══ Section 3 — Exemples des ateliers ══════════════════════════════ */}
        <div className={section === 'exemples' ? '' : 'hidden'}>
          <div className="mt-8 mb-2">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-1">{t.config.examplesTitle}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t.config.examplesIntro}</p>
          </div>

          {selectedEx === null ? (
            /* ── Damier des catégories (groupées par atelier) ── */
            <>
              {[1, 2, 3, 4, 5].map(atelier => {
                const cats = EXEMPLES_CATEGORIES.filter(c => c.atelier === atelier)
                if (!cats.length) return null
                return (
                  <div key={atelier} className="mt-5">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-ebios-700 dark:text-ebios-300 mb-2">
                      {t.config.exEditor.atelier} {atelier}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {cats.map(def => {
                        const rows = exRows[def.key] ?? []
                        const catLabel = (t.config.exEditor.cats as Record<string, string>)[def.key] ?? def.labelDefault
                        return (
                          <button key={def.key} type="button"
                            onClick={() => { setSelectedEx(def.key); setSavedEx(null) }}
                            className="text-left card p-4 hover:shadow-md hover:border-ebios-300 dark:hover:border-ebios-600 transition-all group">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <h4 className="font-semibold text-gray-800 dark:text-gray-100">{catLabel}</h4>
                              <span className="text-ebios-500 group-hover:translate-x-0.5 transition-transform" aria-hidden="true">→</span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-gray-400">{rows.length} {t.config.exEditor.count}</span>
                              {exOverride[def.key] && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-ebios-100 text-ebios-700 dark:bg-ebios-900/40 dark:text-ebios-200 font-medium">
                                  {t.config.exEditor.customized}
                                </span>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </>
          ) : (() => {
            /* ── Vue dédiée : édition d'une seule catégorie ── */
            const def = getCategoryDef(selectedEx as never)
            if (!def) return null
            const rows = exRows[def.key] ?? []
            const catLabel = (t.config.exEditor.cats as Record<string, string>)[def.key] ?? def.labelDefault
            return (
              <div className="mt-6">
                <button type="button" onClick={() => setSelectedEx(null)}
                  className="text-sm text-ebios-600 hover:text-ebios-800 dark:text-ebios-300 font-medium mb-3 inline-flex items-center gap-1">
                  ← {t.config.exEditor.backToCategories}
                </button>
                <section className="card p-5">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-800 dark:text-gray-100">{catLabel}</h4>
                      <span className="text-xs text-gray-400">{rows.length} {t.config.exEditor.count}</span>
                      {exOverride[def.key] && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-ebios-100 text-ebios-700 dark:bg-ebios-900/40 dark:text-ebios-200 font-medium">
                          {t.config.exEditor.customized}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {rows.map((row, idx) => (
                      <div key={idx} className="relative border border-gray-200 dark:border-gray-700 rounded-xl p-3 pr-10 bg-gray-50/50 dark:bg-gray-800/40">
                        <button type="button" onClick={() => removeEx(def.key, idx)} title={t.config.exEditor.remove}
                          className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30">
                          ✕
                        </button>
                        <div className="flex flex-wrap gap-3">
                          {def.fields.map(f => (
                            <div key={f.key} className={exFieldWidth(f)}>
                              <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">{fieldLabel(f.key)}</label>
                              {renderExField(def.key, idx, row, f)}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
                    <button type="button" onClick={() => addEx(def.key)}
                      className="text-sm text-ebios-600 hover:text-ebios-800 dark:text-ebios-300 font-medium">
                      {t.config.exEditor.add}
                    </button>
                    <div className="flex items-center gap-3">
                      {savedEx === def.key && <span className="text-sm text-green-600 font-medium">{t.config.exEditor.saved}</span>}
                      <button type="button" onClick={() => resetEx(def.key)}
                        className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400">
                        {t.config.exEditor.reset}
                      </button>
                      <button type="button" onClick={() => saveEx(def.key)} disabled={savingEx === def.key} className="btn-primary text-sm">
                        {savingEx === def.key ? t.config.exEditor.saving : t.config.exEditor.save}
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            )
          })()}
        </div>

        {/* Bouton sauvegarde bas de page (échelles) */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
          <button onClick={() => router.push('/dashboard')} className="btn-secondary">
            {t.config.backDash}
          </button>
          {isAdmin && section === 'echelles' && (
            <div className="flex items-center gap-3">
              {saved && <span className="text-sm text-green-600 font-medium">{t.config.savedFull}</span>}
              <button onClick={save} disabled={saving} className="btn-primary">
                {saving ? t.config.savingLabel : t.config.saveLong}
              </button>
            </div>
          )}
        </div>
      </main>

      {pendingConfirm && (
        <ConfirmDialog
          message={pendingConfirm.message}
          onConfirm={() => { pendingConfirm.action(); setPendingConfirm(null) }}
          onCancel={() => setPendingConfirm(null)}
        />
      )}
    </div>
  )
}
