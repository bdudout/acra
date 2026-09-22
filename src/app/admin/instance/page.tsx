'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Server } from 'lucide-react'
import Navbar from '@/components/Navbar'
import AdminNav from '@/components/AdminNav'
import { useTranslation } from '@/lib/i18n/context'
import { isAdminRole } from '@/lib/permissions'
import ApiKeysManager from '@/components/ApiKeysManager'
import WebhooksManager from '@/components/WebhooksManager'

// Clé i18n du nom de chaque méthode d'analyse (t.methodes.*).
const METHODE_I18N: Record<string, string> = {
  EBIOS_RM: 'ebiosRm', ISO_27005: 'iso27005', NIST_800_30: 'nist80030', ISO_31000: 'iso31000',
}

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
  const [apiEnabled, setApiEnabled] = useState(false)
  const [mcpEnabled, setMcpEnabled] = useState(false)
  const [methodesActives, setMethodesActives] = useState<string[]>(['EBIOS_RM'])
  const [methodesImplemented, setMethodesImplemented] = useState<string[]>(['EBIOS_RM'])

  useEffect(() => {
    if (status === 'authenticated' && !isAdmin) router.replace('/dashboard')
  }, [status, isAdmin, router])

  useEffect(() => {
    if (!isSuperAdmin) return
    fetch('/api/admin/branding').then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setBrandName(d.appName ?? ''); setBrandBaseline(d.appBaseline ?? '') } }).catch(() => {})
    fetch('/api/admin/organization-config').then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.modulesPolicy && typeof d.modulesPolicy === 'object') setModulesPolicy(d.modulesPolicy) }).catch(() => {})
    fetch('/api/admin/api-mcp-config').then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setApiEnabled(d.apiEnabled === true); setMcpEnabled(d.mcpEnabled === true) } }).catch(() => {})
    fetch('/api/admin/methodes-config').then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { if (Array.isArray(d.active)) setMethodesActives(d.active); if (Array.isArray(d.implemented)) setMethodesImplemented(d.implemented) } }).catch(() => {})
  }, [isSuperAdmin])

  // Active/désactive une méthode d'analyse au niveau instance (EBIOS RM verrouillé).
  async function toggleMethode(methode: string, on: boolean) {
    const next = on ? [...new Set([...methodesActives, methode])] : methodesActives.filter(x => x !== methode)
    const prev = methodesActives
    setMethodesActives(next)
    const res = await fetch('/api/admin/methodes-config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ methodes: next }),
    })
    if (res.ok) { const d = await res.json().catch(() => null); if (d?.active) setMethodesActives(d.active) }
    else setMethodesActives(prev)
  }

  // Interrupteurs des interfaces programmatiques (mise à jour optimiste, rollback sur échec).
  async function saveInterfaceToggle(field: 'apiEnabled' | 'mcpEnabled', value: boolean) {
    const setter = field === 'apiEnabled' ? setApiEnabled : setMcpEnabled
    setter(value)
    const res = await fetch('/api/admin/api-mcp-config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    if (!res.ok) setter(!value)
  }

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
        <AdminNav active="instance" />
        <div>
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

        {isSuperAdmin && (
          <section className="card p-6">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-1">{t.interfacesConfig.sectionTitle}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t.interfacesConfig.sectionDesc}</p>
            <div className="space-y-3">
              {([
                { key: 'apiEnabled' as const, value: apiEnabled, title: t.interfacesConfig.apiTitle, desc: t.interfacesConfig.apiDesc },
                { key: 'mcpEnabled' as const, value: mcpEnabled, title: t.interfacesConfig.mcpTitle, desc: t.interfacesConfig.mcpDesc },
              ]).map(row => (
                <div key={row.key} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{row.title}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{row.desc}</div>
                  </div>
                  <label className="inline-flex items-center gap-2 shrink-0 cursor-pointer">
                    <input type="checkbox" checked={row.value} onChange={e => saveInterfaceToggle(row.key, e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 dark:border-gray-600" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{row.value ? t.interfacesConfig.enabled : t.interfacesConfig.disabled}</span>
                  </label>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">{t.interfacesConfig.hint}</p>
          </section>
        )}

        {isSuperAdmin && (
          <section className="card p-6">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-1">{t.methodesConfig.sectionTitle}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t.methodesConfig.sectionDesc}</p>
            <div className="space-y-3">
              {methodesImplemented.map(mk => {
                const locked = mk === 'EBIOS_RM'
                const on = locked || methodesActives.includes(mk)
                const name = (t.methodes as Record<string, string>)[METHODE_I18N[mk] ?? ''] ?? mk
                return (
                  <div key={mk} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{name}</div>
                      {locked && <div className="text-xs text-gray-400 mt-0.5">{t.methodesConfig.ebiosLocked}</div>}
                    </div>
                    <label className={`inline-flex items-center gap-2 shrink-0 ${locked ? 'opacity-60' : 'cursor-pointer'}`}>
                      <input type="checkbox" checked={on} disabled={locked} onChange={e => toggleMethode(mk, e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 dark:border-gray-600" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{on ? t.interfacesConfig.enabled : t.interfacesConfig.disabled}</span>
                    </label>
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-gray-400 mt-2">{t.methodesConfig.hint}</p>
          </section>
        )}

        {isAdmin && <ApiKeysManager />}
        {isAdmin && <WebhooksManager />}
      </div>
    </div>
  )
}
