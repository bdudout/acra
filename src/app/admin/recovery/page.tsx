'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import AdminNav from '@/components/AdminNav'
import ConfirmDialog from '@/components/ConfirmDialog'
import { useTranslation } from '@/lib/i18n/context'
import { formatDateTime } from '@/lib/format'
import { RotateCcw, Trash2 } from 'lucide-react'

interface DeletedAnalyse {
  id: string
  nom: string
  organisation: string | null
  secteur: string | null
  statut: string
  deletedAt: string
  daysRemaining: number
  user: { name: string | null; email: string } | null
}

export default function RecoveryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { t, locale } = useTranslation()
  const r = t.admin.recovery
  const currentRole = (session?.user as any)?.role ?? 'ANALYSTE'

  const [analyses, setAnalyses] = useState<DeletedAnalyse[]>([])
  const [retentionDays, setRetentionDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ message: string; action: () => void } | null>(null)

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user || currentRole !== 'ADMIN') router.replace('/dashboard')
  }, [session, status, currentRole, router])

  const load = useCallback(() => {
    fetch('/api/admin/recovery')
      .then(r => (r.ok ? r.json() : { analyses: [] }))
      .then(d => {
        setAnalyses(d.analyses ?? [])
        if (d.retentionDays) setRetentionDays(d.retentionDays)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { if (currentRole === 'ADMIN') load() }, [currentRole, load])

  async function act(id: string, method: 'PATCH' | 'DELETE') {
    setBusy(id)
    const res = await fetch(`/api/admin/recovery/${id}`, { method })
    setBusy(null)
    if (res.ok) setAnalyses(prev => prev.filter(a => a.id !== id))
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-ebios-500 border-t-transparent" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main id="main-content" className="mx-auto max-w-6xl px-4 py-8">
        <AdminNav active="recovery" />

        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Trash2 size={22} aria-hidden="true" /> {r.title}
          </h1>
          <p className="mt-1 text-gray-500">{r.subtitle.replace('{days}', String(retentionDays))}</p>
        </div>

        {analyses.length === 0 ? (
          <div className="card p-10 text-center">
            <div className="mb-3 text-4xl">🗑️</div>
            <p className="text-gray-500">{r.empty}</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{r.colName}</th>
                  <th scope="col" className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:table-cell">{r.colOwner}</th>
                  <th scope="col" className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 md:table-cell">{r.colDeleted}</th>
                  <th scope="col" className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">{r.colRemaining}</th>
                  <th scope="col" className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {analyses.map(a => (
                  <tr key={a.id} className="transition-colors hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{a.nom}</div>
                      {a.organisation && <div className="text-xs text-gray-500">{a.organisation}</div>}
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <div className="text-xs text-gray-700">{a.user?.name ?? '—'}</div>
                      {a.user?.email && <div className="text-xs text-gray-400">{a.user.email}</div>}
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-gray-500 md:table-cell">{formatDateTime(a.deletedAt, locale)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${a.daysRemaining <= 3 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                        {a.daysRemaining} {a.daysRemaining <= 3 ? `· ${r.expiringSoon}` : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          disabled={busy === a.id}
                          onClick={() => setConfirm({ message: r.restoreConfirm, action: () => act(a.id, 'PATCH') })}
                          className="inline-flex items-center gap-1 rounded-lg border border-ebios-200 px-2.5 py-1.5 text-xs font-medium text-ebios-700 hover:bg-ebios-50 disabled:opacity-50"
                        >
                          <RotateCcw size={13} aria-hidden="true" /> {r.restore}
                        </button>
                        <button
                          disabled={busy === a.id}
                          onClick={() => setConfirm({ message: r.purgeConfirm, action: () => act(a.id, 'DELETE') })}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 size={13} aria-hidden="true" /> {r.purge}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={() => { confirm.action(); setConfirm(null) }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
