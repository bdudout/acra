'use client'

import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/context'

export default function ForgotPasswordPage() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-gradient-to-br from-ebios-950 to-ebios-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3" aria-hidden="true">🔑</div>
          <h1 className="text-2xl font-bold text-gray-900">{t.auth.forgot.title}</h1>
          <p className="text-gray-500 text-sm mt-1">{t.auth.forgot.subtitle}</p>
        </div>

        <div className="bg-ebios-50 border border-ebios-200 rounded-lg p-4 text-sm text-gray-700 space-y-2">
          <p>{t.auth.forgot.step1}</p>
          <p>{t.auth.forgot.step2}</p>
          <p>{t.auth.forgot.step3}</p>
        </div>

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
