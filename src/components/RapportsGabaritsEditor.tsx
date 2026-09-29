'use client'

// ─── Gabarits de rapports (ADMIN) : titre, introduction, sections masquées ───

import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { FREQUENCES_PLANIFICATION, type GabaritsRapports, type Planification } from '@/lib/rapport-masquage'

const inp = 'px-2 py-1.5 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm w-full'

export default function RapportsGabaritsEditor({ codes }: { codes: string[] }) {
  const { t } = useTranslation()
  const r = t.rapports
  const catalogue = { ...r.catalogue, ...r.catalogueCtl, ...r.catalogueAud } as Record<string, { titre: string }>
  const [gabarits, setGabarits] = useState<GabaritsRapports>({})
  const [planifies, setPlanifies] = useState<Planification[]>([])
  const [canEdit, setCanEdit] = useState(false)
  const [code, setCode] = useState(codes[0] ?? '')
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => { fetch('/api/rapports/config').then(x => (x.ok ? x.json() : null)).then(d => { if (d) { setGabarits(d.config?.gabarits ?? {}); setPlanifies(d.config?.planifies ?? []); setCanEdit(!!d.canEdit) } }).catch(() => {}) }, [])
  useEffect(() => { setCode(c => c || codes[0] || '') }, [codes])
  if (!canEdit || !code) return null

  const g = gabarits[code] ?? {}
  const maj = (patch: Partial<NonNullable<GabaritsRapports[string]>>) => setGabarits(x => ({ ...x, [code]: { ...x[code], ...patch } }))
  async function save() {
    setMsg(null)
    const res = await fetch('/api/rapports/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gabarits, planifies }) })
    const d = await res.json().catch(() => ({}))
    if (res.ok) { setGabarits(d.config.gabarits); setPlanifies(d.config.planifies ?? []); setMsg(r.gabaritsSaved) }
  }

  return (
    <section className="card mt-6 space-y-3" aria-labelledby="rapports-gabarits">
      <h2 id="rapports-gabarits" className="font-semibold">{r.gabaritsTitre}</h2>
      <select aria-label={r.gabaritsTitre} value={code} onChange={e => setCode(e.target.value)} className={inp}>
        {codes.map(c => <option key={c} value={c}>{catalogue[c]?.titre ?? c}</option>)}
      </select>
      <label className="text-xs text-gray-500 block">{r.gabaritTitre}
        <input aria-label={r.gabaritTitre} className={`${inp} mt-1`} maxLength={150} value={g.titre ?? ''} onChange={e => maj({ titre: e.target.value })} />
      </label>
      <label className="text-xs text-gray-500 block">{r.gabaritIntro}
        <textarea aria-label={r.gabaritIntro} className={`${inp} mt-1`} rows={3} maxLength={2000} value={g.introduction ?? ''} onChange={e => maj({ introduction: e.target.value })} />
      </label>
      <label className="text-xs text-gray-500 block">{r.gabaritSections}
        <input aria-label={r.gabaritSections} className={`${inp} mt-1`} value={(g.sectionsMasquees ?? []).join(', ')} onChange={e => maj({ sectionsMasquees: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })} />
      </label>
      <label className="text-xs text-gray-500 block">{r.planifTitre}
        <select aria-label={r.planifTitre} className={`${inp} mt-1`} value={planifies.find(x => x.code === code)?.frequence ?? ''}
          onChange={e => setPlanifies(ps => [...ps.filter(x => x.code !== code), ...(e.target.value ? [{ code: code as Planification['code'], frequence: e.target.value as Planification['frequence'] }] : [])])}>
          <option value="">{r.planifAucune}</option>
          {FREQUENCES_PLANIFICATION.map(f => <option key={f} value={f}>{(r.planifFreq as Record<string, string>)[f]}</option>)}
        </select>
      </label>
      <div className="flex items-center gap-3">
        <button type="button" className="btn-primary text-sm" onClick={save}>{r.gabaritsSave}</button>
        {msg && <span role="status" className="text-xs text-green-700 dark:text-green-300">{msg}</span>}
      </div>
    </section>
  )
}
