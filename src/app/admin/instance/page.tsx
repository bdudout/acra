'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Home, Server } from 'lucide-react'
import Navbar from '@/components/Navbar'
import { useTranslation } from '@/lib/i18n/context'
import { isAdminRole } from '@/lib/permissions'
import ApiKeysManager from '@/components/ApiKeysManager'
import WebhooksManager from '@/components/WebhooksManager'

/**
 * Administration — Paramètres d'instance (identité, politique de modules, API,
 * webhooks). Regroupés dans l'espace ADMIN, distinct de la /configuration métier
 * (échelles, matrice, exemples…) — cf. recette.
 */
export default function AdminInstancePage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const { t } = useTranslation()
  const role = (session?.user as { role?: string } | undefined)?.role
  const isAdmin = isAdminRole(role as never)
  const isSuperAdmin = role === 'SUPER_ADMIN'

  const [brandName, setBrandName] = useState('')
  const [brandBaseline, setBrandBaseline] = useState('')
  const [brandSaved, setBrandSaved] = useState(false)
  const [modulesPolicy, setModulesPolicy] = useState<Record<string, string>>({})

  useEffect(() => {
    if (status === 'authenticated' && !isAdmin) router.replace('/dashboard')
  }, [status, isAdmin, router])

  useEffect(() => {
    if (!isSuperAdmin) return
    fetch('/api/admin/branding').then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setBrandName(d.appName ?? ''); setBrandBaseline(d.appBaseline ?? '') } }).catch(() => {})
    fetch('/api/admin/organization-config').then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.modulesPolicy && typeof d.modulesPolicy === 'object') setModulesPolicy(d.modulesPolicy) }).catch(() => {})
  }, [isSuperAdmin])

  async function saveBranding() {
    setBrandSaved(false)
    const res = await fetch('/api/admin/branding', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appName: brandName, appBaseline: brandBaseline }),
    })
    if (res.ok) { setBrandSaved(true); setTimeout(() => setBrandSaved(false), 2500) }
  }

  async function saveModulesPolicy(moduleKey: string, etat: string) {
    const prev = modulesPolicy
    const next = { ...modulesPolicy, [moduleKey]: etat }
    setModulesPolicy(next)
    const res = await fetch('/api/admin/modules-policy', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modulesPolicy: next }),
    })
    if (!res.ok) setModulesPolicy(prev)
  }

  const modules = [
    { key: 'registreRisques', label: t.features.registreRisquesTitle },
    { key: 'incidents', label: t.features.incidentsTitle },
    { key: 'controlePermanent', label: t.features.controlePermanentTitle },
    { key: 'auditInterne', label: t.features.auditInterneTitle },
    { key: 'kri', label: t.features.kriTitle },
    { key: 'reglementaire', label: t.features.reglementaireTitle },
    { key: 'secondeLigne', label: t.features.secondeLigneTitle },
  ]

  if (status === 'loading' || !isAdmin) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-900"><Navbar /><div className="flex items-center justify-center h-64 text-gray-500">{t.loading}</div></div>
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div>
          <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400"><Home size={14} className="inline align-[-0.15em] mr-1" aria-hidden="true" /> {t.instanceAdmin.back}</Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2"><Server size={22} className="inline align-[-0.15em] mr-2" aria-hidden="true" /> {t.instanceAdmin.title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t.instanceAdmin.subtitle}</p>
        </div>

        {isSuperAdmin && (
          <section className="card p-6">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-1">{t.branding.sectionTitle}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t.branding.sectionDesc}</p>
            <div className="flex flex-wrap gap-4 items-end">
              <label className="text-sm text-gray-700 dark:text-gray-300 flex-1 min-w-[180px]">
                <span className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t.branding.nameLabel}</span>
                <input value={brandName} onChange={e => setBrandName(e.target.value)} placeholder={t.auth.appName} maxLength={120}
                  className="w-full px-2 py-1.5 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm" />
              </label>
              <label className="text-sm text-gray-700 dark:text-gray-300 flex-1 min-w-[220px]">
                <span className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t.branding.baselineLabel}</span>
                <input value={brandBaseline} onChange={e => setBrandBaseline(e.target.value)} placeholder={t.auth.appSubtitle} maxLength={120}
                  className="w-full px-2 py-1.5 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm" />
              </label>
              <button onClick={saveBranding} className="btn-primary text-sm">{brandSaved ? t.config.savedLabel : t.config.saveShort}</button>
            </div>
            <p className="text-xs text-gray-400 mt-2">{t.branding.hint}</p>
          </section>
        )}

        {isSuperAdmin && (
          <section className="card p-6">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-1">{t.modulesPolicy.sectionTitle}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t.modulesPolicy.sectionDesc}</p>
            <div className="space-y-3">
              {modules.map(m => (
                <div key={m.key} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{m.label}</span>
                  <select value={modulesPolicy[m.key] ?? 'PER_ORG'} onChange={e => saveModulesPolicy(m.key, e.target.value)}
                    className="px-2 py-1.5 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm">
                    <option value="PER_ORG">{t.modulesPolicy.perOrg}</option>
                    <option value="FORCE_ON">{t.modulesPolicy.forceOn}</option>
                    <option value="FORCE_OFF">{t.modulesPolicy.forceOff}</option>
                  </select>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">{t.modulesPolicy.hint}</p>
          </section>
        )}

        {isAdmin && <ApiKeysManager />}
        {isAdmin && <WebhooksManager />}
      </div>
    </div>
  )
}
