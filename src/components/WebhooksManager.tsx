'use client'

import { Webhook as WebhookIcon, Copy, Check, Trash2, Power } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { WEBHOOK_EVENTS } from '@/lib/webhook'

interface Webhook {
  id: string; name: string; url: string; events: string[]; actif: boolean; createdAt: string
}

export default function WebhooksManager() {
  const { t, locale } = useTranslation()
  const w = t.webhooks
  const [hooks, setHooks] = useState<Webhook[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function reload() {
    const d = await fetch('/api/config/webhooks').then(x => x.ok ? x.json() : { webhooks: [] }).catch(() => ({ webhooks: [] }))
    setHooks(d.webhooks ?? []); setLoading(false)
  }
  useEffect(() => { reload() }, [])

  const jour = (d: string | null) => (d ? new Date(d).toLocaleDateString(locale) : '—')
  const toggleEvent = (e: string) => setEvents(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e])

  async function creer() {
    setBusy(true); setSecret(null); setErreur(null)
    const res = await fetch('/api/config/webhooks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name || undefined, url, events }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setErreur(w[`err_${data.error}` as keyof typeof w] as string || w.err_generic); return }
    setSecret(data.secret); setName(''); setUrl(''); setEvents([]); reload()
  }

  async function basculer(id: string, actif: boolean) {
    await fetch(`/api/config/webhooks/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actif: !actif }),
    })
    reload()
  }

  async function supprimer(id: string) {
    if (!confirm(w.deleteConfirm)) return
    await fetch(`/api/config/webhooks/${id}`, { method: 'DELETE' }); reload()
  }

  function copier() {
    if (!secret) return
    navigator.clipboard?.writeText(secret).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) }).catch(() => {})
  }

  const inp = 'px-2 py-1.5 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm'

  return (
    <section className="mb-6 card p-6">
      <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-1"><WebhookIcon size={18} className="inline align-[-0.15em] mr-2" aria-hidden="true" />{w.title}</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{w.subtitle}</p>

      {/* Secret de signature affiché une seule fois */}
      {secret && (
        <div className="mb-4 rounded-lg border border-ebios-300 bg-ebios-50 dark:bg-ebios-500/10 dark:border-ebios-500/30 p-3">
          <p className="text-xs font-medium text-ebios-800 dark:text-ebios-200 mb-1.5">{w.secretOnce}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs break-all bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 font-mono">{secret}</code>
            <button onClick={copier} className="btn-secondary text-xs inline-flex items-center gap-1">{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? w.copied : w.copy}</button>
          </div>
        </div>
      )}

      {/* Création */}
      <div className="flex flex-wrap items-end gap-3 mb-2">
        <label className="text-xs text-gray-500 dark:text-gray-400">{w.name}
          <input value={name} onChange={e => setName(e.target.value)} placeholder={w.namePlaceholder} className={`${inp} block mt-1`} />
        </label>
        <label className="text-xs text-gray-500 dark:text-gray-400 flex-1 min-w-[220px]">{w.url}
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" className={`${inp} block mt-1 w-full`} />
        </label>
      </div>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
        {WEBHOOK_EVENTS.map(e => (
          <label key={e} className="text-xs text-gray-600 dark:text-gray-300 inline-flex items-center gap-1.5">
            <input type="checkbox" checked={events.includes(e)} onChange={() => toggleEvent(e)} /> <code className="font-mono">{e}</code>
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={creer} disabled={busy || !url || events.length === 0} className="btn-primary text-sm disabled:opacity-50">{w.create}</button>
        {erreur && <span className="text-xs text-red-600">{erreur}</span>}
      </div>

      {/* Liste */}
      {loading ? <p className="text-xs text-gray-400">…</p>
        : hooks.length === 0 ? <p className="text-xs text-gray-400 italic">{w.empty}</p>
        : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="px-3 py-2">{w.name}</th><th className="px-3 py-2">{w.colUrl}</th><th className="px-3 py-2">{w.colEvents}</th>
                <th className="px-3 py-2">{w.colStatus}</th><th className="px-3 py-2">{w.colCreated}</th><th className="px-3 py-2" />
              </tr></thead>
              <tbody>
                {hooks.map(h => (
                  <tr key={h.id} className={`border-b border-gray-100 dark:border-gray-800 ${h.actif ? '' : 'opacity-50'}`}>
                    <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-100">{h.name}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-500 break-all max-w-[220px]">{h.url}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{(h.events ?? []).join(', ')}</td>
                    <td className="px-3 py-2 text-xs">{h.actif ? <span className="text-green-600">{w.active}</span> : <span className="text-gray-400">{w.inactive}</span>}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{jour(h.createdAt)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button onClick={() => basculer(h.id, h.actif)} className="text-gray-400 hover:text-ebios-600 p-1" aria-label={h.actif ? w.disable : w.enable}><Power size={15} aria-hidden="true" /></button>
                      <button onClick={() => supprimer(h.id)} className="text-gray-400 hover:text-red-600 p-1" aria-label={w.delete}><Trash2 size={15} aria-hidden="true" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </section>
  )
}
