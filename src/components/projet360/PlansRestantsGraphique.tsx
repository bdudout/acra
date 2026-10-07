'use client'
// ─── Graphique « plans d'action restants » d'un projet 360 (SVG) ──────────────
// Courbe en escalier du prévu (jalons = échéances des plans), ligne cible jusqu'à la mise en service, point du jour
// (plans réellement restants : au-dessus de la courbe prévue = retard). Données : lib/projet-burndown (dates ISO).

import { useTranslation } from '@/lib/i18n/context'

export interface DonneesRestants {
  total: number; fin: string
  prevu: { date: string; restants: number }[]
  cible: { date: string; restants: number }[]
  aujourdhui: { date: string; restants: number }
}

const W = 640, H = 220, M = { g: 36, d: 12, h: 12, b: 28 }
const C = { prevu: '#4338CA', cible: '#9CA3AF', jour: '#D97706', grille: '#E5E7EB' }

export default function PlansRestantsGraphique({ data }: { data: DonneesRestants }) {
  const { t, locale } = useTranslation()
  const l = t.projet360.presentation
  const t0 = new Date(data.prevu[0].date).getTime()
  const jour = new Date(data.aujourdhui.date).getTime()
  const t1 = Math.max(new Date(data.fin).getTime(), jour, ...data.prevu.map(p => new Date(p.date).getTime()), t0 + 86_400_000)
  const x = (iso: string | number) => M.g + ((new Date(iso).getTime() - t0) / (t1 - t0)) * (W - M.g - M.d)
  const y = (n: number) => M.h + (1 - n / Math.max(1, data.total)) * (H - M.h - M.b)
  // Escalier : on garde le niveau jusqu'au jalon suivant, puis on descend.
  const escalier = data.prevu.flatMap((p, i) => (i === 0 ? [`M${x(p.date)},${y(p.restants)}`] : [`H${x(p.date)}`, `V${y(p.restants)}`])).join(' ') + ` H${x(t1)}`
  const fmt = (ms: number) => new Date(ms).toLocaleDateString(locale, { day: '2-digit', month: 'short', timeZone: 'UTC' })
  const description = `${l.plansRestants} — ${l.aujourdhui} : ${data.aujourdhui.restants} / ${data.total}`
  const graduations = [0, Math.round(data.total / 2), data.total].filter((v, i, a) => a.indexOf(v) === i)

  return (
    <figure className="card p-5">
      <figcaption className="text-base font-semibold text-gray-900 dark:text-gray-100">{l.plansRestants}</figcaption>
      <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">{l.plansRestantsHint}</p>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={description} className="h-auto w-full">
        {graduations.map(v => (
          <g key={v}>
            <line x1={M.g} x2={W - M.d} y1={y(v)} y2={y(v)} stroke={C.grille} strokeWidth={1} />
            <text x={M.g - 6} y={y(v) + 4} textAnchor="end" fontSize={10} fill="#6B7280">{v}</text>
          </g>
        ))}
        <text x={M.g} y={H - 8} fontSize={10} fill="#6B7280">{fmt(t0)}</text>
        <text x={W - M.d} y={H - 8} fontSize={10} fill="#6B7280" textAnchor="end">{fmt(t1)}</text>
        <line x1={x(data.cible[0].date)} y1={y(data.cible[0].restants)} x2={x(data.cible[1].date)} y2={y(data.cible[1].restants)} stroke={C.cible} strokeWidth={2} strokeDasharray="6 4" />
        <path d={escalier} fill="none" stroke={C.prevu} strokeWidth={2.5} />
        <line x1={x(jour)} x2={x(jour)} y1={M.h} y2={H - M.b} stroke={C.jour} strokeWidth={1} strokeDasharray="2 3" />
        <circle cx={x(jour)} cy={y(data.aujourdhui.restants)} r={5} fill={C.jour} />
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-300">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="inline-block h-0.5 w-5" style={{ backgroundColor: C.prevu }} />{l.prevu}</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="inline-block h-0 w-5 border-t-2 border-dashed" style={{ borderColor: C.cible }} />{l.cible}</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: C.jour }} />{l.aujourdhui}</span>
      </div>
    </figure>
  )
}
