'use client'

import { FormEvent, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { KeyRound } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'

export default function ResetPasswordPage() {
  const { t } = useTranslation(); const router = useRouter(); const params = useSearchParams()
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault(); setError('')
    if (password !== confirm) { setError(t.auth.reset.mismatch); return }
    setLoading(true)
    const res = await fetch('/api/auth/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: params.get('token') ?? '', password }) })
    setLoading(false)
    if (res.ok) { router.push('/auth/signin?reset=1'); return }
    const data = await res.json().catch(() => ({})); setError(data.error === 'PASSWORD_POLICY' ? t.auth.reset.policyError : t.auth.reset.invalid)
  }
  return <div className="min-h-screen bg-gradient-to-br from-ebios-950 to-ebios-800 flex items-center justify-center p-4"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8"><div className="text-center mb-6"><KeyRound size={32} className="mx-auto mb-3 text-ebios-600" /><h1 className="text-2xl font-bold text-gray-900">{t.auth.reset.title}</h1><p className="text-gray-500 text-sm mt-1">{t.auth.reset.subtitle}</p></div>{error && <p className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4">{error}</p>}<form onSubmit={submit} className="space-y-4"><label className="block text-sm font-medium text-gray-700">{t.auth.reset.password}<input required type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className="input mt-1" /></label><label className="block text-sm font-medium text-gray-700">{t.auth.reset.confirm}<input required type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} className="input mt-1" /></label><button disabled={loading} className="w-full bg-ebios-600 hover:bg-ebios-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg">{loading ? t.auth.signIn.submitting : t.auth.reset.submit}</button></form></div></div>
}
