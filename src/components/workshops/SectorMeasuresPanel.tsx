'use client'
// ─── Atelier 5 : mesures proposées pour le secteur / sous-secteur de l'analyse ─
// Suggestions issues des packs sectoriels (exemples-sectoriels*.ts, catégorie `mesures`) :
// chaque mesure s'ajoute au plan de traitement en un clic (pré-remplie, modifiable),
// jamais automatiquement. Les références citent un texte et sa version.

import { Lightbulb } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import PertinenceBadge from '@/components/workshops/PertinenceBadge'

export interface SectorMeasure {
  nom?: unknown
  description?: unknown
  type?: unknown
  categorieEbios?: unknown
  prioriteDefaut?: unknown
  references?: unknown
  pertinence?: unknown
  patternsPertinents?: unknown
}

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase()

export default function SectorMeasuresPanel({ items, existingNames, onAdd }: {
  items: SectorMeasure[]
  /** Intitulés des mesures déjà au plan (pour marquer « ajoutée »). */
  existingNames: string[]
  onAdd: (m: SectorMeasure) => void
}) {
  const { t } = useTranslation()
  if (!items.length) return null
  const a5 = t.workshop.a5
  const present = new Set(existingNames.map(norm))
  const cats = a5.measureCategories as Record<string, string>
  const types = a5.measureTypes as Record<string, string>
  return (
    <div className="card p-5 border-l-4 border-l-indigo-400">
      <h3 className="font-semibold text-gray-800 mb-1"><Lightbulb size={18} className="inline align-[-0.15em] mr-2" aria-hidden="true" /> {a5.sectorMeasTitle}</h3>
      <p className="text-xs text-gray-500 mb-3">{a5.sectorMeasIntro}</p>
      <ul className="space-y-2">
        {items.map((m, i) => {
          const done = present.has(norm(m.nom))
          const refs = Array.isArray(m.references) ? (m.references as string[]) : []
          return (
            <li key={`${norm(m.nom)}-${i}`} className="flex items-start justify-between gap-3">
              <div className="text-sm text-gray-700 min-w-0">
                {!done && <PertinenceBadge ex={m} className="text-[11px] mb-0.5" />}
                <span className="text-xs font-semibold text-indigo-700 mr-1.5">P{Number(m.prioriteDefaut) || 2}</span>
                <span className="font-medium">{String(m.nom ?? '')}</span>
                <span className="ml-1.5 text-xs text-gray-400">
                  {cats[String(m.categorieEbios)] ?? String(m.categorieEbios ?? '')} · {types[String(m.type)] ?? String(m.type ?? '')}
                </span>
                {m.description ? <p className="text-xs text-gray-500">{String(m.description)}</p> : null}
                {refs.length > 0 && <p className="text-xs text-gray-400">{a5.sectorMeasRefs} : {refs.join(' ; ')}</p>}
              </div>
              {done ? (
                <span className="text-xs text-green-600 font-medium shrink-0 mt-0.5">✓ {a5.sectorMeasAdded}</span>
              ) : (
                <button type="button" onClick={() => onAdd(m)} className="text-xs text-ebios-600 hover:text-ebios-800 font-medium shrink-0 mt-0.5 whitespace-nowrap">
                  + {a5.sectorMeasAdd}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
