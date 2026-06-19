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
  fiabiliteLevel,
  expositionLevel,
  type RadarPoint,
  type EcosystemZone,
} from '@/lib/ecosystem-radar'
import { resolveEchelles, bornesMenace, type EchellesEcosysteme } from '@/lib/ecosystem-echelles'

interface PartieLike {
  id: string
  nom: string
  type: string
  exposition: number
  fiabilite: number
  dependance?: number
  penetration?: number
  maturite?: number
  confiance?: number
  critique?: boolean
}

interface Props {
  parties: PartieLike[]
  /** Optionnel : notifié au clic sur un point (ex. faire défiler vers la carte PP). */
  onSelect?: (id: string) => void
  /** Affiche les références T1, T2… à côté des points (défaut true). À désactiver
   *  pour un radar dense sans tableau de correspondance (ex. dashboard). */
  showRefs?: boolean
  /** Masque le titre interne du composant (ex. quand la carte parente l'affiche déjà). */
  hideHeader?: boolean
  /** Échelles de cotation (pour adapter le rayon/les seuils) ; défauts 1→4 si absent. */
  echelles?: EchellesEcosysteme
}

const CX = 240, CY = 240, R_MAX = 190
// Couleur des ANNEAUX de zone (du centre vers le bord) : danger=orange, contrôle=jaune, veille=vert.
const ZONE_COLOR: Record<EcosystemZone, string> = {
  danger:   '#ea580c', // orange-600
  controle: '#eab308', // yellow-500
  veille:   '#16a34a', // green-600
}
// Couleur d'un POINT selon sa fiabilité cyber (niveau 0..3 : rouge → vert).
const FIAB_COLOR = ['#dc2626', '#ea580c', '#eab308', '#16a34a']
// Rayon d'un POINT selon son exposition (niveau 0..3 : croissant) — grossis (méthodologie).
const EXPO_RADIUS = [7, 9, 11.5, 14]
const STAR_COLOR = '#f59e0b' // amber-500 (tiers critique)

export default function EcosystemRadar({ parties, onSelect, showRefs = true, hideHeader = false, echelles }: Props) {
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

  // Bornes de menace dérivées des échelles (rayon adapté à l'échelle).
  const bornes = bornesMenace(echelles ?? resolveEchelles(null))
  const geom = { cx: CX, cy: CY, rMax: R_MAX }
  const points = layoutStakeholders(parties, geom, { menaceMin: bornes.menaceMin, menaceMax: bornes.menaceMax })
  const types = presentTypes(parties)
  const rings = zoneRadii(R_MAX, bornes.menaceMin, bornes.menaceMax)
  const n = types.length
  const sectorWidth = 360 / n
  const shortName = (s: string) => (s.length > 16 ? s.slice(0, 15) + '…' : s)

  const typeLabel = (ty: string) => ppTypes[ty] ?? ty
  // Libellé de secteur tronqué pour ne pas déborder du SVG (nom complet en <title>).
  const shortLabel = (s: string) => (s.length > 14 ? s.slice(0, 13) + '…' : s)

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      {!hideHeader && <h3 className="mb-3 font-semibold text-gray-800">{r.title}</h3>}

      <div className="flex flex-col items-center gap-4">
        <svg
          viewBox="-58 0 596 480"
          className="w-full max-w-[520px] mx-auto"
          role="img"
          aria-label={r.title}
        >
          <title>{r.title}</title>
          <desc>{r.hint}</desc>

          {/* 3 anneaux concentriques : veille (extérieur, = bord) → contrôle → danger (centre).
              Tracés du plus grand au plus petit (le plus petit recouvre). */}
          <circle cx={CX} cy={CY} r={rings.rim} fill={ZONE_COLOR.veille} fillOpacity={0.10}
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
                    stroke="#6b7280" strokeOpacity={0.6} strokeWidth={1.3} strokeDasharray="5 3" />
                )}
                <text x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle"
                  className="fill-gray-500" fontSize={10.5}>
                  {shortLabel(typeLabel(ty))}
                  <title>{typeLabel(ty)}</title>
                </text>
              </g>
            )
          })}

          {/* Points = parties prenantes. Couleur = fiabilité · taille = exposition ·
              ★ = tiers critique · nom affiché si critique ou zone danger/contrôle. */}
          {points.map(p => {
            const isActive = active?.id === p.id
            const baseR = EXPO_RADIUS[expositionLevel(p.exposition, bornes.maxExpo)]
            const fill = FIAB_COLOR[fiabiliteLevel(p.fiabilite, bornes.maxFiab)]
            // Libellé à droite du point : nom (tronqué) si pertinent, sinon référence T1…
            const sideLabel = p.showLabel ? shortName(p.nom) : (showRefs ? p.ref : '')
            return (
              <g
                key={p.id}
                className="cursor-pointer"
                tabIndex={0}
                role="button"
                aria-label={`${p.ref} — ${p.nom}${p.critique ? ' ★' : ''} — ${typeLabel(p.type)} — ${r.menaceLabel} ${p.menace.toFixed(2)}`}
                onMouseEnter={() => setActive(p)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(p)}
                onBlur={() => setActive(null)}
                onClick={() => onSelect?.(p.id)}
              >
                <circle
                  cx={p.x} cy={p.y} r={isActive ? baseR + 2.5 : baseR}
                  fill={fill}
                  stroke="#ffffff" strokeWidth={1.5}
                  className="transition-all"
                />
                {/* Étoile centrée sur le point pour un tiers critique */}
                {p.critique && (
                  <text
                    x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central"
                    fontSize={baseR * 1.7} fill={STAR_COLOR}
                    stroke="#ffffff" strokeWidth={0.8} paintOrder="stroke"
                    style={{ pointerEvents: 'none' }}
                  >
                    ★
                  </text>
                )}
                {/* Libellé à côté du point — halo blanc pour rester lisible sur les zones */}
                {sideLabel && (
                  <text
                    x={p.x + baseR + 3} y={p.y + 3.5}
                    fontSize={isActive ? 11 : (p.showLabel ? 9 : 9.5)} fontWeight={700}
                    fill="#1f2937" stroke="#ffffff" strokeWidth={2.5}
                    paintOrder="stroke"
                    style={{ pointerEvents: 'none' }}
                  >
                    {sideLabel}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {/* Légende (sous le radar) + détail du point survolé */}
        <div className="w-full border-t border-gray-100 pt-3">
          <div className="flex flex-wrap justify-center gap-x-10 gap-y-3">
            {/* Anneaux = zones de menace (3 zones) */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{r.legendZonesTitle}</div>
              {([
                ['danger', r.zoneDanger],
                ['controle', r.zoneControle],
                ['veille', r.zoneVeille],
              ] as [EcosystemZone, string][]).map(([z, label]) => (
                <div key={z} className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: ZONE_COLOR[z] }} aria-hidden="true" />
                  {label}
                  <span className="ml-auto pl-3 text-gray-400">
                    {points.filter(p => p.zone === z).length}
                  </span>
                </div>
              ))}
            </div>

            {/* Points : couleur = fiabilité · taille = exposition · ★ = critique */}
            <div className="space-y-1 text-[11px] text-gray-500">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{r.legendPointsTitle}</div>
              <div className="flex items-center gap-1.5">
                <span className="flex gap-0.5" aria-hidden="true">
                  {FIAB_COLOR.map(c => <span key={c} className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c }} />)}
                </span>
                {r.colorLegend}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="flex items-end gap-0.5" aria-hidden="true">
                  {EXPO_RADIUS.map((rr, i) => <span key={i} className="inline-block rounded-full bg-gray-400" style={{ width: rr, height: rr }} />)}
                </span>
                {r.sizeLegend}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 text-center" style={{ color: STAR_COLOR }} aria-hidden="true">★</span>
                {r.critiqueLegend}
              </div>
            </div>
          </div>

          {active && (
            <div className="mt-4 rounded-md border border-gray-100 bg-gray-50 p-2.5 text-xs">
              <div className="font-semibold text-gray-800">
                <span className="mr-1.5 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold text-gray-700">{active.ref}</span>
                {active.nom}
              </div>
              <div className="text-gray-500">{typeLabel(active.type)}</div>
              <div className="mt-1 text-gray-600">
                {t.workshop.a3.ppDependanceLabel} {active.dependance.toFixed(1)} · {t.workshop.a3.ppPenetrationLabel} {active.penetration.toFixed(1)} · {t.workshop.a3.ppMaturiteLabel} {active.maturite.toFixed(1)} · {t.workshop.a3.ppConfianceLabel} {active.confiance.toFixed(1)}
              </div>
              <div className="mt-0.5 text-gray-600">
                {t.workshop.a3.ppExpLabel}: {active.exposition.toFixed(1)} · {t.workshop.a3.ppFiabLabel}: {active.fiabilite.toFixed(1)}
              </div>
              <div className="font-medium" style={{ color: ZONE_COLOR[active.zone] }}>
                {r.menaceLabel}: {active.menace.toFixed(2)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Légende de lecture — sous le radar */}
      <p className="mt-3 text-xs text-gray-500">{r.hint}</p>
    </div>
  )
}
