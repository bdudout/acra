'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import AdminNav from '@/components/AdminNav'
import { ROLE_LABELS, ROLE_COLORS, type UserRole, isAdminRole } from '@/lib/permissions'
import { useTranslation } from '@/lib/i18n/context'
import { formatDateTime } from '@/lib/format'

interface Stats {
  totalUsers:    number
  activeUsers:   number
  suspendedUsers:number
  byRole:        Record<string, number>
  recentEvents:  RecentEvent[]
  totalAnalyses: number
}

interface RecentEvent {
  id:        string
  action:    string
  userEmail: string | null
  createdAt: string
}

const ACTION_ICONS: Record<string, string> = {
  LOGIN_SUCCESS:    '✅',
  LOGIN_FAILED:     '⚠️',
  REGISTER:         '👤',
  ROLE_CHANGED:     '🔑',
  USER_DELETED:     '🗑️',
  USER_SUSPENDED:   '🔒',
  USER_ACTIVATED:   '🔓',
  ANALYSE_CREATED:  '📄',
  ANALYSE_APPROVED: '✅',
  ANALYSE_REJECTED: '❌',
  EXPORT:           '📥',
}

export default function AdminDashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { t, locale } = useTranslation()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  const currentRole = (session?.user as any)?.role ?? 'ANALYSTE'

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user || !isAdminRole(currentRole)) {
      router.replace('/dashboard')
    }
  }, [session, status, currentRole, router])

  useEffect(() => {
    if (!isAdminRole(currentRole)) return

    // Fetch users + audit log in parallel
    Promise.all([
      fetch('/api/admin/users').then(r => r.json()),
      fetch('/api/admin/audit-log?limit=5').then(r => r.json()),
    ]).then(([usersData, auditData]) => {
      const users: Array<{ role: UserRole; isActive: boolean }> = usersData.users ?? []
      const byRole: Record<string, number> = {}
      for (const u of users) {
        byRole[u.role] = (byRole[u.role] ?? 0) + 1
      }
      setStats({
        totalUsers:     users.length,
        activeUsers:    users.filter(u => u.isActive).length,
        suspendedUsers: users.filter(u => !u.isActive).length,
        byRole,
        recentEvents:   auditData.logs ?? [],
        totalAnalyses:  0, // not tracked here
      })
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [currentRole])

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

        <AdminNav active="dashboard" />

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">🏠 Administration ACRA</h1>
          <p className="text-gray-500 mt-1">Vue d&apos;ensemble de la plateforme</p>
        </div>

        {/* KPIs principaux */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="card p-5 text-center">
            <div className="text-3xl font-bold text-gray-900">{stats?.totalUsers ?? 0}</div>
            <div className="text-sm text-gray-500 mt-1">Utilisateurs total</div>
          </div>
          <div className="card p-5 text-center">
            <div className="text-3xl font-bold text-green-600">{stats?.activeUsers ?? 0}</div>
            <div className="text-sm text-gray-500 mt-1">Comptes actifs</div>
          </div>
          <div className="card p-5 text-center">
            <div className="text-3xl font-bold text-amber-600">{stats?.suspendedUsers ?? 0}</div>
            <div className="text-sm text-gray-500 mt-1">Comptes suspendus</div>
          </div>
          <Link href="/admin/audit" className="card p-5 text-center hover:shadow-md transition-shadow">
            <div className="text-3xl font-bold text-indigo-600">📋</div>
            <div className="text-sm text-gray-500 mt-1">Journal d&apos;audit</div>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Répartition par rôle */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">Répartition des rôles</h2>
              <Link href="/admin/users" className="text-xs text-ebios-600 hover:underline">Gérer →</Link>
            </div>
            <div className="space-y-2">
              {(['LECTEUR', 'ANALYSTE', 'RISK_MANAGER', 'RSSI', 'ADMIN', 'DIRECTION_METIER'] as UserRole[]).map(role => {
                const count = stats?.byRole[role] ?? 0
                const total = stats?.totalUsers ?? 1
                const pct   = total > 0 ? Math.round(count / total * 100) : 0
                return (
                  <div key={role} className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium w-28 text-center ${ROLE_COLORS[role]}`}>
                      {ROLE_LABELS[role]}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-ebios-500 h-2 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 w-6 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Activité récente */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">Activité récente</h2>
              <Link href="/admin/audit" className="text-xs text-ebios-600 hover:underline">Tout voir →</Link>
            </div>
            <div className="space-y-2">
              {(stats?.recentEvents ?? []).length === 0 ? (
                <p className="text-sm text-gray-500 italic text-center py-4">Aucun événement</p>
              ) : stats?.recentEvents.map(ev => (
                <div key={ev.id} className="flex items-start gap-3 py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-base flex-shrink-0">{ACTION_ICONS[ev.action] ?? '📌'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold text-gray-700">{ev.action}</span>
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {ev.userEmail ?? '—'} · {formatDateTime(ev.createdAt, locale)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Raccourcis */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <Link href="/admin/users" className="card p-4 hover:shadow-md transition-shadow flex items-center gap-3">
            <span className="text-2xl">👥</span>
            <div>
              <div className="font-semibold text-gray-800 text-sm">Gestion des utilisateurs</div>
              <div className="text-xs text-gray-500">Rôles, suspension, suppression</div>
            </div>
          </Link>
          <Link href="/admin/security" className="card p-4 hover:shadow-md transition-shadow flex items-center gap-3">
            <span className="text-2xl">🛡️</span>
            <div>
              <div className="font-semibold text-gray-800 text-sm">Politique de sécurité</div>
              <div className="text-xs text-gray-500">Mots de passe, verrouillage</div>
            </div>
          </Link>
          <Link href="/admin/audit" className="card p-4 hover:shadow-md transition-shadow flex items-center gap-3">
            <span className="text-2xl">📋</span>
            <div>
              <div className="font-semibold text-gray-800 text-sm">Journal d&apos;audit</div>
              <div className="text-xs text-gray-500">Tous les événements + export CSV</div>
            </div>
          </Link>
        </div>

      </main>
    </div>
  )
}
