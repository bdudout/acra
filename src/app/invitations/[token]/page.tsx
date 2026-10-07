'use client'

// Acceptation d'une invitation à rejoindre une organisation (T23). Page publique :
// l'invité peut ne pas avoir de compte (création sur place) ou devoir se connecter.

import { FormEvent, use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { MailCheck } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'

type Preview =
  | { state: 'NOT_FOUND' | 'EXPIRED' | 'USED' }
  | { state: 'VALID'; orgNom: string; email: string; role: string; accountExists: boolean }

export default function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const { t } = useTranslation()
  const tr = t.invitations
  const router = useRouter()
  const { data: session, status } = useSession()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('')

  useEffect(() => {
    fetch(`/api/invitations/${encodeURIComponent(token)}`)
      .then(r => r.json()).then(setPreview).catch(() => setPreview({ state: 'NOT_FOUND' }))
  }, [token])

  async function accept(body?: { name: string; password: string }) {
    setBusy(true); setError('')
    const res = await fetch(`/api/invitations/${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (res.ok) { router.push(body ? '/auth/signin?invitation=1' : '/dashboard'); return }
    setError(data.error === 'PASSWORD_POLICY' ? tr.policyError : tr.error)
  }

  function create(e: FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError(tr.mismatch); return }
    accept({ name, password })
  }

  const sessionEmail = (session?.user as { email?: string } | undefined)?.email?.toLowerCase() ?? null
  const roleLabel = (r: string) => (t.roles as Record<string, string>)[r] ?? r
  const valid = preview?.state === 'VALID' ? preview : null

  return (
    <div className="min-h-screen bg-linear-to-br from-ebios-950 to-ebios-800 flex items-center justify-center p-4">
      <main className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <MailCheck size={32} className="mx-auto mb-3 text-ebios-600" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-gray-900">{tr.title}</h1>
        </div>
        {error && <p role="alert" className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4">{error}</p>}
        {!preview || status === 'loading' ? <p className="text-center text-gray-500">{tr.loading}</p>
          : preview.state === 'NOT_FOUND' ? <p className="text-gray-700">{tr.notFound}</p>
          : preview.state === 'EXPIRED' ? <p className="text-gray-700">{tr.expired}</p>
          : preview.state === 'USED' || !valid ? <p className="text-gray-700">{tr.used}</p>
          : (
            <div className="space-y-4">
              <p className="text-gray-700">{tr.intro.replace('{org}', valid.orgNom).replace('{role}', roleLabel(valid.role))}</p>
              {sessionEmail ? (
                sessionEmail === valid.email.toLowerCase()
                  ? <button type="button" disabled={busy} onClick={() => accept()} className="w-full bg-ebios-600 hover:bg-ebios-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg">{busy ? tr.accepting : tr.accept}</button>
                  : <div className="space-y-3"><p className="text-sm text-amber-700">{tr.wrongAccount.replace('{email}', valid.email)}</p><button type="button" onClick={() => signOut({ callbackUrl: `/invitations/${encodeURIComponent(token)}` })} className="btn-secondary w-full">{tr.signOut}</button></div>
              ) : valid.accountExists ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">{tr.loginToAccept.replace('{email}', valid.email)}</p>
                  <Link href={`/auth/signin?callbackUrl=${encodeURIComponent(`/invitations/${token}`)}`} className="block text-center w-full bg-ebios-600 hover:bg-ebios-700 text-white font-medium py-2.5 rounded-lg">{tr.login}</Link>
                </div>
              ) : (
                <form onSubmit={create} className="space-y-3">
                  <h2 className="text-sm font-semibold text-gray-800">{tr.createTitle}</h2>
                  <p className="text-sm text-gray-600">{valid.email}</p>
                  <label className="block text-sm font-medium text-gray-700">{tr.name}<input required minLength={2} maxLength={100} autoComplete="name" value={name} onChange={e => setName(e.target.value)} className="input mt-1" /></label>
                  <label className="block text-sm font-medium text-gray-700">{tr.password}<input required type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className="input mt-1" /></label>
                  <label className="block text-sm font-medium text-gray-700">{tr.confirm}<input required type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} className="input mt-1" /></label>
                  <button disabled={busy} className="w-full bg-ebios-600 hover:bg-ebios-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg">{busy ? tr.accepting : tr.create}</button>
                </form>
              )}
            </div>
          )}
      </main>
    </div>
  )
}
