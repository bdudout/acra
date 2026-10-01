'use client'

// ─── Relances automatiques (questionnaires, préconisations, plans d'action) : lecture 2ᵉ ligne, édition ADMIN ─
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import type { RelancesConfig } from '@/lib/relances'

type Etat = { canEdit: boolean; config: RelancesConfig }

export default function RelancesConfigPanel() {
  const { t } = useTranslation()
  const q = t.questionnaires
  const r = q.relances
  const [etat, setEtat] = useState<Etat | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { void fetch('/api/relances/config').then(async res => (res.ok ? setEtat(await res.json()) : setError(q.error))) }, [q.error])

  async function enregistrer() {
    if (!etat) return
    setBusy(true); setMsg(null); setError(null)
    try {
      const res = await fetch('/api/relances/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(etat.config) })
      if (!res.ok) { setError(q.error); return }
      setEtat({ ...etat, config: (await res.json()).config }); setMsg(r.enregistre)
    } finally { setBusy(false) }
  }

  if (!etat) return error ? <p role="alert" className="text-sm text-red-600">{error}</p> : <p className="text-sm text-gray-500">{q.loading}</p>
  const set = (patch: Partial<RelancesConfig>) => setEtat({ ...etat, config: { ...etat.config, ...patch } })
  const inp = 'mt-1 w-32 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100'
  const lbl = 'block text-xs text-gray-600 dark:text-gray-300'
  return <section className="card max-w-2xl space-y-3 p-4" aria-labelledby="relances-titre">
    <h2 id="relances-titre" className="font-semibold text-gray-800 dark:text-gray-100">{r.titre}</h2>
    <p className="text-sm text-gray-600 dark:text-gray-300">{r.aide}</p>
    <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" disabled={!etat.canEdit} checked={etat.config.actives} onChange={e => set({ actives: e.target.checked })} />{r.actives}</label>
    <div className="flex flex-wrap gap-6">
      <label className={lbl}>{r.joursAvant}<input type="number" min={1} max={90} className={`${inp} block`} disabled={!etat.canEdit} value={etat.config.joursAvant} onChange={e => set({ joursAvant: Number(e.target.value) })} /></label>
      <label className={lbl}>{r.periodiciteJours}<input type="number" min={0} max={180} className={`${inp} block`} disabled={!etat.canEdit} value={etat.config.periodiciteJours} onChange={e => set({ periodiciteJours: Number(e.target.value) })} />
        <span className="mt-1 block text-gray-500 dark:text-gray-400">{r.periodiciteAide}</span></label>
      <label className={lbl}>{r.attenteJours}<input type="number" min={1} max={60} className={`${inp} block`} disabled={!etat.canEdit} value={etat.config.attenteJours} onChange={e => set({ attenteJours: Number(e.target.value) })} />
        <span className="mt-1 block max-w-xs text-gray-500 dark:text-gray-400">{r.attenteAide}</span></label>
    </div>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" disabled={!etat.canEdit} checked={etat.config.tableauBordMensuel} onChange={e => set({ tableauBordMensuel: e.target.checked })} />
      <span>{r.tableauBord}<span className="block text-xs text-gray-500 dark:text-gray-400">{r.tableauBordAide}</span></span></label>
    {etat.canEdit
      ? <button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => void enregistrer()}>{q.save}</button>
      : <p className="text-xs text-gray-500 dark:text-gray-400">{r.lectureSeule}</p>}
    {msg && <p role="status" className="text-sm text-green-700 dark:text-green-400">{msg}</p>}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
  </section>
}
