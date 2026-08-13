'use client'

import { Landmark } from 'lucide-react'
import { Fragment, useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'

type DoraClasse = 'MAJEUR' | 'SIGNIFICATIF' | 'MINEUR'
interface Criteres {
  clientsAffectes?: number | null; transactionsAffectees?: number | null; dureeIndispoMinutes?: number | null; impactEconomique?: number | null
  reputation?: boolean; etendueGeo?: boolean; pertesDonnees?: boolean; serviceCritique?: boolean
}
interface IncidentRow {
  id: string; intitule: string; statut: string; dateSurvenance: string | null
  montantBrut: number | null; recuperations: number | null
  criteres: Criteres; evalue: boolean; classe: DoraClasse | null; declenches: string[]
}
interface Data {
  active: boolean; incidents: IncidentRow[]
  synthese: { evalues: number; majeurs: number; significatifs: number; mineurs: number }
  ldc: { nbIncidents: number; perteBruteTotale: number; recuperationsTotales: number; perteNetteTotale: number }
  canAssess: boolean
}

const CLASSE_BADGE: Record<DoraClasse, string> = {
  MAJEUR: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
  SIGNIFICATIF: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  MINEUR: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
}
const NUM_FIELDS = ['clientsAffectes', 'transactionsAffectees', 'dureeIndispoMinutes', 'impactEconomique'] as const
const BOOL_FIELDS = ['reputation', 'etendueGeo', 'pertesDonnees', 'serviceCritique'] as const

export default function ReglementaireManager({ canAssess }: { canAssess: boolean }) {
  const { t, locale } = useTranslation()
  const r = t.reglementaire
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, string | boolean>>({})

  async function reload() {
    const d = await fetch('/api/reglementaire/dora').then(x => x.ok ? x.json() : null)
    setData(d); setLoading(false)
  }
  useEffect(() => { reload() }, [])

  const euros = (n: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

  function openEdit(row: IncidentRow) {
    setEditing(row.id)
    const f: Record<string, string | boolean> = {}
    for (const k of NUM_FIELDS) f[k] = row.criteres[k] == null ? '' : String(row.criteres[k])
    for (const k of BOOL_FIELDS) f[k] = row.criteres[k] === true
    setForm(f)
  }
  async function save(id: string) {
    const body: Record<string, unknown> = {}
    for (const k of NUM_FIELDS) body[k] = form[k] === '' ? null : Number(form[k])
    for (const k of BOOL_FIELDS) body[k] = form[k] === true
    const res = await fetch(`/api/reglementaire/dora/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) { setEditing(null); reload() }
  }

  if (loading) return <p className="text-gray-400">…</p>
  if (!data?.active) return <p className="text-gray-400">{r.inactive}</p>
  const s = data.synthese, l = data.ldc

  return (
    <div>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100"><Landmark size={22} className="inline align-[-0.15em] mr-2" aria-hidden="true" /> {r.title}</h1>
        <a href="/api/reglementaire/dora?format=csv" className="btn-secondary text-sm">{r.exportCsv}</a>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{r.subtitle}</p>
      <p className="text-xs text-gray-400 italic mb-5">{r.disclaimer}</p>

      {/* KPI DORA */}
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">{r.doraTitle}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Tile label={r.kpiMajeurs} value={s.majeurs} tone={s.majeurs > 0 ? 'red' : undefined} />
        <Tile label={r.kpiSignificatifs} value={s.significatifs} tone={s.significatifs > 0 ? 'amber' : undefined} />
        <Tile label={r.kpiMineurs} value={s.mineurs} tone="green" />
        <Tile label={r.kpiEvalues} value={s.evalues} />
      </div>

      {/* LDC (ACPR) */}
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">{r.ldcTitle}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Tile label={r.ldcIncidents} value={l.nbIncidents} />
        <Tile label={r.ldcBrut} value={euros(l.perteBruteTotale)} />
        <Tile label={r.ldcRecup} value={euros(l.recuperationsTotales)} />
        <Tile label={r.ldcNet} value={euros(l.perteNetteTotale)} tone={l.perteNetteTotale > 0 ? 'red' : undefined} />
      </div>

      {/* Registre d'incidents TIC */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-3">{r.colIncident}</th>
              <th className="px-4 py-3">{r.colClasse}</th>
              <th className="px-4 py-3">{r.colCriteres}</th>
              <th className="px-4 py-3 text-right">{r.colAction}</th>
            </tr>
          </thead>
          <tbody>
            {data.incidents.length === 0 ? <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400 italic">{r.empty}</td></tr>
              : data.incidents.map(row => (
                <Fragment key={row.id}>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800 dark:text-gray-100">{row.intitule}</div>
                      <div className="text-xs text-gray-400">{row.dateSurvenance ? new Date(row.dateSurvenance).toLocaleDateString(locale) : ''}</div>
                    </td>
                    <td className="px-4 py-3">
                      {row.classe
                        ? <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CLASSE_BADGE[row.classe]}`}>{r.classeLabels[row.classe]}</span>
                        : <span className="text-xs text-gray-400 italic">{r.nonEvalue}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {row.declenches.length > 0 ? row.declenches.map(d => (r.critereLabels as Record<string, string>)[d] ?? d).join(', ') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canAssess && <button onClick={() => editing === row.id ? setEditing(null) : openEdit(row)} className="text-ebios-600 hover:underline text-xs">{r.assess}</button>}
                    </td>
                  </tr>
                  {editing === row.id && (
                    <tr className="bg-gray-50 dark:bg-gray-800/40 border-b border-gray-100 dark:border-gray-800">
                      <td colSpan={4} className="px-4 py-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                          {NUM_FIELDS.map(f => (
                            <label key={f} className="text-xs text-gray-600 dark:text-gray-300 flex flex-col gap-1">
                              {(r.criteres as Record<string, string>)[f]}
                              <input type="number" min={0} className="input" value={String(form[f] ?? '')} onChange={e => setForm(x => ({ ...x, [f]: e.target.value }))} />
                            </label>
                          ))}
                          {BOOL_FIELDS.map(f => (
                            <label key={f} className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2 mt-4">
                              <input type="checkbox" checked={form[f] === true} onChange={e => setForm(x => ({ ...x, [f]: e.target.checked }))} />
                              {(r.criteres as Record<string, string>)[f]}
                            </label>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => save(row.id)} className="btn-primary text-sm">{r.save}</button>
                          <button onClick={() => setEditing(null)} className="btn-secondary text-sm">{r.cancel}</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
          </tbody>
        </table>
      </div>
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
