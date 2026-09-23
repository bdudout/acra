'use client'

// ─── Parcours d'analyse PAR PHASES — générique, piloté par le registre ───────
// Composant unique pour les méthodes phasées à saisie directe (ISO/IEC 27005:2022,
// NIST SP 800-30, et ISO 31000 ramené à une seule phase). Remplace les composants
// dédiés (Iso27005Workshop, Nist80030Workshop). Les phases + leur type viennent du
// registre (`lib/methodes.ts`) ; les libellés (résolus i18n) sont fournis par la
// page. Chaque phase se rend selon son `type` :
//   context = périmètre/objectifs · appreciation = registre éditable ·
//   review = registre lecture seule (priorisation) · note = conseils seuls.
// L'appréciation réutilise RisquesDirects (saisie directe gravité × vraisemblance).

import { useState } from 'react'
import RisquesDirects from '@/components/RisquesDirects'
import PhaseGuidance from '@/components/PhaseGuidance'
import ContexteEditor from '@/components/ContexteEditor'
import type { PhaseType, ApprMode } from '@/lib/methodes'
import type { RisqueExemple } from '@/lib/risque-exemples'

export interface WorkshopPhase {
  key: string
  type: PhaseType
  label: string
  /** Texte de conseils/description affiché au-dessus de la phase (optionnel). */
  desc?: string
  /** Conseils pédagogiques repliables (R2) : démarche de la phase. */
  guidance?: { intro?: string; points?: readonly string[] }
  /** Sous-mode d'appréciation (différenciation ISO 27005). */
  apprMode?: ApprMode
}

export default function PhasedRiskWorkshop({
  analyseId, editable, phases, perimetre, objectifs, perimetreLabel, objectifsLabel, noContext, phasesLabel,
  guidanceTitle, guidanceHide, guidanceShow, risqueSuggestions,
  contexteSave, contexteSaved, perimetrePlaceholder, objectifsPlaceholder, initialPhaseKey,
  withVulnerabilites,
}: {
  analyseId: string
  editable: boolean
  /** Active la saisie des vulnérabilités (ISO 27005) en phase d'identification. */
  withVulnerabilites?: boolean
  phases: WorkshopPhase[]
  perimetre?: string | null
  objectifs?: string | null
  perimetreLabel?: string
  objectifsLabel?: string
  noContext?: string
  phasesLabel?: string
  guidanceTitle?: string
  guidanceHide?: string
  guidanceShow?: string
  /** Suggestions de risques sectoriels (R3) — proposées en phase d'appréciation. */
  risqueSuggestions?: RisqueExemple[]
  /** Libellés d'édition du contexte (phase « context » éditable). */
  contexteSave?: string
  contexteSaved?: string
  perimetrePlaceholder?: string
  objectifsPlaceholder?: string
  /** Ouvre directement cette phase (deep-link `?phase=`), ex. depuis le registre. */
  initialPhaseKey?: string
}) {
  const initialIndex = initialPhaseKey ? phases.findIndex(p => p.key === initialPhaseKey) : -1
  const [active, setActive] = useState(initialIndex >= 0 ? initialIndex : 0)
  const phase = phases[active] ?? phases[0]
  const multi = phases.length > 1

  return (
    <div>
      {multi && (
        <nav className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700 mb-5" aria-label={phasesLabel}>
          {phases.map((ph, i) => (
            <button key={ph.key} onClick={() => setActive(i)}
              className={`px-3 py-2 text-sm font-medium rounded-t-lg -mb-px border-b-2 ${
                i === active ? 'border-ebios-600 text-ebios-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              <span className="text-xs text-gray-400 mr-1">{i + 1}</span>{ph.label}
            </button>
          ))}
        </nav>
      )}

      {phase.guidance && (guidanceTitle !== undefined) && (
        <PhaseGuidance
          intro={phase.guidance.intro} points={phase.guidance.points}
          title={guidanceTitle} hideLabel={guidanceHide ?? ''} showLabel={guidanceShow ?? guidanceTitle}
        />
      )}

      {phase.type === 'context' ? (
        <section className="card p-6">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-1">{phase.label}</h2>
          {phase.desc && <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{phase.desc}</p>}
          {editable && contexteSave !== undefined ? (
            // Contexte ÉDITABLE (périmètre + objectifs/critères) — persistance PATCH.
            <ContexteEditor
              analyseId={analyseId} perimetre={perimetre} objectifs={objectifs}
              perimetreLabel={perimetreLabel ?? ''} objectifsLabel={objectifsLabel ?? ''}
              perimetrePlaceholder={perimetrePlaceholder} objectifsPlaceholder={objectifsPlaceholder}
              save={contexteSave} saved={contexteSaved ?? ''}
            />
          ) : (
            <dl className="space-y-3">
              <div>
                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">{perimetreLabel}</dt>
                <dd className="text-sm text-gray-800 dark:text-gray-200 mt-0.5 whitespace-pre-wrap">{perimetre?.trim() || <span className="text-gray-400 italic">{noContext}</span>}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">{objectifsLabel}</dt>
                <dd className="text-sm text-gray-800 dark:text-gray-200 mt-0.5 whitespace-pre-wrap">{objectifs?.trim() || <span className="text-gray-400 italic">{noContext}</span>}</dd>
              </div>
            </dl>
          )}
        </section>
      ) : phase.type === 'note' ? (
        <section className="card p-6">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-1">{phase.label}</h2>
          {phase.desc && <p className="text-sm text-gray-500 dark:text-gray-400">{phase.desc}</p>}
        </section>
      ) : (
        <>
          {phase.desc && <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{phase.desc}</p>}
          {/* appreciation = éditable ; review = lecture seule (priorisation +
              décision d'acceptation). Le sous-mode (identify/rate/treat) différencie
              les phases d'appréciation ISO 27005. */}
          <RisquesDirects analyseId={analyseId} editable={editable && phase.type !== 'review'}
            mode={phase.type === 'review' ? 'review' : (phase.apprMode ?? 'full')}
            withVulnerabilites={withVulnerabilites}
            suggestions={phase.type !== 'review' ? risqueSuggestions : undefined} />
        </>
      )}
    </div>
  )
}
