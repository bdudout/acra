'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { useTranslation } from '@/lib/i18n/context'
import { formatDate } from '@/lib/format'
import ConfirmDialog from '@/components/ConfirmDialog'
import { KeyRound, UserPlus, X } from 'lucide-react'
import AdminNav from '@/components/AdminNav'
import {
  ROLE_LABELS, ROLE_DESCRIPTIONS, ROLE_COLORS,
  type UserRole,
} from '@/lib/permissions'

interface UserItem {
  id: string
  name: string | null
  email: string
  role: UserRole
  isActive: boolean
  createdAt: string
  _count: { analyses: number }
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { t, locale } = useTranslation()

  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [pendingConfirm, setPendingConfirm] = useState<{
    message: string
    action: () => void
    title?: string
    confirmLabel?: string
    icon?: string
    variant?: 'danger' | 'warning' | 'primary' | 'success'
  } | null>(null)

  // ── Formulaire de création de compte ─────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'ANALYSTE' as UserRole })
  const [createError, setCreateError] = useState<string | null>(null)
  // Identifiants temporaires affichés une seule fois après création (#10)
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)
  // Import CSV en masse
  const [showImport, setShowImport] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [importResults, setImportResults] = useState<{ summary: any; results: any[] } | null>(null)

  const currentUserId = (session?.user as any)?.id
  const currentRole = (session?.user as any)?.role ?? 'ANALYSTE'

  // Rôles assignables : un SUPER_ADMIN peut aussi promouvoir/rétrograder un SUPER_ADMIN.
  const isSuperAdmin = currentRole === 'SUPER_ADMIN'
  const assignableRoles: UserRole[] = isSuperAdmin
    ? ['LECTEUR', 'ANALYSTE', 'RISK_MANAGER', 'RSSI', 'ADMIN', 'SUPER_ADMIN']
    : ['LECTEUR', 'ANALYSTE', 'RISK_MANAGER', 'RSSI', 'ADMIN']

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user || (currentRole !== 'ADMIN' && currentRole !== 'SUPER_ADMIN')) {
      router.replace('/dashboard')
    }
  }, [session, status, currentRole, router])

  useEffect(() => {
    if (currentRole !== 'ADMIN' && currentRole !== 'SUPER_ADMIN') return
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(d => { setUsers(d.users ?? []); setLoading(false) })
      .catch(() => { setError(t.admin.loadError); setLoading(false) })
  }, [currentRole])

  function showSuccess(msg: string) {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3000)
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      })
      const data = await res.json()
      if (!res.ok) { setCreateError(data.error || t.networkError); return }
      setUsers(prev => [...prev, data.user])
      // Affiche le mot de passe temporaire généré (une seule fois)
      setCreatedCreds({ email: data.user.email, password: data.tempPassword })
      setCopied(false)
      setNewUser({ name: '', email: '', role: 'ANALYSTE' })
      setShowCreate(false)
      showSuccess(t.admin.createSuccessMsg)
    } catch {
      setCreateError(t.networkError)
    } finally {
      setCreating(false)
    }
  }

  async function importCsv() {
    if (!csvText.trim()) return
    setImporting(true); setImportError(null); setImportResults(null)
    try {
      const res = await fetch('/api/admin/users/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: csvText }),
      })
      const data = await res.json()
      if (!res.ok) { setImportError(data.error || t.networkError); return }
      setImportResults(data)
      // Recharger la liste des utilisateurs
      fetch('/api/admin/users').then(r => r.json()).then(d => setUsers(d.users ?? [])).catch(() => {})
    } catch { setImportError(t.networkError) } finally { setImporting(false) }
  }

  function onCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCsvText(String(reader.result || ''))
    reader.readAsText(file)
  }

  function downloadImportedCreds() {
    if (!importResults) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const created = importResults.results.filter((r: any) => r.status === 'created')
    if (!created.length) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lines = created.map((r: any) => `${r.email},${r.tempPassword},${r.role}`)
    const blob = new Blob(['email,mot_de_passe_temporaire,role\n' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'acra-comptes-importes.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  async function changeRole(userId: string, role: UserRole) {
    setSaving(userId)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: data.user.role } : u))
      showSuccess(`${t.admin.roleUpdatedMsg} ${data.user.name || data.user.email}`)
    } catch {
      setError(t.networkError)
    } finally {
      setSaving(null)
    }
  }

  // Demande de confirmation accessible (#1) — remplace les confirm() natifs
  function confirmSuspend(user: UserItem) {
    setPendingConfirm(user.isActive
      ? { message: t.admin.suspendConfirm(user.email), action: () => toggleSuspend(user),
          title: t.admin.suspendTitle, confirmLabel: t.admin.suspendConfirmBtn, icon: '⏸️', variant: 'warning' }
      : { message: t.admin.activateConfirm(user.email), action: () => toggleSuspend(user),
          title: t.admin.activateTitle, confirmLabel: t.admin.activateConfirmBtn, icon: '✅', variant: 'success' })
  }
  function confirmDelete(user: UserItem) {
    setPendingConfirm({ message: t.admin.deleteConfirm(user.email), action: () => deleteUser(user) })
  }
  function confirmResetPassword(user: UserItem) {
    setPendingConfirm({ message: t.admin.resetPwdConfirm(user.email), action: () => resetPassword(user),
      title: t.admin.resetPwdTitle, confirmLabel: t.admin.resetPwdConfirmBtn, icon: '🔑', variant: 'primary' })
  }

  async function resetPassword(user: UserItem) {
    setSaving(user.id)
    setError(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, action: 'reset-password' }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || t.networkError); return }
      setCreatedCreds({ email: user.email, password: data.tempPassword })
      setCopied(false)
      showSuccess(t.admin.resetPwdSuccessMsg)
    } catch {
      setError(t.networkError)
    } finally {
      setSaving(null)
    }
  }

  async function toggleSuspend(user: UserItem) {
    const action = user.isActive ? 'suspend' : 'activate'
    setSaving(user.id)
    setError(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, action }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isActive: data.user.isActive } : u))
      showSuccess(user.isActive ? t.admin.suspendSuccessMsg : t.admin.activateSuccessMsg)
    } catch {
      setError(t.networkError)
    } finally {
      setSaving(null)
    }
  }

  async function deleteUser(user: UserItem) {
    setSaving(user.id)
    setError(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setUsers(prev => prev.filter(u => u.id !== user.id))
      showSuccess(t.admin.deleteSuccessMsg)
    } catch {
      setError(t.networkError)
    } finally {
      setSaving(null)
    }
  }

  const filteredUsers = users.filter(u => {
    const matchesSearch =
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && u.isActive) ||
      (statusFilter === 'inactive' && !u.isActive)
    return matchesSearch && matchesStatus
  })

  const inactiveCount = users.filter(u => !u.isActive).length

  const roleStats = (['LECTEUR', 'ANALYSTE', 'RISK_MANAGER', 'RSSI', 'ADMIN'] as UserRole[]).map(r => ({
    role: r,
    count: users.filter(u => u.role === r).length,
  }))

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-ebios-500 border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main id="main-content" className="max-w-6xl mx-auto px-4 py-8">

        <AdminNav active="users" />

        {/* En-tête */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{t.admin.pageTitle}</h1>
          <p className="text-gray-500 mt-1">{t.admin.pageSubtitle}</p>
        </div>

        {/* KPI rôles */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {roleStats.map(({ role, count }) => (
            <div key={role} className="card p-4 text-center">
              <div className="text-2xl font-bold text-gray-800">{count}</div>
              <div className={`text-xs mt-1 px-2 py-0.5 rounded-full inline-block font-medium ${ROLE_COLORS[role]}`}>
                {ROLE_LABELS[role]}
              </div>
            </div>
          ))}
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            ⚠️ {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            ✅ {success}
          </div>
        )}

        {/* Mot de passe temporaire généré — affiché une seule fois (#10) */}
        {createdCreds && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-amber-800 text-sm mb-1">🔑 {t.admin.tempPwdTitle}</div>
                <p className="text-xs text-amber-700 mb-2">{t.admin.tempPwdHint}</p>
                <div className="text-sm text-gray-700">
                  <div><span className="text-gray-500">{t.admin.createEmail}:</span> <span className="font-medium">{createdCreds.email}</span></div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-gray-500">{t.admin.tempPwdLabel}:</span>
                    <code className="px-2 py-1 bg-white border border-amber-200 rounded font-mono text-sm select-all">{createdCreds.password}</code>
                    <button
                      type="button"
                      onClick={async () => { await navigator.clipboard?.writeText(createdCreds.password); setCopied(true) }}
                      className="text-xs px-2 py-1 rounded border border-amber-300 text-amber-700 hover:bg-amber-100"
                    >
                      {copied ? t.admin.tempPwdCopied : t.admin.tempPwdCopy}
                    </button>
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => setCreatedCreds(null)} className="text-amber-500 hover:text-amber-700 text-sm" aria-label="Fermer">✕</button>
            </div>
          </div>
        )}

        {/* Créer un compte / Importer */}
        <div className="mb-6">
          <div className="flex gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => { setShowCreate(v => !v); setCreateError(null) }}
            className="btn-primary flex items-center gap-2"
          >
            {showCreate ? <X size={16} aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />}
            {showCreate ? t.admin.createCancel : t.admin.createBtn}
          </button>
          <button
            type="button"
            onClick={() => { setShowImport(v => !v); setImportError(null) }}
            className="btn-secondary flex items-center gap-2"
          >
            📥 {t.admin.bulkImport.btn}
          </button>
          </div>

          {showCreate && (
            <div className="mt-4 card p-5">
              <h2 className="font-semibold text-gray-800 mb-4">{t.admin.createTitle}</h2>
              {createError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  ⚠️ {createError}
                </div>
              )}
              <form onSubmit={createUser} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">{t.admin.createName}</label>
                  <input
                    type="text"
                    required
                    value={newUser.name}
                    onChange={e => setNewUser(p => ({ ...p, name: e.target.value }))}
                    placeholder={t.admin.createNamePh}
                    className="input"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="label">{t.admin.createEmail}</label>
                  <input
                    type="email"
                    required
                    value={newUser.email}
                    onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))}
                    placeholder={t.ph.userEmail}
                    className="input"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="label">{t.admin.createRole}</label>
                  <select
                    value={newUser.role}
                    onChange={e => setNewUser(p => ({ ...p, role: e.target.value as UserRole }))}
                    className="input"
                  >
                    {(['LECTEUR', 'ANALYSTE', 'RISK_MANAGER', 'RSSI', 'ADMIN'] as UserRole[]).map(r => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3">
                  ℹ️ {t.admin.createPwdAutoHint}
                </div>
                <div className="sm:col-span-2 flex gap-3 pt-2">
                  <button type="submit" disabled={creating} className="btn-primary">
                    {creating ? t.saving : t.admin.createSubmit}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCreate(false); setCreateError(null) }}
                    className="btn-secondary"
                  >
                    {t.admin.createCancel}
                  </button>
                </div>
              </form>
            </div>
          )}

          {showImport && (
            <div className="mt-4 card p-5">
              <h2 className="font-semibold text-gray-800 mb-1">{t.admin.bulkImport.title}</h2>
              <p className="text-xs text-gray-500 mb-3">{t.admin.bulkImport.desc}</p>
              {importError && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">⚠️ {importError}</div>
              )}
              <textarea
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
                rows={6}
                placeholder={t.admin.bulkImport.placeholder}
                className="input w-full font-mono text-xs"
              />
              <div className="flex items-center gap-3 flex-wrap mt-3">
                <label className="text-sm text-gray-600 cursor-pointer hover:text-gray-800">
                  <input type="file" accept=".csv,text/csv" onChange={onCsvFile} className="hidden" />
                  📄 {t.admin.bulkImport.file}
                </label>
                <button type="button" onClick={importCsv} disabled={importing || !csvText.trim()} className="btn-primary ml-auto disabled:opacity-50">
                  {importing ? t.admin.bulkImport.running : t.admin.bulkImport.run}
                </button>
              </div>

              {importResults && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <div className="flex items-center gap-2 flex-wrap text-sm mb-3">
                    <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">{importResults.summary.created} {t.admin.bulkImport.created}</span>
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">{importResults.summary.exists} {t.admin.bulkImport.exists}</span>
                    <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">{importResults.summary.invalid} {t.admin.bulkImport.invalid}</span>
                    {importResults.summary.created > 0 && (
                      <button type="button" onClick={downloadImportedCreds} className="ml-auto text-ebios-600 hover:underline text-sm font-medium">⬇️ {t.admin.bulkImport.download}</button>
                    )}
                  </div>
                  <div className="overflow-x-auto max-h-64 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-200">
                          <th className="py-1 pr-3 font-medium">{t.admin.bulkImport.colEmail}</th>
                          <th className="py-1 pr-3 font-medium">{t.admin.bulkImport.colStatus}</th>
                          <th className="py-1 font-medium">{t.admin.bulkImport.colPwd}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {importResults.results.map((r: any, i: number) => (
                          <tr key={i} className="border-b border-gray-50">
                            <td className="py-1 pr-3">{r.email || `(ligne ${r.line})`}</td>
                            <td className="py-1 pr-3">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${r.status === 'created' ? 'bg-green-100 text-green-700' : r.status === 'exists' ? 'bg-gray-100 text-gray-600' : 'bg-red-100 text-red-700'}`}>
                                {r.status === 'created' ? t.admin.bulkImport.stCreated : r.status === 'exists' ? t.admin.bulkImport.stExists : t.admin.bulkImport.stInvalid}
                              </span>
                            </td>
                            <td className="py-1 font-mono text-gray-700">{r.tempPassword ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tableau utilisateurs */}
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center gap-3 flex-wrap">
            <input
              type="text"
              placeholder={t.admin.searchPh}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input flex-1 text-sm min-w-[180px]"
            />
            {/* Filtre de statut (#13) */}
            <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-0.5 bg-gray-50">
              {([
                { key: 'all',      label: t.admin.filterAll },
                { key: 'active',   label: t.admin.filterActive },
                { key: 'inactive', label: t.admin.filterInactive },
              ] as const).map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setStatusFilter(opt.key)}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                    statusFilter === opt.key ? 'bg-white text-ebios-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {opt.label}
                  {opt.key === 'inactive' && inactiveCount > 0 && (
                    <span className="ml-1 text-[10px] text-red-600">({inactiveCount})</span>
                  )}
                </button>
              ))}
            </div>
            <span className="text-sm text-gray-500">
              {filteredUsers.length} {filteredUsers.length > 1 ? t.admin.userPlural : t.admin.userSingular}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th scope="col" className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.admin.colUser}</th>
                  <th scope="col" className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.admin.colStatus}</th>
                  <th scope="col" className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.admin.colCurrentRole}</th>
                  <th scope="col" className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.admin.colAnalyses}</th>
                  <th scope="col" className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.admin.colMember}</th>
                  <th scope="col" className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.admin.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredUsers.map(u => (
                  <tr key={u.id} className={`hover:bg-gray-50 ${u.id === currentUserId ? 'bg-blue-50/30 dark:bg-ebios-500/10' : ''} ${!u.isActive ? 'opacity-60' : ''}`}>
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-800">
                        {u.name || '—'}
                        {u.id === currentUserId && <span className="ml-2 text-xs text-ebios-600 font-normal">{t.admin.youLabel}</span>}
                      </div>
                      <div className="text-xs text-gray-500">{u.email}</div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {u.isActive ? t.admin.activeLabel : t.admin.suspendedLabel}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <select
                        value={u.role}
                        onChange={e => changeRole(u.id, e.target.value as UserRole)}
                        disabled={saving === u.id || !u.isActive || (!isSuperAdmin && u.role === 'SUPER_ADMIN')}
                        className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-ebios-500 focus:border-transparent disabled:opacity-50"
                      >
                        {(u.role === 'SUPER_ADMIN' && !assignableRoles.includes('SUPER_ADMIN')
                          ? [...assignableRoles, 'SUPER_ADMIN' as UserRole]
                          : assignableRoles
                        ).map(r => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4 text-center text-gray-600">
                      {u._count.analyses}
                    </td>
                    <td className="py-3 px-4 text-center text-gray-500 text-xs">
                      {formatDate(u.createdAt, locale)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {u.id !== currentUserId && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => confirmResetPassword(u)}
                            disabled={saving === u.id}
                            className="text-xs px-2 py-1 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                            title={t.admin.resetPwdBtn}
                          >
                            <KeyRound size={13} aria-hidden="true" /> {t.admin.resetPwdBtn}
                          </button>
                          <button
                            type="button"
                            onClick={() => confirmSuspend(u)}
                            disabled={saving === u.id}
                            className={`text-xs px-2 py-1 rounded-lg border font-medium transition-colors disabled:opacity-50 ${
                              u.isActive
                                ? 'border-amber-300 text-amber-700 hover:bg-amber-50'
                                : 'border-green-300 text-green-700 hover:bg-green-50'
                            }`}
                          >
                            {u.isActive ? t.admin.suspendBtn : t.admin.activateBtn}
                          </button>
                          <button
                            type="button"
                            onClick={() => confirmDelete(u)}
                            disabled={saving === u.id}
                            className="text-xs px-2 py-1 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 font-medium transition-colors disabled:opacity-50"
                          >
                            {t.admin.deleteBtn}
                          </button>
                          {saving === u.id && <span className="text-xs text-gray-500">⏳</span>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500 italic text-sm">
                      {t.admin.noUsers}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Guide des rôles */}
        <div className="mt-6 card p-5">
          <h2 className="font-semibold text-gray-800 mb-4">{t.admin.rolesGuideTitle}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(['LECTEUR', 'ANALYSTE', 'RISK_MANAGER', 'RSSI', 'ADMIN'] as UserRole[]).map(role => (
              <div key={role} className="p-3 rounded-lg border border-gray-100 bg-gray-50">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[role]}`}>
                    {ROLE_LABELS[role]}
                  </span>
                </div>
                <p className="text-xs text-gray-600">{ROLE_DESCRIPTIONS[role]}</p>
                <div className="mt-2 space-y-0.5 text-xs text-gray-500">
                  {role === 'LECTEUR' && <>
                    <div>✅ {t.admin.lecteurCan}</div>
                    <div>❌ {t.admin.lecteurCant}</div>
                  </>}
                  {role === 'ANALYSTE' && <>
                    <div>✅ {t.admin.analysteCan1}</div>
                    <div>✅ {t.admin.analysteCan2}</div>
                    <div>✅ {t.admin.analysteCan3}</div>
                    <div>❌ {t.admin.analysteCant}</div>
                  </>}
                  {role === 'RISK_MANAGER' && <>
                    <div>✅ {t.admin.rmCan1}</div>
                    <div>✅ {t.admin.rmCan2}</div>
                    <div>❌ {t.admin.rmCant}</div>
                  </>}
                  {role === 'RSSI' && <>
                    <div>✅ {t.admin.rssiCan1}</div>
                    <div>✅ {t.admin.rssiCan2}</div>
                    <div>❌ {t.admin.rssiCant}</div>
                  </>}
                  {role === 'ADMIN' && <>
                    <div>✅ {t.admin.adminCan1}</div>
                    <div>✅ {t.admin.adminCan2}</div>
                    <div>✅ {t.admin.adminCan3}</div>
                  </>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {pendingConfirm && (
        <ConfirmDialog
          message={pendingConfirm.message}
          title={pendingConfirm.title}
          confirmLabel={pendingConfirm.confirmLabel}
          icon={pendingConfirm.icon}
          variant={pendingConfirm.variant}
          onConfirm={() => { pendingConfirm.action(); setPendingConfirm(null) }}
          onCancel={() => setPendingConfirm(null)}
        />
      )}
    </div>
  )
}
