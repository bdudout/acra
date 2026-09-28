'use client'

// ─── Éditeur des règles « réponse → risque proposé / imposé » (ADMIN) ────────
// Chaque règle : question + réponse déclenchante (listes, pas d'identifiant à
// saisir), risque (intitulé libre ou intitulé traduit du catalogue par défaut),
// méthode ciblée, catégorie, cotation, traitement, IMPOSÉ (non décochable) et
// activation. Contrôlé : l'état vit dans QualificationQuestionnaireEditor.

import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { QUALIFICATION_RISK_CATEGORIES, QUALIFICATION_RISK_STRATEGIES, type QualificationRiskRule } from '@/lib/qualification'

export type RuleQuestion = { id: string; label: string; type: 'bool' | 'choice'; options?: { value: string; label: string }[] }
const METHODS = ['EBIOS_RM', 'ISO_27005', 'ISO_31000', 'NIST_800_30'] as const
const METHOD_LABELS: Record<(typeof METHODS)[number], string> = { EBIOS_RM: 'EBIOS RM', ISO_27005: 'ISO/IEC 27005', ISO_31000: 'ISO 31000', NIST_800_30: 'NIST SP 800-30' }

/** Réponse par défaut d'une question : « oui » ou 1ʳᵉ option. */
const defaultAnswer = (q?: RuleQuestion): boolean | string => (q?.type === 'choice' ? (q.options?.[0]?.value ?? '') : true)

export default function QualificationRiskRulesEditor({ rules, questions, onChange }: {
  rules: QualificationRiskRule[]; questions: RuleQuestion[]; onChange: (rules: QualificationRiskRule[]) => void
}) {
  const { t } = useTranslation()
  const e = t.qualifEditor
  const categories = t.qualification.riskProposal.categories as Record<string, string>
  const strategies = t.risquesDirects.strategies as Record<string, string>
  const catalog = t.qualification.riskCatalog as Record<string, { title: string }>
  const inp = 'w-full px-2 py-1 text-sm border border-gray-300 rounded bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-600'
  const lbl = 'flex flex-col gap-0.5 text-[11px] text-gray-500 dark:text-gray-400'

  const update = (i: number, patch: (r: QualificationRiskRule) => QualificationRiskRule) => onChange(rules.map((r, j) => (j === i ? patch(r) : r)))
  const setRisk = (i: number, risk: Partial<QualificationRiskRule['risk']>) => update(i, r => ({ ...r, risk: { ...r.risk, ...risk } }))

  function addRule() {
    const q = questions[0]
    onChange([...rules, {
      id: `regle-${Date.now().toString(36)}`, enabled: true, mandatory: false,
      when: { questionId: q?.id ?? '', equals: defaultAnswer(q) },
      risk: { category: 'CYBER', title: '', gravity: 3, likelihood: 2, strategy: 'REDUIRE' },
    }])
  }

  return (
    <div>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">{e.riskRulesTitle}</p>
      <div className="space-y-2">
        {rules.map((rule, i) => {
          const q = questions.find(x => x.id === rule.when.questionId)
          const fid = (k: string) => `rule-${i}-${k}`
          return (
            <div key={`${rule.id}-${i}`} className={`rounded-lg border p-3 space-y-2 ${rule.mandatory ? 'border-amber-300 dark:border-amber-700' : 'border-gray-200 dark:border-gray-700'} ${rule.enabled === false ? 'opacity-60' : ''}`}>
              <div className="grid gap-2 sm:grid-cols-[1fr_9rem_1.4fr_auto] items-end">
                <label className={lbl} htmlFor={fid('q')}>{e.ruleQuestion}
                  <select id={fid('q')} className={inp} value={rule.when.questionId}
                    onChange={ev => { const nq = questions.find(x => x.id === ev.target.value); update(i, r => ({ ...r, when: { questionId: ev.target.value, equals: defaultAnswer(nq) } })) }}>
                    {!q && <option value={rule.when.questionId}>{rule.when.questionId}</option>}
                    {questions.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
                  </select>
                </label>
                <label className={lbl} htmlFor={fid('a')}>{e.ruleAnswer}
                  <select id={fid('a')} className={inp} value={String(rule.when.equals)}
                    onChange={ev => update(i, r => ({ ...r, when: { ...r.when, equals: q?.type === 'choice' ? ev.target.value : ev.target.value === 'true' } }))}>
                    {q?.type === 'choice'
                      ? (q.options ?? []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)
                      : <><option value="true">{e.ruleYes}</option><option value="false">{e.ruleNo}</option></>}
                  </select>
                </label>
                <label className={lbl} htmlFor={fid('t')}>{e.ruleTitle}
                  <input id={fid('t')} className={inp} value={rule.risk.title}
                    placeholder={rule.risk.titleKey ? (catalog[rule.risk.titleKey]?.title ?? '') : ''}
                    title={rule.risk.titleKey ? e.ruleTitleCatalog : undefined}
                    onChange={ev => setRisk(i, { title: ev.target.value })} />
                </label>
                <button type="button" onClick={() => onChange(rules.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-600 p-1.5" aria-label={e.removeRule}>
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>
              <div className="grid gap-2 grid-cols-2 sm:grid-cols-[1fr_1fr_4.5rem_4.5rem_1fr] items-end">
                <label className={lbl} htmlFor={fid('m')}>{e.ruleMethod}
                  <select id={fid('m')} className={inp} value={rule.methods?.[0] ?? ''}
                    onChange={ev => update(i, r => ({ ...r, methods: ev.target.value ? [ev.target.value as (typeof METHODS)[number]] : [] }))}>
                    <option value="">{e.allMethods}</option>
                    {METHODS.map(m => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
                  </select>
                </label>
                <label className={lbl} htmlFor={fid('c')}>{e.ruleCategory}
                  <select id={fid('c')} className={inp} value={rule.risk.category}
                    onChange={ev => setRisk(i, { category: ev.target.value as QualificationRiskRule['risk']['category'] })}>
                    {QUALIFICATION_RISK_CATEGORIES.map(c => <option key={c} value={c}>{categories[c] ?? c}</option>)}
                  </select>
                </label>
                <label className={lbl} htmlFor={fid('g')}>{e.ruleGravity}
                  <select id={fid('g')} className={inp} value={rule.risk.gravity} onChange={ev => setRisk(i, { gravity: Number(ev.target.value) })}>
                    {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                <label className={lbl} htmlFor={fid('v')}>{e.ruleLikelihood}
                  <select id={fid('v')} className={inp} value={rule.risk.likelihood} onChange={ev => setRisk(i, { likelihood: Number(ev.target.value) })}>
                    {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                <label className={lbl} htmlFor={fid('s')}>{e.ruleStrategy}
                  <select id={fid('s')} className={inp} value={rule.risk.strategy}
                    onChange={ev => setRisk(i, { strategy: ev.target.value as QualificationRiskRule['risk']['strategy'] })}>
                    {QUALIFICATION_RISK_STRATEGIES.map(s => <option key={s} value={s}>{strategies[s] ?? s}</option>)}
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-300">
                <label className="inline-flex items-center gap-1.5">
                  <input type="checkbox" checked={rule.mandatory === true} onChange={ev => update(i, r => ({ ...r, mandatory: ev.target.checked }))} />
                  {e.ruleMandatory}
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input type="checkbox" checked={rule.enabled !== false} onChange={ev => update(i, r => ({ ...r, enabled: ev.target.checked }))} />
                  {e.ruleEnabled}
                </label>
              </div>
            </div>
          )
        })}
      </div>
      <button type="button" onClick={addRule} disabled={questions.length === 0} className="mt-2 btn-secondary text-sm inline-flex items-center gap-1 disabled:opacity-50">
        <Plus size={14} aria-hidden="true" /> {e.addRule}
      </button>
      <p className="mt-1 text-[11px] text-gray-400">{e.riskRulesHint}</p>
    </div>
  )
}
