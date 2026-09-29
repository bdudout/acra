'use client'

// ─── « Partir d'un projet 360 » (création d'une analyse cyber) ────────────────
// N'apparaît que si le module Projets 360 est actif et qu'au moins un projet
// existe (la liste vient de /api/projets, vide quand le module est inactif).

import { Briefcase } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'

export interface ProjetOption { id: string; nom: string; description?: string | null }

export default function ProjetSourcePicker({ projets, value, onChange }: { projets: ProjetOption[]; value: string; onChange: (p: ProjetOption | null) => void }) {
  const { t } = useTranslation()
  if (projets.length === 0) return null
  const n = t.newAnalysis
  return (
    <div className="rounded-lg border border-ebios-200 bg-ebios-50/50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50">
      <label className="label" htmlFor="projet-source"><Briefcase size={14} className="inline align-[-0.15em] mr-1" aria-hidden="true" />{n.fromProjet}</label>
      <select id="projet-source" className="input" value={value} onChange={e => onChange(projets.find(p => p.id === e.target.value) ?? null)}>
        <option value="">{n.fromProjetNone}</option>
        {projets.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
      </select>
      <p className="text-xs text-gray-500 mt-1">{n.fromProjetHint}</p>
    </div>
  )
}
