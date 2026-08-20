'use client'

import { Download, CalendarClock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'

interface Constat {
  id: string; intitule: string; description: string | null; recommandation: string | null
  criticite: number | null; source: string; statut: string; echeance: string | null
  responsableAction: string | null; missionIntitule: string | null
}
interface Synthese {
  total: number; ouverts: number; resolus: number; echues: number; sous30j: number; aVenir: number
  sansEcheance: number; critiques: number; tauxResolution: number
}

const STATUT_BADGE: Record<string, string> = {
  OUVERT: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  EN_COURS: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300',
  RESOLU: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  ACCEPTE: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
}
const CRIT_BADGE: Record<number, string> = {
  4: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
  3: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300',
  2: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  1: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
}
const TERMINES = new Set(['RESOLU', 'ACCEPTE'])

export default function SuiviRegulateurManager() {
  const { t } = useTranslation()
  const s = t.suiviRegulateur
  const [constats, setConstats] = useState<Constat[]>([])
  const [synthese, setSynthese] = useState<Synthese | null>(null)
  const [prochaine, setProchaine] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/reglementaire/suivi-regulateur')
      .then(x => x.ok ? x.json() : null).catch(() => null)
      .then(d => {
        setConstats(d?.constats ?? [])
        setSynthese(d?.synthese ?? null)
        setProchaine(d?.prochaineEcheance ?? null)
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="text-center py-12 text-gray-500">{t.loading}</div>

  const kpi = (label: string, value: string | number, tone = 'text-gray-900 dark:text-gray-100') => (
    <div className="card p-4">
      <div className={`text-2xl font-bold ${tone} tabular-nums`}>{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 leading-snug mt-0.5">{label}</div>
    </div>
  )

  const enRetard = (c: Constat) => c.echeance && !TERMINES.has(c.statut) && new Date(c.echeance).getTime() < Date.now()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{s.title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">{s.subtitle}</p>
        </div>
        {constats.length > 0 && (
          <a href="/api/reglementaire/suivi-regulateur?format=csv"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
            <Download size={15} aria-hidden="true" /> {s.export}
          </a>
        )}
      </div>

      {synthese && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpi(s.kpi.total, synthese.total)}
          {kpi(s.kpi.ouverts, synthese.ouverts)}
          {kpi(s.kpi.echues, synthese.echues, synthese.echues > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100')}
          {kpi(s.kpi.sous30j, synthese.sous30j, synthese.sous30j > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-gray-100')}
          {kpi(s.kpi.critiques, synthese.critiques, synthese.critiques > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100')}
          {kpi(s.kpi.taux, `${synthese.tauxResolution}%`, synthese.tauxResolution >= 80 ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-gray-100')}
        </div>
      )}

      {prochaine && (
        <p className="text-xs text-gray-500 dark:text-gray-400 -mt-3 flex items-center gap-1">
          <CalendarClock size={13} aria-hidden="true" /> {s.prochaine} : <b className="text-gray-700 dark:text-gray-200 tabular-nums">{prochaine.slice(0, 10)}</b>
        </p>
      )}

      {constats.length === 0 ? (
        <div className="card p-10 text-center text-gray-400 dark:text-gray-500 text-sm">{s.empty}</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs">
              <tr>
                <th className="text-left font-medium px-3 py-2">{s.col.intitule}</th>
                <th className="text-left font-medium px-3 py-2">{s.col.criticite}</th>
                <th className="text-left font-medium px-3 py-2">{s.col.statut}</th>
                <th className="text-left font-medium px-3 py-2">{s.col.echeance}</th>
                <th className="text-left font-medium px-3 py-2">{s.col.responsable}</th>
                <th className="text-left font-medium px-3 py-2">{s.col.mission}</th>
              </tr>
            </thead>
            <tbody>
              {constats.map(c => (
                <tr key={c.id} className="border-t border-gray-100 dark:border-gray-700 align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-800 dark:text-gray-100">{c.intitule}</div>
                    {c.recommandation && <div className="text-[11px] text-gray-400 max-w-md truncate" title={c.recommandation}>{c.recommandation}</div>}
                  </td>
                  <td className="px-3 py-2">
                    {c.criticite
                      ? <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CRIT_BADGE[c.criticite] ?? CRIT_BADGE[1]}`}>{c.criticite}</span>
                      : <span className="text-xs text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_BADGE[c.statut] ?? STATUT_BADGE.OUVERT}`}>{s.statutOpt[c.statut as keyof typeof s.statutOpt] ?? c.statut}</span></td>
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">
                    {c.echeance ? c.echeance.slice(0, 10) : '—'}
                    {enRetard(c) && <span className="ml-1.5 text-[10px] text-red-600 dark:text-red-400 font-semibold">⚠ {s.enRetard}</span>}
                  </td>
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{c.responsableAction ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{c.missionIntitule ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
