'use client'
// ─── Récupération › incidents supprimés (corbeille, ADMIN) ────────────────────
// Liste les incidents supprimés encore dans la rétention ; restaurer (même identifiant, liens encore valides) ou
// purger définitivement, après confirmation. API : /api/admin/recovery/elements/[id] ; logique pure : lib/corbeille.

import { useState } from 'react'
import { RotateCcw, Trash2 } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import { useTranslation } from '@/lib/i18n/context'
import { formatDateTime } from '@/lib/format'

export interface ElementCorbeille { id: string; type: string; intitule: string; supprimeLe: string; daysRemaining: number }

export default function CorbeilleElements({ initial }: { initial: ElementCorbeille[] }) {
  const { t, locale } = useTranslation()
  const r = t.admin.recovery
  const [elements, setElements] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ message: string; label: string; action: () => void } | null>(null)

  async function act(id: string, method: 'PATCH' | 'DELETE') {
    setBusy(id)
    const res = await fetch(`/api/admin/recovery/elements/${id}`, { method }).catch(() => null)
    setBusy(null)
    if (res?.ok) setElements(prev => prev.filter(e => e.id !== id))
  }

  return (
    <section className="mt-8" aria-label={r.elementsTitle}>
      <h2 className="mb-3 text-lg font-semibold text-gray-900">{r.elementsTitle}</h2>
      {elements.length === 0 ? <p className="card p-6 text-sm text-gray-500">{r.elementsEmpty}</p> : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50"><tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{r.colName}</th>
              <th scope="col" className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 md:table-cell">{r.colDeleted}</th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">{r.colRemaining}</th>
              <th scope="col" className="px-4 py-3" />
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {elements.map(e => (
                <tr key={e.id}>
                  <td className="px-4 py-3 font-medium text-gray-800">{e.intitule}</td>
                  <td className="hidden px-4 py-3 text-xs text-gray-500 md:table-cell">{formatDateTime(e.supprimeLe, locale)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${e.daysRemaining <= 3 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{e.daysRemaining}{e.daysRemaining <= 3 ? ` · ${r.expiringSoon}` : ''}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" disabled={busy === e.id} onClick={() => setConfirm({ message: r.elementsRestoreConfirm, label: r.restore, action: () => act(e.id, 'PATCH') })}
                        className="inline-flex items-center gap-1 rounded-lg border border-ebios-200 px-2.5 py-1.5 text-xs font-medium text-ebios-700 hover:bg-ebios-50 disabled:opacity-50">
                        <RotateCcw size={13} aria-hidden="true" /> {r.restore}
                      </button>
                      <button type="button" disabled={busy === e.id} onClick={() => setConfirm({ message: r.elementsPurgeConfirm, label: r.purge, action: () => act(e.id, 'DELETE') })}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
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
      {confirm && <ConfirmDialog message={confirm.message} confirmLabel={confirm.label} variant={confirm.label === r.restore ? 'primary' : 'danger'}
        onConfirm={() => { confirm.action(); setConfirm(null) }} onCancel={() => setConfirm(null)} />}
    </section>
  )
}
