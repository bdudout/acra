'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useTranslation } from '@/lib/i18n/context'
import { validatePassword, DEFAULT_POLICY, type PasswordPolicyShape, type PasswordRuleCode } from '@/lib/password-policy'

export default function ChangePasswordPage() {
  const router = useRouter()
  const { data: session, status, update } = useSession()
  const { t } = useTranslation()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [policy, setPolicy] = useState<PasswordPolicyShape>(DEFAULT_POLICY)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/auth/signin')
  }, [status, router])

  useEffect(() => {
    fetch('/api/auth/password-policy')
      .then(r => r.json())
      .then(d => { if (d && typeof d.minLength === 'number') setPolicy(d) })
      .catch(() => {})
  }, [])

  const checks = newPassword ? validatePassword(newPassword, policy) : []

  // Libellé traduit d'une règle de mot de passe (code → texte i18n)
  const ruleLabel = (code: PasswordRuleCode): string => ({
    minLength: t.passwordPolicy.ruleMinLength.replace('{min}', String(policy.minLength)),
    uppercase: t.passwordPolicy.ruleUppercase,
    lowercase: t.passwordPolicy.ruleLowercase,
    digit:     t.passwordPolicy.ruleDigit,
    special:   t.passwordPolicy.ruleSpecial,
  }[code])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (newPassword !== confirm) { setError(t.changePassword.mismatch); return }
    if (checks.length > 0) { setError(checks.map(ruleLabel).join(' ')); return }
    if (newPassword === currentPassword) { setError(t.changePassword.sameAsOld); return }

    setSaving(true)
    const res = await fetch('/api/user/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    setSaving(false)
    if (res.ok) {
      // Rafraîchit la session (mustChangePassword devient false) puis redirige
      await update?.()
      router.replace('/dashboard')
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error === 'PASSWORD_POLICY' ? t.passwordPolicy.policyError : (d.error || t.changePassword.genericError))
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <div className="mb-6">
            <div className="text-3xl mb-2">🔐</div>
            <h1 className="text-xl font-bold text-gray-900">{t.changePassword.title}</h1>
            <p className="text-sm text-gray-500 mt-1">{t.changePassword.subtitle}</p>
            {session?.user?.email && (
              <p className="text-xs text-gray-400 mt-1">{session.user.email}</p>
            )}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">{t.changePassword.current}</label>
              <input
                type="password" required autoComplete="current-password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="input w-full"
                placeholder={t.changePassword.currentPh}
              />
            </div>
            <div>
              <label className="label">{t.changePassword.new}</label>
              <input
                type="password" required autoComplete="new-password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="input w-full"
              />
              {newPassword && checks.length > 0 && (
                <ul className="mt-1 text-xs text-amber-600 list-disc list-inside">
                  {checks.map((c, i) => <li key={i}>{ruleLabel(c)}</li>)}
                </ul>
              )}
            </div>
            <div>
              <label className="label">{t.changePassword.confirm}</label>
              <input
                type="password" required autoComplete="new-password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className="input w-full"
              />
            </div>
            <button type="submit" disabled={saving} className="btn-primary w-full">
              {saving ? t.saving : t.changePassword.submit}
            </button>
          </form>

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="mt-4 text-xs text-gray-400 hover:text-gray-600 w-full text-center"
          >
            {t.changePassword.signOut}
          </button>
        </div>
      </div>
    </div>
  )
}
