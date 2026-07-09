'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Navbar from '@/components/Navbar'
import AdminNav from '@/components/AdminNav'
import { useTranslation } from '@/lib/i18n/context'

interface SmtpConfig {
  enabled: boolean
  host: string | null
  port: number
  secure: boolean
  username: string | null
  password: string | null
  fromAddress: string | null
  fromName: string | null
}

const DEFAULTS: SmtpConfig = {
  enabled: false, host: '', port: 587, secure: false,
  username: '', password: '', fromAddress: '', fromName: 'ACRA',
}

const inputCls =
  'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-ebios-500 focus:border-ebios-500'

export default function SmtpConfigPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { t } = useTranslation()

  const [cfg, setCfg] = useState<SmtpConfig>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const userRole = (session?.user as any)?.role

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/login')
    if (status === 'authenticated' && !(userRole === 'SUPER_ADMIN')) router.push('/dashboard')
  }, [status, userRole, router])

  useEffect(() => {
    if (status !== 'authenticated' || !(userRole === 'SUPER_ADMIN')) return
    fetch('/api/admin/smtp-config')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setCfg({ ...DEFAULTS, ...d, host: d.host ?? '', username: d.username ?? '', password: d.password ?? '', fromAddress: d.fromAddress ?? '', fromName: d.fromName ?? 'ACRA' }) })
      .finally(() => setLoading(false))
  }, [status, userRole])

  function set<K extends keyof SmtpConfig>(key: K, value: SmtpConfig[K]) {
    setCfg(c => ({ ...c, [key]: value })); setSaved(false); setTestMsg(null)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setSaved(false); setError(null)
    try {
      const res = await fetch('/api/admin/smtp-config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? 'Erreur'); return }
      setSaved(true)
    } finally { setSaving(false) }
  }

  async function handleTest() {
    setTesting(true); setTestMsg(null)
    try {
      const res = await fetch('/api/admin/smtp-config/test', { method: 'POST' })
      const d = await res.json().catch(() => ({}))
      if (res.ok && d.ok) setTestMsg({ ok: true, text: `${t.smtp.testOkMsg} ${d.to}` })
      else setTestMsg({ ok: false, text: d.error ?? t.smtp.testErrMsg })
    } finally { setTesting(false) }
  }

  if (status !== 'authenticated' || !(userRole === 'SUPER_ADMIN')) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main id="main-content" className="max-w-6xl mx-auto px-4 py-8">
        <AdminNav active="smtp" />

        <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{t.smtp.title}</h1>
        <p className="text-gray-500 text-sm mb-2">{t.smtp.subtitle}</p>
        <p className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 mb-6 inline-block">
          {t.smtp.adminOnlyNotice}
        </p>

        {loading ? (
          <div className="text-center py-12 text-gray-500">{t.loading}</div>
        ) : (
          <form onSubmit={handleSave} className="card p-6 space-y-5">
            {saved && <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm">✅ {t.smtp.savedMsg}</div>}
            {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">⚠️ {error}</div>}

            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">⚠️ {t.smtp.secretsWarning}</p>

            {/* Toggle activé */}
            <label className="flex items-center gap-3 cursor-pointer select-none group">
              <div
                onClick={() => set('enabled', !cfg.enabled)}
                className={`relative w-11 h-6 rounded-full transition-colors ${cfg.enabled ? 'bg-ebios-500' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 bg-[white] rounded-full shadow transition-transform ${cfg.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
              <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{t.smtp.enableLabel}</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.smtp.hostLabel}</label>
                <input type="text" value={cfg.host ?? ''} onChange={e => set('host', e.target.value)} placeholder="smtp.example.com" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.smtp.portLabel}</label>
                <input type="number" min={1} max={65535} value={cfg.port} onChange={e => set('port', parseInt(e.target.value) || 587)} className={inputCls} />
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer select-none group">
              <div
                onClick={() => set('secure', !cfg.secure)}
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 mt-0.5 ${cfg.secure ? 'bg-ebios-500' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 bg-[white] rounded-full shadow transition-transform ${cfg.secure ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
              <span>
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 block">{t.smtp.secureLabel}</span>
                <span className="text-xs text-gray-500">{t.smtp.secureHint}</span>
              </span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.smtp.usernameLabel}</label>
                <input type="text" autoComplete="off" value={cfg.username ?? ''} onChange={e => set('username', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.smtp.passwordLabel}</label>
                <input type="password" autoComplete="new-password" value={cfg.password ?? ''} onChange={e => set('password', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.smtp.fromAddressLabel}</label>
                <input type="email" value={cfg.fromAddress ?? ''} onChange={e => set('fromAddress', e.target.value)} placeholder="no-reply@example.com" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.smtp.fromNameLabel}</label>
                <input type="text" value={cfg.fromName ?? ''} onChange={e => set('fromName', e.target.value)} className={inputCls} />
              </div>
            </div>

            {testMsg && (
              <div className={`rounded-xl px-4 py-3 text-sm border ${testMsg.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                {testMsg.ok ? '✅ ' : '⚠️ '}{testMsg.text}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-2 flex-wrap">
              <button type="button" onClick={handleTest} disabled={testing} className="btn-secondary text-sm">
                {testing ? t.smtp.testSending : t.smtp.testBtn}
              </button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? t.saving : t.smtp.saveBtn}
              </button>
            </div>
          </form>
        )}
        </div>
      </main>
    </div>
  )
}
