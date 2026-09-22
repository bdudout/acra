'use client'

// ─── Parcours NIST SP 800-30 Rev. 1 — processus par PHASES ───────────────────
// Étapes officielles : Prepare → Conduct → Communicate → Maintain. L'appréciation
// (Conduct : threat source → threat event → vulnerability → likelihood → impact →
// risk) réutilise le registre de risques à saisie directe (RisquesDirects) ;
// Communicate présente les résultats en lecture seule ; Maintain permet de tenir
// l'appréciation à jour. Libellés officiels NIST (US, pas de traduction).

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import RisquesDirects from '@/components/RisquesDirects'

type Phase = 'prepare' | 'conduct' | 'communicate' | 'maintain'
const PHASES: Phase[] = ['prepare', 'conduct', 'communicate', 'maintain']

export default function Nist80030Workshop({
  analyseId, editable, perimetre, objectifs,
}: { analyseId: string; editable: boolean; perimetre?: string | null; objectifs?: string | null }) {
  const { t } = useTranslation()
  const n = t.nist80030
  const [phase, setPhase] = useState<Phase>('prepare')

  return (
    <div>
      <nav className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700 mb-5" aria-label={n.phasesLabel}>
        {PHASES.map((ph, i) => (
          <button key={ph} onClick={() => setPhase(ph)}
            className={`px-3 py-2 text-sm font-medium rounded-t-lg -mb-px border-b-2 ${
              phase === ph ? 'border-ebios-600 text-ebios-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <span className="text-xs text-gray-400 mr-1">{i + 1}</span>{n.phases[ph]}
          </button>
        ))}
      </nav>

      {phase === 'prepare' ? (
        <section className="card p-6">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-1">{n.phases.prepare}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{n.prepareDesc}</p>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">{n.perimetreLabel}</dt>
              <dd className="text-sm text-gray-800 dark:text-gray-200 mt-0.5 whitespace-pre-wrap">{perimetre?.trim() || <span className="text-gray-400 italic">{n.noContext}</span>}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">{n.objectifsLabel}</dt>
              <dd className="text-sm text-gray-800 dark:text-gray-200 mt-0.5 whitespace-pre-wrap">{objectifs?.trim() || <span className="text-gray-400 italic">{n.noContext}</span>}</dd>
            </div>
          </dl>
        </section>
      ) : (
        <>
          {phase === 'communicate' && <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{n.communicateNote}</p>}
          {phase === 'maintain' && <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{n.maintainNote}</p>}
          {/* Conduct/Maintain : appréciation éditable ; Communicate : lecture seule. */}
          <RisquesDirects analyseId={analyseId} editable={editable && phase !== 'communicate'} />
        </>
      )}
    </div>
  )
}
