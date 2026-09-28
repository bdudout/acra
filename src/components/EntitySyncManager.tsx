'use client'

import { useEffect, useState } from 'react'
import { CloudDownload } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'

type Connector = { type: 'REST' | 'LDAP'; endpoint: string; token: string; bindDN: string; password: string; baseDN: string; filter: string }
const empty: Connector = { type: 'REST', endpoint: '', token: '', bindDN: '', password: '', baseDN: '', filter: '' }

/** Administration d'un connecteur : configuration chiffrée, aperçu, puis import choisi. */
export default function EntitySyncManager({ orgId }: { orgId: string }) {
  const { t } = useTranslation(); const e = t.entites
  const base = `/api/organizations/${orgId}/entites`
  const [config, setConfig] = useState<Connector>(empty)
  const [destination, setDestination] = useState<'MEASURE_OWNERS' | 'ORGANIZATION_TREE'>('MEASURE_OWNERS')
  const [entities, setEntities] = useState<string[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState('')

  useEffect(() => { fetch(`${base}/sync-config`).then(r => r.ok ? r.json() : null).then(data => { if (data?.type) setConfig({ ...empty, ...data }) }).catch(() => {}) }, [base])
  const change = (key: keyof Connector, value: string) => setConfig(current => ({ ...current, [key]: value }))
  async function save() {
    setBusy(true); setNotice('')
    const res = await fetch(`${base}/sync-config`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) })
    setBusy(false); if (!res.ok) return setNotice(e.syncError)
    setConfig({ ...empty, ...await res.json() }); setNotice(e.syncSaved)
  }
  async function preview() {
    setBusy(true); setNotice('')
    const res = await fetch(`${base}/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operation: 'preview', destination }) })
    const data = await res.json().catch(() => null); setBusy(false)
    if (!res.ok) return setNotice(e.syncError)
    const next = Array.isArray(data?.newEntities) ? data.newEntities : []
    setEntities(next); setSelected(next)
  }
  async function importSelection() {
    setBusy(true); setNotice('')
    const res = await fetch(`${base}/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operation: 'import', destination, entities: selected }) })
    const data = await res.json().catch(() => null); setBusy(false)
    if (!res.ok) return setNotice(e.syncError)
    setNotice(e.syncImported.replace('{n}', String(data?.imported?.length ?? 0))); setEntities([]); setSelected([])
  }
  const toggle = (name: string) => setSelected(current => current.includes(name) ? current.filter(value => value !== name) : [...current, name])

  return <section className="card p-4 space-y-3">
    <div><h2 className="text-sm font-semibold text-gray-800 flex gap-2 items-center"><CloudDownload size={16} />{e.syncTitle}</h2><p className="text-sm text-gray-500 mt-1">{e.syncDesc}</p></div>
    <div className="grid md:grid-cols-2 gap-3">
      <label className="text-xs text-gray-600"><span className="block mb-1">{e.syncType}</span><select value={config.type} onChange={ev => change('type', ev.target.value)} className="w-full input"><option value="REST">REST</option><option value="LDAP">LDAP / LDAPS</option></select></label>
      <label className="text-xs text-gray-600"><span className="block mb-1">{e.syncDestination}</span><select value={destination} onChange={ev => { setDestination(ev.target.value as 'MEASURE_OWNERS' | 'ORGANIZATION_TREE'); setEntities([]); setSelected([]) }} className="w-full input"><option value="MEASURE_OWNERS">{e.syncMeasureOwners}</option><option value="ORGANIZATION_TREE">{e.syncOrganizationTree}</option></select></label>
      <label className="text-xs text-gray-600"><span className="block mb-1">{e.syncEndpoint}</span><input value={config.endpoint} onChange={ev => change('endpoint', ev.target.value)} placeholder={config.type === 'REST' ? 'https://directory.example/api/entities' : 'ldaps://directory.example:636'} className="w-full input" /></label>
      {config.type === 'REST' ? <label className="text-xs text-gray-600"><span className="block mb-1">{e.syncToken}</span><input value={config.token} onChange={ev => change('token', ev.target.value)} type="password" className="w-full input" /></label> : <>
        <label className="text-xs text-gray-600"><span className="block mb-1">{e.syncBindDn}</span><input value={config.bindDN} onChange={ev => change('bindDN', ev.target.value)} className="w-full input" /></label>
        <label className="text-xs text-gray-600"><span className="block mb-1">{e.syncPassword}</span><input value={config.password} onChange={ev => change('password', ev.target.value)} type="password" className="w-full input" /></label>
        <label className="text-xs text-gray-600"><span className="block mb-1">{e.syncBaseDn}</span><input value={config.baseDN} onChange={ev => change('baseDN', ev.target.value)} className="w-full input" /></label>
        <label className="text-xs text-gray-600"><span className="block mb-1">{e.syncFilter}</span><input value={config.filter} onChange={ev => change('filter', ev.target.value)} className="w-full input" /></label>
      </>}
    </div>
    <div className="flex flex-wrap gap-2"><button type="button" onClick={save} disabled={busy || !config.endpoint.trim()} className="btn-secondary text-sm">{e.syncSave}</button><button type="button" onClick={preview} disabled={busy || !config.endpoint.trim()} className="btn-primary text-sm">{e.syncPreview}</button></div>
    {entities.length > 0 && <div className="rounded border border-gray-200 p-3 space-y-2"><button type="button" onClick={() => setSelected(entities)} className="text-xs text-ebios-700 underline">{e.syncSelectAll}</button>{entities.map(name => <label key={name} className="block text-sm text-gray-700"><input type="checkbox" checked={selected.includes(name)} onChange={() => toggle(name)} className="mr-2" />{name}</label>)}<button type="button" onClick={importSelection} disabled={busy || !selected.length} className="btn-primary text-sm">{e.syncImport}</button></div>}
    {entities.length === 0 && notice === '' && <p className="text-xs text-gray-400">{e.syncNone}</p>}
    {notice && <p role="status" className="text-sm text-gray-700">{notice}</p>}
  </section>
}
