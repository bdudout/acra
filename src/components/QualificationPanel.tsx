'use client'

import { Compass, ListPlus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/context'
import { QualificationRisksDialog, useQualificationProposals } from '@/components/QualificationRisksFlow'
import {
  FILIERE_OIV_OPTIONS,
  deriveOrientations,
  isQualificationComplete,
  effectiveQualificationQuestions,
  EMPTY_QUALIFICATION_CONFIG,
  type QualificationAnswers,
  type QualificationConfig,
  type EffectiveQualQuestion,
} from '@/lib/qualification'

interface Props {
  analyseId: string
  initial?: QualificationAnswers | null
  canEdit?: boolean
  /** Ouvrir le panneau déplié (ex. mise en avant tant que la qualification est incomplète). */
  defaultOpen?: boolean
  /** Secteur de l'analyse — conditionne l'affichage de champs sectoriels (ex. finance/DORA). */
  secteur?: string | null
  /** Personnalisation du questionnaire (overrides natifs + questions custom) — config org. */
  config?: QualificationConfig | null
  /** Méthode de l'analyse (conservée pour compatibilité ; le serveur filtre les règles). */
  methode?: string | null
  /** Questions pré-remplies d'après la qualification 360 du projet de l'analyse (à vérifier puis enregistrer). */
  reprisesProjet?: string[]
}

/**
 * Panneau optionnel de qualification d'une analyse (cf. lib/qualification.ts).
 * Affiché en début d'analyse uniquement si la fonctionnalité est activée
 * (OrganizationConfig.qualificationActive). Sauvegarde via PATCH /api/analyses/[id].
 */
export default function QualificationPanel({ analyseId, initial, canEdit = true, defaultOpen = false, secteur = null, config = null, reprisesProjet = [] }: Props) {
  const isFinance = /banqu|financ|bancaire|assur|fintech/i.test(secteur ?? '')
  const { t } = useTranslation()
  const [answers, setAnswers] = useState<QualificationAnswers>(initial ?? {})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  // Risques proposés/imposés par les réponses (propositions calculées et traduites côté serveur).
  const router = useRouter()
  const { channel, pending, reload } = useQualificationProposals(analyseId)
  const [proposalsOpen, setProposalsOpen] = useState(false)
  const [proposalSummary, setProposalSummary] = useState<string | null>(null)
  const hasInitialAnswers = !!initial && Object.keys(initial).length > 0
  useEffect(() => { if (hasInitialAnswers) void reload() }, [hasInitialAnswers, reload])
  // Replié par défaut (vue synthétique) ; déplié si `defaultOpen` (mise en avant
  // tant que la qualification est incomplète).
  // Déplié aussi quand des réponses viennent d'être reprises du projet 360 (à vérifier).
  const [collapsed, setCollapsed] = useState<boolean>(!defaultOpen && !(canEdit && reprisesProjet.length > 0))

  const cfg = config ?? EMPTY_QUALIFICATION_CONFIG
  const customById = useMemo(() => new Map(cfg.custom.map(c => [c.id, c])), [cfg])
  // Questions effectives = natives activées (selon overrides) + personnalisées.
  const effQuestions = useMemo(() => effectiveQualificationQuestions(cfg), [cfg])

  const orientations = useMemo(() => deriveOrientations(answers), [answers])
  const complete = useMemo(() => isQualificationComplete(answers, cfg), [answers, cfg])
  const qLabels = t.qualification.questions as Record<string, string>
  const critLabels = t.qualification.criticiteOptions as Record<string, string>
  const statutLabels = t.qualification.statutOptions as Record<string, string>
  const oLabels = t.qualification.orientations as Record<string, string>
  const shortLabels = t.qualification.short as Record<string, string>

  // Libellé d'une question : override org / i18n natif / libellé custom.
  const questionLabel = (q: EffectiveQualQuestion): string =>
    q.builtin ? (cfg.overrides[q.id]?.label || qLabels[q.id] || q.id) : (customById.get(q.id)?.label || q.id)
  // Libellé d'une valeur d'option (natif via i18n ; custom via config).
  const optLabel = (q: EffectiveQualQuestion, value: string): string => {
    if (q.builtin) return (q.id === 'statutReglementaire' ? statutLabels : critLabels)[value] ?? value
    return customById.get(q.id)?.options?.find(o => o.value === value)?.label ?? value
  }
  const shortLabel = (q: EffectiveQualQuestion): string => q.builtin ? (shortLabels[q.id] ?? questionLabel(q)) : questionLabel(q)

  // Synthèse des points saillants pour la vue repliée (booléens « Oui » + choix)
  const summaryChips = useMemo(() => {
    const chips: { key: string; label: string; tone: 'pos' | 'warn' | 'neutral' }[] = []
    for (const q of effQuestions) {
      const v = answers[q.id]
      if (q.type === 'bool') {
        if (v === true) chips.push({ key: q.id, label: shortLabel(q), tone: 'pos' })
      } else if (q.type === 'choice' && typeof v === 'string') {
        // 'aucun' (statut réglementaire neutre) n'est pas un point saillant
        if (q.id === 'statutReglementaire' && v === 'aucun') continue
        chips.push({ key: q.id, label: `${shortLabel(q)} : ${optLabel(q, v)}`, tone: v === 'eleve' ? 'warn' : 'neutral' })
      }
    }
    return chips
  }, [answers, effQuestions]) // eslint-disable-line react-hooks/exhaustive-deps

  const chipClass = (tone: 'pos' | 'warn' | 'neutral') =>
    tone === 'warn' ? 'bg-amber-100 text-amber-800 border-amber-200'
    : tone === 'pos' ? 'bg-ebios-50 text-ebios-700 border-ebios-100'
    : 'bg-gray-100 text-gray-600 border-gray-200'

  function setAnswer(id: string, value: boolean | string) {
    setAnswers(prev => ({ ...prev, [id]: value }))
    setSaved(false)
  }

  async function save() {
    setSaving(true); setSaved(false)
    const res = await fetch(`/api/analyses/${analyseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qualification: answers }),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true); setCollapsed(true); setProposalSummary(null)
      // Méthodes à saisie directe : proposition immédiate ; EBIOS RM : en atelier 5.
      const next = await reload()
      if (canEdit && next.channel === 'DIRECT' && next.pending.length > 0) setProposalsOpen(true)
    }
  }

  function proposalsDone(summary: string) {
    setProposalsOpen(false); setProposalSummary(summary); void reload(); router.refresh()
  }

  if (collapsed) {
    return (
      <><div className="card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span><Compass size={18} aria-hidden="true" /></span>
            <span className="text-sm font-medium text-gray-800">{t.qualification.title}</span>
          </div>
          {canEdit && (
            <button onClick={() => setCollapsed(false)} className="text-xs text-ebios-600 hover:text-ebios-800 font-medium hover:underline flex-shrink-0">
              {t.qualification.edit}
            </button>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {!complete ? (
            <span className="text-xs text-gray-500 italic">{t.qualification.notRealized}</span>
          ) : summaryChips.length === 0 ? (
            <span className="text-xs text-gray-500">{t.qualification.summaryEmpty}</span>
          ) : (
            summaryChips.map(c => (
              <span key={c.key} className={`text-xs px-2 py-0.5 rounded-full border font-medium ${chipClass(c.tone)}`}>{c.label}</span>
            ))
          )}
        </div>
        {complete && orientations.length > 0 && (
          <p className="text-xs text-gray-400 mt-2">{orientations.length} {t.qualification.orientationsTitle.toLowerCase()}</p>
        )}
        {proposalSummary && <p role="status" className="mt-2 text-xs text-green-700 dark:text-green-300">{proposalSummary}</p>}
        {pending.length > 0 && channel === 'DIRECT' && canEdit && (
          <button type="button" onClick={() => setProposalsOpen(true)} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-ebios-600 hover:text-ebios-800 hover:underline">
            <ListPlus size={14} aria-hidden="true" />{t.qualification.riskProposal.pending.replace('{n}', String(pending.length))}
          </button>
        )}
        {pending.length > 0 && channel === 'ATELIER5' && (
          <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">{t.qualification.riskProposal.ebiosHint}</p>
        )}
      </div>{proposalsOpen && <QualificationRisksDialog analyseId={analyseId} risks={pending} onClose={() => setProposalsOpen(false)} onDone={proposalsDone} />}</>
    )
  }

  return (
    <div className="card p-6">
      <div className="flex items-start gap-2 mb-1">
        <span className="text-lg"><Compass size={18} aria-hidden="true" /></span>
        <h2 className="text-base font-semibold text-gray-800">{t.qualification.title}</h2>
      </div>
      <p className="text-sm text-gray-500 mb-5">{t.qualification.intro}</p>
      {canEdit && reprisesProjet.length > 0 && <p className="mb-4 rounded-md bg-ebios-50 px-3 py-2 text-xs text-ebios-800 dark:bg-ebios-900/20 dark:text-ebios-200">{t.qualification.reprisesProjet.replace('{n}', String(reprisesProjet.length))}</p>}

      <div className="space-y-4">
        {effQuestions.map(q => (
          <div key={q.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <label className="text-sm text-gray-700 sm:max-w-[60%]">{questionLabel(q)}</label>
            {q.type === 'bool' ? (
              <div className="flex gap-2">
                {[true, false].map(v => (
                  <button
                    key={String(v)}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setAnswer(q.id, v)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      answers[q.id] === v ? 'bg-ebios-600 text-white border-ebios-600' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {v ? t.qualification.yes : t.qualification.no}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {(q.options ?? []).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setAnswer(q.id, opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      answers[q.id] === opt.value ? 'bg-ebios-600 text-white border-ebios-600' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {optLabel(q, opt.value)}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Filière OIV (optionnelle) — affichée seulement si statut = OIV (issue #80) */}
        {answers.statutReglementaire === 'OIV' && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t border-gray-100">
            <label className="text-sm text-gray-700 sm:max-w-[60%]">{t.qualification.filiereOivLabel}</label>
            <div className="flex gap-2 flex-wrap">
              {FILIERE_OIV_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => setAnswer('filiereOiv', opt.value)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    answers.filiereOiv === opt.value ? 'bg-ebios-600 text-white border-ebios-600' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {(t.qualification.filieresOiv as Record<string, string>)[opt.value] ?? opt.value}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Entité financière agréée (optionnel) — secteur finance seulement (issue #106) */}
        {isFinance && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t border-gray-100">
            <label className="text-sm text-gray-700 sm:max-w-[60%]">{t.qualification.entiteFinanciereAgreeeLabel}</label>
            <div className="flex gap-2">
              {[{ v: true, l: t.qualification.yes }, { v: false, l: t.qualification.no }].map(opt => (
                <button
                  key={String(opt.v)}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => setAnswer('entiteFinanciereAgreee', opt.v)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    answers.entiteFinanciereAgreee === opt.v ? 'bg-ebios-600 text-white border-ebios-600' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Orientations dérivées */}
      <div className="mt-6 p-4 rounded-lg bg-ebios-50 border border-ebios-100">
        <p className="text-sm font-semibold text-ebios-800 mb-2">{t.qualification.orientationsTitle}</p>
        {orientations.length === 0 ? (
          <p className="text-sm text-gray-500">{t.qualification.noOrientation}</p>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-2">{t.qualification.orientationsIntro}</p>
            <ul className="space-y-1.5">
              {orientations.map(o => (
                <li key={o} className="text-sm text-gray-700 flex gap-2">
                  <span className="text-ebios-600">›</span>
                  <span>{oLabels[o] ?? o}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {canEdit && (
        <div className="mt-5 flex items-center gap-3">
          <button onClick={save} disabled={saving} className="btn-primary text-sm">
            {saving ? '…' : t.qualification.save}
          </button>
          {saved && <span className="text-sm text-green-600">✓ {t.qualification.saved}</span>}
        </div>
      )}
    </div>
  )
}
