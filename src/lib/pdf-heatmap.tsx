// ─── Heatmap gravité × vraisemblance — composant PDF RÉUTILISABLE (#134 M5) ──
// Matrice colorée (vert/orange/rouge) partagée par le PDF cartographie ET le pack
// comité, pour que le décideur voie la carte des risques, pas seulement des chiffres.
// Compilé dans chaque template par esbuild (compile-pdf-template.mjs).

import { View, Text, StyleSheet } from '@react-pdf/renderer'
import type { HeatGrid } from '@/lib/carto-export'

const HEAT = { eleve: '#DC2626', moyen: '#D97706', faible: '#16A34A', empty: '#F3F4F6' }

/** Couleur d'une cellule de heatmap selon son palier de risque. Pur → testable. */
export function heatCellColor(bucket: string | undefined): string {
  if (bucket === 'eleve') return HEAT.eleve
  if (bucket === 'moyen') return HEAT.moyen
  if (bucket === 'faible') return HEAT.faible
  return HEAT.empty
}

/**
 * Rend la matrice gravité (lignes, forte→faible) × vraisemblance (colonnes, 1→N),
 * cellules colorées par palier avec le compte. `cellWidth`/`cellHeight` permettent
 * une version compacte (pack comité) ou large (cartographie).
 */
export function HeatmapGrid({ grid, axisLabel, cellWidth = 46, cellHeight = 26 }: {
  grid: HeatGrid; axisLabel: string; cellWidth?: number; cellHeight?: number
}) {
  const axisW = 18
  const fs = cellHeight <= 20 ? 8 : 9
  return (
    <View wrap={false}>
      {grid.gravites.map(g => (
        <View key={`g${g}`} style={{ flexDirection: 'row' }}>
          <View style={{ width: axisW, height: cellHeight, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 7, color: '#6B7280' }}>{String(g)}</Text>
          </View>
          {grid.vraisemblances.map(v => {
            const n = grid.counts[g]?.[v] ?? 0
            return (
              <View key={`c${g}-${v}`} style={{ width: cellWidth, height: cellHeight, borderWidth: 1, borderColor: '#FFFFFF', backgroundColor: heatCellColor(grid.buckets[g]?.[v]), alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: fs, fontWeight: 'bold', color: '#FFFFFF' }}>{n > 0 ? String(n) : ' '}</Text>
              </View>
            )
          })}
        </View>
      ))}
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: axisW, height: cellHeight }}><Text style={{ fontSize: 7 }}>{' '}</Text></View>
        {grid.vraisemblances.map(v => (
          <View key={`v${v}`} style={{ width: cellWidth, height: cellHeight, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 7, color: '#6B7280' }}>{String(v)}</Text>
          </View>
        ))}
      </View>
      <Text style={{ fontSize: 7, color: '#6B7280', marginTop: 3, marginLeft: axisW }}>{axisLabel}</Text>
    </View>
  )
}
