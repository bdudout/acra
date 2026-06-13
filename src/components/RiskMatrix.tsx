'use client'

import { buildRiskMatrixModel, resolveScaleConfig, type ScaleConfig } from '@/lib/risk-scale'
import { readableTextColor } from '@/lib/contrast-color'

interface RiskItem {
  nom: string
  vraisemblance: number
  gravite: number
}

/** Ajoute un canal alpha (hex 2 caractères) à une couleur hex #rrggbb. */
function withAlpha(hex: string, alpha: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? `${hex}${alpha}` : hex
}

/** Pastille numérotée d'un risque (R1, R2…) colorée selon son niveau. */
function RiskBadge({ refId, couleur, title }: { refId: string; couleur: string; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center justify-center min-w-[1.4rem] h-5 px-1 rounded text-[10px] font-bold leading-none"
      style={{ backgroundColor: couleur, color: readableTextColor(couleur) }}
    >
      {refId}
    </span>
  )
}

/**
 * Matrice des risques rendue dynamiquement à partir de la configuration
 * (échelles gravité/vraisemblance + seuils), administrable par l'ADMIN.
 * En l'absence de `config`, les valeurs par défaut (4 niveaux) s'appliquent.
 *
 * Chaque risque est représenté par une pastille numérotée (R1, R2…) dans la
 * cellule correspondante ; les libellés complets sont listés sous la matrice,
 * ce qui évite que des noms longs ne déforment la grille.
 */
export default function RiskMatrix({
  risks,
  config,
}: {
  risks: RiskItem[]
  config?: Partial<ScaleConfig> | null
}) {
  const model = buildRiskMatrixModel(config)
  const { graviteLevels } = model

  // Couleur (seuil) d'une cellule donnée
  const allCells = model.cells.flat()
  const cellColor = (v: number, g: number) =>
    allCells.find(c => c.vraisemblance === v && c.gravite === g)?.couleur ?? '#9ca3af'

  // Numérotation R1, R2… des risques, du plus critique au moins critique (score = G×V)
  const numbered = risks
    .map((r, idx) => ({ ...r, idx }))
    .sort((a, b) => (b.gravite * b.vraisemblance) - (a.gravite * a.vraisemblance) || a.idx - b.idx)
    .map((r, i) => ({ ...r, ref: `R${i + 1}`, couleur: cellColor(r.vraisemblance, r.gravite) }))

  // Légende : seuils distincts, ordonnés du moins grave au plus grave
  const legend = [...resolveScaleConfig(config).seuilsMatrice]
    .sort((a, b) => a.scoreMin - b.scoreMin)
    .map(s => ({ label: s.label, couleur: s.couleur }))

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse w-full max-w-lg" role="grid" aria-label="Matrice des risques — vraisemblance par gravité">
        <caption className="sr-only">
          Matrice des risques : chaque cellule liste les risques positionnés selon leur vraisemblance (lignes) et leur gravité (colonnes).
        </caption>
        <thead>
          <tr>
            <th scope="col" className="p-2 text-gray-500 text-left">
              <span className="sr-only">Vraisemblance / Gravité</span>
              <span aria-hidden="true">Vraisemblance ↕ / Gravité →</span>
            </th>
            {graviteLevels.map(g => (
              <th key={g.niveau} scope="col" className="p-2 text-center text-gray-600 font-medium w-24">
                {g.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {model.cells.map((row, ri) => {
            const vLabel = model.vraisemblanceLevels.find(v => v.niveau === row[0]?.vraisemblance)?.label ?? ''
            return (
              <tr key={ri}>
                <th scope="row" className="p-2 text-gray-600 font-medium text-right pr-4">
                  {vLabel}
                </th>
                {row.map(cell => {
                  const gLabel = graviteLevels.find(g => g.niveau === cell.gravite)?.label ?? ''
                  const inCell = numbered.filter(r => r.vraisemblance === cell.vraisemblance && r.gravite === cell.gravite)
                  return (
                    <td
                      key={cell.gravite}
                      className="p-2 border border-gray-200 align-top h-14 w-24"
                      style={{ backgroundColor: withAlpha(cell.couleur, '26') }}
                      aria-label={`Vraisemblance ${vLabel}, Gravité ${gLabel} (${cell.label}) — ${inCell.length === 0 ? 'aucun risque' : `${inCell.length} risque${inCell.length > 1 ? 's' : ''}`}`}
                    >
                      <div className="flex flex-wrap gap-1">
                        {inCell.map(r => (
                          <RiskBadge key={r.ref} refId={r.ref} couleur={r.couleur} title={r.nom} />
                        ))}
                      </div>
                      {inCell.length === 0 && <div className="opacity-0" aria-hidden="true">–</div>}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="flex items-center gap-3 flex-wrap mt-2" role="list" aria-label="Légende des niveaux de risque">
        {legend.map(({ couleur, label }) => (
          <div key={label} role="listitem" className="flex items-center gap-1 text-xs text-gray-500">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: couleur }} aria-hidden="true" />
            {label}
          </div>
        ))}
      </div>

      {numbered.length > 0 && (
        <ol className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1" aria-label="Libellés des risques">
          {numbered.map(r => (
            <li key={r.ref} className="flex items-start gap-2 text-xs text-gray-600">
              <RiskBadge refId={r.ref} couleur={r.couleur} />
              <span className="leading-5">{r.nom}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
