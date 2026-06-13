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

  const callbackUrl = params.get('callbackUrl') || '/dashboard'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await signIn('credentials', {
      email, password, redirect: false,
    })

    setLoading(false)
    if (res?.error) {
      // Codes levés par authorize() : compte bloqué/suspendu/rate-limité
      const blocked = ['ACCOUNT_LOCKED', 'ACCOUNT_SUSPENDED', 'TOO_MANY_ATTEMPTS']
      setError(blocked.some(c => res.error?.includes(c)) ? t.auth.signIn.errorBlocked : t.auth.signIn.error)
    } else {
      router.push(callbackUrl)
    }
  }

  return (
    <>
      <h2 className="text-xl font-semibold text-gray-800 mb-6">{t.auth.signIn.title}</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
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
