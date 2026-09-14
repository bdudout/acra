import { donutSegments } from '@/lib/donut'

export interface GaugesLabels {
  actuelle: string; actuelleHint: string
  avecDerog: string; avecDerogHint: string
  cible: string; cibleHint: string
  legendConforme: string; legendDeroge: string; legendAccept: string; legendPlan: string; legendReste: string
}

const C_CONFORME = '#16a34a' // vert
const C_DEROGE = '#7c3aed'   // violet
const C_ACCEPT = '#0ea5e9'   // bleu (acceptation de risque)
const C_PLAN = '#f59e0b'     // ambre (plan d'action)

// Un cadran (anneau) : parts « couvertes » colorées sur un total « pertinents »,
// le reste laissant voir la piste neutre ; taux au centre.
function Gauge({ taux, covered, pertinents, title, hint, size = 116 }: {
  taux: number
  covered: { value: number; color: string }[]
  pertinents: number
  title: string
  hint: string
  size?: number
}) {
  const stroke = 14
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const parts = [
    ...covered.map((c, i) => ({ key: `c${i}`, value: c.value, color: c.color })),
    { key: 'reste', value: Math.max(0, pertinents - covered.reduce((s, c) => s + c.value, 0)), color: 'transparent' },
  ]
  const { segments } = donutSegments(parts, circ)
  return (
    <div className="flex flex-col items-center text-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${title} ${taux}%`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke}
          className="stroke-gray-200 dark:stroke-gray-700" />
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {segments.map(s => s.color !== 'transparent' && s.len > 0 && (
            <circle key={s.key} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={stroke}
              strokeLinecap="butt" strokeDasharray={`${s.len} ${s.gap}`} strokeDashoffset={s.offset} />
          ))}
        </g>
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
          className="fill-gray-900 dark:fill-gray-50 font-bold" style={{ fontSize: 24 }}>{taux}%</text>
      </svg>
      <div className="mt-2 text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</div>
      <div className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight max-w-[16rem]">{hint}</div>
    </div>
  )
}

/**
 * Trois cadrans de conformité globale (tous référentiels), progressifs :
 *  1. Actuelle : conformes / pertinents.
 *  2. Avec dérogations : + écarts couverts par dérogation OU acceptation de risque.
 *  3. Cible : + écarts couverts par dérogation OU plan d'action (→ conformité à terme).
 * couvDerog / couvAccept / couvPlan sont mutuellement exclusifs (cf. conformiteStats).
 * Thème clair/sombre géré.
 */
export default function ConformiteGauges({ conforme, pertinents, couvDerog, couvAccept, couvPlan, labels }: {
  conforme: number; pertinents: number; couvDerog: number; couvAccept: number; couvPlan: number
  labels: GaugesLabels
}) {
  const pct = (n: number) => (pertinents > 0 ? Math.round((n / pertinents) * 100) : 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Gauge taux={pct(conforme)} pertinents={pertinents} title={labels.actuelle} hint={labels.actuelleHint}
          covered={[{ value: conforme, color: C_CONFORME }]} />
        <Gauge taux={pct(conforme + couvDerog + couvAccept)} pertinents={pertinents} title={labels.avecDerog} hint={labels.avecDerogHint}
          covered={[{ value: conforme, color: C_CONFORME }, { value: couvDerog, color: C_DEROGE }, { value: couvAccept, color: C_ACCEPT }]} />
        <Gauge taux={pct(conforme + couvDerog + couvPlan)} pertinents={pertinents} title={labels.cible} hint={labels.cibleHint}
          covered={[{ value: conforme, color: C_CONFORME }, { value: couvDerog, color: C_DEROGE }, { value: couvPlan, color: C_PLAN }]} />
      </div>

      {/* Légende partagée */}
      <ul className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-xs text-gray-600 dark:text-gray-300">
        {[
          { c: C_CONFORME, l: labels.legendConforme },
          { c: C_DEROGE, l: labels.legendDeroge },
          { c: C_ACCEPT, l: labels.legendAccept },
          { c: C_PLAN, l: labels.legendPlan },
        ].map(x => (
          <li key={x.l} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: x.c }} aria-hidden="true" />{x.l}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-gray-200 dark:bg-gray-700" aria-hidden="true" />{labels.legendReste}
        </li>
      </ul>
    </div>
  )
}
