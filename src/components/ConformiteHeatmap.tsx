import Link from 'next/link'

export interface HeatmapCell { taux: number; orgCount: number; evalues: number; total: number }
export interface HeatmapRow { orgId: string; nom: string; depth: number; cells: Record<string, HeatmapCell | undefined> }
export interface HeatmapRef { id: string; nom: string }

/** Couleur de fond d'une cellule selon le taux de conformité. */
function cellStyle(taux: number): string {
  if (taux >= 80) return 'bg-green-100 text-green-800'
  if (taux >= 60) return 'bg-lime-100 text-lime-800'
  if (taux >= 40) return 'bg-amber-100 text-amber-800'
  if (taux >= 20) return 'bg-orange-100 text-orange-800'
  return 'bg-red-100 text-red-800'
}

/**
 * Heatmap de conformité : lignes = organisations (indentées selon l'arbre),
 * colonnes = référentiels, cellules = taux agrégé (roll-up sous-arbre).
 * Présentational — libellés fournis par l'appelant.
 */
export default function ConformiteHeatmap({ rows, refs, orgCol, emptyLabel }: {
  rows: HeatmapRow[]
  refs: HeatmapRef[]
  orgCol: string
  emptyLabel: string
}) {
  if (rows.length === 0 || refs.length === 0) {
    return <p className="text-sm text-gray-500 italic">{emptyLabel}</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="text-left px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">{orgCol}</th>
            {refs.map(r => (
              <th key={r.id} className="px-2 py-1 text-xs font-semibold text-gray-500 text-center min-w-[80px]">{r.nom}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.orgId}>
              <td className="px-2 py-1 font-medium text-gray-800 whitespace-nowrap" style={{ paddingLeft: `${8 + row.depth * 16}px` }}>
                {row.depth > 0 && <span className="text-gray-300 mr-1" aria-hidden="true">└</span>}
                {row.nom}
              </td>
              {refs.map(r => {
                const c = row.cells[r.id]
                return (
                  <td key={r.id} className="text-center">
                    {c ? (
                      <Link
                        href={`/analyses`}
                        className={`inline-flex flex-col items-center rounded px-2 py-1 leading-tight ${cellStyle(c.taux)} hover:ring-1 hover:ring-gray-300`}
                        title={`${c.orgCount} org · ${c.evalues}/${c.total}`}
                      >
                        <span className="font-bold">{c.taux}%</span>
                        <span className="text-[9px] opacity-70">{c.evalues}/{c.total}</span>
                      </Link>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
