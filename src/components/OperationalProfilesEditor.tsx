'use client'

import { useState } from 'react'
import { OPERATIONAL_PROFILE_STATUSES, type OperationalProfileEntry, type OperationalProfileFramework } from '@/lib/operational-profiles'

type Catalog = { title: string; version: string; sourceUrl: string; items: { ref: string; label: string; description: string }[] }
type Profile = { framework: OperationalProfileFramework; catalog: Catalog; entries: OperationalProfileEntry[] }
type Labels = { current: string; target: string; save: string; saved: string; noAssessment: string; createAction: string; actionCreated: string }

const statusLabel: Record<string, string> = { NON_EVALUE: 'Non évalué', COUVERT: 'Couvert', PARTIEL: 'Partiel', NON_COUVERT: 'Non couvert', NON_APPLICABLE: 'Non applicable' }

/** Éditeur à granularité profil : une sauvegarde atomique par cadre évite les états partiels. */
export default function OperationalProfilesEditor({ profiles, canManage, labels }: { profiles: Profile[]; canManage: boolean; labels: Labels }) {
  const [state, setState] = useState(profiles)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [createdAction, setCreatedAction] = useState<string | null>(null)

  function update(framework: OperationalProfileFramework, ref: string, field: keyof OperationalProfileEntry, value: string) {
    setSaved(null)
    setState(previous => previous.map(profile => profile.framework !== framework ? profile : {
      ...profile,
      entries: profile.catalog.items.map(item => {
        const old = profile.entries.find(entry => entry.ref === item.ref) ?? { ref: item.ref, statut: 'NON_EVALUE' as const }
        return item.ref === ref ? { ...old, [field]: value } as OperationalProfileEntry : old
      }),
    }))
  }

  async function save(profile: Profile) {
    setSaving(profile.framework); setSaved(null)
    try {
      const res = await fetch('/api/operational-profiles', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ framework: profile.framework, entries: profile.entries }) })
      if (res.ok) setSaved(profile.framework)
    } finally { setSaving(null) }
  }
  async function createAction(profile: Profile, entry: OperationalProfileEntry) {
    const key = `${profile.framework}:${entry.ref}`
    setSaving(key); setCreatedAction(null)
    try {
      const res = await fetch('/api/operational-profiles/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ framework: profile.framework, ref: entry.ref, responsable: entry.responsable, description: entry.commentaire }) })
      if (res.ok) setCreatedAction(key)
    } finally { setSaving(null) }
  }

  return <div className="grid gap-5 md:grid-cols-2">{state.map(profile => <section key={profile.framework} className="card p-5">
    <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-gray-900 dark:text-gray-100">{profile.catalog.title}</h2><p className="text-xs text-gray-500">{profile.catalog.version}</p></div><a className="text-xs text-ebios-600 hover:underline" href={profile.catalog.sourceUrl} target="_blank" rel="noreferrer">Source officielle</a></div>
    <div className="mt-4 space-y-4">{profile.catalog.items.map(item => {
      const entry = profile.entries.find(value => value.ref === item.ref) ?? { ref: item.ref, statut: 'NON_EVALUE' as const }
      return <div key={item.ref} className="border-t border-gray-100 dark:border-gray-700 pt-3"><p className="text-sm font-medium text-gray-800 dark:text-gray-100">{item.ref} · {item.label}</p><p className="text-xs text-gray-500 mt-0.5">{item.description}</p><div className="grid grid-cols-2 gap-2 mt-2"><label className="text-xs text-gray-600 dark:text-gray-300">{labels.current}<select aria-label={`${item.ref} état courant`} disabled={!canManage} value={entry.statut} onChange={event => update(profile.framework, item.ref, 'statut', event.target.value)} className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-800">{OPERATIONAL_PROFILE_STATUSES.map(status => <option key={status} value={status}>{statusLabel[status]}</option>)}</select></label><label className="text-xs text-gray-600 dark:text-gray-300">{labels.target}<select aria-label={`${item.ref} cible`} disabled={!canManage} value={entry.cible ?? 'NON_EVALUE'} onChange={event => update(profile.framework, item.ref, 'cible', event.target.value)} className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-800">{OPERATIONAL_PROFILE_STATUSES.map(status => <option key={status} value={status}>{statusLabel[status]}</option>)}</select></label></div>
        {canManage && <div className="grid grid-cols-1 gap-2 mt-2"><input aria-label={`${item.ref} responsable`} value={entry.responsable ?? ''} onChange={event => update(profile.framework, item.ref, 'responsable', event.target.value)} placeholder="Responsable" className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-800" /><textarea aria-label={`${item.ref} justification`} value={entry.commentaire ?? ''} onChange={event => update(profile.framework, item.ref, 'commentaire', event.target.value)} placeholder="Justification / preuve" className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-800" rows={2} />{(entry.statut === 'PARTIEL' || entry.statut === 'NON_COUVERT') && <div className="flex items-center gap-2"><button type="button" disabled={saving === `${profile.framework}:${entry.ref}`} onClick={() => createAction(profile, entry)} className="text-xs font-medium text-ebios-700 hover:underline">{labels.createAction}</button>{createdAction === `${profile.framework}:${entry.ref}` && <span className="text-xs text-green-700">{labels.actionCreated}</span>}</div>}</div>}
      </div>
    })}</div>
    {canManage && <div className="mt-4 flex items-center gap-3"><button type="button" disabled={saving === profile.framework} onClick={() => save(profile)} className="btn-primary text-sm">{labels.save}</button>{saved === profile.framework && <span className="text-xs text-green-700">{labels.saved}</span>}</div>}
  </section>)}</div>
}
