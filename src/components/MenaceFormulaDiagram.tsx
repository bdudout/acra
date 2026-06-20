'use client'

/**
 * MenaceFormulaDiagram — Schéma HTML expliquant le calcul du niveau de menace
 * d'une partie prenante (méthode Club EBIOS, Fiche méthode 5) :
 *
 *   menace = (Dépendance × Pénétration) / (Maturité cyber × Confiance)
 *
 * Reproduit en HTML/Tailwind (pas une image) le schéma de la fiche méthode,
 * avec le détail de chaque multiplication. Compatible thème clair/sombre.
 */
import { useTranslation } from '@/lib/i18n/context'

function Critere({ titre, question }: { titre: string; question: string }) {
  return (
    <div className="flex-1 rounded-md border border-sky-100 bg-sky-50 p-2.5 text-left dark:border-slate-600 dark:bg-slate-800">
      <div className="text-xs font-bold text-gray-800 dark:text-gray-100">{titre}</div>
      <div className="mt-0.5 text-[10px] leading-snug text-gray-600 dark:text-gray-300">{question}</div>
    </div>
  )
}

/** Un groupe = deux critères reliés par « × » (exposition ou fiabilité). */
function Groupe({ titre, gauche, droite }: { titre: string; gauche: { t: string; q: string }; droite: { t: string; q: string } }) {
  return (
    <div>
      <div className="mb-1.5 rounded bg-slate-700 py-1 text-[10px] font-semibold uppercase tracking-wide text-white dark:bg-slate-600">{titre}</div>
      <div className="flex items-stretch gap-1.5">
        <Critere titre={gauche.t} question={gauche.q} />
        <span className="flex items-center text-lg font-bold text-gray-400 dark:text-gray-500" aria-hidden="true">×</span>
        <Critere titre={droite.t} question={droite.q} />
      </div>
    </div>
  )
}

export default function MenaceFormulaDiagram() {
  const { t } = useTranslation()
  const a3 = t.workshop.a3
  const r = a3.radar
  return (
    <div className="text-center">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Groupe titre={r.formulaExpoTitle}
          gauche={{ t: a3.ppDependanceLabel, q: r.formulaDepQ }}
          droite={{ t: a3.ppPenetrationLabel, q: r.formulaPenQ }} />
        <Groupe titre={r.formulaFiabTitle}
          gauche={{ t: a3.ppMaturiteLabel, q: r.formulaMatQ }}
          droite={{ t: a3.ppConfianceLabel, q: r.formulaConfQ }} />
      </div>

      <div aria-hidden="true" className="my-1 text-lg leading-none text-gray-300 dark:text-gray-600">↓</div>

      {/* Niveau de menace = exposition / fiabilité (fraction) */}
      <div className="inline-block rounded-md bg-purple-800 px-5 py-2 text-white dark:bg-purple-700">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide">{r.formulaMenaceTitle}</div>
        <div className="inline-flex flex-col items-center text-[11px]">
          <span className="px-2 py-0.5">{a3.ppDependanceLabel} × {a3.ppPenetrationLabel}</span>
          <span className="my-px h-px w-full bg-white/70" />
          <span className="px-2 py-0.5">{a3.ppMaturiteLabel} × {a3.ppConfianceLabel}</span>
        </div>
      </div>
    </div>
  )
}
