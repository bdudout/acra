'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/context'
import { type TaxonomieNode } from '@/lib/taxonomie'
import { distinctEntites, filtersToQuery, type RiskFilters } from '@/lib/risk-filters'
import RiskFiltersBar from '@/components/RiskFiltersBar'

interface RiskTotals { total: number; eleve: number; moyen: number; faible: number; nonCote: number }
interface ActionsSummary { total: number; faits: number; enCours: number; aFaire: number; enRetard: number; tauxAvancement: number }
interface IncidentTotals { total: number; ouverts: number; perteNette: number }
interface ControleTotals { controles: number; evaluees: number; conformes: number; anomalies: number; tauxConformite: number | null }
interface AuditTotals { missions: number; constats: number; critiques: number; recosEnRetard: number; tauxResolution: number }
interface AppetitSynthese { total: number; evalues: number; horsAppetit: number; dansAppetit: number; sansSeuil: number }
interface KriSynthese { total: number; normal: number; alerte: number; critique: number; inconnu: number; enAlerte: number }
interface DoraSynthese { evalues: number; majeurs: number; significatifs: number; mineurs: number }
interface OrgPosture {
  orgId: string; orgNom: string; risques: RiskTotals; actions: ActionsSummary
  incidents?: IncidentTotals; controles?: ControleTotals; audit?: AuditTotals; horsAppetit?: number; kriEnAlerte?: number; doraMajeurs?: number
}
interface Rollup {
  active: boolean; orgCount: number
  modules: { incidents: boolean; controles: boolean; audit: boolean; appetit: boolean; kri: boolean; reglementaire: boolean }
  consolide: { risques: RiskTotals; actions: ActionsSummary; incidents?: IncidentTotals; controles?: ControleTotals; audit?: AuditTotals; appetit?: AppetitSynthese; kri?: KriSynthese; dora?: DoraSynthese }
  parOrg: OrgPosture[]
}

// Barre de répartition des paliers (élevé / moyen / faible / non coté).
function PostureBar({ t: totals }: { t: RiskTotals }) {
  const segs = [
    { n: totals.eleve, c: 'bg-red-500' },
    { n: totals.moyen, c: 'bg-amber-500' },
    { n: totals.faible, c: 'bg-green-500' },
    { n: totals.nonCote, c: 'bg-gray-300 dark:bg-gray-600' },
  ]
  const tot = totals.total || 1
  return (
    <div className="flex h-2 w-28 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
      {segs.map((s, i) => s.n > 0 && <div key={i} className={s.c} style={{ width: `${(s.n / tot) * 100}%` }} title={String(s.n)} />)}
    </div>
  )
}

function progressColor(s: ActionsSummary): string {
  if (s.total === 0) return 'text-gray-400'
  if (s.enRetard > 0) return 'text-red-600 dark:text-red-400'
  if (s.tauxAvancement === 100) return 'text-green-600 dark:text-green-400'
  return 'text-amber-600 dark:text-amber-400'
}

export default function PilotageGrc() {
  const { t, locale } = useTranslation()
  const p = t.pilotage
  const [data, setData] = useState<Rollup | null>(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<RiskFilters>({})
  const [taxo, setTaxo] = useState<TaxonomieNode[]>([])
  const [procs, setProcs] = useState<{ id: string; nom: string }[]>([])
  const [entites, setEntites] = useState<string[]>([])

  const tr = useMemo(() => (key: string) => key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], t) as string ?? '', [t])

  // Référentiels des sélecteurs (chargés une fois) : catégories, processus, entités.
  useEffect(() => {
    Promise.all([
      fetch('/api/taxonomie').then(x => x.ok ? x.json() : { taxonomie: [] }),
      fetch('/api/processus').then(x => x.ok ? x.json() : { processus: [] }),
      fetch('/api/risk-items').then(x => x.ok ? x.json() : { risks: [] }),
    ]).then(([tt, pp, rr]) => {
      setTaxo(tt.taxonomie ?? []); setProcs(pp.processus ?? []); setEntites(distinctEntites(rr.risks ?? []))
    })
  }, [])

  // La consolidation est recalculée côté serveur à chaque changement de filtre.
  useEffect(() => {
    const q = filtersToQuery(filters)
    fetch(`/api/grc/rollup${q ? `?${q}` : ''}`).then(x => x.ok ? x.json() : null).then(d => { setData(d); setLoading(false) })
  }, [filters])

  // Export du périmètre filtré ; `lang` localise le rapport PDF.
  function exportAs(format: 'csv' | 'xlsx' | 'pdf') {
    const qs = new URLSearchParams(filtersToQuery(filters))
    qs.set('format', format)
    if (format === 'pdf') qs.set('lang', locale)
    window.location.href = `/api/risk-items/export?${qs.toString()}`
  }

  if (loading) return <p className="text-gray-400">…</p>
  if (!data?.active) return <p className="text-gray-400">{p.inactive}</p>

  const cr = data.consolide.risques
  const ca = data.consolide.actions
  const ci = data.consolide.incidents
  const cc = data.consolide.controles
  const cau = data.consolide.audit
  const cap = data.consolide.appetit
  const ck = data.consolide.kri
  const cd = data.consolide.dora
  const euros = (n: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
  const mod = data.modules
  const nbCols = 5 + (mod.incidents ? 1 : 0) + (mod.controles ? 1 : 0) + (mod.audit ? 1 : 0) + (mod.appetit ? 1 : 0) + (mod.kri ? 1 : 0) + (mod.reglementaire ? 1 : 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">📊 {p.title}</h1>
        <span className="text-xs text-gray-400">{p.scope.replace('{n}', String(data.orgCount))}</span>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{p.subtitle}</p>

      <RiskFiltersBar
        filters={filters} onChange={setFilters} taxo={taxo} tr={tr}
        processus={procs} entites={entites} onExport={exportAs}
      />

      {/* Synthèse consolidée */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <Tile label={p.total} value={cr.total} />
        <Tile label={p.eleves} value={cr.eleve} tone="red" />
        <Tile label={p.moyens} value={cr.moyen} tone="amber" />
        <Tile label={p.faibles} value={cr.faible} tone="green" />
        <Tile label={p.avancement} value={`${ca.tauxAvancement}%`} />
        <Tile label={p.enRetard} value={ca.enRetard} tone={ca.enRetard > 0 ? 'red' : undefined} />
      </div>

      {/* Bandeau cross-module : un groupe par module actif (3 lignes de défense) */}
      {(ci || cc || cau || cap || ck || cd) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {ci && <>
            <Tile label={p.perteNette} value={euros(ci.perteNette)} />
            <Tile label={p.incidentsOuverts} value={ci.ouverts} tone={ci.ouverts > 0 ? 'amber' : undefined} />
          </>}
          {cc && <>
            <Tile label={p.tauxConformite} value={cc.tauxConformite == null ? '—' : `${cc.tauxConformite}%`} tone={cc.tauxConformite != null && cc.tauxConformite < 80 ? 'red' : undefined} />
            <Tile label={p.anomalies} value={cc.anomalies} tone={cc.anomalies > 0 ? 'amber' : undefined} />
          </>}
          {cau && <>
            <Tile label={p.constatsCritiques} value={cau.critiques} tone={cau.critiques > 0 ? 'red' : undefined} />
            <Tile label={p.recosEnRetard} value={cau.recosEnRetard} tone={cau.recosEnRetard > 0 ? 'red' : undefined} />
          </>}
          {cap && <>
            <Tile label={p.horsAppetit} value={cap.horsAppetit} tone={cap.horsAppetit > 0 ? 'red' : undefined} />
            <Tile label={p.dansAppetit} value={`${cap.dansAppetit}/${cap.evalues}`} tone="green" />
          </>}
          {ck && <>
            <Tile label={p.kriCritiques} value={ck.critique} tone={ck.critique > 0 ? 'red' : undefined} />
            <Tile label={p.kriEnAlerte} value={ck.enAlerte} tone={ck.enAlerte > 0 ? 'amber' : undefined} />
          </>}
          {cd && <>
            <Tile label={p.doraMajeurs} value={cd.majeurs} tone={cd.majeurs > 0 ? 'red' : undefined} />
            <Tile label={p.doraEvalues} value={cd.evalues} />
          </>}
        </div>
      )}

      {/* Ventilation par entité */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-3">{p.colOrg}</th>
              <th className="px-4 py-3">{p.colPosture}</th>
              <th className="px-4 py-3 text-right">{p.colTotal}</th>
              <th className="px-4 py-3 text-right">{p.colEleves}</th>
              <th className="px-4 py-3">{p.colPlan}</th>
              {mod.incidents && <th className="px-4 py-3 text-right">{p.colIncidents}</th>}
              {mod.controles && <th className="px-4 py-3 text-right">{p.colConformite}</th>}
              {mod.audit && <th className="px-4 py-3 text-right">{p.colConstats}</th>}
              {mod.appetit && <th className="px-4 py-3 text-right">{p.colHorsAppetit}</th>}
              {mod.kri && <th className="px-4 py-3 text-right">{p.colKri}</th>}
              {mod.reglementaire && <th className="px-4 py-3 text-right">{p.colDora}</th>}
            </tr>
          </thead>
          <tbody>
            {data.parOrg.length === 0 ? <tr><td colSpan={nbCols} className="px-4 py-6 text-center text-gray-400 italic">{p.empty}</td></tr>
              : data.parOrg.map(o => (
                <tr key={o.orgId} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{o.orgNom}</td>
                  <td className="px-4 py-3"><PostureBar t={o.risques} /></td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{o.risques.total}</td>
                  <td className="px-4 py-3 text-right">{o.risques.eleve > 0 ? <span className="text-red-600 dark:text-red-400 font-semibold">{o.risques.eleve}</span> : <span className="text-gray-400">0</span>}</td>
                  <td className={`px-4 py-3 ${progressColor(o.actions)}`}>
                    {o.actions.total === 0 ? <span className="text-gray-400">—</span> : (
                      <span>{o.actions.tauxAvancement}% · {o.actions.faits}/{o.actions.total}{o.actions.enRetard > 0 && <span className="ml-1">⚠ {o.actions.enRetard}</span>}</span>
                    )}
                  </td>
                  {mod.incidents && (
                    <td className="px-4 py-3 text-right">
                      {o.incidents && o.incidents.total > 0
                        ? <span className={o.incidents.ouverts > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-600 dark:text-gray-300'}>{o.incidents.ouverts}/{o.incidents.total}</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                  )}
                  {mod.controles && (
                    <td className="px-4 py-3 text-right">
                      {o.controles && o.controles.tauxConformite != null
                        ? <span className={o.controles.tauxConformite < 80 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-600 dark:text-gray-300'}>{o.controles.tauxConformite}%</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                  )}
                  {mod.audit && (
                    <td className="px-4 py-3 text-right">
                      {o.audit && o.audit.critiques > 0
                        ? <span className="text-red-600 dark:text-red-400 font-semibold">{o.audit.critiques}</span>
                        : <span className="text-gray-400">{o.audit && o.audit.constats > 0 ? '0' : '—'}</span>}
                    </td>
                  )}
                  {mod.appetit && (
                    <td className="px-4 py-3 text-right">
                      {o.horsAppetit && o.horsAppetit > 0
                        ? <span className="text-red-600 dark:text-red-400 font-semibold">{o.horsAppetit}</span>
                        : <span className="text-gray-400">0</span>}
                    </td>
                  )}
                  {mod.kri && (
                    <td className="px-4 py-3 text-right">
                      {o.kriEnAlerte && o.kriEnAlerte > 0
                        ? <span className="text-amber-600 dark:text-amber-400 font-semibold">{o.kriEnAlerte}</span>
                        : <span className="text-gray-400">0</span>}
                    </td>
                  )}
                  {mod.reglementaire && (
                    <td className="px-4 py-3 text-right">
                      {o.doraMajeurs && o.doraMajeurs > 0
                        ? <span className="text-red-600 dark:text-red-400 font-semibold">{o.doraMajeurs}</span>
                        : <span className="text-gray-400">0</span>}
                    </td>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-4">
        {p.links}{' '}
        <Link href="/cartographie" className="text-ebios-600 hover:underline">{t.nav.cartographie}</Link>
        {' · '}
        <Link href="/conformite" className="text-ebios-600 hover:underline">{t.nav.conformite}</Link>
      </p>
    </div>
  )
}

function Tile({ label, value, tone }: { label: string; value: number | string; tone?: 'red' | 'amber' | 'green' }) {
  const color = tone === 'red' ? 'text-red-600 dark:text-red-400' : tone === 'amber' ? 'text-amber-600 dark:text-amber-400' : tone === 'green' ? 'text-green-600 dark:text-green-400' : 'text-gray-800 dark:text-gray-100'
  return (
    <div className="card p-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}
