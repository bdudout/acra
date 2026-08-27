'use client'

import { KeyRound, Copy, Check, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'

interface ApiKey {
  id: string; name: string; masque: string; scopes: string[]
  createdAt: string; lastUsedAt: string | null; expiresAt: string | null; revoked: boolean
}

export default function ApiKeysManager() {
  const { t, locale } = useTranslation()
  const a = t.apiKeys
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [scopeWrite, setScopeWrite] = useState(false)
  const [scopeProvision, setScopeProvision] = useState(false)
  const [expiresAt, setExpiresAt] = useState('')
  const [busy, setBusy] = useState(false)
  const [secret, setSecret] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function reload() {
    const d = await fetch('/api/config/api-keys').then(x => x.ok ? x.json() : { keys: [] }).catch(() => ({ keys: [] }))
    setKeys(d.keys ?? []); setLoading(false)
  }
  useEffect(() => { reload() }, [])

  const jour = (d: string | null) => (d ? new Date(d).toLocaleDateString(locale) : '—')

  async function creer() {
    setBusy(true); setSecret(null)
    const res = await fetch('/api/config/api-keys', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name || undefined, scopes: ['read', ...(scopeWrite ? ['write'] : []), ...(scopeProvision ? ['provision'] : [])], expiresAt: expiresAt || undefined }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return
    setSecret(data.secret); setName(''); setScopeWrite(false); setScopeProvision(false); setExpiresAt(''); reload()
  }

  async function revoquer(id: string) {
    if (!confirm(a.revokeConfirm)) return
    await fetch(`/api/config/api-keys/${id}`, { method: 'DELETE' }); reload()
  }

  function copier() {
    if (!secret) return
    navigator.clipboard?.writeText(secret).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) }).catch(() => {})
  }

  const inp = 'px-2 py-1.5 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm'

  return (
    <section className="mb-6 card p-6">
      <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-1"><KeyRound size={18} className="inline align-[-0.15em] mr-2" aria-hidden="true" />{a.title}</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{a.subtitle} <a href="/api/v1/openapi.json" target="_blank" rel="noopener noreferrer" className="text-ebios-600 hover:underline">OpenAPI</a>.</p>

      {/* Secret affiché une seule fois */}
      {secret && (
        <div className="mb-4 rounded-lg border border-ebios-300 bg-ebios-50 dark:bg-ebios-500/10 dark:border-ebios-500/30 p-3">
          <p className="text-xs font-medium text-ebios-800 dark:text-ebios-200 mb-1.5">{a.secretOnce}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs break-all bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 font-mono">{secret}</code>
            <button onClick={copier} className="btn-secondary text-xs inline-flex items-center gap-1">{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? a.copied : a.copy}</button>
          </div>
        </div>
      )}

      {/* Création */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label className="text-xs text-gray-500 dark:text-gray-400">{a.name}
          <input value={name} onChange={e => setName(e.target.value)} placeholder={a.namePlaceholder} className={`${inp} block mt-1`} />
        </label>
        <label className="text-xs text-gray-500 dark:text-gray-400">{a.expiry}
          <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className={`${inp} block mt-1`} />
        </label>
        <label className="text-xs text-gray-600 dark:text-gray-300 inline-flex items-center gap-1.5 pb-1.5">
          <input type="checkbox" checked={scopeWrite} onChange={e => setScopeWrite(e.target.checked)} /> {a.scopeWrite}
        </label>
        <label className="text-xs text-gray-600 dark:text-gray-300 inline-flex items-center gap-1.5 pb-1.5">
          <input type="checkbox" checked={scopeProvision} onChange={e => setScopeProvision(e.target.checked)} /> {a.scopeProvision}
        </label>
        <button onClick={creer} disabled={busy} className="btn-primary text-sm disabled:opacity-50">{a.create}</button>
      </div>

      {/* Liste */}
      {loading ? <p className="text-xs text-gray-400">…</p>
        : keys.length === 0 ? <p className="text-xs text-gray-400 italic">{a.empty}</p>
        : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="px-3 py-2">{a.name}</th><th className="px-3 py-2">{a.colKey}</th><th className="px-3 py-2">{a.colScopes}</th>
                <th className="px-3 py-2">{a.colLastUsed}</th><th className="px-3 py-2">{a.colExpiry}</th><th className="px-3 py-2" />
              </tr></thead>
              <tbody>
                {keys.map(k => (
                  <tr key={k.id} className={`border-b border-gray-100 dark:border-gray-800 ${k.revoked ? 'opacity-50' : ''}`}>
                    <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-100">{k.name}{k.revoked && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300">{a.revoked}</span>}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">{k.masque}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{k.scopes.join(', ')}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{jour(k.lastUsedAt)}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{jour(k.expiresAt)}</td>
                    <td className="px-3 py-2 text-right">{!k.revoked && <button onClick={() => revoquer(k.id)} className="text-gray-400 hover:text-red-600 p-1" aria-label={a.revoke}><Trash2 size={15} aria-hidden="true" /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </section>
  )
}
