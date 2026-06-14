'use client'

import { useState, useEffect } from 'react'
import { Globe, Check } from 'lucide-react'
import Navbar from '@/components/Navbar'
import { useTranslation } from '@/lib/i18n/context'
import { LOCALES, LOCALE_LABELS } from '@/lib/i18n'
import { useTheme, type ThemeMode } from '@/lib/theme'

// Validation locale de la politique de mots de passe (miroir de src/lib/password-policy.ts)
interface PolicyShape {
  minLength: number
  requireUppercase: boolean
  requireLowercase: boolean
  requireNumbers: boolean
  requireSpecial: boolean
}

const DEFAULT_POLICY: PolicyShape = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecial: true,
}

function checkPassword(password: string, policy: PolicyShape) {
  return [
    { ok: password.length >= policy.minLength,         label: `${policy.minLength} caractères minimum` },
    { ok: !policy.requireUppercase || /[A-Z]/.test(password), label: 'Au moins une majuscule' },
    { ok: !policy.requireLowercase || /[a-z]/.test(password), label: 'Au moins une minuscule' },
    { ok: !policy.requireNumbers  || /[0-9]/.test(password), label: 'Au moins un chiffre' },
    { ok: !policy.requireSpecial  || /[^A-Za-z0-9]/.test(password), label: 'Au moins un caractère spécial' },
  ]
}

const THEME_OPTIONS: { value: ThemeMode; icon: string }[] = [
  { value: 'light',  icon: '☀️' },
  { value: 'dark',   icon: '🌙' },
  { value: 'system', icon: '💻' },
]

export default function ProfilePage() {
  const { t, locale, setLocale } = useTranslation()
  const { theme, setTheme } = useTheme()

  // ── État profil ──────────────────────────────────────────────────────
  const [name,        setName]        = useState('')
  const [email,       setEmail]       = useState('')
  const [phone,       setPhone]       = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState(false)
  const [profileError,   setProfileError]   = useState('')

  // ── État mot de passe ────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword,     setNewPassword]     = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPwd,    setSavingPwd]    = useState(false)
  const [pwdSuccess,   setPwdSuccess]   = useState(false)
  const [pwdError,     setPwdError]     = useState('')

  // ── Politique de mots de passe (récupérée depuis l'API admin) ────────
  const [policy, setPolicy] = useState<PolicyShape>(DEFAULT_POLICY)

  useEffect(() => {
    // Charger les infos de l'utilisateur courant
    fetch('/api/user/profile')
      .then(r => r.json())
      .then(d => {
        if (d.user) {
          setName(d.user.name || '')
          setEmail(d.user.email || '')
          setPhone(d.user.phone || '')
        }
      })
      .catch(() => {})

    // Charger la politique de mots de passe active
    fetch('/api/admin/password-policy')
      .then(r => r.json())
      .then(d => { if (d.policy) setPolicy(d.policy) })
      .catch(() => {})
  }, [])

  // Indicateurs de force du mot de passe
  const pwdChecks = newPassword ? checkPassword(newPassword, policy) : []
  const pwdStrong = pwdChecks.length > 0 && pwdChecks.every(c => c.ok)

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault()
    setProfileError('')
    setProfileSuccess(false)
    setSavingProfile(true)
    const res = await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone }),
    })
    setSavingProfile(false)
    if (res.ok) {
      setProfileSuccess(true)
    } else {
      const d = await res.json()
      setProfileError(d.error || t.error)
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPwdError('')
    setPwdSuccess(false)

    if (newPassword !== confirmPassword) {
      setPwdError(t.profile.mismatch)
      return
    }
    if (!pwdStrong) {
      setPwdError(t.passwordPolicy.policyError)
      return
    }

    setSavingPwd(true)
    const res = await fetch('/api/user/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    setSavingPwd(false)

    if (res.ok) {
      setPwdSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } else {
      const d = await res.json()
      setPwdError(d.error === 'PASSWORD_POLICY' ? t.passwordPolicy.policyError : (d.error || t.error))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 py-10 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">{t.profile.title}</h1>

        {/* ── Section identité ──────────────────────────────────────── */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-5">👤 {t.profile.identityTitle}</h2>

          {profileSuccess && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm">
              ✅ {t.profile.identitySuccess}
            </div>
          )}
          {profileError && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              ⚠️ {profileError}
            </div>
          )}

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.profile.nameLabel}
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t.profile.namePh}
                required
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.profile.emailLabel}
              </label>
              <input
                type="email"
                value={email}
                disabled
                className="input w-full bg-gray-50 text-gray-500 cursor-not-allowed"
                title="L'adresse e-mail ne peut pas être modifiée ici."
              />
              <p className="text-xs text-gray-500 mt-1">{t.profile.emailHint}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.profile.phoneLabel}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="input w-full"
                placeholder="+33 6 12 34 56 78"
              />
              <p className="text-xs text-gray-500 mt-1">{t.profile.phoneHint}</p>
            </div>
            <button
              type="submit"
              disabled={savingProfile}
              className="btn-primary w-full"
            >
              {savingProfile ? t.saving : t.profile.saveIdentityBtn}
            </button>
          </form>
        </div>

        {/* ── Section langue ────────────────────────────────────────── */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">🌐 Langue de l&apos;interface</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {LOCALES.map(l => (
              <button
                key={l}
                onClick={() => setLocale(l)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                  l === locale
                    ? 'bg-ebios-50 border-ebios-300 text-ebios-700 shadow-sm'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Globe size={16} aria-hidden="true" />
                <span className="truncate">{LOCALE_LABELS[l]}</span>
                {l === locale && <Check size={14} className="ml-auto text-ebios-500" />}
              </button>
            ))}
          </div>
        </div>

        {/* ── Section thème ─────────────────────────────────────────── */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">🎨 {t.profile.themeTitle}</h2>
          <div className="grid grid-cols-3 gap-2">
            {THEME_OPTIONS.map(({ value, icon }) => {
              const label = value === 'light'
                ? t.profile.themeLight
                : value === 'dark'
                  ? t.profile.themeDark
                  : t.profile.themeSystem
              const desc = value === 'light'
                ? t.profile.themeLightDesc
                : value === 'dark'
                  ? t.profile.themeDarkDesc
                  : t.profile.themeSystemDesc
              return (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl border text-sm font-medium transition-colors ${
                    value === theme
                      ? 'bg-ebios-50 border-ebios-300 text-ebios-700 shadow-sm'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-xl">{icon}</span>
                  <span>{label}</span>
                  <span className={`text-xs text-center leading-tight font-normal ${value === theme ? 'text-ebios-500' : 'text-gray-400'}`}>{desc}</span>
                  {value === theme && <span className="text-ebios-500 text-xs">✓</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Section mot de passe ──────────────────────────────────── */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-5">🔒 {t.profile.changePassword}</h2>

          {pwdSuccess && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm">
              ✅ {t.profile.successMsg}
            </div>
          )}
          {pwdError && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              ⚠️ {pwdError}
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.profile.currentPassword}
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder={t.profile.currentPh}
                required
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.profile.newPassword}
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder={t.profile.newPh}
                required
                className={`input w-full ${newPassword && (pwdStrong ? 'border-green-400' : 'border-orange-400')}`}
              />
              {/* Indicateurs de politique en temps réel */}
              {newPassword && (
                <div className="mt-2 space-y-1">
                  {pwdChecks.map((c, i) => (
                    <div key={i} className={`flex items-center gap-2 text-xs ${c.ok ? 'text-green-600' : 'text-orange-600'}`}>
                      <span>{c.ok ? '✓' : '✗'}</span>
                      <span>{c.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.profile.confirmPassword}
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder={t.profile.confirmPh}
                required
                className={`input w-full ${
                  confirmPassword
                    ? confirmPassword === newPassword ? 'border-green-400' : 'border-red-400'
                    : ''
                }`}
              />
              {confirmPassword && confirmPassword !== newPassword && (
                <p className="text-xs text-red-600 mt-1">{t.profile.mismatch}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={savingPwd || !pwdStrong || newPassword !== confirmPassword}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingPwd ? t.saving : t.profile.updateBtn}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
