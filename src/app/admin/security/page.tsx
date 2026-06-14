'use client'

import { useState, useEffect, useCallback } from 'react'
import Navbar from '@/components/Navbar'
import AdminNav from '@/components/AdminNav'
import { useTranslation } from '@/lib/i18n/context'

type SmsProvider  = 'TWILIO' | 'OVH' | 'CUSTOM'
type SsoProtocol  = 'SAML' | 'OIDC'
type SsoSignAlgo  = 'RSA-SHA256' | 'RSA-SHA1'
type UserRoleEnum = 'LECTEUR' | 'ANALYSTE' | 'RISK_MANAGER' | 'RSSI' | 'ADMIN'

interface SSOConfig {
  enabled:          boolean
  protocol:         SsoProtocol
  // SAML
  samlEntityId:     string | null
  samlSsoUrl:       string | null
  samlCertificate:  string | null
  samlSignAlgorithm: SsoSignAlgo
  // OIDC
  oidcIssuerUrl:    string | null
  oidcClientId:     string | null
  oidcClientSecret: string | null
  oidcScopes:       string
  // Common
  autoProvision:    boolean
  defaultRole:      UserRoleEnum
  allowedDomains:   string | null
}

const SSO_DEFAULT: SSOConfig = {
  enabled: false, protocol: 'OIDC',
  samlEntityId: null, samlSsoUrl: null, samlCertificate: null, samlSignAlgorithm: 'RSA-SHA256',
  oidcIssuerUrl: null, oidcClientId: null, oidcClientSecret: null, oidcScopes: 'openid email profile',
  autoProvision: true, defaultRole: 'ANALYSTE', allowedDomains: null,
}

interface Policy {
  minLength:                number
  requireUppercase:         boolean
  requireLowercase:         boolean
  requireNumbers:           boolean
  requireSpecial:           boolean
  maxAgeDays:               number
  maxFailedAttempts:        number
  lockoutDurationMinutes:   number
  requireEmailVerification: boolean
  inactivityDaysLimit:      number
  // MFA
  mfaEnabled:               boolean
  mfaMethodEmail:           boolean
  mfaMethodSms:             boolean
  mfaScope:                 'ALL' | 'ADMIN_ONLY'
  smsProvider:              SmsProvider
  smsApiKey:                string | null
  smsApiSecret:             string | null
  smsSenderId:              string | null
  // Safety window
  mfaPendingConfirmation:   boolean
  mfaConfirmationDeadline:  string | null
}

// Valeurs par défaut conformes ANSSI guide d'hygiène v2
const DEFAULT: Policy = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecial: true,
  maxAgeDays: 90,
  maxFailedAttempts: 5,
  lockoutDurationMinutes: 15,
  requireEmailVerification: false,
  inactivityDaysLimit: 180,
  mfaEnabled: false,
  mfaMethodEmail: true,
  mfaMethodSms: false,
  mfaScope: 'ALL',
  smsProvider: 'TWILIO',
  smsApiKey: null,
  smsApiSecret: null,
  smsSenderId: null,
  mfaPendingConfirmation: false,
  mfaConfirmationDeadline: null,
}

/** Formate un nombre de secondes en mm:ss */
function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Option (a) — la configuration MFA est masquée dans le panel admin tant que
 * l'application du MFA au login n'est pas implémentée (les fondations
 * lib/mfa.ts, lib/sms.ts, lib/mfa-service.ts sont prêtes ; l'intégration à
 * authorize() reste à faire). On évite ainsi qu'un admin active un MFA qui ne
 * serait pas réellement appliqué (faux sentiment de sécurité).
 * Repasser à `true` une fois l'enforcement branché.
 */
const MFA_UI_VISIBLE = false

export default function AdminSecurityPage() {
  const { t } = useTranslation()
  const [policy, setPolicy]           = useState<Policy>(DEFAULT)
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const [confirming, setConfirming]   = useState(false)
  const [confirmed, setConfirmed]     = useState(false)
  const [error, setError]             = useState('')
  const [countdown, setCountdown]     = useState<number | null>(null)
  // SSO
  const [sso, setSso]                 = useState<SSOConfig>(SSO_DEFAULT)
  const [ssoLoading, setSsoLoading]   = useState(true)
  const [ssoSaving, setSsoSaving]     = useState(false)
  const [ssoSaved, setSsoSaved]       = useState(false)
  const [ssoError, setSsoError]       = useState('')

  const loadPolicy = useCallback(() => {
    fetch('/api/admin/password-policy')
      .then(r => r.json())
      .then(d => {
        if (d.id) setPolicy(d)
        setLoading(false)
      })
  }, [])

  useEffect(() => { loadPolicy() }, [loadPolicy])

  // Chargement de la config SSO
  useEffect(() => {
    fetch('/api/admin/sso-config')
      .then(r => r.json())
      .then(d => { if (d.id) setSso(d); setSsoLoading(false) })
      .catch(() => setSsoLoading(false))
  }, [])

  // Compte à rebours — se rafraîchit chaque seconde quand la fenêtre est active
  useEffect(() => {
    if (!policy.mfaPendingConfirmation || !policy.mfaConfirmationDeadline) {
      setCountdown(null)
      return
    }
    const deadline = new Date(policy.mfaConfirmationDeadline).getTime()
    const tick = () => {
      const remaining = Math.max(0, Math.floor((deadline - Date.now()) / 1000))
      setCountdown(remaining)
      if (remaining === 0) {
        // Fenêtre expirée — recharger la policy (la prochaine requête GET
        // va auto-désactiver le MFA côté serveur)
        setTimeout(() => loadPolicy(), 1500)
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [policy.mfaPendingConfirmation, policy.mfaConfirmationDeadline, loadPolicy])

  function toggle(field: keyof Policy) {
    setPolicy(p => ({ ...p, [field]: !p[field] }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaved(false)
    setSaving(true)
    const res = await fetch('/api/admin/password-policy', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(policy),
    })
    setSaving(false)
    if (res.ok) {
      const updated = await res.json()
      if (updated.id) setPolicy(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else {
      const d = await res.json()
      setError(d.error || t.error)
    }
  }

  async function handleSsoSave(e: React.FormEvent) {
    e.preventDefault()
    setSsoError('')
    setSsoSaved(false)
    setSsoSaving(true)
    const res = await fetch('/api/admin/sso-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sso),
    })
    setSsoSaving(false)
    if (res.ok) {
      const updated = await res.json()
      if (updated.id) setSso(updated)
      setSsoSaved(true)
      setTimeout(() => setSsoSaved(false), 3000)
    } else {
      const d = await res.json()
      setSsoError(d.error || t.error)
    }
  }

  async function handleConfirmMfa() {
    setConfirming(true)
    const res = await fetch('/api/admin/password-policy/confirm', { method: 'POST' })
    setConfirming(false)
    if (res.ok) {
      const d = await res.json()
      if (d.policy) setPolicy(d.policy)
      setConfirmed(true)
      setTimeout(() => setConfirmed(false), 4000)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main id="main-content" className="max-w-6xl mx-auto px-4 py-8">

        <AdminNav active="security" />

        {/* Contenu contraint en largeur pour garder des formulaires lisibles,
            tout en laissant la navigation admin s'aligner comme les autres pages */}
        <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{t.passwordPolicy.title}</h1>
        <p className="text-gray-500 text-sm mb-8">{t.passwordPolicy.subtitle}</p>

        {/* ── Bandeau confirmation MFA — visible admins uniquement ─────────── */}
        {MFA_UI_VISIBLE && policy.mfaPendingConfirmation && countdown !== null && countdown > 0 && (
          <div className="mb-4 rounded-xl border-2 border-amber-400 bg-amber-50 px-5 py-4 space-y-3">
            {/* En-tête */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">⏱️</span>
                <p className="font-semibold text-amber-900 text-sm">{t.mfa.pendingTitle}</p>
              </div>
              <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                {t.mfa.pendingAdminOnly}
              </span>
            </div>

            {/* Étapes à suivre */}
            <div>
              <p className="text-xs font-medium text-amber-800 mb-1">{t.mfa.pendingWhatToDo}</p>
              <ol className="text-xs text-amber-700 space-y-1 list-decimal list-inside">
                <li>{t.mfa.pendingStep1}</li>
                <li>{t.mfa.pendingStep2}</li>
                <li>{t.mfa.pendingStep3}</li>
                <li>{t.mfa.pendingStep4}</li>
              </ol>
            </div>

            {/* Conséquences */}
            <div className="rounded-lg bg-amber-100 border border-amber-200 px-3 py-2 text-xs space-y-1">
              <p>
                <span className="font-semibold text-green-700">✅ {t.mfa.pendingIfConfirm}</span>
                {' '}<span className="text-amber-700">{t.mfa.pendingIfConfirmDesc}</span>
              </p>
              <p>
                <span className="font-semibold text-red-600">🔴 {t.mfa.pendingIfExpire}</span>
                {' '}<span className="text-amber-700">{t.mfa.pendingIfExpireDesc}</span>
              </p>
            </div>

            {/* Compte à rebours + bouton */}
            <div className="flex items-center gap-4 flex-wrap pt-1">
              <span className="font-mono text-3xl font-bold text-amber-800 tabular-nums">
                {formatCountdown(countdown)}
              </span>
              {confirmed ? (
                <span className="text-green-700 font-semibold text-sm">{t.mfa.confirmedMsg}</span>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmMfa}
                  disabled={confirming}
                  className="btn-primary text-sm px-4 py-2"
                >
                  {confirming ? t.saving : t.mfa.confirmBtn}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Bandeau MFA auto-désactivé (fenêtre expirée) */}
        {MFA_UI_VISIBLE && policy.mfaPendingConfirmation && countdown === 0 && (
          <div className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            🔴 {t.mfa.autoDisabledWarning}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-gray-500">{t.loading}</div>
        ) : (
          <form onSubmit={handleSave} className="card p-6 space-y-6">

            {saved && (
              <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm">
                ✅ {t.passwordPolicy.savedMsg}
              </div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                ⚠️ {error}
              </div>
            )}

            {/* Longueur minimale */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.passwordPolicy.minLength}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={8}
                  max={128}
                  value={policy.minLength}
                  onChange={e => setPolicy(p => ({ ...p, minLength: parseInt(e.target.value) || 8 }))}
                  className="input w-24"
                />
                <span className="text-sm text-gray-500">{t.passwordPolicy.minLengthHint}</span>
              </div>
            </div>

            {/* Toggles de complexité */}
            <div className="space-y-3">
              {(
                [
                  ['requireUppercase', t.passwordPolicy.requireUppercase],
                  ['requireLowercase', t.passwordPolicy.requireLowercase],
                  ['requireNumbers',   t.passwordPolicy.requireNumbers],
                  ['requireSpecial',   t.passwordPolicy.requireSpecial],
                ] as [keyof Policy, string][]
              ).map(([field, label]) => (
                <label key={field} className="flex items-center gap-3 cursor-pointer select-none group">
                  <div
                    onClick={() => toggle(field)}
                    className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${
                      policy[field] ? 'bg-ebios-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span className={`absolute top-1 left-1 w-4 h-4 bg-[white] rounded-full shadow transition-transform ${
                      policy[field] ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </div>
                  <span className="text-sm text-gray-700 group-hover:text-gray-900">{label}</span>
                </label>
              ))}
            </div>

            {/* Expiration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.passwordPolicy.maxAgeDays}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  max={3650}
                  value={policy.maxAgeDays}
                  onChange={e => setPolicy(p => ({ ...p, maxAgeDays: parseInt(e.target.value) || 0 }))}
                  className="input w-24"
                />
                <span className="text-sm text-gray-500">{t.passwordPolicy.maxAgeDaysHint}</span>
              </div>
            </div>

            {/* Verrouillage de compte */}
            <div className="border-t border-gray-100 pt-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-4">{t.passwordPolicy.lockoutSectionTitle}</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t.passwordPolicy.maxFailedAttempts}
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={policy.maxFailedAttempts}
                      onChange={e => setPolicy(p => ({ ...p, maxFailedAttempts: parseInt(e.target.value) || 0 }))}
                      className="input w-24"
                    />
                    <span className="text-sm text-gray-500">{t.passwordPolicy.maxFailedAttemptsHint}</span>
                  </div>
                </div>

                <div className={policy.maxFailedAttempts === 0 ? 'opacity-50 pointer-events-none' : ''}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t.passwordPolicy.lockoutDurationMinutes}
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={1440}
                      value={policy.lockoutDurationMinutes}
                      onChange={e => setPolicy(p => ({ ...p, lockoutDurationMinutes: parseInt(e.target.value) || 15 }))}
                      className="input w-24"
                    />
                    <span className="text-sm text-gray-500">{t.passwordPolicy.lockoutDurationMinutesHint}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Désactivation par inactivité (#12) */}
            <div className="border-t border-gray-100 pt-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-1">{t.passwordPolicy.inactivityTitle}</h2>
              <p className="text-xs text-gray-500 mb-3">{t.passwordPolicy.inactivityDesc}</p>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.passwordPolicy.inactivityDaysLimit}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  max={3650}
                  value={policy.inactivityDaysLimit}
                  onChange={e => setPolicy(p => ({ ...p, inactivityDaysLimit: parseInt(e.target.value) || 0 }))}
                  className="input w-24"
                />
                <span className="text-sm text-gray-500">{t.passwordPolicy.inactivityHint}</span>
              </div>
            </div>

            {/* Vérification email à l'inscription */}
            <div className="border-t border-gray-100 pt-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-1">{t.passwordPolicy.emailVerifTitle}</h2>
              <p className="text-xs text-gray-500 mb-3">{t.passwordPolicy.emailVerifDesc}</p>
              <label className="flex items-center gap-3 cursor-pointer select-none group">
                <div
                  onClick={() => toggle('requireEmailVerification')}
                  className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${
                    policy.requireEmailVerification ? 'bg-ebios-500' : 'bg-gray-300'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    policy.requireEmailVerification ? 'translate-x-5' : 'translate-x-1'
                  }`} />
                </div>
                <span className="text-sm text-gray-700 group-hover:text-gray-900">{t.passwordPolicy.emailVerifLabel}</span>
              </label>
              {policy.requireEmailVerification && (
                <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  ⚠️ {t.passwordPolicy.emailVerifWarning}
                </p>
              )}
            </div>

            {/* ── Authentification forte (MFA) — masquée tant que non appliquée au login (option a) ── */}
            {MFA_UI_VISIBLE && (
            <div className="border-t border-gray-100 pt-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-1">{t.mfa.sectionTitle}</h2>
              <p className="text-xs text-gray-500 mb-3">{t.mfa.sectionDesc}</p>

              {/* Bandeau "fonctionnalité à venir" */}
              <div className="mb-4 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <span className="text-blue-500 mt-0.5">ℹ️</span>
                <p className="text-xs text-blue-700">{t.mfa.comingSoonNotice}</p>
              </div>

              {/* Activer/désactiver le MFA */}
              <label className="flex items-center gap-3 cursor-pointer select-none group mb-4">
                <div
                  onClick={() => setPolicy(p => ({ ...p, mfaEnabled: !p.mfaEnabled }))}
                  className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${
                    policy.mfaEnabled ? 'bg-ebios-500' : 'bg-gray-300'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    policy.mfaEnabled ? 'translate-x-5' : 'translate-x-1'
                  }`} />
                </div>
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{t.mfa.enableLabel}</span>
              </label>

              {policy.mfaEnabled && (
                <div className="space-y-5 pl-2 border-l-2 border-ebios-100">

                  {/* Méthodes */}
                  <div>
                    <p className="text-xs font-medium text-gray-700 mb-2">{t.mfa.methodsLabel}</p>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={policy.mfaMethodEmail}
                          onChange={e => setPolicy(p => ({ ...p, mfaMethodEmail: e.target.checked }))}
                          className="w-4 h-4 accent-ebios-600"
                        />
                        <span className="text-sm text-gray-700">📧 {t.mfa.methodEmail}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={policy.mfaMethodSms}
                          onChange={e => setPolicy(p => ({ ...p, mfaMethodSms: e.target.checked }))}
                          className="w-4 h-4 accent-ebios-600"
                        />
                        <span className="text-sm text-gray-700">📱 {t.mfa.methodSms}</span>
                      </label>
                    </div>
                    {!policy.mfaMethodEmail && !policy.mfaMethodSms && (
                      <p className="mt-2 text-xs text-red-600">{t.mfa.atLeastOneMethod}</p>
                    )}
                  </div>

                  {/* Portée */}
                  <div>
                    <p className="text-xs font-medium text-gray-700 mb-2">{t.mfa.scopeLabel}</p>
                    <div className="flex gap-3">
                      {(['ALL', 'ADMIN_ONLY'] as const).map(scope => (
                        <label key={scope} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="mfaScope"
                            value={scope}
                            checked={policy.mfaScope === scope}
                            onChange={() => setPolicy(p => ({ ...p, mfaScope: scope }))}
                            className="accent-ebios-600"
                          />
                          <span className="text-sm text-gray-700">
                            {scope === 'ALL' ? t.mfa.scopeAll : t.mfa.scopeAdminOnly}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Config SMS — visible uniquement si SMS coché */}
                  {policy.mfaMethodSms && (
                    <div className="bg-gray-50 rounded-xl p-4 space-y-4 border border-gray-200">
                      <p className="text-xs font-semibold text-gray-800">📱 {t.mfa.smsProviderTitle}</p>

                      {/* Avertissement sécurité clés */}
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        ⚠️ {t.mfa.smsKeysWarning}
                      </p>

                      {/* Provider */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">{t.mfa.smsProviderLabel}</label>
                        <select
                          value={policy.smsProvider}
                          onChange={e => setPolicy(p => ({ ...p, smsProvider: e.target.value as SmsProvider }))}
                          className="input text-sm"
                        >
                          <option value="TWILIO">Twilio</option>
                          <option value="OVH">OVH (SMS API)</option>
                          <option value="CUSTOM">{t.mfa.smsProviderCustom}</option>
                        </select>
                      </div>

                      {/* API Key */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          {policy.smsProvider === 'TWILIO' ? 'Account SID' :
                           policy.smsProvider === 'OVH'    ? 'Application Key' :
                           t.mfa.smsApiKeyLabel}
                        </label>
                        <input
                          type="text"
                          value={policy.smsApiKey ?? ''}
                          onChange={e => setPolicy(p => ({ ...p, smsApiKey: e.target.value || null }))}
                          placeholder={t.mfa.smsApiKeyPh}
                          className="input text-sm"
                          autoComplete="off"
                        />
                      </div>

                      {/* API Secret */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          {policy.smsProvider === 'TWILIO' ? 'Auth Token' :
                           policy.smsProvider === 'OVH'    ? 'Application Secret' :
                           t.mfa.smsApiSecretLabel}
                        </label>
                        <input
                          type="password"
                          value={policy.smsApiSecret ?? ''}
                          onChange={e => setPolicy(p => ({ ...p, smsApiSecret: e.target.value || null }))}
                          placeholder="••••••••••••"
                          className="input text-sm"
                          autoComplete="new-password"
                        />
                      </div>

                      {/* Sender ID */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">{t.mfa.smsSenderIdLabel}</label>
                        <input
                          type="text"
                          value={policy.smsSenderId ?? ''}
                          onChange={e => setPolicy(p => ({ ...p, smsSenderId: e.target.value || null }))}
                          placeholder={policy.smsProvider === 'TWILIO' ? '+33600000000' : 'ACRA'}
                          className="input text-sm"
                        />
                        <p className="mt-1 text-xs text-gray-400">{t.mfa.smsSenderIdHint}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving || (policy.mfaEnabled && !policy.mfaMethodEmail && !policy.mfaMethodSms)}
                className="btn-primary"
              >
                {saving ? t.saving : t.passwordPolicy.saveBtn}
              </button>
            </div>
          </form>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            Section SSO (Single Sign-On)
            ════════════════════════════════════════════════════════════════ */}
        <div className="mt-10">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{t.sso.sectionTitle}</h1>
          <p className="text-gray-500 text-sm mb-2">{t.sso.sectionDesc}</p>
          {/* Badge admin-only */}
          <p className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 mb-6 inline-block">
            {t.sso.adminOnlyNotice}
          </p>

          {ssoLoading ? (
            <div className="text-center py-12 text-gray-500">{t.loading}</div>
          ) : (
            <form onSubmit={handleSsoSave} className="card p-6 space-y-6">

              {ssoSaved && (
                <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm">
                  ✅ {t.sso.savedMsg}
                </div>
              )}
              {ssoError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                  ⚠️ {ssoError}
                </div>
              )}

              {/* Bandeau "à venir" */}
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <span className="text-blue-500 mt-0.5">ℹ️</span>
                <p className="text-xs text-blue-700">{t.sso.comingSoonNotice}</p>
              </div>

              {/* Avertissement secrets */}
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                ⚠️ {t.sso.keysWarning}
              </p>

              {/* Toggle SSO activé */}
              <label className="flex items-center gap-3 cursor-pointer select-none group">
                <div
                  onClick={() => setSso(s => ({ ...s, enabled: !s.enabled }))}
                  className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${
                    sso.enabled ? 'bg-ebios-500' : 'bg-gray-300'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    sso.enabled ? 'translate-x-5' : 'translate-x-1'
                  }`} />
                </div>
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{t.sso.enableLabel}</span>
              </label>

              {sso.enabled && (
                <div className="space-y-6 pl-2 border-l-2 border-ebios-100">

                  {/* Sélecteur de protocole */}
                  <div>
                    <p className="text-xs font-medium text-gray-700 mb-2">{t.sso.protocolLabel}</p>
                    <div className="flex gap-4">
                      {(['SAML', 'OIDC'] as const).map(p => (
                        <label key={p} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="ssoProtocol"
                            value={p}
                            checked={sso.protocol === p}
                            onChange={() => setSso(s => ({ ...s, protocol: p }))}
                            className="accent-ebios-600"
                          />
                          <span className="text-sm font-medium text-gray-700">{p}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* ── SAML ────────────────────────────────────────────── */}
                  {sso.protocol === 'SAML' && (
                    <div className="bg-gray-50 rounded-xl p-4 space-y-4 border border-gray-200">
                      <p className="text-xs font-semibold text-gray-800">🔐 {t.sso.samlSection}</p>

                      {/* SP Entity ID */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">{t.sso.samlEntityId}</label>
                        <input type="text" value={sso.samlEntityId ?? ''} placeholder={t.sso.samlEntityIdPh}
                          onChange={e => setSso(s => ({ ...s, samlEntityId: e.target.value || null }))}
                          className="input text-sm" />
                        <p className="mt-1 text-xs text-gray-400">{t.sso.samlEntityIdHint}</p>
                      </div>

                      {/* IdP SSO URL */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">{t.sso.samlSsoUrl}</label>
                        <input type="url" value={sso.samlSsoUrl ?? ''} placeholder={t.sso.samlSsoUrlPh}
                          onChange={e => setSso(s => ({ ...s, samlSsoUrl: e.target.value || null }))}
                          className="input text-sm" />
                        <p className="mt-1 text-xs text-gray-400">{t.sso.samlSsoUrlHint}</p>
                      </div>

                      {/* Certificat */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">{t.sso.samlCertificate}</label>
                        <textarea rows={5} value={sso.samlCertificate ?? ''} placeholder={t.sso.samlCertPh}
                          onChange={e => setSso(s => ({ ...s, samlCertificate: e.target.value || null }))}
                          className="input text-xs font-mono resize-y" />
                        <p className="mt-1 text-xs text-gray-400">{t.sso.samlCertHint}</p>
                      </div>

                      {/* Algorithme de signature */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">{t.sso.samlSignAlgo}</label>
                        <select value={sso.samlSignAlgorithm}
                          onChange={e => setSso(s => ({ ...s, samlSignAlgorithm: e.target.value as SsoSignAlgo }))}
                          className="input text-sm">
                          <option value="RSA-SHA256">RSA-SHA256 (recommandé)</option>
                          <option value="RSA-SHA1">RSA-SHA1 (legacy)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* ── OIDC ────────────────────────────────────────────── */}
                  {sso.protocol === 'OIDC' && (
                    <div className="bg-gray-50 rounded-xl p-4 space-y-4 border border-gray-200">
                      <p className="text-xs font-semibold text-gray-800">🔐 {t.sso.oidcSection}</p>

                      {/* Issuer URL */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">{t.sso.oidcIssuerUrl}</label>
                        <input type="url" value={sso.oidcIssuerUrl ?? ''} placeholder={t.sso.oidcIssuerUrlPh}
                          onChange={e => setSso(s => ({ ...s, oidcIssuerUrl: e.target.value || null }))}
                          className="input text-sm" />
                        <p className="mt-1 text-xs text-gray-400">{t.sso.oidcIssuerUrlHint}</p>
                      </div>

                      {/* Client ID */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">{t.sso.oidcClientId}</label>
                        <input type="text" value={sso.oidcClientId ?? ''} placeholder={t.sso.oidcClientIdPh}
                          onChange={e => setSso(s => ({ ...s, oidcClientId: e.target.value || null }))}
                          className="input text-sm" autoComplete="off" />
                      </div>

                      {/* Client Secret */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">{t.sso.oidcClientSecret}</label>
                        <input type="password" value={sso.oidcClientSecret ?? ''} placeholder="••••••••••••"
                          onChange={e => setSso(s => ({ ...s, oidcClientSecret: e.target.value || null }))}
                          className="input text-sm" autoComplete="new-password" />
                      </div>

                      {/* Scopes */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">{t.sso.oidcScopes}</label>
                        <input type="text" value={sso.oidcScopes}
                          onChange={e => setSso(s => ({ ...s, oidcScopes: e.target.value }))}
                          className="input text-sm" />
                        <p className="mt-1 text-xs text-gray-400">{t.sso.oidcScopesHint}</p>
                      </div>

                      {/* Redirect URI (read-only) */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">{t.sso.oidcRedirectUri}</label>
                        <input type="text" readOnly
                          value={typeof window !== 'undefined' ? `${window.location.origin}/api/auth/callback/sso` : '/api/auth/callback/sso'}
                          className="input text-sm bg-gray-100 text-gray-500 cursor-default select-all" />
                        <p className="mt-1 text-xs text-gray-400">{t.sso.oidcRedirectUriHint}</p>
                      </div>
                    </div>
                  )}

                  {/* ── Paramètres communs ───────────────────────────────── */}
                  <div className="border-t border-gray-100 pt-4 space-y-4">
                    <p className="text-xs font-semibold text-gray-800">{t.sso.commonSection}</p>

                    {/* Auto-provisioning */}
                    <label className="flex items-start gap-3 cursor-pointer select-none group">
                      <div
                        onClick={() => setSso(s => ({ ...s, autoProvision: !s.autoProvision }))}
                        className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 mt-0.5 ${
                          sso.autoProvision ? 'bg-ebios-500' : 'bg-gray-300'
                        }`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          sso.autoProvision ? 'translate-x-4' : 'translate-x-0.5'
                        }`} />
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{t.sso.autoProvision}</span>
                        <p className="text-xs text-gray-400 mt-0.5">{t.sso.autoProvisionDesc}</p>
                      </div>
                    </label>

                    {/* Rôle par défaut — visible si autoProvision */}
                    {sso.autoProvision && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">{t.sso.defaultRole}</label>
                        <select value={sso.defaultRole}
                          onChange={e => setSso(s => ({ ...s, defaultRole: e.target.value as UserRoleEnum }))}
                          className="input text-sm">
                          <option value="LECTEUR">LECTEUR</option>
                          <option value="ANALYSTE">ANALYSTE</option>
                          <option value="RISK_MANAGER">RISK_MANAGER</option>
                          <option value="RSSI">RSSI</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                        <p className="mt-1 text-xs text-gray-400">{t.sso.defaultRoleHint}</p>
                      </div>
                    )}

                    {/* Domaines autorisés */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">{t.sso.allowedDomains}</label>
                      <input type="text" value={sso.allowedDomains ?? ''} placeholder={t.sso.allowedDomainsPh}
                        onChange={e => setSso(s => ({ ...s, allowedDomains: e.target.value || null }))}
                        className="input text-sm" />
                      <p className="mt-1 text-xs text-gray-400">{t.sso.allowedDomainsHint}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Bouton sauvegarde */}
              <div className="pt-2">
                <button type="submit" disabled={ssoSaving} className="btn-primary">
                  {ssoSaving ? t.saving : t.sso.saveBtn}
                </button>
              </div>
            </form>
          )}
        </div>
        </div>
      </main>
    </div>
  )
}
