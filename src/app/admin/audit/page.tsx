'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import AdminNav from '@/components/AdminNav'
import { useTranslation } from '@/lib/i18n/context'

interface AuditLog {
  id: string
  action: string
  userId: string | null
  userEmail: string | null
  userRole: string | null
  targetId: string | null
  targetType: string | null
  ip: string | null
  details: string | null
  createdAt: string
}

const ACTION_COLORS: Record<string, string> = {
  LOGIN_SUCCESS:           'bg-green-100 text-green-800',
  LOGIN_FAILED:            'bg-red-100 text-red-800',
  LOGIN_RATE_LIMITED:      'bg-orange-100 text-orange-800',
  LOGOUT:                  'bg-gray-100 text-gray-700',
  REGISTER:                'bg-blue-100 text-blue-800',
  PASSWORD_CHANGED:        'bg-yellow-100 text-yellow-800',
  PASSWORD_POLICY_UPDATED: 'bg-yellow-100 text-yellow-800',
  ROLE_CHANGED:            'bg-purple-100 text-purple-800',
  USER_DELETED:            'bg-red-100 text-red-800',
  USER_SUSPENDED:          'bg-amber-100 text-amber-800',
  USER_ACTIVATED:          'bg-green-100 text-green-800',
  ANALYSE_CREATED:         'bg-blue-100 text-blue-800',
  ANALYSE_DELETED:         'bg-red-100 text-red-800',
  ANALYSE_SUBMITTED:       'bg-indigo-100 text-indigo-800',
  ANALYSE_APPROVED:        'bg-green-100 text-green-800',
  ANALYSE_REJECTED:        'bg-orange-100 text-orange-800',
  EXPORT:                  'bg-teal-100 text-teal-800',
  ADMIN_ACTION:            'bg-purple-100 text-purple-800',
}

function ActionBadge({ action }: { action: string }) {
  const cls = ACTION_COLORS[action] ?? 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-semibold ${cls}`}>
      {action}
    </span>
  )
}

const LOCALE_BCP47: Record<string, string> = { fr: 'fr-FR', en: 'en-GB', de: 'de-DE', es: 'es-ES', it: 'it-IT' }

function formatDate(iso: string, locale?: string) {
  // Locale BCP 47 explicite (corrige l'affichage au format système du runtime)
  return new Date(iso).toLocaleString((locale && LOCALE_BCP47[locale]) || 'fr-FR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

export default function AuditLogPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const { t, locale } = useTranslation()
  const [logs, setLogs]               = useState<AuditLog[]>([])
  const [total, setTotal]             = useState(0)
  const [pages, setPages]             = useState(1)
  const [availableActions, setAvailableActions] = useState<string[]>([])
  const [loading, setLoading]         = useState(false)
  const [expanded, setExpanded]       = useState<string | null>(null)

  // Filters
  const [page, setPage]               = useState(1)
  const [filterAction, setFilterAction] = useState('')
  const [filterFrom, setFilterFrom]   = useState('')
  const [filterTo, setFilterTo]       = useState('')

  const userRole = (session?.user as any)?.role

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/login')
    if (status === 'authenticated' && userRole !== 'ADMIN') router.push('/dashboard')
  }, [status, userRole, router])

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '50' })
    if (filterAction) params.set('action', filterAction)
    if (filterFrom)   params.set('from',   filterFrom)
    if (filterTo)     params.set('to',     filterTo)

    try {
      const res = await fetch(`/api/admin/audit-log?${params}`)
      const data = await res.json()
      setLogs(data.logs ?? [])
      setTotal(data.total ?? 0)
      setPages(data.pages ?? 1)
      if (data.availableActions?.length) setAvailableActions(data.availableActions)
    } finally {
      setLoading(false)
    }
  }, [page, filterAction, filterFrom, filterTo])

  useEffect(() => {
    if (status === 'authenticated' && userRole === 'ADMIN') {
      fetchLogs()
    }
  }, [fetchLogs, status, userRole])

  function resetFilters() {
    setFilterAction('')
    setFilterFrom('')
    setFilterTo('')
    setPage(1)
  }

  if (status !== 'authenticated' || userRole !== 'ADMIN') return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">

      <AdminNav active="audit" />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.audit.title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t.audit.eventsCount.replace('{n}', total.toLocaleString((LOCALE_BCP47[locale]) || 'fr-FR'))}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">{t.audit.filterAction}</label>
          <select
            value={filterAction}
            onChange={e => { setFilterAction(e.target.value); setPage(1) }}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{t.audit.filterAll}</option>
            {availableActions.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">{t.audit.filterFrom}</label>
          <input
            type="datetime-local"
            value={filterFrom}
            onChange={e => { setFilterFrom(e.target.value); setPage(1) }}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">{t.audit.filterTo}</label>
          <input
            type="datetime-local"
            value={filterTo}
            onChange={e => { setFilterTo(e.target.value); setPage(1) }}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={resetFilters}
          className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          {t.audit.reset}
        </button>

        <button
          onClick={fetchLogs}
          disabled={loading}
          className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? t.audit.loading : t.audit.refresh}
        </button>

        <a
          href={(() => {
            const params = new URLSearchParams()
            if (filterAction) params.set('action', filterAction)
            if (filterFrom)   params.set('from', filterFrom)
            if (filterTo)     params.set('to', filterTo)
            return `/api/admin/audit-log/export?${params}`
          })()}
          download
          className="px-4 py-1.5 text-sm bg-gray-100 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-200 inline-flex items-center gap-1"
        >
          ⬇ {t.audit.exportCsv}
        </a>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th scope="col" className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">{t.audit.colDate}</th>
                <th scope="col" className="text-left px-4 py-3 font-semibold text-gray-600">{t.audit.colAction}</th>
                <th scope="col" className="text-left px-4 py-3 font-semibold text-gray-600">{t.audit.colUser}</th>
                <th scope="col" className="text-left px-4 py-3 font-semibold text-gray-600">{t.audit.colRole}</th>
                <th scope="col" className="text-left px-4 py-3 font-semibold text-gray-600">{t.audit.colIp}</th>
                <th scope="col" className="text-left px-4 py-3 font-semibold text-gray-600">{t.audit.colTarget}</th>
                <th scope="col" className="text-left px-4 py-3 font-semibold text-gray-600">{t.audit.colDetails}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-500">
                    {loading ? t.audit.loading : t.audit.empty}
                  </td>
                </tr>
              ) : logs.map(log => {
                const isExpanded = expanded === log.id
                let detailsObj: Record<string, unknown> | null = null
                try {
                  if (log.details) detailsObj = JSON.parse(log.details)
                } catch {}

                return (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap font-mono text-xs">
                      {formatDate(log.createdAt, locale)}
                    </td>
                    <td className="px-4 py-3">
                      <ActionBadge action={log.action} />
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate">
                      {log.userEmail ?? log.userId ?? <span className="text-gray-500">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {log.userRole ? (
                        <span className="text-xs text-gray-600 font-medium">{log.userRole}</span>
                      ) : <span className="text-gray-500">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {log.ip ?? <span className="text-gray-500">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {log.targetType && log.targetId
                        ? <span className="font-medium">{log.targetType}</span>
                        : <span className="text-gray-500">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {detailsObj ? (
                        <button
                          onClick={() => setExpanded(isExpanded ? null : log.id)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {isExpanded ? t.audit.hide : t.audit.show}
                        </button>
                      ) : <span className="text-gray-500 text-xs">—</span>}
                      {isExpanded && detailsObj && (
                        <pre className="mt-2 bg-gray-100 rounded p-2 text-xs text-gray-700 whitespace-pre-wrap max-w-xs">
                          {JSON.stringify(detailsObj, null, 2)}
                        </pre>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {t.audit.pageOf.replace('{page}', String(page)).replace('{pages}', String(pages))}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >
                ← {t.audit.prev}
              </button>
              <button
                disabled={page >= pages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >
                {t.audit.next} →
              </button>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
