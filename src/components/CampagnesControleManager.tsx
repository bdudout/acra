'use client'

import { Plus, Trash2, AlertTriangle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import ConfirmDialog from '@/components/ConfirmDialog'

const STATUTS = ['PLANIFIEE', 'EN_COURS', 'CLOTUREE'] as const
const NIVEAUX = ['N1', 'N2'] as const

interface Avancement { total: number; faits: number; aFaire: number; anomalies: number; tauxAvancement: number }
interface Campagne {
  id: string; intitule: string; description: string | null; niveau: string; statut: string
  dateDebut: string | null; dateFin: string | null; controleIds: string[]
  avancement: Avancement; enRetard: boolean
}
interface ControleLite { id: string; intitule: string; niveau: string; actif: boolean }

const STATUT_BADGE: Record<string, string> = {
  PLANIFIEE: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  EN_COURS: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300',
  CLOTUREE: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
}

const emptyForm = { intitule: '', description: '', niveau: 'N1', statut: 'PLANIFIEE', dateDebut: '', dateFin: '', controleIds: [] as string[] }

export default function CampagnesControleManager({ canDefine }: { canDefine: boolean }) {
  const { t } = useTranslation()
  const c = t.campagneControle
  const [campagnes, setCampagnes] = useState<Campagne[]>([])
  const [controles, setControles] = useState<ControleLite[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })
  const [err, setErr] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

  async function reload() {
    const d = await fetch('/api/controles/campagnes').then(x => x.ok ? x.json() : null).catch(() => null)
    setCampagnes(d?.campagnes ?? [])
    setControles(d?.controles ?? [])
    setLoading(false)
  }
  useEffect(() => { reload() }, [])

  function openCreate() { setForm({ ...emptyForm }); setErr(null); setShowForm(true) }

  function toggleControle(id: string) {
    setForm(f => ({ ...f, controleIds: f.controleIds.includes(id) ? f.controleIds.filter(x => x !== id) : [...f.controleIds, id] }))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/controles/campagnes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setErr(d.error === 'intitule_requis' ? c.errorRequired : (d.error || 'Erreur'))
      return
    }
    setShowForm(false); reload()
  }
  async function del(id: string) { await fetch(`/api/controles/campagnes/${id}`, { method: 'DELETE' }); setConfirmDel(null); reload() }

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-ebios-500'

  if (loading) return <div className="text-center py-12 text-gray-500">{t.loading}</div>

  const total = campagnes.length
  const enCours = campagnes.filter(x => x.statut === 'EN_COURS').length
  const enRetard = campagnes.filter(x => x.enRetard).length
  const avgAvancement = total ? Math.round((campagnes.reduce((s, x) => s + x.avancement.tauxAvancement, 0) / total) * 100) : 0

  const kpi = (label: string, value: string | number, tone = 'text-gray-900 dark:text-gray-100') => (
    <div className="card p-4">
      <div className={`text-2xl font-bold ${tone} tabular-nums`}>{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 leading-snug mt-0.5">{label}</div>
    </div>
  )

  const fmtPeriode = (a: Campagne) => {
    const d = a.dateDebut ? a.dateDebut.slice(0, 10) : '…'
    const f = a.dateFin ? a.dateFin.slice(0, 10) : '…'
    return `${d} → ${f}`
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{c.title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">{c.subtitle}</p>
        </div>
        {canDefine && (
          <button onClick={openCreate}
            className="inline-flex items-center gap-1.5 bg-ebios-600 hover:bg-ebios-700 text-white text-sm font-medium py-2 px-3 rounded-lg">
            <Plus size={15} aria-hidden="true" /> {c.add}
          </button>
        )}
      </div>

      {!canDefine && (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
          {c.readOnly}
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpi(c.kpi.total, total)}
        {kpi(c.kpi.enCours, enCours)}
        {kpi(c.kpi.enRetard, enRetard, enRetard > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100')}
        {kpi(c.kpi.avancement, `${avgAvancement}%`)}
      </div>

      {/* Formulaire */}
      {showForm && canDefine && (
        <form onSubmit={save} className="card p-5 space-y-4">
          {err && <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 rounded-lg px-3 py-2 text-sm"><AlertTriangle size={14} className="inline align-[-0.15em] mr-1" aria-hidden="true" /> {err}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2"><span className="text-sm text-gray-700 dark:text-gray-300">{c.champ.intitule}</span>
              <input className={`mt-1 ${inputCls}`} value={form.intitule} onChange={e => setForm({ ...form, intitule: e.target.value })} required /></label>
            <label className="block sm:col-span-2"><span className="text-sm text-gray-700 dark:text-gray-300">{c.champ.description}</span>
              <input className={`mt-1 ${inputCls}`} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
            <label className="block"><span className="text-sm text-gray-700 dark:text-gray-300">{c.champ.niveau}</span>
              <select className={`mt-1 ${inputCls}`} value={form.niveau} onChange={e => setForm({ ...form, niveau: e.target.value })}>
                {NIVEAUX.map(n => <option key={n} value={n}>{n}</option>)}
              </select></label>
            <label className="block"><span className="text-sm text-gray-700 dark:text-gray-300">{c.champ.statut}</span>
              <select className={`mt-1 ${inputCls}`} value={form.statut} onChange={e => setForm({ ...form, statut: e.target.value })}>
                {STATUTS.map(s => <option key={s} value={s}>{c.statutOpt[s]}</option>)}
              </select></label>
            <label className="block"><span className="text-sm text-gray-700 dark:text-gray-300">{c.champ.dateDebut}</span>
              <input type="date" className={`mt-1 ${inputCls}`} value={form.dateDebut} onChange={e => setForm({ ...form, dateDebut: e.target.value })} /></label>
            <label className="block"><span className="text-sm text-gray-700 dark:text-gray-300">{c.champ.dateFin}</span>
              <input type="date" className={`mt-1 ${inputCls}`} value={form.dateFin} onChange={e => setForm({ ...form, dateFin: e.target.value })} /></label>
          </div>

          {/* Périmètre : sélection de contrôles */}
          <div>
            <span className="text-sm text-gray-700 dark:text-gray-300">{c.champ.controles}</span>
            {controles.length === 0 ? (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{c.noControles}</p>
            ) : (
              <div className="mt-1 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
                {controles.map(ct => (
                  <label key={ct.id} className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                    <input type="checkbox" checked={form.controleIds.includes(ct.id)} onChange={() => toggleControle(ct.id)} />
                    <span className="text-gray-700 dark:text-gray-200">{ct.intitule}</span>
                    <span className="ml-auto text-[10px] text-gray-400 tabular-nums">{ct.niveau}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button type="submit" className="bg-ebios-600 hover:bg-ebios-700 text-white text-sm font-medium py-2 px-4 rounded-lg">{t.save}</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-sm py-2 px-4">{t.cancel}</button>
          </div>
        </form>
      )}

      {/* Tableau */}
      {campagnes.length === 0 ? (
        <div className="card p-10 text-center text-gray-400 dark:text-gray-500 text-sm">{c.empty}</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs">
              <tr>
                <th className="text-left font-medium px-3 py-2">{c.col.campagne}</th>
                <th className="text-left font-medium px-3 py-2">{c.col.periode}</th>
                <th className="text-left font-medium px-3 py-2">{c.col.statut}</th>
                <th className="text-left font-medium px-3 py-2 w-48">{c.col.avancement}</th>
                <th className="text-left font-medium px-3 py-2">{c.col.anomalies}</th>
                {canDefine && <th className="px-3 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {campagnes.map(a => {
                const pct = Math.round(a.avancement.tauxAvancement * 100)
                return (
                  <tr key={a.id} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-800 dark:text-gray-100">{a.intitule}</div>
                      <div className="text-[11px] text-gray-400">{a.niveau} · {a.controleIds.length} {c.champ.controles.toLowerCase()}</div>
                    </td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">
                      {fmtPeriode(a)}
                      {a.enRetard && <span className="ml-1.5 text-[10px] text-red-600 dark:text-red-400 font-semibold">⚠ {c.enRetard}</span>}
                    </td>
                    <td className="px-3 py-2"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_BADGE[a.statut] ?? STATUT_BADGE.PLANIFIEE}`}>{c.statutOpt[a.statut as keyof typeof c.statutOpt] ?? a.statut}</span></td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden min-w-[3rem]">
                          <div className={`h-full rounded-full ${a.enRetard && pct < 100 ? 'bg-red-500' : pct >= 100 ? 'bg-green-500' : 'bg-ebios-500'}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums w-16 text-right">{c.faits.replace('{faits}', String(a.avancement.faits)).replace('{total}', String(a.avancement.total))}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {a.avancement.anomalies > 0
                        ? <span className="text-xs text-red-700 dark:text-red-400 font-semibold tabular-nums">{a.avancement.anomalies}</span>
                        : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    {canDefine && (
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <button onClick={() => setConfirmDel(a.id)} className="text-gray-400 hover:text-red-600 p-1" aria-label={t.delete}><Trash2 size={15} aria-hidden="true" /></button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {confirmDel && (
        <ConfirmDialog
          message={c.deleteConfirm}
          confirmLabel={t.delete}
          onConfirm={() => del(confirmDel)}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </div>
  )
}
