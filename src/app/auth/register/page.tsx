'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/context'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { validatePassword, DEFAULT_POLICY, type PasswordPolicyShape, type PasswordRuleCode } from '@/lib/password-policy'

export default function RegisterPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [policy, setPolicy] = useState<PasswordPolicyShape>(DEFAULT_POLICY)

  // Libellé traduit d'une règle de mot de passe (code → texte i18n)
  const ruleLabel = (code: PasswordRuleCode): string => ({
    minLength: t.passwordPolicy.ruleMinLength.replace('{min}', String(policy.minLength)),
    uppercase: t.passwordPolicy.ruleUppercase,
    lowercase: t.passwordPolicy.ruleLowercase,
    digit:     t.passwordPolicy.ruleDigit,
    special:   t.passwordPolicy.ruleSpecial,
  }[code])

  // Charger la politique de mot de passe (endpoint public dédié)
  useEffect(() => {
    fetch('/api/auth/password-policy').then(r => r.ok ? r.json() : null).then(data => {
      if (data) setPolicy(data)
    }).catch(() => { /* utiliser la politique par défaut */ })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirm) {
      setError(t.auth.register.errorMismatch)
      return
    }
    const errors = validatePassword(form.password, policy)
    if (errors.length > 0) {
      setError(errors.map(ruleLabel).join(' '))
      return
    }

    setLoading(true)
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error === 'PASSWORD_POLICY' ? t.passwordPolicy.policyError : (data.error || t.auth.register.errorGeneric))
      setLoading(false)
      return
    }

    // Mode démo : l'adresse doit être vérifiée (OTP) avant toute connexion.
    if (data.verificationRequired) {
      router.push(`/auth/verify-email?email=${encodeURIComponent(form.email)}`)
      return
    }

    await signIn('credentials', { email: form.email, password: form.password, redirect: false })
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-ebios-950 to-ebios-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <Image src="/logo-mark.png" alt="" width={334} height={384} priority className="h-16 w-auto mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-gray-900">{t.auth.appName}</h1>
          <p className="text-gray-500 text-sm mt-1">{t.auth.appSubtitle}</p>
        </div>

        <h2 className="text-xl font-semibold text-gray-800 mb-2">{t.auth.register.title}</h2>
        <p className="text-sm text-gray-500 mb-6">{t.auth.register.description}</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.auth.register.name}</label>
            <input
              type="text" required minLength={2}
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ebios-500"
              placeholder={t.auth.register.namePh}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.auth.register.emailPro}</label>
            <input
              type="email" required
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ebios-500"
              placeholder={t.auth.emailPh}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.auth.password}</label>
            <input
              type="password" required
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ebios-500"
              placeholder={t.auth.passwordPh}
            />
            {/* Règles affichées uniquement quand l'utilisateur commence à taper */}
            {form.password.length > 0 && (
              <div className="mt-2 space-y-1">
                {[
                  { ok: form.password.length >= policy.minLength,                   label: ruleLabel('minLength') },
                  ...(policy.requireUppercase ? [{ ok: /[A-Z]/.test(form.password), label: ruleLabel('uppercase') }] : []),
                  ...(policy.requireLowercase ? [{ ok: /[a-z]/.test(form.password), label: ruleLabel('lowercase') }] : []),
                  ...(policy.requireNumbers   ? [{ ok: /[0-9]/.test(form.password), label: ruleLabel('digit') }] : []),
                  ...(policy.requireSpecial   ? [{ ok: /[^A-Za-z0-9]/.test(form.password), label: ruleLabel('special') }] : []),
                ].map((rule, i) => (
                  <div key={i} className={`flex items-center gap-1.5 text-xs ${rule.ok ? 'text-green-600' : 'text-red-500'}`}>
                    <span>{rule.ok ? '✓' : '✗'}</span>
                    <span>{rule.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.auth.register.confirm}</label>
            <input
              type="password" required
              value={form.confirm}
              onChange={e => setForm({ ...form, confirm: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ebios-500"
              placeholder={t.auth.register.confirmPh}
            />
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full bg-ebios-600 hover:bg-ebios-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition-colors"
          >
            {loading ? t.auth.register.submitting : t.auth.register.submit}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          {t.auth.register.hasAccount}{' '}
          <Link href="/auth/signin" className="text-ebios-600 hover:underline font-medium">
            {t.auth.register.signinLink}
          </Link>
        </p>

        <div className="flex justify-center mt-4">
          <LanguageSwitcher />
        </div>
      </div>
    </div>
  )
}
