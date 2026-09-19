'use client'

import { FormEvent, useState } from 'react'
import { KeyRound } from 'lucide-react'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/context'

export default function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault(); setLoading(true)
    await fetch('/api/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }).catch(() => {})
    setLoading(false); setSent(true)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-ebios-950 to-ebios-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3" aria-hidden="true"><KeyRound size={32} aria-hidden="true" /></div>
          <h1 className="text-2xl font-bold text-gray-900">{t.auth.forgot.title}</h1>
          <p className="text-gray-500 text-sm mt-1">{t.auth.forgot.subtitle}</p>
        </div>

        {sent ? <p className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">{t.auth.forgot.sent}</p> : <form onSubmit={submit} className="space-y-4"><label className="block text-sm font-medium text-gray-700">{t.auth.email}<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="input mt-1" /></label><button disabled={loading} className="w-full bg-ebios-600 hover:bg-ebios-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg">{loading ? t.auth.signIn.submitting : t.auth.forgot.submit}</button></form>}

        <Link
          href="/auth/signin"
          className="mt-6 block text-center w-full bg-ebios-600 hover:bg-ebios-700 text-white font-medium py-2.5 rounded-lg transition-colors"
        >
          {t.auth.forgot.backToSignIn}
        </Link>
      </div>
    </div>
  )
}
