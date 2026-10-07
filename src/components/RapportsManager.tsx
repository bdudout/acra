'use client'

// ─── Rapports GRC : éditions figées ──────────────────────────────────────────
// Liste des éditions de l'organisation active et génération d'un brouillon
// (rapport × période × langue des libellés). La validation se fait sur la page de
// l'édition (cycle relu → validé → diffusé, quatre-yeux).

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileBarChart, Plus } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import ModuleGuide from '@/components/ModuleGuide'
import RapportsGabaritsEditor from '@/components/RapportsGabaritsEditor'
import { PERIODE_PRESETS, periodePreset } from '@/lib/rapport-model'

interface EditionRow { id: string; code: string; statut: string; periodeDebut: string; periodeFin: string; createdAt: string }
const inp = 'px-2 py-1.5 rounded-sm border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm'
const LANGS = ['fr', 'en', 'de', 'es', 'it']

export const STATUT_BADGE: Record<string, string> = {
  BROUILLON: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  RELU: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
  VALIDE: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  DIFFUSE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
}

export default function RapportsManager() {
  const { t, locale } = useTranslation()
  const r = t.rapports
  const router = useRouter()
  const [editions, setEditions] = useState<EditionRow[]>([])
  const [disponibles, setDisponibles] = useState<{ code: string }[]>([])
  const [canWrite, setCanWrite] = useState(false)
  const [livrableDora, setLivrableDora] = useState(false)
  const [anneeDora, setAnneeDora] = useState(new Date().getUTCFullYear())
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [preset, setPreset] = useState<string>('TRIMESTRE_PRECEDENT')
  const [debut, setDebut] = useState('')
  const [fin, setFin] = useState('')
  const [langue, setLangue] = useState<string>(locale)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const catalogue = { ...r.catalogue, ...r.catalogueCtl, ...r.catalogueAud } as Record<string, { titre: string; desc: string }>
  const presets = r.presets as Record<string, string>

  useEffect(() => {
    fetch('/api/rapports').then(x => (x.ok ? x.json() : null)).then(d => {
      if (d) { setEditions(d.editions ?? []); setDisponibles(d.disponibles ?? []); setCanWrite(!!d.canWrite); setLivrableDora(!!d.livrableDora); setCode(c => c || d.disponibles?.[0]?.code || '') }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function generer() {
    const periode = preset === 'PERSO' ? { debut, fin } : periodePreset(preset as (typeof PERIODE_PRESETS)[number], new Date())
    setBusy(true); setError(null)
    const res = await fetch('/api/rapports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, periode, langue }) }).catch(() => null)
    const d = await res?.json().catch(() => ({}))
    setBusy(false)
    if (!res || !res.ok || !d?.id) { setError((r.errors as Record<string, string>)[d?.error] ?? String(d?.error ?? res?.status ?? '—')); return }
    router.push(`/rapports/${d.id}`)
  }

  const day = (iso: string) => new Date(iso).toLocaleDateString(locale, { timeZone: 'UTC' })
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100"><FileBarChart size={22} className="inline align-[-0.15em] mr-2" aria-hidden="true" />{r.title}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{r.subtitle}</p>
      </header>
      <ModuleGuide guide={r.guide} />
      {canWrite && !open && <button type="button" onClick={() => setOpen(true)} className="btn-primary text-sm inline-flex items-center gap-1.5"><Plus size={15} aria-hidden="true" />{r.generer}</button>}
      {!loading && !canWrite && <p className="text-xs text-gray-500">{r.lecteur}</p>}
      {open && (
        <section className="card p-4 space-y-3" aria-label={r.generer}>
          <div className="flex flex-wrap gap-3">
            <label className="text-xs text-gray-500">{r.choisir}
              <select aria-label={r.choisir} value={code} onChange={e => setCode(e.target.value)} className={`${inp} block mt-1`}>
                {disponibles.map(d => <option key={d.code} value={d.code}>{catalogue[d.code]?.titre ?? d.code}</option>)}
              </select>
            </label>
            <label className="text-xs text-gray-500">{r.periode}
              <select aria-label={r.periode} value={preset} onChange={e => setPreset(e.target.value)} className={`${inp} block mt-1`}>
                {[...PERIODE_PRESETS, 'PERSO'].map(p => <option key={p} value={p}>{presets[p]}</option>)}
              </select>
            </label>
            {preset === 'PERSO' && (<>
              <label className="text-xs text-gray-500">{r.debut}<input type="date" aria-label={r.debut} value={debut} onChange={e => setDebut(e.target.value)} className={`${inp} block mt-1`} /></label>
              <label className="text-xs text-gray-500">{r.fin}<input type="date" aria-label={r.fin} value={fin} onChange={e => setFin(e.target.value)} className={`${inp} block mt-1`} /></label>
            </>)}
            <label className="text-xs text-gray-500">{r.langue}
              <select aria-label={r.langue} value={langue} onChange={e => setLangue(e.target.value)} className={`${inp} block mt-1`}>
                {LANGS.map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
              </select>
            </label>
          </div>
          {catalogue[code] && <p className="text-xs text-gray-500">{catalogue[code].desc}</p>}
          <div className="flex items-center gap-2">
            <button type="button" disabled={busy || !code} onClick={generer} className="btn-primary text-sm disabled:opacity-50">{r.generate}</button>
            <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-500 hover:underline">{r.cancel}</button>
            {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
          </div>
        </section>
      )}
      {livrableDora && (
        <section className="card p-4 flex flex-wrap items-end justify-between gap-3" aria-label={r.livrableDora.titre}>
          <div className="max-w-2xl">
            <h2 className="font-semibold text-gray-800 dark:text-gray-100">{r.livrableDora.titre}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{r.livrableDora.desc}</p>
          </div>
          <div className="flex items-end gap-2">
            <label className="text-xs text-gray-500">{r.livrableDora.annee}
              <input type="number" min={2023} max={2100} value={anneeDora} onChange={e => setAnneeDora(Number(e.target.value) || new Date().getUTCFullYear())} className={`${inp} block mt-1 w-24`} />
            </label>
            <a href={`/api/reglementaire/reexamen-dora?annee=${anneeDora}`} className="btn-secondary text-sm">{r.livrableDora.telecharger}</a>
          </div>
        </section>
      )}
      <div className="card overflow-x-auto">
        {loading ? <p className="p-5 text-sm text-gray-400">…</p> : editions.length === 0 ? <p className="p-5 text-sm italic text-gray-400">{r.empty}</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-2">{r.colRapport}</th><th className="px-4 py-2">{r.colPeriode}</th><th className="px-4 py-2">{r.colStatut}</th><th className="px-4 py-2">{r.colCree}</th><th className="px-4 py-2" />
            </tr></thead>
            <tbody>
              {editions.map(e => (
                <tr key={e.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-100">{catalogue[e.code]?.titre ?? e.code}</td>
                  <td className="px-4 py-2 text-xs tabular-nums">{day(e.periodeDebut)} → {day(e.periodeFin)}</td>
                  <td className="px-4 py-2"><span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUT_BADGE[e.statut] ?? STATUT_BADGE.BROUILLON}`}>{(r.statuts as Record<string, string>)[e.statut] ?? e.statut}</span></td>
                  <td className="px-4 py-2 text-xs text-gray-500">{new Date(e.createdAt).toLocaleDateString(locale)}</td>
                  <td className="px-4 py-2 text-right"><Link href={`/rapports/${e.id}`} className="text-ebios-700 hover:underline text-xs">{r.actions.voir}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <RapportsGabaritsEditor codes={disponibles.map(d => d.code)} />
    </div>
  )
}
