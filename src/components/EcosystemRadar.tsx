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
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/context'
import {
  layoutStakeholders,
  sectorSpans,
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
  rang?: number
  cle?: string
  parentCle?: string
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
  /** Notifié au survol d'un point (id) ou à la sortie (null) — ex. surligner la ligne du tableau. */
  onHover?: (id: string | null) => void
  /** Lien « Modifier les tiers » : page atelier 3 (analyse) ou /tiers (radar agrégé). */
  manageTiersHref?: string
  /** Si vrai, un clic sur un point navigue vers `manageTiersHref#pp-<cle>` (scroll vers le tiers). */
  manageTiersPerPoint?: boolean
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

export default function EcosystemRadar({ parties, onSelect, showRefs = true, hideHeader = false, echelles, onEditShortName, aggregated = false, onHover, manageTiersHref, manageTiersPerPoint }: Props) {
  const { t } = useTranslation()
  const router = useRouter()
  const r = t.workshop.a3.radar
  const ppTypes = t.workshop.a3.ppTypes as Record<string, string>
  const [active, setActive] = useState<RadarPoint | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [showRanks, setShowRanks] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  // Présence de PP connexes (rang ≥ 2) → propose le basculement d'affichage.
  const hasRanks = parties.some(p => (p.rang ?? 1) >= 2)

  // Survol d'un point : MAJ de l'état local + notification parent (surlignage tableau).
  const enter = (p: RadarPoint) => { setActive(p); onHover?.(p.id) }
  const leave = () => { setActive(null); onHover?.(null) }

  // Export du radar — SVG vectoriel, ou PNG rasterisé (2×) via canvas.
  function exportSvgString(): string {
    if (!svgRef.current) return ''
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.querySelectorAll('foreignObject').forEach(el => el.remove()) // retire bulle/édition
    return new XMLSerializer().serializeToString(clone)
  }
  function download(href: string, name: string) {
    const a = document.createElement('a'); a.href = href; a.download = name
    document.body.appendChild(a); a.click(); a.remove()
  }
  function exportSVG() {
    const blob = new Blob([exportSvgString()], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob); download(url, 'cartographie-ecosysteme.svg'); URL.revokeObjectURL(url)
  }
  function exportPNG() {
    const svgStr = exportSvgString(); if (!svgStr) return
    const scale = 2, w = 596, h = 480
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas'); canvas.width = w * scale; canvas.height = h * scale
      const ctx = canvas.getContext('2d'); if (!ctx) return
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.scale(scale, scale); ctx.drawImage(img, 0, 0, w, h)
      download(canvas.toDataURL('image/png'), 'cartographie-ecosysteme.png')
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)))
  }

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
  // Rang 1 par défaut (recommandation du guide) ; rangs 2/3 affichés sur demande.
  const shownParties = showRanks ? parties : parties.filter(p => (p.rang ?? 1) <= 1)
  const points = layoutStakeholders(shownParties, geom, { menaceMin: bornes.menaceMin, menaceMax: bornes.menaceMax })
  const byCle = new Map(points.filter(p => p.cle).map(p => [p.cle, p]))
  // Secteurs proportionnels au nombre de PP de chaque catégorie.
  const spans = sectorSpans(shownParties)
  const rings = zoneRadii(R_MAX, bornes.menaceMin, bornes.menaceMax)
  const n = spans.length
  const typeLabel = (ty: string) => ppTypes[ty] ?? ty
  // Libellé de secteur : sur 2 lignes (mots équilibrés) au lieu d'être tronqué.
  const wrapLabel = (s: string): string[] => {
    if (s.length <= 14) return [s]
    const words = s.split(' ')
    if (words.length === 1) return [s]
    let cut = 1, bestDiff = Infinity
    for (let i = 1; i < words.length; i++) {
      const d = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length)
      if (d < bestDiff) { bestDiff = d; cut = i }
    }
    return [words.slice(0, cut).join(' '), words.slice(cut).join(' ')]
  }
  const editable = !!onEditShortName
  // Libellé d'un point : nom court (≤12) si défini, sinon réf T1, T2…
  const pointLabel = (p: RadarPoint) => (p.nomCourt || (showRefs ? p.ref : ''))
  function commitShortName(id: string, value: string) {
    onEditShortName?.(id, value.trim().slice(0, 12))
    setEditing(null)
  }
  // Clic sur un point : naviguer vers l'édition du tiers (atelier 3, scroll) si demandé,
  // sinon notifier le parent (surlignage / défilement interne).
  function handlePointClick(p: RadarPoint) {
    if (manageTiersPerPoint && manageTiersHref) router.push(`${manageTiersHref}#pp-${p.id}`)
    else onSelect?.(p.id)
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700">
      <div className="mb-3 flex items-center justify-between gap-2">
        {!hideHeader ? <h3 className="font-semibold text-gray-800 dark:text-gray-100">{r.title}</h3> : <span />}
        <div className="flex items-center gap-1.5">
          {hasRanks && (
            <label className="mr-1 inline-flex cursor-pointer items-center gap-1 text-[11px] text-gray-600 dark:text-gray-300">
              <input type="checkbox" checked={showRanks} onChange={e => setShowRanks(e.target.checked)} className="accent-ebios-600" />
              {r.showRanks}
            </label>
          )}
          {manageTiersHref && (
            <a href={manageTiersHref}
              className="rounded border border-ebios-200 bg-ebios-50 px-2 py-1 text-[11px] font-medium text-ebios-700 hover:bg-ebios-100 dark:border-ebios-700 dark:bg-ebios-900/30 dark:text-ebios-300">
              {r.manageTiers}
            </a>
          )}
          <button type="button" onClick={exportPNG}
            className="rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">{r.exportPng}</button>
          <button type="button" onClick={exportSVG}
            className="rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">{r.exportSvg}</button>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4">
        <svg
          ref={svgRef}
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

          {/* Liens des PP connexes (rang 2/3) vers leur PP parente — pointillé + pastille
              de RANG au milieu du lien (1 = direct, 2/3 = profondeur du sous-traitant). */}
          {showRanks && points.map(p => {
            const parent = p.parentCle ? byCle.get(p.parentCle) : undefined
            if (!parent) return null
            const mx = (parent.x + p.x) / 2, my = (parent.y + p.y) / 2
            return (
              <g key={`lnk-${p.id}`}>
                {/* Pointillés ronds (et non tirets, réservés aux séparateurs de secteurs). */}
                <line x1={parent.x} y1={parent.y} x2={p.x} y2={p.y}
                  className="[stroke:#6366f1] dark:[stroke:#a5b4fc]"
                  strokeOpacity={0.9} strokeWidth={1.6} strokeLinecap="round" strokeDasharray="0.1 4" />
                <circle cx={mx} cy={my} r={6.5} fill="#4f46e5" stroke="#ffffff" strokeWidth={1.2} />
                <text x={mx} y={my + 2.8} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="#ffffff" style={{ pointerEvents: 'none' }}>
                  {p.rang}
                </text>
              </g>
            )
          })}

          {/* Séparateurs de secteurs (au bord initial) + libellés de catégorie (au centre,
              sur 2 lignes si nécessaire). Secteurs proportionnels au nombre de PP. */}
          {spans.map((s) => {
            const [bx, by] = polarToXY(R_MAX, s.startDeg, CX, CY)
            const [lx, ly] = polarToXY(R_MAX + 20, s.centerDeg, CX, CY)
            const anchor = Math.abs(lx - CX) < 8 ? 'middle' : lx < CX ? 'end' : 'start'
            const lines = wrapLabel(typeLabel(s.type))
            const y0 = ly - (lines.length - 1) * 6
            return (
              <g key={s.type}>
                {n > 1 && (
                  <line x1={CX} y1={CY} x2={bx} y2={by}
                    stroke="#6b7280" strokeOpacity={0.6} strokeWidth={1.3} strokeDasharray="5 3" />
                )}
                <text x={lx} y={y0} textAnchor={anchor} dominantBaseline="middle"
                  className="fill-gray-500 dark:fill-gray-400" fontSize={10.5}>
                  {lines.map((ln, j) => <tspan key={j} x={lx} dy={j === 0 ? 0 : 12}>{ln}</tspan>)}
                  <title>{typeLabel(s.type)}</title>
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
            // Libellé du côté EXTÉRIEUR (gauche si le point est à gauche du centre) pour
            // ne pas s'étendre vers le cœur du radar — réduit fortement les chevauchements.
            const labelLeft = p.x < CX
            const labelX = labelLeft ? p.x - baseR - 4 : p.x + baseR + 4
            const labelAnchor = labelLeft ? 'end' : 'start'
            const label = pointLabel(p)
            const isEditing = editing === p.id
            return (
              <g
                key={p.id}
                className="cursor-pointer"
                tabIndex={0}
                role="button"
                opacity={p.rang > 1 ? 0.78 : 1}
                aria-label={`${p.nomCourt || p.ref} — ${p.nom}${p.critique ? ` (${r.critiqueLegend})` : ''}${p.rang > 1 ? ` — ${r.rangLabel} ${p.rang}` : ''} — ${typeLabel(p.type)} — ${r.menaceLabel} ${p.menace.toFixed(2)}`}
                onMouseEnter={() => enter(p)}
                onMouseLeave={leave}
                onFocus={() => enter(p)}
                onBlur={leave}
                onClick={() => handlePointClick(p)}
                onDoubleClick={editable ? (e => { e.stopPropagation(); setEditing(p.id) }) : undefined}
              >
                <circle
                  cx={p.x} cy={p.y} r={isActive ? baseR + 2.5 : baseR}
                  fill={fill}
                  stroke="#ffffff" strokeWidth={1.5}
                  className="transition-all"
                />
                {isEditing ? (
                  // Édition inline du nom court (sans changer de page) — côté du libellé
                  <foreignObject x={labelLeft ? labelX - 116 : labelX - 2} y={p.y - 9} width={118} height={22}>
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
                  // ★ (si critique) juste avant le libellé, à droite du point — halo
                  // (blanc en clair, sombre en thème sombre) pour rester lisible sur les zones.
                  <text
                    x={labelX} y={p.y + 3.5} textAnchor={labelAnchor}
                    fontSize={isActive ? 11 : 9.5} fontWeight={700}
                    strokeWidth={2.5} paintOrder="stroke"
                    className="fill-gray-900 [stroke:#fff] dark:fill-gray-50 dark:[stroke:#0f172a]"
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

          {/* Détail au survol — rendu APRÈS les points (z-order au-dessus) mais NON
              interactif (pointer-events:none sur le foreignObject ET son contenu) pour
              ne jamais intercepter le clic/double-clic d'édition du libellé. */}
          {active && editing === null && (() => {
            const a3 = t.workshop.a3
            const aR = EXPO_RADIUS[expositionLevel(active.exposition, bornes.maxExpo)]
            const tipW = 210, tipH = 140
            const VB_L = -58, VB_R = 538, VB_B = 480
            let tx = active.x + aR + 2
            if (tx + tipW > VB_R) tx = active.x - aR - tipW - 2
            tx = Math.max(VB_L, Math.min(tx, VB_R - tipW))
            let ty = active.y - tipH - 2
            if (ty < 2) ty = active.y + aR + 2
            ty = Math.max(2, Math.min(ty, VB_B - tipH))
            return (
              <foreignObject x={tx} y={ty} width={tipW} height={tipH} pointerEvents="none" style={{ pointerEvents: 'none', overflow: 'visible' }}>
                <div style={{ pointerEvents: 'none' }} className="inline-block rounded-md border border-gray-200 bg-white/95 p-2 text-[10px] leading-snug shadow-md dark:border-gray-700 dark:bg-gray-800/95">
                  <div className="flex items-center gap-1">
                    <span className="rounded bg-gray-200 px-1 py-px text-[9px] font-bold text-gray-700 dark:bg-gray-700 dark:text-gray-200">{active.nomCourt || active.ref}</span>
                    <span className="text-gray-500 dark:text-gray-400">{typeLabel(active.type)}</span>
                  </div>
                  <div className="mt-0.5 font-semibold text-gray-800 dark:text-gray-100">{active.nom}</div>
                  <div className="mt-1 text-gray-600 dark:text-gray-300">{a3.ppDependanceLabel} {active.dependance.toFixed(1)} · {a3.ppPenetrationLabel} {active.penetration.toFixed(1)}</div>
                  <div className="text-gray-600 dark:text-gray-300">{a3.ppMaturiteLabel} {active.maturite.toFixed(1)} · {a3.ppConfianceLabel} {active.confiance.toFixed(1)}</div>
                  <div className="mt-0.5 text-gray-600 dark:text-gray-300">{a3.ppExpLabel} {active.exposition.toFixed(1)} · {a3.ppFiabLabel} {active.fiabilite.toFixed(1)}</div>
                  <div className="font-semibold" style={{ color: ZONE_COLOR[active.zone] }}>{r.menaceLabel} {active.menace.toFixed(2)}</div>
                </div>
              </foreignObject>
            )
          })()}
        </svg>

        {/* Légende compacte (sous le radar) + aide dépliable */}
        <div className="w-full border-t border-gray-100 pt-3 dark:border-gray-700">
          {/* Ligne 1 — zones de menace (anneaux) */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
            {([
              ['danger', r.zoneDanger],
              ['controle', r.zoneControle],
              ['veille', r.zoneVeille],
            ] as [EcosystemZone, string][]).map(([z, label]) => (
              <span key={z} className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: ZONE_COLOR[z] }} aria-hidden="true" />
                {label}
                <span className="text-gray-400 dark:text-gray-500">({points.filter(p => p.zone === z).length})</span>
              </span>
            ))}
          </div>
          {/* Ligne 2 — encodage des points */}
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
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
              className="text-xs text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
              {showHelp ? r.helpHide : r.helpToggle}
            </button>
          </div>
          {showHelp && (
            <div className="mt-3 space-y-3 rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
              <div className="space-y-0.5 text-center text-[11px] text-gray-500 dark:text-gray-400">
                <div>{r.radiusLegend}</div>
                <div>{r.sectorLegend}</div>
                {editable && <div className="italic text-gray-400 dark:text-gray-500">{r.editHint}</div>}
                {aggregated && <div className="italic text-gray-400 dark:text-gray-500">{r.multiLegend}</div>}
              </div>
              <MenaceFormulaDiagram />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
