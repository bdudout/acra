'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/context'
import LanguageSwitcher from '@/components/LanguageSwitcher'

/**
 * Page de vérification d'e-mail (mode démo) : le testeur saisit le code OTP reçu par
 * e-mail à l'inscription. Une fois validé, la connexion est débloquée. Bouton de
 * renvoi de code (rate-limité côté serveur).
 */
function VerifyEmailForm() {
  const router = useRouter()
  const params = useSearchParams()
  const { t } = useTranslation()
  const email = params.get('email') || ''
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setInfo(''); setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, action: 'verify' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(res.status === 429 ? t.auth.verifyEmail.tooMany : t.auth.verifyEmail.invalid)
        setLoading(false)
        return
      }
      // Succès : rediriger vers la connexion.
      router.push('/auth/signin?verified=1')
    } catch {
      setError(t.auth.verifyEmail.invalid)
      setLoading(false)
    }
  }

  async function resend() {
    setError(''); setInfo(''); setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, action: 'resend' }),
      })
      setInfo(res.status === 429 ? t.auth.verifyEmail.tooMany : t.auth.verifyEmail.resent)
    } catch {
      setError(t.auth.verifyEmail.invalid)
    }
    setLoading(false)
  }

  return (
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
      <div className="text-center mb-8">
        <Image src="/logo-mark.png" alt="" width={334} height={384} priority className="h-16 w-auto mx-auto mb-3" />
        <h1 className="text-2xl font-bold text-gray-900">{t.auth.appName}</h1>
      </div>

      <h2 className="text-xl font-semibold text-gray-800 mb-1">{t.auth.verifyEmail.title}</h2>
      <p className="text-sm text-gray-500 mb-6">
        {t.auth.verifyEmail.description} <span className="font-medium text-gray-700">{email}</span>
      </p>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">{error}</div>}
      {info && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm mb-4">{info}</div>}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.auth.verifyEmail.codeLabel}</label>
          <input
            type="text" inputMode="numeric" autoComplete="one-time-code" required
            value={code}
            onChange={e => setCode(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-ebios-500"
            placeholder="––––––"
          />
        </div>
        <button
          type="submit" disabled={loading || !code}
          className="w-full bg-ebios-600 hover:bg-ebios-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition-colors"
        >
          {loading ? t.auth.verifyEmail.submitting : t.auth.verifyEmail.submit}
        </button>
      </form>

      <div className="text-center mt-4">
        <button type="button" onClick={resend} disabled={loading}
          className="text-ebios-600 hover:underline text-sm font-medium">
          {t.auth.verifyEmail.resend}
        </button>
      </div>

      <p className="text-center text-sm text-gray-600 mt-6">
        <Link href="/auth/signin" className="text-ebios-600 hover:underline font-medium">
          {t.auth.verifyEmail.backToSignin}
        </Link>
      </p>

      <div className="flex justify-center mt-4">
        <LanguageSwitcher />
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-ebios-950 to-ebios-800 flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-white">…</div>}>
        <VerifyEmailForm />
      </Suspense>
    </div>
  )
}
