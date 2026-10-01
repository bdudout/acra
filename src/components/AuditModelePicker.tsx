'use client'

// ─── Choix d'un modèle de mission : par référentiel, par processus ou par risque ─
// Au choix de l'auditeur. Un modèle PRÉREMPLIT le formulaire (intitulé si vide, points de revue,
// processus si l'organisation l'a déjà) ; rien n'est enregistré tant que l'auditeur ne valide pas.

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'

type Template = { key: string; origin: 'REFERENTIEL' | 'CATALOGUE'; title: string; points: string[]; referentiel?: { id: string; nom: string }; processKey?: string; riskKeys: string[] }
type Data = {
  templates: Template[]; processes: { key: string; title: string }[]; risks: { key: string; title: string }[]
  ownedProcesses: Record<string, string>; ownedRiskKeys: string[]
}
type Angle = 'REFERENTIEL' | 'PROCESSUS' | 'RISQUE'
export type AuditModeleChoice = { title: string; points: string[]; processusId: string | null }

export default function AuditModelePicker({ onApply }: { onApply: (choice: AuditModeleChoice) => void }) {
  const { t, locale } = useTranslation()
  const m = t.auditModeles
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<Data | null>(null)
  const [angle, setAngle] = useState<Angle>('REFERENTIEL')
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      const res = await fetch(`/api/audit/modeles?locale=${locale}`)
      if (!res.ok) throw new Error('load')
      setData(await res.json() as Data)
    } catch { setError(m.error) }
  }

  const catalogue = (data?.templates ?? []).filter(x => x.origin === 'CATALOGUE')
  const groups: { key: string; title: string; owned: boolean; items: Template[] }[] =
    angle === 'REFERENTIEL'
      ? [{ key: 'ref', title: '', owned: true, items: (data?.templates ?? []).filter(x => x.origin === 'REFERENTIEL') }]
      : angle === 'PROCESSUS'
        ? (data?.processes ?? []).map(p => ({ key: p.key, title: p.title, owned: !!data?.ownedProcesses[p.key], items: catalogue.filter(x => x.processKey === p.key) })).filter(g => g.items.length)
        : (data?.risks ?? []).map(r => ({ key: r.key, title: r.title, owned: !!data?.ownedRiskKeys.includes(r.key), items: catalogue.filter(x => x.riskKeys.includes(r.key)) })).filter(g => g.items.length)

  function apply(x: Template) {
    onApply({ title: x.title, points: x.points, processusId: x.processKey ? data?.ownedProcesses[x.processKey] ?? null : null })
    setOpen(false)
  }

  return <div>
    <button type="button" className="btn-secondary text-xs" onClick={() => { setOpen(o => !o); if (!data) void load() }}>{m.open}</button>
    {open && <div role="dialog" aria-label={m.title} className="mt-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700 space-y-2">
      <p className="text-xs text-gray-600 dark:text-gray-300">{m.hint}</p>
      <div role="tablist" aria-label={m.angleLabel} className="flex flex-wrap gap-2">
        {(['REFERENTIEL', 'PROCESSUS', 'RISQUE'] as Angle[]).map(a => (
          <button key={a} type="button" role="tab" aria-selected={angle === a} onClick={() => setAngle(a)}
            className={`rounded-full px-3 py-1 text-xs border ${angle === a ? 'bg-ebios-600 text-white border-ebios-600' : 'border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-200'}`}>{m.angles[a]}</button>
        ))}
      </div>
      {angle === 'REFERENTIEL' && locale !== 'fr' && <p className="text-xs text-amber-800 dark:text-amber-300">{m.frenchOnly}</p>}
      {error && <p role="alert" className="text-xs text-red-700 dark:text-red-300">{error}</p>}
      <div className="max-h-72 overflow-y-auto space-y-2">
        {groups.map(g => <div key={g.key}>
          {g.title && <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">{g.title}{!g.owned && <span className="ml-2 font-normal text-gray-500 dark:text-gray-400">({angle === 'PROCESSUS' ? m.processMissing : m.riskMissing})</span>}</p>}
          {g.items.map(x => (
            <div key={x.key} data-key={x.key} className="flex items-start justify-between gap-2 rounded px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-800">
              <span className="min-w-0 text-sm text-gray-900 dark:text-gray-100">{x.title}<span className="block text-xs text-gray-500 dark:text-gray-400">{m.points.replace('{n}', String(x.points.length))}</span></span>
              <button type="button" className="btn-secondary shrink-0 px-2 py-1 text-xs" onClick={() => apply(x)}>{m.use}</button>
            </div>
          ))}
        </div>)}
      </div>
    </div>}
  </div>
}
