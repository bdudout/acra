'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Navbar from '@/components/Navbar'
import AdminNav from '@/components/AdminNav'
import { useTranslation } from '@/lib/i18n/context'

interface DemoCfg {
  inactivityDays: number
  hardCapDays: number
  warningDays: number
  maxAnalysesPerOrg: number
  maxActiveOrgs: number
}
interface UpcomingOrg {
  id: string
  nom: string
  expiresAt: string
  daysUntilPurge: number
}

const inputCls =
  'w-32 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-ebios-500 focus:border-ebios-500'

export default function DemoAdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { t, locale } = useTranslation()
  const d = t.admin.demoConfig

  const [cfg, setCfg] = useState<DemoCfg | null>(null)
  const [activeOrgs, setActiveOrgs] = useState(0)
  const [upcoming, setUpcoming] = useState<UpcomingOrg[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [purging, setPurging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSuperAdmin = (session?.user as { role?: string } | undefined)?.role === 'SUPER_ADMIN'

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin')
    if (status === 'authenticated' && !isSuperAdmin) router.push('/dashboard')
  }, [status, isSuperAdmin, router])

  function applyData(data: { config: DemoCfg; activeOrgs: number; upcoming: UpcomingOrg[] }) {
    setCfg(data.config); setActiveOrgs(data.activeOrgs); setUpcoming(data.upcoming ?? [])
  }

  useEffect(() => {
    if (status !== 'authenticated' || !isSuperAdmin) return
    fetch('/api/admin/demo-config')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) applyData(data) })
      .finally(() => setLoading(false))
  }, [status, isSuperAdmin])

  function set<K extends keyof DemoCfg>(key: K, value: number) {
    setCfg(c => (c ? { ...c, [key]: value } : c)); setSaved(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!cfg) return
    setSaving(true); setSaved(false); setError(null)
    try {
      const res = await fetch('/api/admin/demo-config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'Erreur'); return }
      applyData(data); setSaved(true)
    } finally { setSaving(false) }
  }

  async function handlePurge() {
    if (!window.confirm(d.purgeConfirm)) return
    setPurging(true); setError(null)
    try {
      const res = await fetch('/api/admin/demo-config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'purge' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'Erreur'); return }
      applyData({ config: cfg!, activeOrgs: data.activeOrgs, upcoming: data.upcoming })
    } finally { setPurging(false) }
  }

  if (status !== 'authenticated' || !isSuperAdmin) return null

  const fields: { key: keyof DemoCfg; label: string; min: number }[] = [
    { key: 'inactivityDays',    label: d.inactivityDays,    min: 1 },
    { key: 'hardCapDays',       label: d.hardCapDays,       min: 1 },
    { key: 'warningDays',       label: d.warningDays,       min: 0 },
    { key: 'maxAnalysesPerOrg', label: d.maxAnalysesPerOrg, min: 1 },
    { key: 'maxActiveOrgs',     label: d.maxActiveOrgs,     min: 1 },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main id="main-content" className="max-w-6xl mx-auto px-4 py-8">
        <AdminNav active="demo" />

        <h1 className="text-2xl font-bold text-gray-900 mb-1">{d.title}</h1>
        <p className="text-gray-500 text-sm mb-6">{d.subtitle}</p>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">⚠️ {error}</div>}

        {loading || !cfg ? (
          <div className="text-center py-12 text-gray-500">{t.loading}</div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Réglages */}
            <form onSubmit={handleSave} className="card p-6 space-y-4">
              <h2 className="font-semibold text-gray-900">{d.settingsTitle}</h2>
              {saved && <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm">✅ {d.saved}</div>}
              {fields.map(f => (
                <label key={f.key} className="flex items-center justify-between gap-4">
                  <span className="text-sm text-gray-700">{f.label}</span>
                  <input
                    type="number" min={f.min} required
                    value={cfg[f.key]}
                    onChange={e => set(f.key, Number(e.target.value))}
                    className={inputCls}
                  />
                </label>
              ))}
              <button type="submit" disabled={saving}
                className="bg-ebios-600 hover:bg-ebios-700 disabled:opacity-60 text-white font-medium py-2 px-4 rounded-lg text-sm">
                {saving ? d.saving : d.save}
              </button>
            </form>

            {/* Tableau de bord */}
            <div className="card p-6 space-y-4">
              <h2 className="font-semibold text-gray-900">{d.dashboardTitle}</h2>
              <p className="text-sm text-gray-600">
                {d.activeOrgs} : <span className="font-semibold text-gray-900">{activeOrgs}</span>
              </p>

              <div className="max-h-80 overflow-auto border border-gray-100 rounded-lg">
                {upcoming.length === 0 ? (
                  <p className="text-sm text-gray-400 p-4">{d.noOrgs}</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs sticky top-0">
                      <tr>
                        <th className="text-left font-medium px-3 py-2">{d.org}</th>
                        <th className="text-right font-medium px-3 py-2">{d.daysLeft}</th>
                        <th className="text-right font-medium px-3 py-2">{d.expiresAt}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {upcoming.map(o => (
                        <tr key={o.id} className="border-t border-gray-100">
                          <td className="px-3 py-2 text-gray-800 truncate max-w-[16rem]" title={o.nom}>{o.nom}</td>
                          <td className={`px-3 py-2 text-right font-medium ${o.daysUntilPurge === 0 ? 'text-red-600' : o.daysUntilPurge <= (cfg.warningDays || 0) ? 'text-amber-600' : 'text-gray-700'}`}>
                            {o.daysUntilPurge}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-500">{new Date(o.expiresAt).toLocaleDateString(locale)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <button type="button" onClick={handlePurge} disabled={purging}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-medium py-2 px-4 rounded-lg text-sm">
                {purging ? d.purging : d.purgeNow}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
