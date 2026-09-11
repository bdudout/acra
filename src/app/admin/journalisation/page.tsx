'use client'

import { AlertTriangle, CheckCircle2, Share2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Navbar from '@/components/Navbar'
import AdminNav from '@/components/AdminNav'
import { useTranslation } from '@/lib/i18n/context'
import { SIEM_CATEGORIES } from '@/lib/siem'

interface SiemConfig {
  enabled: boolean
  endpoint: string
  authHeader: string
  categories: string[]
  includeStdout: boolean
  lastDeliveryOk?: boolean
  lastDeliveryAt?: string | null
  lastError?: string | null
}

const DEFAULTS: SiemConfig = { enabled: false, endpoint: '', authHeader: '', categories: [], includeStdout: true }
const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-ebios-500 focus:border-ebios-500'

export default function JournalisationPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { t } = useTranslation()
  const s = t.siem
  const [cfg, setCfg] = useState<SiemConfig>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userRole = (session?.user as any)?.role

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin')
    if (status === 'authenticated' && userRole !== 'SUPER_ADMIN') router.push('/dashboard')
  }, [status, userRole, router])

  useEffect(() => {
    if (status !== 'authenticated' || userRole !== 'SUPER_ADMIN') return
    fetch('/api/admin/siem-config').then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setCfg({ ...DEFAULTS, ...d, endpoint: d.endpoint ?? '', authHeader: d.authHeader ?? '', categories: d.categories ?? [] }) })
      .finally(() => setLoading(false))
  }, [status, userRole])

  function set<K extends keyof SiemConfig>(k: K, v: SiemConfig[K]) { setCfg(c => ({ ...c, [k]: v })); setSaved(false); setTestMsg(null) }
  function toggleCat(cat: string) {
    setCfg(c => ({ ...c, categories: c.categories.includes(cat) ? c.categories.filter(x => x !== cat) : [...c.categories, cat] }))
    setSaved(false)
  }

  async function save() {
    setSaving(true); setError(null); setSaved(false)
    const res = await fetch('/api/admin/siem-config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: cfg.enabled, endpoint: cfg.endpoint, authHeader: cfg.authHeader, categories: cfg.categories, includeStdout: cfg.includeStdout }),
    })
    setSaving(false)
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error === 'endpoint_invalide' ? s.errEndpoint : (d.error || 'Erreur')); return }
    const d = await res.json(); setCfg({ ...DEFAULTS, ...d, endpoint: d.endpoint ?? '', authHeader: d.authHeader ?? '', categories: d.categories ?? [] })
    setSaved(true)
  }
  async function test() {
    setTesting(true); setTestMsg(null)
    const res = await fetch('/api/admin/siem-config/test', { method: 'POST' })
    const d = await res.json().catch(() => ({}))
    setTesting(false)
    setTestMsg(res.ok ? { ok: true, text: s.testOk } : { ok: false, text: `${s.testFail}${d.error ? ' — ' + d.error : ''}` })
  }

  if (loading) return <div className="min-h-screen bg-gray-50"><Navbar /><main className="max-w-3xl mx-auto px-4 py-8"><AdminNav active="journalisation" /><p className="text-gray-400">{t.loading}</p></main></div>

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <AdminNav active="journalisation" />
        <h1 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2"><Share2 size={22} aria-hidden="true" /> {s.title}</h1>
        <p className="text-gray-500 text-sm mb-6 max-w-2xl">{s.subtitle}</p>

        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm"><AlertTriangle size={14} className="inline align-[-0.15em] mr-1" /> {error}</div>}
        {saved && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 text-green-700 px-3 py-2 text-sm"><CheckCircle2 size={14} className="inline align-[-0.15em] mr-1" /> {s.saved}</div>}

        <div className="card p-6 space-y-5">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={cfg.enabled} onChange={e => set('enabled', e.target.checked)} />
            <span className="text-sm font-medium text-gray-800">{s.enabled}</span>
          </label>

          <div>
            <label className="block text-sm text-gray-700 mb-1">{s.endpoint}</label>
            <input className={inputCls} value={cfg.endpoint} onChange={e => set('endpoint', e.target.value)} placeholder="https://splunk.example.com:8088/services/collector/raw" />
            <p className="text-xs text-gray-400 mt-1">{s.endpointHint}</p>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">{s.authHeader}</label>
            <input className={inputCls} value={cfg.authHeader} onChange={e => set('authHeader', e.target.value)} placeholder="Splunk 12345678-…  /  Bearer …" />
            <p className="text-xs text-gray-400 mt-1">{s.authHeaderHint}</p>
          </div>

          {/* Journal par journal */}
          <div>
            <p className="text-sm font-medium text-gray-800 mb-1">{s.journauxTitle}</p>
            <p className="text-xs text-gray-500 mb-2">{s.journauxHint}</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {SIEM_CATEGORIES.map(cat => (
                <label key={cat} className="flex items-start gap-2 border border-gray-200 rounded-lg px-3 py-2">
                  <input type="checkbox" className="mt-0.5" checked={cfg.categories.includes(cat)} onChange={() => toggleCat(cat)} />
                  <span>
                    <span className="text-sm font-medium text-gray-800 block">{(s.categories as Record<string, string>)[cat] ?? cat}</span>
                    <span className="text-[11px] text-gray-500">{(s.categoriesDesc as Record<string, string>)[cat] ?? ''}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={cfg.includeStdout} onChange={e => set('includeStdout', e.target.checked)} />
            <span className="text-sm text-gray-700">{s.includeStdout}</span>
          </label>

          {/* Dernière livraison */}
          {cfg.lastDeliveryAt && (
            <p className={`text-xs ${cfg.lastDeliveryOk ? 'text-green-600' : 'text-red-600'}`}>
              {cfg.lastDeliveryOk ? s.lastOk : s.lastFail} — {new Date(cfg.lastDeliveryAt).toLocaleString()}{cfg.lastError ? ` (${cfg.lastError})` : ''}
            </p>
          )}
          {testMsg && <p className={`text-sm ${testMsg.ok ? 'text-green-600' : 'text-red-600'}`}>{testMsg.text}</p>}

          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="bg-ebios-600 hover:bg-ebios-700 text-white text-sm font-medium py-2 px-4 rounded-lg disabled:opacity-50">{saving ? s.saving : t.save}</button>
            <button onClick={test} disabled={testing || !cfg.endpoint} className="btn-secondary text-sm py-2 px-4 disabled:opacity-50" title={s.testHint}>{testing ? s.testing : s.test}</button>
          </div>
        </div>
      </main>
    </div>
  )
}
