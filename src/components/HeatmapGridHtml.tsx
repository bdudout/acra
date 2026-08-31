'use client'

import type { HeatGrid } from '@/lib/carto-export'

// Heatmap gravité × vraisemblance en HTML (cockpit /pilotage, #136). Pendant du
// composant PDF `pdf-heatmap.tsx` — même sémantique de couleur (vert/orange/rouge).
function cellClass(bucket: string | undefined): string {
  return bucket === 'eleve' ? 'bg-red-600'
    : bucket === 'moyen' ? 'bg-amber-500'
    : bucket === 'faible' ? 'bg-green-600'
    : 'bg-gray-100 dark:bg-gray-800'
}

export default function HeatmapGridHtml({ grid, axisLabel }: { grid?: HeatGrid; axisLabel: string }) {
  if (!grid?.gravites?.length) return null
  return (
    <div className="inline-block">
      {grid.gravites.map(g => (
        <div key={g} className="flex">
          <div className="w-5 h-8 flex items-center justify-center text-[10px] text-gray-400">{g}</div>
          {grid.vraisemblances.map(v => {
            const n = grid.counts[g]?.[v] ?? 0
            return (
              <div key={v}
                className={`w-11 h-8 flex items-center justify-center text-xs font-bold text-white border border-white dark:border-gray-900 ${cellClass(grid.buckets[g]?.[v])}`}>
                {n > 0 ? n : ''}
              </div>
            )
          })}
        </div>
      ))}
      <div className="flex">
        <div className="w-5" />
        {grid.vraisemblances.map(v => (
          <div key={v} className="w-11 h-5 flex items-center justify-center text-[10px] text-gray-400">{v}</div>
        ))}
      </div>
      <p className="text-[10px] text-gray-400 mt-1 ml-5">{axisLabel}</p>
    </div>
  )
}
