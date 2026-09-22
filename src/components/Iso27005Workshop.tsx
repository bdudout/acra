'use client'

// ─── Parcours ISO/IEC 27005:2022 — processus par PHASES ──────────────────────
// Contrairement à ISO 31000 (écran unique), ISO 27005 suit le processus par
// phases : établissement du contexte → identification → analyse → évaluation →
// traitement. Chaque phase est un onglet ; l'appréciation (identification/analyse/
// évaluation/traitement) réutilise le registre de risques à saisie directe
// (RisquesDirects). Les libellés de phases sont à aligner sur ISO/IEC 27005:2022
// (traduction AFNOR) — cf. docs/methodes-analyse-cadrage.md.

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import RisquesDirects from '@/components/RisquesDirects'

type Phase = 'contexte' | 'identification' | 'analyse' | 'evaluation' | 'traitement'
const PHASES: Phase[] = ['contexte', 'identification', 'analyse', 'evaluation', 'traitement']

export default function Iso27005Workshop({
  analyseId, editable, perimetre, objectifs,
}: { analyseId: string; editable: boolean; perimetre?: string | null; objectifs?: string | null }) {
  const { t } = useTranslation()
  const p = t.iso27005
  const [phase, setPhase] = useState<Phase>('contexte')

  return (
    <div>
      {/* Onglets de phases (processus ISO 27005) */}
      <nav className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700 mb-5" aria-label={p.phasesLabel}>
        {PHASES.map((ph, i) => (
          <button key={ph} onClick={() => setPhase(ph)}
            className={`px-3 py-2 text-sm font-medium rounded-t-lg -mb-px border-b-2 ${
              phase === ph ? 'border-ebios-600 text-ebios-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <span className="text-xs text-gray-400 mr-1">{i + 1}</span>{p.phases[ph]}
          </button>
        ))}
      </nav>

      {phase === 'contexte' ? (
        <section className="card p-6">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-1">{p.phases.contexte}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{p.contexteDesc}</p>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">{p.perimetreLabel}</dt>
              <dd className="text-sm text-gray-800 dark:text-gray-200 mt-0.5 whitespace-pre-wrap">{perimetre?.trim() || <span className="text-gray-400 italic">{p.noContext}</span>}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">{p.objectifsLabel}</dt>
              <dd className="text-sm text-gray-800 dark:text-gray-200 mt-0.5 whitespace-pre-wrap">{objectifs?.trim() || <span className="text-gray-400 italic">{p.noContext}</span>}</dd>
            </div>
          </dl>
        </section>
      ) : (
        <>
          {phase === 'evaluation' && <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{p.evaluationNote}</p>}
          {/* Appréciation : même registre de risques, en lecture seule pour l'évaluation (priorisation). */}
          <RisquesDirects analyseId={analyseId} editable={editable && phase !== 'evaluation'} />
        </>
      )}
    </div>
  )
}
