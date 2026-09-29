'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { uid } from '@/lib/uid'

type Tier = { id: string; nom: string; type: string }

/** Tiers du projet : suggestions organisationnelles, puis persistance isolée. */
export default function ProjectTiers({ analyseId, initial, editable }: { analyseId: string; initial: Tier[]; editable: boolean }) {
  const { t } = useTranslation()
  const p = t.projet360 as typeof t.projet360 & { tiers: { title: string; desc: string; add: string; save: string; saved: string; error: string; name: string; type: string } }
  const [tiers, setTiers] = useState<Tier[]>(initial)
  const [known, setKnown] = useState<string[]>([])
  const [message, setMessage] = useState('')
  useEffect(() => { fetch('/api/tiers/names').then(r => r.ok ? r.json() : null).then(d => setKnown(Array.isArray(d?.noms) ? d.noms : [])).catch(() => {}) }, [])
  const add = () => setTiers(v => [...v, { id: uid(), nom: '', type: 'PRESTATAIRE' }])
  async function save() {
    const res = await fetch(`/api/analyses/${analyseId}/tiers`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ partiesPrenantes: tiers }) })
    setMessage(res.ok ? p.tiers.saved : p.tiers.error)
  }
  return <section className="card p-5 mt-5"><h2 className="font-semibold text-gray-900 dark:text-gray-100">{p.tiers.title}</h2><p className="text-sm text-gray-500 dark:text-gray-300 mt-1">{p.tiers.desc}</p>
    <datalist id="project-known-tiers">{known.map(n => <option key={n} value={n} />)}</datalist>
    <div className="mt-3 space-y-2">{tiers.map((tier, i) => <div key={tier.id} className="flex gap-2"><input className="input flex-1" list="project-known-tiers" aria-label={`${p.tiers.name} ${i + 1}`} value={tier.nom} disabled={!editable} onChange={e => setTiers(v => v.map((x, n) => n === i ? { ...x, nom: e.target.value } : x))} /><select className="input w-40" aria-label={`${p.tiers.type} ${i + 1}`} value={tier.type} disabled={!editable} onChange={e => setTiers(v => v.map((x, n) => n === i ? { ...x, type: e.target.value } : x))}><option value="PRESTATAIRE">Prestataire</option><option value="FOURNISSEUR">Fournisseur</option><option value="PARTENAIRE">Partenaire</option></select></div>)}</div>
    {editable && <div className="mt-3 flex gap-2"><button type="button" className="btn-secondary text-sm" onClick={add}>{p.tiers.add}</button><button type="button" className="btn-primary text-sm" onClick={save}>{p.tiers.save}</button></div>}{message && <p role="status" className="text-xs mt-2">{message}</p>}
  </section>
}
