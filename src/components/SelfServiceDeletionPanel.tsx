'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'

interface Labels { title: string; description: string; confirmation: string; button: string; error: string }

export default function SelfServiceDeletionPanel({ enabled, labels }: { enabled: boolean; labels: Labels }) {
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  if (!enabled) return null

  async function removeAccount() {
    setError('')
    setDeleting(true)
    try {
      const response = await fetch('/api/account/delete', { method: 'DELETE' })
      if (!response.ok) { setError(labels.error); return }
      await signOut({ callbackUrl: '/' })
    } catch {
      setError(labels.error)
    } finally {
      setDeleting(false)
    }
  }

  return <section className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-900/70 dark:bg-red-950/30">
    <h2 className="text-lg font-semibold text-red-900 dark:text-red-100">{labels.title}</h2>
    <p className="mt-2 text-sm text-red-800 dark:text-red-200">{labels.description}</p>
    <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-red-900 dark:text-red-100">
      <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-red-700" />
      <span>{labels.confirmation}</span>
    </label>
    <button type="button" disabled={!confirmed || deleting} onClick={removeAccount} className="mt-4 min-h-11 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50">
      {labels.button}
    </button>
    {error && <p role="alert" className="mt-3 text-sm text-red-800 dark:text-red-200">{error}</p>}
  </section>
}
