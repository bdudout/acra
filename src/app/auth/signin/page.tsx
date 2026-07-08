'use client'

import { Suspense, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/context'
import LanguageSwitcher from '@/components/LanguageSwitcher'

function SignInForm() {
  const router = useRouter()
  const params = useSearchParams()
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // ── Étape MFA (déclenchée si la politique l'exige) ──
  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials')
  const [mfaCode, setMfaCode] = useState('')
  const [mfaChannel, setMfaChannel] = useState('EMAIL')
  const [mfaMasked, setMfaMasked] = useState('')

  const callbackUrl = params.get('callbackUrl') || '/dashboard'

  function handleResult(res: { error?: string | null } | undefined) {
    if (res?.error) {
      const err = res.error
      if (err.includes('MFA_REQUIRED')) {
        const parts = err.split('::')
        setMfaChannel(parts[1] || 'EMAIL')
        setMfaMasked(parts[2] || '')
        setStep('mfa'); setMfaCode(''); setError('')
        return
      }
      if (err.includes('MFA_INVALID'))     { setError(t.auth.signIn.mfaInvalid); return }
      if (err.includes('MFA_SEND_FAILED')) { setError(t.auth.signIn.mfaErrorSend); return }
      if (err.includes('MFA_NO_METHOD'))   { setError(t.auth.signIn.mfaNoMethod); return }
      // Démo : adresse non vérifiée → rediriger vers la saisie du code de vérification.
      if (err.includes('EMAIL_NOT_VERIFIED')) {
        router.push(`/auth/verify-email?email=${encodeURIComponent(email)}`)
        return
      }
      const blocked = ['ACCOUNT_LOCKED', 'ACCOUNT_SUSPENDED', 'TOO_MANY_ATTEMPTS']
      setError(blocked.some(c => err.includes(c)) ? t.auth.signIn.errorBlocked : t.auth.signIn.error)
    } else {
      router.push(callbackUrl)
    }
  }

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true)
    const res = await signIn('credentials', { email, password, redirect: false })
    setLoading(false); handleResult(res ?? undefined)
  }

  async function submitMfa(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true)
    const res = await signIn('credentials', { email, password, mfaCode, mfaChannel, redirect: false })
    setLoading(false); handleResult(res ?? undefined)
  }

  async function resendCode() {
    setError(''); setLoading(true)
    const res = await signIn('credentials', { email, password, mfaChannel, redirect: false })
    setLoading(false); handleResult(res ?? undefined)
  }

  // ── Étape 2 : saisie du code MFA ──
  if (step === 'mfa') {
    return (
      <>
        <h2 className="text-xl font-semibold text-gray-800 mb-1">{t.auth.signIn.mfaTitle}</h2>
        <p className="text-sm text-gray-500 mb-5">
          {t.auth.signIn.mfaSentTo} <span className="font-medium text-gray-700">{mfaMasked}</span>
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">{error}</div>
        )}

        <form onSubmit={submitMfa} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.auth.signIn.mfaCodeLabel}</label>
            <input
              type="text" inputMode="numeric" autoComplete="one-time-code" autoFocus required
              maxLength={6} value={mfaCode}
              onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-center text-lg tracking-[0.4em] font-mono focus:outline-none focus:ring-2 focus:ring-ebios-500 focus:border-transparent"
              placeholder="••••••"
            />
          </div>

          <button type="submit" disabled={loading || mfaCode.length < 6}
            className="w-full bg-ebios-600 hover:bg-ebios-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition-colors">
            {loading ? t.auth.signIn.submitting : t.auth.signIn.mfaSubmit}
          </button>
        </form>

        <div className="flex items-center justify-between mt-4 text-sm">
          <button type="button" onClick={() => { setStep('credentials'); setError(''); setMfaCode('') }}
            className="text-gray-500 hover:text-ebios-600 hover:underline">
            {t.auth.signIn.mfaBack}
          </button>
          <button type="button" onClick={resendCode} disabled={loading}
            className="text-ebios-600 hover:underline font-medium disabled:opacity-60">
            {t.auth.signIn.mfaResend}
          </button>
        </div>
      </>
    )
  }

  // ── Étape 1 : identifiants ──
  return (
    <>
      <h2 className="text-xl font-semibold text-gray-800 mb-6">{t.auth.signIn.title}</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
          {error}
        </div>
      )}

      <form onSubmit={submitCredentials} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.auth.email}</label>
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ebios-500 focus:border-transparent"
            placeholder={t.auth.emailPh}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.auth.password}</label>
          <input
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ebios-500 focus:border-transparent"
            placeholder={t.auth.passwordPh}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-ebios-600 hover:bg-ebios-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition-colors"
        >
          {loading ? t.auth.signIn.submitting : t.auth.signIn.submit}
        </button>
      </form>

      <p className="text-center text-sm mt-4">
        <Link href="/auth/forgot-password" className="text-gray-500 hover:text-ebios-600 hover:underline">
          {t.auth.signIn.forgotPassword}
        </Link>
      </p>

      <p className="text-center text-sm text-gray-600 mt-4">
        {t.auth.signIn.noAccount}{' '}
        <Link href="/auth/register" className="text-ebios-600 hover:underline font-medium">
          {t.auth.signIn.createLink}
        </Link>
      </p>
    </>
  )
}

export default function SignInPage() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-gradient-to-br from-ebios-950 to-ebios-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <Image src="/logo-mark.png" alt="" width={334} height={384} priority className="h-16 w-auto mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-gray-900">{t.auth.appName}</h1>
          <p className="text-gray-500 text-sm mt-1">{t.auth.appSubtitle}</p>
        </div>

        <Suspense fallback={
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-ebios-500 border-t-transparent rounded-full" />
          </div>
        }>
          <SignInForm />
        </Suspense>

        <div className="flex justify-center mt-6">
          <LanguageSwitcher />
        </div>
      </div>
    </div>
  )
}
