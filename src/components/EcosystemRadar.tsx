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
import MenaceFormulaDiagram from '@/components/MenaceFormulaDiagram'

interface PartieLike {
  id: string
  nom: string
  nomCourt?: string
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
  /** Si fourni, le libellé d'un point devient éditable au clic (nom court ≤ 12 car.). */
  onEditShortName?: (id: string, nomCourt: string) => void
  /** Radar agrégé (plusieurs analyses) : affiche la note « un tiers peut apparaître plusieurs fois ». */
  aggregated?: boolean
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

export default function EcosystemRadar({ parties, onSelect, showRefs = true, hideHeader = false, echelles, onEditShortName, aggregated = false }: Props) {
  const { t } = useTranslation()
  const r = t.workshop.a3.radar
  const ppTypes = t.workshop.a3.ppTypes as Record<string, string>
  const [active, setActive] = useState<RadarPoint | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)

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
  const typeLabel = (ty: string) => ppTypes[ty] ?? ty
  // Libellé de secteur tronqué pour ne pas déborder du SVG (nom complet en <title>).
  const shortLabel = (s: string) => (s.length > 14 ? s.slice(0, 13) + '…' : s)
  const editable = !!onEditShortName
  // Libellé d'un point : nom court (≤12) si défini, sinon réf T1, T2…
  const pointLabel = (p: RadarPoint) => (p.nomCourt || (showRefs ? p.ref : ''))
  function commitShortName(id: string, value: string) {
    onEditShortName?.(id, value.trim().slice(0, 12))
    setEditing(null)
  }

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
              ★ (avant le libellé) = tiers critique · libellé = nom court ou réf T1… */}
          {points.map(p => {
            const isActive = active?.id === p.id
            const baseR = EXPO_RADIUS[expositionLevel(p.exposition, bornes.maxExpo)]
            const fill = FIAB_COLOR[fiabiliteLevel(p.fiabilite, bornes.maxFiab)]
            const labelX = p.x + baseR + 4
            const label = pointLabel(p)
            const isEditing = editing === p.id
            return (
              <g
                key={p.id}
                className="cursor-pointer"
                tabIndex={0}
                role="button"
                aria-label={`${p.nomCourt || p.ref} — ${p.nom}${p.critique ? ` (${r.critiqueLegend})` : ''} — ${typeLabel(p.type)} — ${r.menaceLabel} ${p.menace.toFixed(2)}`}
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
                {isEditing ? (
                  // Édition inline du nom court (sans changer de page)
                  <foreignObject x={labelX - 2} y={p.y - 9} width={118} height={22}>
                    <input
                      autoFocus
                      defaultValue={p.nomCourt}
                      maxLength={12}
                      placeholder={r.shortNamePlaceholder}
                      onClick={e => e.stopPropagation()}
                      onBlur={e => commitShortName(p.id, e.currentTarget.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') e.currentTarget.blur()
                        else if (e.key === 'Escape') setEditing(null)
                      }}
                      style={{ width: '100%', height: 18, fontSize: 10, padding: '0 3px', border: '1px solid #9ca3af', borderRadius: 3, outline: 'none' }}
                    />
                  </foreignObject>
                ) : (
                  // ★ (si critique) juste avant le libellé, à droite du point — halo blanc.
                  <text
                    x={labelX} y={p.y + 3.5}
                    fontSize={isActive ? 11 : 9.5} fontWeight={700}
                    fill="#1f2937" stroke="#ffffff" strokeWidth={2.5}
                    paintOrder="stroke"
                    onClick={editable ? (e => { e.stopPropagation(); setEditing(p.id) }) : undefined}
                    style={{ cursor: editable ? 'text' : 'default', pointerEvents: editable ? 'auto' : 'none' }}
                  >
                    {p.critique && <tspan fill={STAR_COLOR}>★ </tspan>}
                    <tspan>{label}</tspan>
                  </text>
                )}
              </g>
            )
          })}

          {/* Détail au survol — bulle en haut à droite du point survolé */}
          {active && editing === null && (() => {
            const aR = EXPO_RADIUS[expositionLevel(active.exposition, bornes.maxExpo)]
            const tipW = 176, tipH = 96
            const tx = Math.max(-58, Math.min(active.x + aR + 2, 538 - tipW))
            const ty = Math.max(2, active.y - tipH - 2)
            return (
              <foreignObject x={tx} y={ty} width={tipW} height={tipH} style={{ pointerEvents: 'none' }}>
                <div className="rounded-md border border-gray-200 bg-white/95 p-2 text-[10px] leading-tight shadow-sm">
                  <div className="font-semibold text-gray-800">
                    <span className="mr-1 rounded bg-gray-200 px-1 py-px text-[9px] font-bold text-gray-700">{active.nomCourt || active.ref}</span>
                    {active.nom}
                  </div>
                  <div className="text-gray-500">{typeLabel(active.type)}</div>
                  <div className="mt-1 text-gray-600">
                    {t.workshop.a3.ppDependanceLabel} {active.dependance.toFixed(1)} · {t.workshop.a3.ppPenetrationLabel} {active.penetration.toFixed(1)} · {t.workshop.a3.ppMaturiteLabel} {active.maturite.toFixed(1)} · {t.workshop.a3.ppConfianceLabel} {active.confiance.toFixed(1)}
                  </div>
                  <div className="text-gray-600">
                    {t.workshop.a3.ppExpLabel} {active.exposition.toFixed(1)} · {t.workshop.a3.ppFiabLabel} {active.fiabilite.toFixed(1)}
                  </div>
                  <div className="font-semibold" style={{ color: ZONE_COLOR[active.zone] }}>
                    {r.menaceLabel} {active.menace.toFixed(2)}
                  </div>
                </div>
              </foreignObject>
            )
          })()}
        </svg>

        {/* Légende compacte (sous le radar) + aide dépliable */}
        <div className="w-full border-t border-gray-100 pt-3">
          {/* Ligne 1 — zones de menace (anneaux) */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-gray-600">
            {([
              ['danger', r.zoneDanger],
              ['controle', r.zoneControle],
              ['veille', r.zoneVeille],
            ] as [EcosystemZone, string][]).map(([z, label]) => (
              <span key={z} className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: ZONE_COLOR[z] }} aria-hidden="true" />
                {label}
                <span className="text-gray-400">({points.filter(p => p.zone === z).length})</span>
              </span>
            ))}
          </div>
          {/* Ligne 2 — encodage des points */}
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="flex gap-0.5" aria-hidden="true">
                {FIAB_COLOR.map(c => <span key={c} className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c }} />)}
              </span>
              {r.colorLegend}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="flex items-end gap-0.5" aria-hidden="true">
                {EXPO_RADIUS.map((rr, i) => <span key={i} className="inline-block rounded-full bg-gray-400" style={{ width: rr, height: rr }} />)}
              </span>
              {r.sizeLegend}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span style={{ color: STAR_COLOR }} aria-hidden="true">★</span>
              {r.critiqueLegend}
            </span>
          </div>
          {/* Lien d'aide — notes de lecture + schéma de calcul (masqués par défaut) */}
          <div className="mt-2 text-center">
            <button type="button" onClick={() => setShowHelp(v => !v)}
              aria-expanded={showHelp}
              className="text-xs text-blue-600 underline hover:text-blue-800">
              {showHelp ? r.helpHide : r.helpToggle}
            </button>
          </div>
          {showHelp && (
            <div className="mt-3 space-y-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="space-y-0.5 text-center text-[11px] text-gray-500">
                <div>{r.radiusLegend}</div>
                <div>{r.sectorLegend}</div>
                {editable && <div className="italic text-gray-400">{r.editHint}</div>}
                {aggregated && <div className="italic text-gray-400">{r.multiLegend}</div>}
              </div>
              <MenaceFormulaDiagram />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
