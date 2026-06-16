'use client'

/**
 * EcosystemRadar — Radar de menace de l'écosystème (Atelier 3 EBIOS RM).
 *
 * Diagramme polaire : chaque partie prenante est positionnée par son niveau de
 * menace (centre = menace maximale), regroupée par catégorie en secteurs angulaires,
 * et colorée selon sa zone (danger / contrôle / veille). La géométrie pure provient de
 * src/lib/ecosystem-radar.ts (testée). Le composant ne fait que rendre du SVG.
 *
 * Cohérence : zones et menace identiques au calcul vulnerabilite déjà affiché en listes.
 */
import { useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import {
  layoutStakeholders,
  presentTypes,
  zoneRadii,
  polarToXY,
  type RadarPoint,
  type EcosystemZone,
} from '@/lib/ecosystem-radar'

interface PartieLike {
  id: string
  nom: string
  type: string
  exposition: number
  fiabilite: number
}

interface Props {
  parties: PartieLike[]
  /** Optionnel : notifié au clic sur un point (ex. faire défiler vers la carte PP). */
  onSelect?: (id: string) => void
}

const CX = 240, CY = 240, R_MAX = 190
const ZONE_COLOR: Record<EcosystemZone, string> = {
  danger:   '#dc2626', // red-600
  controle: '#d97706', // amber-600
  veille:   '#16a34a', // green-600
}

export default function EcosystemRadar({ parties, onSelect }: Props) {
  const { t } = useTranslation()
  const r = t.workshop.a3.radar
  const ppTypes = t.workshop.a3.ppTypes as Record<string, string>
  const [active, setActive] = useState<RadarPoint | null>(null)

  if (!parties.length) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
        {r.empty}
      </div>
    )
  }

  const geom = { cx: CX, cy: CY, rMax: R_MAX }
  const points = layoutStakeholders(parties, geom)
  const types = presentTypes(parties)
  const rings = zoneRadii(R_MAX)
  const n = types.length
  const sectorWidth = 360 / n

  const typeLabel = (ty: string) => ppTypes[ty] ?? ty
  // Libellé de secteur tronqué pour ne pas déborder du SVG (nom complet en <title>).
  const shortLabel = (s: string) => (s.length > 14 ? s.slice(0, 13) + '…' : s)

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-1 font-semibold text-gray-800">{r.title}</h3>
      <p className="mb-3 text-xs text-gray-500">{r.hint}</p>

      <div className="flex flex-col items-center gap-4 md:flex-row md:items-start">
        <svg
          viewBox="-58 0 596 480"
          className="w-full max-w-[480px] shrink-0"
          role="img"
          aria-label={r.title}
        >
          <title>{r.title}</title>
          <desc>{r.hint}</desc>

          {/* Zones concentriques : veille (extérieur) → contrôle → danger (centre) */}
          <circle cx={CX} cy={CY} r={rings.rim} fill={ZONE_COLOR.veille} fillOpacity={0.1}
            stroke={ZONE_COLOR.veille} strokeOpacity={0.3} />
          <circle cx={CX} cy={CY} r={rings.controle} fill={ZONE_COLOR.controle} fillOpacity={0.14}
            stroke={ZONE_COLOR.controle} strokeOpacity={0.35} />
          <circle cx={CX} cy={CY} r={rings.danger} fill={ZONE_COLOR.danger} fillOpacity={0.18}
            stroke={ZONE_COLOR.danger} strokeOpacity={0.45} />

          {/* Séparateurs de secteurs + libellés de catégorie au bord */}
          {types.map((ty, i) => {
            const boundary = (i - 0.5) * sectorWidth
            const [bx, by] = polarToXY(R_MAX, boundary, CX, CY)
            const [lx, ly] = polarToXY(R_MAX + 20, i * sectorWidth, CX, CY)
            const anchor = Math.abs(lx - CX) < 8 ? 'middle' : lx < CX ? 'end' : 'start'
            return (
              <g key={ty}>
                {n > 1 && (
                  <line x1={CX} y1={CY} x2={bx} y2={by}
                    stroke="#9ca3af" strokeOpacity={0.3} strokeDasharray="3 3" />
                )}
                <text x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle"
                  className="fill-gray-500" fontSize={10.5}>
                  {shortLabel(typeLabel(ty))}
                  <title>{typeLabel(ty)}</title>
                </text>
              </g>
            )
          })}

          {/* Points = parties prenantes */}
          {points.map(p => {
            const isActive = active?.id === p.id
            return (
              <circle
                key={p.id}
                cx={p.x} cy={p.y} r={isActive ? 9 : 6.5}
                fill={ZONE_COLOR[p.zone]}
                stroke="#ffffff" strokeWidth={1.5}
                className="cursor-pointer transition-all"
                tabIndex={0}
                role="button"
                aria-label={`${p.nom} — ${typeLabel(p.type)} — ${r.menaceLabel} ${p.menace}/16`}
                onMouseEnter={() => setActive(p)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(p)}
                onBlur={() => setActive(null)}
                onClick={() => onSelect?.(p.id)}
              />
            )
          })}
        </svg>

        {/* Légende + détail du point survolé */}
        <div className="w-full md:w-48">
          <div className="space-y-1.5">
            {([
              ['danger', r.zoneDanger],
              ['controle', r.zoneControle],
              ['veille', r.zoneVeille],
            ] as [EcosystemZone, string][]).map(([z, label]) => (
              <div key={z} className="flex items-center gap-2 text-xs text-gray-600">
                <span className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: ZONE_COLOR[z] }} aria-hidden="true" />
                {label}
                <span className="ml-auto text-gray-400">
                  {points.filter(p => p.zone === z).length}
                </span>
              </div>
            ))}
          </div>

          {active && (
            <div className="mt-4 rounded-md border border-gray-100 bg-gray-50 p-2.5 text-xs">
              <div className="font-semibold text-gray-800">{active.nom}</div>
              <div className="text-gray-500">{typeLabel(active.type)}</div>
              <div className="mt-1 text-gray-600">
                {t.workshop.a3.ppExpLabel}: {active.exposition}/4 · {t.workshop.a3.ppFiabLabel}: {active.fiabilite}/4
              </div>
              <div className="font-medium" style={{ color: ZONE_COLOR[active.zone] }}>
                {r.menaceLabel}: {active.menace}/16
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
