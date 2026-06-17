'use client'

/**
 * Atelier4 — Scénarios opérationnels (EBIOS RM Workshop 4)
 *
 * Drills down from strategic scenarios to concrete technical attack sequences:
 *  - Scénarios opérationnels : detailed attack chains linked to a strategic
 *    scenario, described as sequences of elementary actions (MITRE ATT&CK tactics)
 *  - Actions élémentaires : individual technical steps with technique ID,
 *    likelihood, and detection difficulty
 *  - Vraisemblance technique : overall technical likelihood score (1–4) for
 *    the full operational scenario
 *
 * Scenario data is linked back to Atelier 3 via `scenarioStrategiqueId` so
 * each operational scenario is traceable to its strategic parent.
 *
 * Auto-saves via `useAutoSave`.
 *
 * Props:
 *  - analyseId   : Prisma cuid of the parent Analyse
 *  - initialData : { scenariosOperationnels } from DB
 *  - analyse     : parent Analyse (used for strategic scenario names in dropdowns)
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

interface Props {
  analyseId: string
  initialData?: { scenariosOperationnels: any[] }
  analyse: any
  /** Mode « Flash » (Club EBIOS) — A4 réduit : ≥1 scénario opérationnel par scénario stratégique */
  flashMode?: boolean
}

function uid() { return Math.random().toString(36).slice(2, 9) }

function getNiveauRisqueColor(score: number) {
  if (score >= 12) return 'bg-red-100 text-red-700 border-red-200'
  if (score >= 8)  return 'bg-orange-100 text-orange-700 border-orange-200'
  if (score >= 4)  return 'bg-yellow-100 text-yellow-700 border-yellow-200'
  return 'bg-green-100 text-green-700 border-green-200'
}

export default function Atelier4({ analyseId, initialData, analyse, flashMode }: Props) {
  const router = useRouter()
  const { t, locale } = useTranslation()
  const { TYPES_ACTION_ELEMENTAIRE, NIVEAUX_VRAISEMBLANCE, NIVEAUX_GRAVITE } = useEbiosData()
  // Exemples : override organisation si présent, sinon défauts (ebios-data)
  const [exOverride, setExOverride] = useState<Record<string, any[]>>({})
  useEffect(() => {
    fetch('/api/admin/organization-config').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.exemplesAteliers && typeof d.exemplesAteliers === 'object' && !Array.isArray(d.exemplesAteliers)) setExOverride(d.exemplesAteliers)
    }).catch(() => {})
  }, [])
  const aeExamples = useMemo(() => resolveExemples(exOverride.actionsElementaires, defaultExemplesFor('actionsElementaires', t as unknown as ExemplesTranslations, locale)) as any[], [t, exOverride]) // eslint-disable-line react-hooks/exhaustive-deps
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{ msg: string; action: () => void } | null>(null)
  // Reconstruire scenarioStrategiqueNom depuis scenarioStrategiqueId au chargement depuis DB
  const [scenarios, setScenarios] = useState<any[]>(() => {
    const allSS = analyse?.scenariosStrategiques?.filter((s: any) => s.retenu) || []
    return (initialData?.scenariosOperationnels || []).map((s: any) => {
      if (!s.scenarioStrategiqueNom && s.scenarioStrategiqueId) {
        const ss = allSS.find((x: any) => x.id === s.scenarioStrategiqueId)
        if (ss) return { ...s, scenarioStrategiqueNom: ss.nom }
      }
      return s
    })
  })
  const [expanded, setExpanded] = useState<string | null>(null)

  // ── Auto-save ─────────────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const autoSaveData = useMemo(() => ({ scenariosOperationnels: scenarios }), [scenarios])
  const { status: autoStatus, lastSaved, error: autoError, saveNow } = useAutoSave(
    autoSaveData,
    async (data) => {
      const res = await fetch(`/api/analyses/${analyseId}/workshop/4`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Sauvegarde échouée')
    },
    { delay: 1500 }
  )

  // Scénarios stratégiques retenus de l'atelier 3
  const scenariosStrat: any[] = analyse?.scenariosStrategiques?.filter((s: any) => s.retenu) || []

  // Biens supports de l'atelier 1
  const biensSupports: any[] = analyse?.cadrage?.biensSupports || []

  function addScenario(scenarioStratRef?: any) {
    const id = uid()
    setScenarios(prev => [...prev, {
      id,
      nom: scenarioStratRef ? `${scenarioStratRef.nom} — déclinaison opérationnelle` : '',
      scenarioStrategiqueId: scenarioStratRef?.id || '',
      scenarioStrategiqueNom: scenarioStratRef?.nom || '',
      description: '',
      actionsElementaires: [],
      vraisemblance: 2,
      gravite: scenarioStratRef?.gravite || 3,
    }])
    setExpanded(id)
  }

  function updateScenario(id: string, field: string, value: any) {
    setScenarios(prev => prev.map(s => {
      if (s.id !== id) return s
      const up = { ...s, [field]: value }
      // Si on change le lien avec un scénario stratégique, hériter la gravité
      if (field === 'scenarioStrategiqueId') {
        const ss = scenariosStrat.find((x: any) => x.id === value)
        if (ss) {
          up.gravite = ss.gravite
          up.scenarioStrategiqueNom = ss.nom
        }
      }
      return up
    }))
  }

  function addAction(scenarioId: string, exemple?: any) {
    setScenarios(prev => prev.map(s => {
      if (s.id !== scenarioId) return s
      return {
        ...s,
        actionsElementaires: [
          ...(s.actionsElementaires || []),
          {
            id: uid(),
            type: exemple?.type || 'ACCES_INITIAL',
            nom: exemple?.nom || '',
            description: exemple?.description || '',
            bienSupport: '',
            vulnerabilite: '',
          },
        ],
      }
    }))
  }

  function updateAction(scenarioId: string, actionId: string, field: string, value: any) {
    setScenarios(prev => prev.map(s => {
      if (s.id !== scenarioId) return s
      return {
        ...s,
        actionsElementaires: s.actionsElementaires.map((a: any) =>
          a.id === actionId ? { ...a, [field]: value } : a
        ),
      }
    }))
  }

  function removeAction(scenarioId: string, actionId: string) {
    setScenarios(prev => prev.map(s => {
      if (s.id !== scenarioId) return s
      return { ...s, actionsElementaires: s.actionsElementaires.filter((a: any) => a.id !== actionId) }
    }))
  }

  async function save() {
    setSaving(true)
    await saveNow()
    setSaving(false)
    router.push(`/analyses/${analyseId}/atelier/5${flashMode ? '?mode=flash' : ''}`)
  }

  // Grouper les scénarios opérationnels par scénario stratégique
  const byStrat = scenariosStrat.map(ss => ({
    ss,
    ops: scenarios.filter(s => s.scenarioStrategiqueId === ss.id),
  }))
  const orphelins = scenarios.filter(s => !s.scenarioStrategiqueId || !scenariosStrat.find((ss: any) => ss.id === s.scenarioStrategiqueId))

  return (
    <div className="space-y-6">
      {flashMode && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-5 py-3 flex items-start gap-3">
          <span className="text-xl flex-shrink-0" aria-hidden="true">⚡</span>
          <p className="text-sm text-amber-800">{t.workshop.a4.flashHint}</p>
        </div>
      )}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
        <div className="flex gap-3">
          <span className="text-2xl">⚙️</span>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              {/* h3 commenté : titre déjà affiché en h1 par la page atelier */}
              {/* <h3 className="font-semibold text-yellow-900">{t.workshop.a4.title}</h3> */}
              <AutoSaveBadge status={autoStatus} lastSaved={lastSaved} error={autoError} />
            </div>
            <p className="text-sm text-yellow-800">{t.workshop.a4.desc}</p>
          </div>
        </div>
      </div>

      {/* Suggestion : créer un SO par scénario stratégique */}
      {scenariosStrat.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            {t.workshop.a4.stratPanelTitle}
          </h3>
          <div className="space-y-2">
            {byStrat.map(({ ss, ops }) => (
              <div key={ss.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-800">{ss.nom}</span>
                  {ss.coupleLabel && <span className="ml-2 text-xs text-gray-500">({ss.coupleLabel})</span>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${getNiveauRisqueColor(ss.niveauRisque)}`}>
                  {t.workshop.a4.stratRiskLabel} {ss.niveauRisque}/16
                </span>
                <span className="text-xs text-gray-500">{ops.length} {t.workshop.a4.stratLinkedLabel}</span>
                <button onClick={() => addScenario(ss)}
                  className="text-xs px-3 py-1 bg-ebios-600 text-white rounded hover:bg-ebios-700">
                  {t.workshop.a4.stratCreateBtn}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">{t.workshop.a4.scenListTitle} ({scenarios.length})</h3>
          <button onClick={() => addScenario()} className="btn-primary text-sm py-1.5">{t.workshop.a4.scenAddBtn}</button>
        </div>

        {scenarios.length === 0 && (
          <p className="text-sm text-gray-500 italic text-center py-8">
            {t.workshop.a4.scenEmpty}
          </p>
        )}

        <div className="space-y-3">
          {scenarios.map(s => (
            <div key={s.id} className="border border-gray-200 rounded-xl overflow-hidden">
              <div
                role="button"
                tabIndex={0}
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50"
                aria-expanded={expanded === s.id}
                onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(expanded === s.id ? null : s.id) } }}
              >
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-gray-800">
                    {s.nom || <em className="text-gray-500">{t.workshop.a4.scenNoTitle}</em>}
                  </span>
                  {s.scenarioStrategiqueNom && (
                    <div className="text-xs text-gray-500 mt-0.5 truncate">
                      📋 {t.workshop.a4.scenSSPrefix} {s.scenarioStrategiqueNom}
                    </div>
                  )}
                </div>
                <span className="text-xs text-gray-500 flex-shrink-0">{(s.actionsElementaires || []).length} {t.workshop.a4.scenAE}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium border flex-shrink-0 ${getNiveauRisqueColor(s.vraisemblance * s.gravite)}`}>
                  {s.vraisemblance * s.gravite}/16
                </span>
                <span className="text-gray-500" aria-hidden="true">{expanded === s.id ? '▲' : '▼'}</span>
                <button aria-label="Supprimer" onClick={e => { e.stopPropagation(); setPendingDelete({ msg: t.deleteDialog.scenOp, action: () => setScenarios(prev => prev.filter(x => x.id !== s.id)) }) }}
                  className="text-gray-500 hover:text-red-500"><span aria-hidden="true">✕</span></button>
              </div>

              {expanded === s.id && (
                <div className="p-4 border-t border-gray-100 bg-gray-50 space-y-5">
                  {/* Traçabilité vers Atelier 3 */}
                  <div className="border border-orange-200 rounded-lg p-3 bg-orange-50">
                    <h4 className="text-xs font-semibold text-orange-700 mb-2">{t.workshop.a4.traceTitle}</h4>
                    {scenariosStrat.length > 0 ? (
                      <>
                        <label className="sr-only" htmlFor={`ss-link-${s.id}`}>{t.workshop.a4.traceTitle}</label>
                        <select id={`ss-link-${s.id}`} value={s.scenarioStrategiqueId || ''}
                          onChange={e => updateScenario(s.id, 'scenarioStrategiqueId', e.target.value)}
                          className="input text-sm">
                          <option value="">{t.workshop.a4.selectSSPh}</option>
                          {scenariosStrat.map((ss: any) => (
                            <option key={ss.id} value={ss.id}>{ss.nom}</option>
                          ))}
                        </select>
                      </>
                    ) : (
                      <p className="text-xs text-orange-600 italic">{t.workshop.a4.completeA3}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label" htmlFor={`sop-nom-${s.id}`}>{t.workshop.nameLabel}</label>
                      <input id={`sop-nom-${s.id}`} value={s.nom} onChange={e => updateScenario(s.id, 'nom', e.target.value)}
                        className="input text-sm" placeholder={t.ph.a4Scenario} />
                    </div>
                    <div>
                      <label className="label" htmlFor={`sop-desc-${s.id}`}>{t.workshop.a4.modeOperLabel}</label>
                      <input id={`sop-desc-${s.id}`} value={s.description} onChange={e => updateScenario(s.id, 'description', e.target.value)}
                        className="input text-sm" placeholder={t.ph.a4Summary} />
                    </div>
                  </div>

                  {/* Actions élémentaires */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="label mb-0 text-base">{t.workshop.a4.aeSequenceTitle}</label>
                    </div>

                    <div className="mb-3">
                      <p className="text-xs text-gray-500 mb-2">{t.workshop.a4.aeTypesHint}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {aeExamples.map((a, i) => {
                          const type = TYPES_ACTION_ELEMENTAIRE.find(tae => tae.value === a.type)
                          return (
                            <button key={i} onClick={() => addAction(s.id, a)}
                              className={`text-xs px-2 py-1 rounded-full font-medium ${type?.color} hover:opacity-80 transition-opacity`}>
                              + {a.nom}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {(s.actionsElementaires || []).length > 0 && (
                      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-2">
                        {/* Visualisation séquentielle */}
                        <div className="flex overflow-x-auto p-3 gap-2 border-b border-gray-100 bg-gray-50">
                          {s.actionsElementaires.map((a: any, idx: number) => {
                            const type = TYPES_ACTION_ELEMENTAIRE.find(tae => tae.value === a.type)
                            return (
                              <div key={a.id} className="flex items-center gap-1 flex-shrink-0">
                                {idx > 0 && <span className="text-gray-500">→</span>}
                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${type?.color}`}>
                                  {idx + 1}. {a.nom || a.type}
                                </span>
                              </div>
                            )
                          })}
                        </div>

                        <div className="divide-y divide-gray-100">
                          {s.actionsElementaires.map((a: any, idx: number) => {
                            const type = TYPES_ACTION_ELEMENTAIRE.find(tae => tae.value === a.type)
                            return (
                              <div key={a.id} className="flex gap-2 items-start p-3">
                                <span className="text-gray-500 text-sm w-5 text-center mt-2.5 flex-shrink-0">{idx + 1}</span>
                                <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2">
                                  <select value={a.type}
                                    aria-label="Type d'action élémentaire"
                                    onChange={e => updateAction(s.id, a.id, 'type', e.target.value)}
                                    className="input text-xs">
                                    {TYPES_ACTION_ELEMENTAIRE.map(tae => (
                                      <option key={tae.value} value={tae.value}>{tae.label}</option>
                                    ))}
                                  </select>
                                  <input value={a.nom} onChange={e => updateAction(s.id, a.id, 'nom', e.target.value)}
                                    aria-label={t.workshop.a4.aeNamePh}
                                    className="input text-sm" placeholder={t.workshop.a4.aeNamePh} />
                                  <select value={a.bienSupport}
                                    aria-label={t.workshop.a4.aeBienSelectPh}
                                    onChange={e => updateAction(s.id, a.id, 'bienSupport', e.target.value)}
                                    className="input text-sm">
                                    <option value="">{t.workshop.a4.aeBienSelectPh}</option>
                                    {biensSupports.map((b: any) => (
                                      <option key={b.id} value={b.nom}>{b.nom}</option>
                                    ))}
                                    <option value="__custom__">{t.workshop.a4.aeOtherOption}</option>
                                  </select>
                                  {a.bienSupport === '__custom__' ? (
                                    <input value={a.bienSupportCustom || ''}
                                      onChange={e => updateAction(s.id, a.id, 'bienSupportCustom', e.target.value)}
                                      aria-label={t.workshop.a4.aeBienSelectPh}
                                      className="input text-sm" placeholder={t.workshop.a4.aeBienSelectPh} />
                                  ) : (
                                    <input value={a.vulnerabilite} onChange={e => updateAction(s.id, a.id, 'vulnerabilite', e.target.value)}
                                      aria-label={t.workshop.a4.aeVulnPh}
                                      className="input text-sm" placeholder={t.workshop.a4.aeVulnPh} />
                                  )}
                                </div>
                                <button aria-label="Supprimer" onClick={() => removeAction(s.id, a.id)}
                                  className="text-gray-500 hover:text-red-500 mt-2"><span aria-hidden="true">✕</span></button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    <button onClick={() => addAction(s.id)} className="btn-secondary text-xs py-1">
                      {t.workshop.a4.aeAddManual}
                    </button>
                  </div>

                  {/* Évaluation vraisemblance + gravité */}
                  <div className="grid grid-cols-2 gap-4 p-4 bg-white rounded-lg border border-gray-200">
                    <div>
                      <label className="label">{t.workshop.a4.vraisLabel} V{s.vraisemblance} — {NIVEAUX_VRAISEMBLANCE[s.vraisemblance - 1]?.label}</label>
                      <input type="range" min={1} max={4} value={s.vraisemblance}
                        onChange={e => updateScenario(s.id, 'vraisemblance', parseInt(e.target.value))}
                        className="w-full accent-ebios-600" />
                      <p className="text-xs text-gray-500 mt-1">{NIVEAUX_VRAISEMBLANCE[s.vraisemblance - 1]?.description}</p>
                    </div>
                    <div>
                      <label className="label">Gravité G{s.gravite} — {NIVEAUX_GRAVITE[s.gravite - 1]?.label}</label>
                      <input type="range" min={1} max={4} value={s.gravite}
                        onChange={e => updateScenario(s.id, 'gravite', parseInt(e.target.value))}
                        className="w-full accent-red-500" />
                      <p className="text-xs text-gray-500 mt-1 italic">
                        {s.scenarioStrategiqueNom ? `${t.workshop.a4.inheritedFromSS} "${s.scenarioStrategiqueNom}"` : NIVEAUX_GRAVITE[s.gravite - 1]?.description}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border ${getNiveauRisqueColor(s.vraisemblance * s.gravite)}`}>
                        {t.workshop.a4.riskOpLabel} {s.vraisemblance * s.gravite}/16
                        {s.vraisemblance * s.gravite >= 12 && ` — ${t.workshop.a4.riskCritique}`}
                        {s.vraisemblance * s.gravite >= 8 && s.vraisemblance * s.gravite < 12 && ` — ${t.workshop.a4.riskEleve}`}
                        {s.vraisemblance * s.gravite >= 4 && s.vraisemblance * s.gravite < 8 && ` — ${t.workshop.a4.riskModere}`}
                        {s.vraisemblance * s.gravite < 4 && ` — ${t.workshop.a4.riskFaible}`}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Tableau de couverture */}
      {scenariosStrat.length > 0 && scenarios.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{t.workshop.a4.coverageTitle}</h3>
          <div className="space-y-2">
            {byStrat.map(({ ss, ops }) => (
              <div key={ss.id} className={`flex items-center gap-3 p-3 rounded-lg border ${ops.length > 0 ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                <span className={`text-sm ${ops.length > 0 ? 'text-green-700' : 'text-yellow-700'}`}>
                  {ops.length > 0 ? '✅' : '⚠️'}
                </span>
                <span className="text-sm text-gray-700 flex-1">{ss.nom}</span>
                <span className="text-xs text-gray-500">
                  {ops.length > 0 ? `${ops.length} ${t.workshop.a4.stratLinkedLabel}` : t.workshop.a4.coverageSOCreate}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={save} disabled={saving} className="btn-primary w-full text-base py-3">
        {saving ? t.workshop.saving : t.workshop.saveNext}
      </button>

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
