'use client'

/**
 * MenaceFormulaDiagram — Schéma HTML expliquant le calcul du niveau de menace
 * d'une partie prenante (méthode Club EBIOS, Fiche méthode 5) :
 *
 *   menace = (Dépendance × Pénétration) / (Maturité cyber × Confiance)
 *
 * Reproduit en HTML/Tailwind (pas une image) le schéma de la fiche méthode.
 * Affiché dans la légende dépliable du radar d'écosystème.
 */
import { useTranslation } from '@/lib/i18n/context'

function Critere({ titre, question }: { titre: string; question: string }) {
  return (
    <div className="flex-1 rounded-md border border-sky-100 bg-sky-50 p-2.5 text-left">
      <div className="text-xs font-bold text-gray-800">{titre}</div>
      <div className="mt-0.5 text-[10px] leading-snug text-gray-500">{question}</div>
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
        {/* Exposition numérique = Dépendance × Pénétration */}
        <div>
          <div className="mb-1.5 rounded bg-slate-700 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">{r.formulaExpoTitle}</div>
          <div className="flex gap-2">
            <Critere titre={a3.ppDependanceLabel} question={r.formulaDepQ} />
            <Critere titre={a3.ppPenetrationLabel} question={r.formulaPenQ} />
          </div>
        </div>
        {/* Fiabilité numérique = Maturité cyber × Confiance */}
        <div>
          <div className="mb-1.5 rounded bg-slate-700 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">{r.formulaFiabTitle}</div>
          <div className="flex gap-2">
            <Critere titre={a3.ppMaturiteLabel} question={r.formulaMatQ} />
            <Critere titre={a3.ppConfianceLabel} question={r.formulaConfQ} />
          </div>
        </div>
      </div>

      <div aria-hidden="true" className="my-1 text-lg leading-none text-gray-300">↓</div>

      {/* Niveau de menace = exposition / fiabilité (fraction) */}
      <div className="inline-block rounded-md bg-purple-800 px-5 py-2 text-white">
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
