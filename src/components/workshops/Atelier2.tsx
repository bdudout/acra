'use client'

/**
 * Atelier2 — Sources de risque (EBIOS RM Workshop 2)
 *
 * Identifies and qualifies threat sources targeting the organisation:
 *  - Sources de risque : threat actors (cybercriminals, insiders, competitors…)
 *    with motivation, resources, and pertinence (P1 retained / P2 discarded)
 *  - Objectifs visés : for each retained source, what the attacker aims to achieve
 *    (SR/OV couples — the formal unit of analysis in EBIOS RM)
 *  - Vraisemblance : likelihood score (1–4) per SR/OV couple
 *
 * Auto-saves via `useAutoSave`. Example suggestions are drawn from
 * `SOURCES_RISQUE_EXEMPLES` and `OBJECTIFS_VISES_EXEMPLES` in ebios-data.ts.
 *
 * En mode « Flash » (`flashMode=true`, démarche Club EBIOS), le parcours reste
 * complet (A1→A2→A3→A4→A5) ; le flag est seulement conservé dans l'URL et un
 * bandeau rappelle le cadrage rapide.
 *
 * Props:
 *  - analyseId   : Prisma cuid of the parent Analyse
 *  - initialData : { sourcesRisque: SourceRisque[] } from DB
 *  - analyse     : parent Analyse (used for sector/context in suggestions)
 *  - flashMode   : mode « Flash » — conserve le flag dans la navigation vers A3
 */

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/context'
import ConfirmDialog from '@/components/ConfirmDialog'
import AutoSaveBadge from '@/components/AutoSaveBadge'
import { useAutoSave } from '@/lib/useAutoSave'
import { resolveExemples } from '@/lib/exemples-ateliers'
import { rankExemples } from '@/lib/exemples-context'
import { defaultExemplesFor, type ExemplesTranslations } from '@/lib/exemples-defaults'

interface Props {
  analyseId: string
  initialData?: { sourcesRisque: any[] }
  analyse: any
  flashMode?: boolean
}

function uid() { return Math.random().toString(36).slice(2, 9) }

// Static color map for categories (keys don't change with locale)
const CATEGORY_COLORS: Record<string, string> = {
  CYBERCRIMINEL:       'bg-red-100 text-red-700',
  ETAT_NATION:         'bg-purple-100 text-purple-700',
  CONCURRENT:          'bg-orange-100 text-orange-700',
  ACTIVISTE:           'bg-yellow-100 text-yellow-700',
  EMPLOYE_MALVEILLANT: 'bg-rose-100 text-rose-700',
  PRESTATAIRE:         'bg-blue-100 text-blue-700',
  AMATEUR:             'bg-gray-100 text-gray-600',
  TERRORISTE:          'bg-red-200 text-red-800',
  AUTRE:               'bg-gray-100 text-gray-600',
}

export default function Atelier2({ analyseId, initialData, analyse, flashMode }: Props) {
  const router = useRouter()
  const { t, locale } = useTranslation()

  // Translated arrays (re-derived on locale change)
  const CATEGORIES = [
    { value: 'CYBERCRIMINEL',       label: t.workshop.a2.cats.CYBERCRIMINEL.label,       color: CATEGORY_COLORS.CYBERCRIMINEL,       desc: t.workshop.a2.cats.CYBERCRIMINEL.desc },
    { value: 'ETAT_NATION',         label: t.workshop.a2.cats.ETAT_NATION.label,         color: CATEGORY_COLORS.ETAT_NATION,         desc: t.workshop.a2.cats.ETAT_NATION.desc },
    { value: 'CONCURRENT',          label: t.workshop.a2.cats.CONCURRENT.label,          color: CATEGORY_COLORS.CONCURRENT,          desc: t.workshop.a2.cats.CONCURRENT.desc },
    { value: 'ACTIVISTE',           label: t.workshop.a2.cats.ACTIVISTE.label,           color: CATEGORY_COLORS.ACTIVISTE,           desc: t.workshop.a2.cats.ACTIVISTE.desc },
    { value: 'EMPLOYE_MALVEILLANT', label: t.workshop.a2.cats.EMPLOYE_MALVEILLANT.label, color: CATEGORY_COLORS.EMPLOYE_MALVEILLANT, desc: t.workshop.a2.cats.EMPLOYE_MALVEILLANT.desc },
    { value: 'PRESTATAIRE',         label: t.workshop.a2.cats.PRESTATAIRE.label,         color: CATEGORY_COLORS.PRESTATAIRE,         desc: t.workshop.a2.cats.PRESTATAIRE.desc },
    { value: 'AMATEUR',             label: t.workshop.a2.cats.AMATEUR.label,             color: CATEGORY_COLORS.AMATEUR,             desc: t.workshop.a2.cats.AMATEUR.desc },
    { value: 'TERRORISTE',          label: t.workshop.a2.cats.TERRORISTE.label,          color: CATEGORY_COLORS.TERRORISTE,          desc: t.workshop.a2.cats.TERRORISTE.desc },
    { value: 'AUTRE',               label: t.workshop.a2.cats.AUTRE.label,               color: CATEGORY_COLORS.AUTRE,               desc: t.workshop.a2.cats.AUTRE.desc },
  ]
  const SCORE_LABELS: Record<number, string> = {
    1: t.workshop.a2.scoreLabels[1],
    2: t.workshop.a2.scoreLabels[2],
    3: t.workshop.a2.scoreLabels[3],
    4: t.workshop.a2.scoreLabels[4],
  }

  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{ msg: string; action: () => void } | null>(null)
  const [sources, setSources] = useState<any[]>(initialData?.sourcesRisque || [])

  // Exemples : override organisation si présent, sinon défauts (ebios-data)
  const [exOverride, setExOverride] = useState<Record<string, any[]>>({})
  useEffect(() => {
    fetch('/api/admin/organization-config').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.exemplesAteliers && typeof d.exemplesAteliers === 'object' && !Array.isArray(d.exemplesAteliers)) setExOverride(d.exemplesAteliers)
    }).catch(() => {})
  }, [])
  const tEx = t as unknown as ExemplesTranslations
  const srExamples = useMemo(() => resolveExemples(exOverride.sourcesRisque, defaultExemplesFor('sourcesRisque', tEx, locale)) as any[], [t, exOverride]) // eslint-disable-line react-hooks/exhaustive-deps
  const ovExamples = useMemo(() => resolveExemples(exOverride.objectifsVises, defaultExemplesFor('objectifsVises', tEx, locale)) as any[], [t, exOverride]) // eslint-disable-line react-hooks/exhaustive-deps
  // Exemples contextuels : sources de risque remontées selon le secteur de l'analyse
  const srExamplesRanked = useMemo(
    () => rankExemples(srExamples, { secteur: analyse?.secteur }),
    [srExamples, analyse?.secteur]
  )

  // ── Auto-save ─────────────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const autoSaveData = useMemo(() => ({ sourcesRisque: sources }), [sources])
  const { status: autoStatus, lastSaved, error: autoError, saveNow } = useAutoSave(
    autoSaveData,
    async (data) => {
      const res = await fetch(`/api/analyses/${analyseId}/workshop/2`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Sauvegarde échouée')
    },
    { delay: 1500 }
  )

  const [expandedId, setExpandedId] = useState<string | null>(null)
  // [IA — désactivé] const [aiLoading, setAiLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'saisie' | 'synthese'>('saisie')
  const [showSrExamples, setShowSrExamples] = useState(true)

  function addSource(exemple?: any) {
    const id = uid()
    setSources(prev => [...prev, {
      id,
      nom: exemple?.nom || '',
      categorie: exemple?.categorie || 'CYBERCRIMINEL',
      description: exemple?.description || '',
      motivation: exemple?.motivation || '',
      ressources: exemple?.ressources || '',
      activite: '',
      motivationScore: 2,
      ressourcesScore: 2,
      activiteScore: 2,
      pertinence: exemple?.pertinenceDefaut || 2,
      retenu: true,
      objectifsVises: [],
    }])
    setExpandedId(id)
  }

  function updateSource(id: string, field: string, value: any) {
    setSources(prev => prev.map(s => {
      if (s.id !== id) return s
      const updated = { ...s, [field]: value }
      // Recalcul automatique de pertinence si on modifie les scores
      if (['motivationScore', 'ressourcesScore', 'activiteScore'].includes(field)) {
        const ms = field === 'motivationScore' ? value : (updated.motivationScore || 2)
        const rs = field === 'ressourcesScore' ? value : (updated.ressourcesScore || 2)
        const as = field === 'activiteScore' ? value : (updated.activiteScore || 2)
        updated.pertinence = Math.round((ms + rs + as) / 3)
      }
      return updated
    }))
  }

  function removeSource(id: string) {
    setSources(prev => prev.filter(s => s.id !== id))
  }

  function addOV(sourceId: string, ov?: any) {
    setSources(prev => prev.map(s => {
      if (s.id !== sourceId) return s
      return {
        ...s,
        objectifsVises: [
          ...(s.objectifsVises || []),
          { id: uid(), nom: ov?.nom || '', description: ov?.desc || '', priorite: 'P2', pertinenceOV: 3 },
        ],
      }
    }))
  }

  function updateOV(sourceId: string, ovId: string, field: string, value: any) {
    setSources(prev => prev.map(s => {
      if (s.id !== sourceId) return s
      return { ...s, objectifsVises: s.objectifsVises.map((o: any) => o.id === ovId ? { ...o, [field]: value } : o) }
    }))
  }

  function removeOV(sourceId: string, ovId: string) {
    setSources(prev => prev.map(s => {
      if (s.id !== sourceId) return s
      return { ...s, objectifsVises: s.objectifsVises.filter((o: any) => o.id !== ovId) }
    }))
  }

  // [IA — désactivé] La fonction aiSuggest appelle /api/ai-suggest (Anthropic Claude).
  // À réactiver lorsque l'intégration IA sera activée en production.
  // async function aiSuggest() {
  //   setAiLoading(true)
  //   try {
  //     const res = await fetch('/api/ai-suggest', {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify({
  //         contexte: `Organisation : ${analyse.organisation}, Secteur : ${analyse.secteur}`,
  //         atelier: 2,
  //         question: `Quelles sont les sources de risque les plus pertinentes et leurs objectifs visés pour une organisation du secteur ${analyse.secteur} ? Retourne un JSON avec "suggestions" : [{nom, categorie, description, motivation, objectifsVises:[{nom,description}]}]`,
  //       }),
  //     })
  //     const data = await res.json()
  //     if (data.suggestions?.length) {
  //       data.suggestions.slice(0, 3).forEach((s: any) => addSource(s))
  //     }
  //   } catch {}
  //   setAiLoading(false)
  // }

  async function save() {
    setSaving(true)
    await saveNow()
    setSaving(false)
    // Mode Flash : parcours complet conservé (→ A3), on propage juste le flag
    router.push(`/analyses/${analyseId}/atelier/3${flashMode ? '?mode=flash' : ''}`)
  }

  const retained = sources.filter(s => s.retenu)
  const totalCouples = retained.reduce((acc: number, s: any) => acc + (s.objectifsVises?.length || 0), 0)
  const couplesP1 = retained.reduce((acc: number, s: any) =>
    acc + (s.objectifsVises?.filter((o: any) => o.priorite === 'P1').length || 0), 0)

  return (
    <div className="space-y-6">
      <div className="bg-red-50 border border-red-200 rounded-xl p-5">
        <div className="flex gap-3">
          <span className="text-2xl">🎭</span>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              {/* h3 commenté : titre déjà affiché en h1 par la page atelier */}
              {/* <h3 className="font-semibold text-red-900">{t.workshop.a2.title}</h3> */}
              <AutoSaveBadge status={autoStatus} lastSaved={lastSaved} error={autoError} />
            </div>
            <p className="text-sm text-red-800">{t.workshop.a2.desc}</p>
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setActiveTab('saisie')}
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'saisie' ? 'bg-white shadow-sm text-ebios-700' : 'text-gray-600 hover:text-gray-900'}`}
        >
          🎭 {t.workshop.a2.tabSR}
        </button>
        <button
          onClick={() => setActiveTab('synthese')}
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'synthese' ? 'bg-white shadow-sm text-ebios-700' : 'text-gray-600 hover:text-gray-900'}`}
        >
          📊 {t.workshop.a2.tabCouples}
        </button>
      </div>

      {activeTab === 'saisie' && (
        <>
          {/* [IA — désactivé] Bloc de suggestions IA à réactiver quand l'intégration sera prête.
          <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 rounded-xl">
            <span className="text-2xl">🤖</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-violet-900">{t.workshop.a2.aiTitle}</p>
              <p className="text-xs text-violet-700">
                {t.workshop.a2.aiDescSector} {analyse.secteur} {t.workshop.a2.aiDescVia}
              </p>
            </div>
            <button
              onClick={aiSuggest} disabled={aiLoading}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {aiLoading ? `⏳ ${t.workshop.aiLoading}` : `✨ ${t.workshop.aiBtn}`}
            </button>
          </div>
          */}

          {/* Exemples */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">{t.workshop.a2.srExTitle}</h3>
              <button
                onClick={() => setShowSrExamples(v => !v)}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                {showSrExamples ? t.workshop.hideExamples : t.workshop.showExamples}
              </button>
            </div>
            {showSrExamples && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                {srExamplesRanked.map((s, i) => {
                  const cat = CATEGORIES.find(c => c.value === s.categorie)
                  const added = sources.some((x: any) => x.nom === s.nom)
                  return (
                    <button key={i} onClick={() => { if (!added) addSource(s) }}
                      className={`text-left p-3 border rounded-lg transition-all ${
                        added
                          ? 'border-green-400 bg-green-50 opacity-70 cursor-default'
                          : 'border-dashed border-gray-300 hover:border-red-300 hover:bg-red-50'
                      }`}
                    >
                      {added && <div className="text-xs text-green-600 font-semibold mb-1">{t.workshop.addedLabel}</div>}
                      {!added && s.pertinent && <div className="text-xs text-ebios-700 font-semibold mb-1">⭐ {t.workshop.relevantLabel}</div>}
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cat?.color}`}>{cat?.label}</span>
                        <span className="text-xs font-medium text-gray-700">{s.nom}</span>
                      </div>
                      <p className="text-xs text-gray-500">{s.description}</p>
                    </button>
                  )
                })}
              </div>
            )}
            <button onClick={() => addSource()} className="btn-secondary text-sm py-1.5">
              {t.workshop.a2.srAddCustomBtn}
            </button>
          </div>

          {/* Liste sources */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">
                {t.workshop.a2.srTitle} ({sources.length} / {retained.length})
              </h3>
            </div>

            {sources.length === 0 && (
              <p className="text-sm text-gray-500 italic text-center py-8">
                {t.workshop.a2.srEmpty}
              </p>
            )}

            <div className="space-y-3">
              {sources.map(s => {
                const cat = CATEGORIES.find(c => c.value === s.categorie)
                const expanded = expandedId === s.id
                return (
                  <div key={s.id} className={`border rounded-xl overflow-hidden ${s.retenu ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                    <div
                      role="button"
                      tabIndex={0}
                      className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50"
                      aria-expanded={expanded}
                      aria-controls={`sr-detail-${s.id}`}
                      onClick={() => setExpandedId(expanded ? null : s.id)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedId(expanded ? null : s.id) } }}
                    >
                      <input type="checkbox" checked={s.retenu}
                        onChange={e => { e.stopPropagation(); updateSource(s.id, 'retenu', e.target.checked) }}
                        className="w-4 h-4 accent-ebios-600" title="Retenir cette source"
                      />
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${cat?.color}`}>
                        {cat?.label}
                      </span>
                      <span className="font-medium text-gray-800 flex-1">
                        {s.nom || <em className="text-gray-500">{t.workshop.a2.srNoName}</em>}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span title={t.workshop.a2.pertGlobalLabel} className="px-2 py-0.5 bg-gray-100 rounded font-medium">
                          {t.workshop.a2.srPertLabel} {s.pertinence}/4
                        </span>
                        <span>{s.objectifsVises?.length || 0} OV
                          {(s.objectifsVises?.filter((o: any) => o.priorite === 'P1').length || 0) > 0 &&
                            <span className="ml-1 text-ebios-700 font-semibold">
                              ({s.objectifsVises.filter((o: any) => o.priorite === 'P1').length} P1)
                            </span>
                          }
                        </span>
                        <span className="text-gray-500" aria-hidden="true">{expanded ? '▲' : '▼'}</span>
                      </div>
                      <button aria-label="Supprimer" onClick={e => { e.stopPropagation(); setPendingDelete({ msg: t.deleteDialog.source, action: () => removeSource(s.id) }) }} className="text-gray-500 hover:text-red-500"><span aria-hidden="true">✕</span></button>
                    </div>

                    {expanded && (
                      <div className="p-4 border-t border-gray-100 bg-gray-50 space-y-5">
                        {/* Identification */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="label" htmlFor={`sr-nom-${s.id}`}>{t.workshop.nameLabel}</label>
                            <input id={`sr-nom-${s.id}`} value={s.nom} onChange={e => updateSource(s.id, 'nom', e.target.value)} className="input text-sm" />
                          </div>
                          <div>
                            <label className="label" htmlFor={`sr-cat-${s.id}`}>{t.workshop.a2.srCatLabel}</label>
                            <select id={`sr-cat-${s.id}`} value={s.categorie} onChange={e => updateSource(s.id, 'categorie', e.target.value)} className="input text-sm">
                              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label} — {c.desc}</option>)}
                            </select>
                          </div>
                          <div className="sm:col-span-2">
                            <label className="label" htmlFor={`sr-desc-${s.id}`}>{t.workshop.a2.srDescOperLabel}</label>
                            <textarea id={`sr-desc-${s.id}`} value={s.description} onChange={e => updateSource(s.id, 'description', e.target.value)}
                              className="input text-sm resize-none" rows={2} placeholder={t.ph.a2SourceTechniques} />
                          </div>
                        </div>

                        {/* Caractérisation FM4 — Motivation / Ressources / Activité */}
                        <div className="border border-gray-200 rounded-lg p-4 bg-white">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">
                            📊 {t.workshop.a2.fm4Title}
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {/* Motivation */}
                            <div>
                              <label className="label" htmlFor={`sr-motiv-${s.id}`}>{t.workshop.a2.motivLabel} — {SCORE_LABELS[s.motivationScore || 2]}</label>
                              <input type="range" min={1} max={4} value={s.motivationScore || 2}
                          aria-label={`sr-motiv-${s.id}`}
                                onChange={e => updateSource(s.id, 'motivationScore', parseInt(e.target.value))}
                                className="w-full accent-red-500 mb-1"
                              />
                              <input value={s.motivation} onChange={e => updateSource(s.id, 'motivation', e.target.value)}
                                className="input text-xs" placeholder={t.ph.a2Objectif} />
                            </div>
                            {/* Ressources */}
                            <div>
                              <label className="label" htmlFor={`sr-res-${s.id}`}>{t.workshop.a2.resLabel} — {SCORE_LABELS[s.ressourcesScore || 2]}</label>
                              <input type="range" min={1} max={4} value={s.ressourcesScore || 2}
                          aria-label={`sr-res-${s.id}`}
                                onChange={e => updateSource(s.id, 'ressourcesScore', parseInt(e.target.value))}
                                className="w-full accent-orange-500 mb-1"
                              />
                              <input value={s.ressources} onChange={e => updateSource(s.id, 'ressources', e.target.value)}
                                className="input text-xs" placeholder={t.ph.a2Ressources} />
                            </div>
                            {/* Activité */}
                            <div>
                              <label className="label" htmlFor={`sr-act-${s.id}`}>{t.workshop.a2.actLabel} — {SCORE_LABELS[s.activiteScore || 2]}</label>
                              <input type="range" min={1} max={4} value={s.activiteScore || 2}
                          aria-label={`sr-act-${s.id}`}
                                onChange={e => updateSource(s.id, 'activiteScore', parseInt(e.target.value))}
                                className="w-full accent-yellow-500 mb-1"
                              />
                              <input value={s.activite} onChange={e => updateSource(s.id, 'activite', e.target.value)}
                                className="input text-xs" placeholder={t.ph.a2Pertinence} />
                            </div>
                          </div>
                          <div className="mt-3 p-3 bg-gray-50 rounded-lg flex items-center gap-3">
                            <div className="text-sm">
                              <span className="font-medium text-gray-700">{t.workshop.a2.pertGlobalLabel} </span>
                              <span className={`font-bold text-lg ${
                                s.pertinence >= 4 ? 'text-red-600' : s.pertinence >= 3 ? 'text-orange-500' : s.pertinence >= 2 ? 'text-yellow-600' : 'text-green-600'
                              }`}>
                                {s.pertinence}/4 — {SCORE_LABELS[s.pertinence]}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500">{t.workshop.a2.pertAvgHint}</p>
                          </div>
                        </div>

                        {/* Objectifs visés (Couples SR/OV FM4) */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold text-gray-700">
                              🎯 {t.workshop.a2.ovSectionTitle}
                            </h4>
                            <button onClick={() => addOV(s.id)} className="text-xs text-ebios-600 hover:underline">{t.workshop.a2.ovAddBtn}</button>
                          </div>
                          <p className="text-xs text-gray-500 mb-2">{t.workshop.a2.ovP1Hint}</p>
                          <div className="flex flex-wrap gap-2 mb-3">
                            {ovExamples.map((ov, i) => {
                              const added = (s.objectifsVises || []).some((x: any) => x.nom === ov.nom)
                              return (
                              <button key={i} onClick={() => { if (!added) addOV(s.id, ov) }}
                                className={`text-xs px-2 py-1 border rounded transition-all ${
                                  added
                                    ? 'border-green-400 bg-green-50 text-green-700 opacity-70 cursor-default'
                                    : 'bg-white border-dashed border-gray-300 hover:border-ebios-400 hover:bg-ebios-50'
                                }`}>
                                {added ? '✓' : '+'} {ov.nom}
                              </button>
                              )
                            })}
                          </div>
                          <div className="space-y-2">
                            {(s.objectifsVises || []).map((ov: any) => (
                              <div key={ov.id} className="flex gap-2 items-start p-3 bg-white border border-gray-200 rounded-lg">
                                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                  <input value={ov.nom}
                                    onChange={e => updateOV(s.id, ov.id, 'nom', e.target.value)}
                                    className="input text-sm" placeholder={t.workshop.a2.ovNamePh} />
                                  <input value={ov.description || ''}
                                    onChange={e => updateOV(s.id, ov.id, 'description', e.target.value)}
                                    className="input text-sm" placeholder={t.ph.a2ShortDesc} />
                                  <div className="flex gap-2">
                                    <select value={ov.priorite || 'P2'}
                                      onChange={e => updateOV(s.id, ov.id, 'priorite', e.target.value)}
                                      className={`input text-sm flex-1 font-medium ${
                                        ov.priorite === 'P1' ? 'border-ebios-500 bg-ebios-50 text-ebios-800' : 'border-gray-300'
                                      }`}
                                    >
                                      <option value="P1">{t.workshop.a2.ovP1Option}</option>
                                      <option value="P2">{t.workshop.a2.ovP2Option}</option>
                                    </select>
                                    <button aria-label="Supprimer" onClick={() => setPendingDelete({ msg: t.deleteDialog.ov, action: () => removeOV(s.id, ov.id) })} className="text-gray-500 hover:text-red-500 px-1"><span aria-hidden="true">✕</span></button>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {(s.objectifsVises || []).length === 0 && (
                              <p className="text-xs text-gray-500 italic">{t.workshop.a2.ovEmpty}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* ── TABLEAU DE SYNTHÈSE FM4 ───────────────────────────────────────── */}
      {activeTab === 'synthese' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-800">{t.workshop.a2.synthDesc}</p>
          </div>

          {retained.length === 0 && (
            <div className="card p-8 text-center text-gray-500 italic">
              {t.workshop.a2.synthEmpty}
            </div>
          )}

          {retained.length > 0 && (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left p-3 font-semibold text-gray-700">{t.workshop.a2.thSR}</th>
                    <th className="text-left p-3 font-semibold text-gray-700">{t.workshop.a2.thCat}</th>
                    <th className="text-center p-3 font-semibold text-gray-700">{t.workshop.a2.thMotiv}</th>
                    <th className="text-center p-3 font-semibold text-gray-700">{t.workshop.a2.thRes}</th>
                    <th className="text-center p-3 font-semibold text-gray-700">{t.workshop.a2.thAct}</th>
                    <th className="text-center p-3 font-semibold text-gray-700">{t.workshop.a2.thPert}</th>
                    <th className="text-left p-3 font-semibold text-gray-700">{t.workshop.a2.thOV}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {retained.map(s => {
                    const cat = CATEGORIES.find(c => c.value === s.categorie)
                    return (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-800">{s.nom}</td>
                        <td className="p-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${cat?.color}`}>{cat?.label}</span>
                        </td>
                        <td className="p-3 text-center">
                          <ScoreCell value={s.motivationScore || 2} />
                        </td>
                        <td className="p-3 text-center">
                          <ScoreCell value={s.ressourcesScore || 2} />
                        </td>
                        <td className="p-3 text-center">
                          <ScoreCell value={s.activiteScore || 2} />
                        </td>
                        <td className="p-3 text-center">
                          <ScoreCell value={s.pertinence} big />
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {(s.objectifsVises || []).map((ov: any) => (
                              <span key={ov.id} className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                ov.priorite === 'P1'
                                  ? 'bg-ebios-100 text-ebios-800 border border-ebios-300'
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {ov.priorite === 'P1' ? '⭐ ' : ''}{ov.nom}
                              </span>
                            ))}
                            {!(s.objectifsVises?.length) && <span className="text-xs text-gray-500 italic">{t.workshop.a2.ovEmpty}</span>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4 text-center">
              <div className="text-3xl font-bold text-ebios-700">{retained.length}</div>
              <div className="text-sm text-gray-500 mt-1">{t.workshop.a2.statRetained}</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-3xl font-bold text-ebios-700">{totalCouples}</div>
              <div className="text-sm text-gray-500 mt-1">{t.workshop.a2.statCouples}</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-3xl font-bold text-amber-600">{couplesP1}</div>
              <div className="text-sm text-gray-500 mt-1">{t.workshop.a2.statP1}</div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-800">
          <strong>✅ {t.workshop.a2.summaryLabel} :</strong> {retained.length} {t.workshop.a2.summaryText} {totalCouples} {t.workshop.a2.summaryCouple} <strong>{couplesP1} P1</strong>. {t.workshop.a2.summaryFeed}
        </p>
      </div>

      {flashMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <span className="text-xl flex-shrink-0">⚡</span>
          <div>
            <p className="text-sm font-semibold text-amber-900">{t.analyses.expressTitle} — {t.analyses.expressSubtitle}</p>
            <p className="text-xs text-amber-700 mt-0.5">{t.analyses.expressInfo}</p>
          </div>
        </div>
      )}

      {activeTab === 'saisie' ? (
        <button onClick={() => setActiveTab('synthese')} className="btn-primary w-full text-base py-3">
          {t.workshop.a2.nextCouples}
        </button>
      ) : (
        <button onClick={save} disabled={saving} className="btn-primary w-full text-base py-3">
          {saving ? t.workshop.saving : t.workshop.saveNext}
        </button>
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

function ScoreCell({ value, big = false }: { value: number, big?: boolean }) {
  const colors = ['', 'text-green-600 bg-green-50', 'text-yellow-600 bg-yellow-50', 'text-orange-600 bg-orange-50', 'text-red-600 bg-red-50']
  return (
    <span className={`inline-block px-2 py-0.5 rounded font-bold ${big ? 'text-base' : 'text-xs'} ${colors[value] || colors[2]}`}>
      {value}/4
    </span>
  )
}
