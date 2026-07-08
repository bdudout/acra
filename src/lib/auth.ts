import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'
import { auditLog } from '@/lib/logger'
import { checkLockout, recordFailure, recordSuccess, type LockoutPolicy } from '@/lib/login-lockout'
import { touchOrgActivityForUser, isDemoInstance } from '@/lib/demo-server'
import { requiresEmailVerification } from '@/lib/demo'
import { isPasswordExpired } from '@/lib/password-policy'
import { resolveSessionCookie } from '@/lib/auth-cookies'
import { isMfaRequired, resolveChannel, type MfaPolicyView } from '@/lib/mfa'
import { createAndSendChallenge, verifyChallenge } from '@/lib/mfa-service'

// 🔴 Cookie de session aligné sur le défaut de getToken (middleware) : sa
// sécurité dépend du SCHÉMA de NEXTAUTH_URL, pas de NODE_ENV. Sans cet
// alignement, le login pose `__Secure-...` (NODE_ENV=prod) alors que le
// middleware lit `next-auth.session-token` (schéma http) → pages protégées
// inaccessibles. Voir auth-cookies.ts.
const sessionCookie = resolveSessionCookie()

interface LoginPolicy extends LockoutPolicy {
  maxAgeDays: number
  mfa: MfaPolicyView
}

const MFA_DISABLED: MfaPolicyView = {
  mfaEnabled: false, mfaPendingConfirmation: false, mfaScope: 'ALL',
  mfaMethodEmail: true, mfaMethodSms: false,
}

/**
 * Charge la politique (verrouillage + expiration + MFA) configurée par
 * l'administrateur. Retourne des valeurs neutres (MFA désactivé) si la table
 * est absente.
 */
async function loadLoginPolicy(): Promise<LoginPolicy> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stored = await (prisma as any).passwordPolicy.findUnique({ where: { id: 'global' } })
    if (stored) {
      return {
        maxFailedAttempts:      stored.maxFailedAttempts ?? 0,
        lockoutDurationMinutes: stored.lockoutDurationMinutes ?? 15,
        maxAgeDays:             stored.maxAgeDays ?? 0,
        mfa: {
          mfaEnabled:             stored.mfaEnabled === true,
          mfaPendingConfirmation: stored.mfaPendingConfirmation === true,
          mfaScope:               stored.mfaScope ?? 'ALL',
          mfaMethodEmail:         stored.mfaMethodEmail !== false,
          mfaMethodSms:           stored.mfaMethodSms === true,
        },
      }
    }
  } catch { /* table absente */ }
  return { maxFailedAttempts: 0, lockoutDurationMinutes: 15, maxAgeDays: 0, mfa: MFA_DISABLED }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 }, // 8h au lieu de 30j
  pages: {
    signIn: '/auth/signin',
    error:  '/auth/signin',
  },
  // ── Cookies sécurisés ──────────────────────────────────────────────────────
  // HttpOnly + SameSite=Lax toujours ; le préfixe `__Secure-` et le flag `secure`
  // suivent le schéma de NEXTAUTH_URL (https → sécurisé), comme le middleware.
  useSecureCookies: sessionCookie.secure,
  cookies: {
    sessionToken: {
      name: sessionCookie.name,
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: sessionCookie.secure,
      },
    },
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:      { label: 'Email',        type: 'email' },
        password:   { label: 'Mot de passe', type: 'password' },
        mfaCode:    { label: 'Code MFA',     type: 'text' },
        mfaChannel: { label: 'Canal MFA',    type: 'text' },
      },
      async authorize(credentials: Record<string, string> | undefined, req?: { headers?: Record<string, string> } | undefined) {
        if (!credentials?.email || !credentials.password) return null

        // Anti-brute-force à DEUX clés (audit R01 / CWE-307 / A07:2021) :
        //   (1) par EMAIL   : 10 tentatives / 15 min (bloque le ciblage d'un compte) ;
        //   (2) par IP      : 50 tentatives / 15 min (bloque le credential-stuffing /
        //       password-spraying sur de nombreux emails depuis une même IP).
        // Le store est abstrait (rate-limit.ts, Redis-ready) : en multi-instance,
        // brancher un RedisRateLimitStore. L'IP provient des en-têtes de proxy — à
        // n'utiliser que derrière un reverse-proxy de confiance (voir README/ops).
        const emailKey = `login:email:${credentials.email.toLowerCase()}`
        const rl = rateLimit(emailKey, 10, 15 * 60 * 1000)
        if (!rl.allowed) {
          await auditLog('LOGIN_RATE_LIMITED', { userEmail: credentials.email })
          throw new Error('TOO_MANY_ATTEMPTS')
        }

        // Clé par IP (en-têtes de proxy ; objet plat côté next-auth, pas un Headers).
        const xff = req?.headers?.['x-forwarded-for']
        const ip = (typeof xff === 'string' ? xff.split(',')[0]?.trim() : undefined)
          || req?.headers?.['x-real-ip']
          || 'unknown'
        if (ip !== 'unknown') {
          const rlIp = rateLimit(`login:ip:${ip}`, 50, 15 * 60 * 1000)
          if (!rlIp.allowed) {
            await auditLog('LOGIN_RATE_LIMITED', { userEmail: credentials.email, ip })
            throw new Error('TOO_MANY_ATTEMPTS')
          }
        }

        // Politique configurable (verrouillage + expiration)
        const loginPolicy = await loadLoginPolicy()
        const lockoutPolicy = loginPolicy
        const lockoutEnabled = lockoutPolicy.maxFailedAttempts > 0
        if (lockoutEnabled && checkLockout(credentials.email).locked) {
          await auditLog('LOGIN_LOCKED', { userEmail: credentials.email })
          throw new Error('ACCOUNT_LOCKED')
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const user = await (prisma.user as any).findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
          select: {
            id: true, email: true, name: true, role: true, phone: true,
            passwordHash: true, isActive: true, emailVerified: true,
            passwordChangedAt: true, mustChangePassword: true,
          },
        })

        if (!user?.passwordHash) {
          await auditLog('LOGIN_FAILED', { userEmail: credentials.email, details: { reason: 'user_not_found' } })
          return null
        }

        // ⛔ Compte suspendu — refus immédiat avant de comparer le mot de passe
        if (user.isActive === false) {
          await auditLog('LOGIN_FAILED', { userId: user.id, userEmail: user.email, details: { reason: 'account_suspended' } })
          throw new Error('ACCOUNT_SUSPENDED')
        }

        const valid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!valid) {
          // Incrémente le compteur d'échecs et verrouille si le seuil est atteint
          if (lockoutEnabled) {
            const state = recordFailure(credentials.email, lockoutPolicy)
            if (state.lockedUntil != null) {
              await auditLog('LOGIN_LOCKED', { userId: user.id, userEmail: user.email, details: { reason: 'max_failed_attempts' } })
              throw new Error('ACCOUNT_LOCKED')
            }
          }
          await auditLog('LOGIN_FAILED', { userId: user.id, userEmail: user.email, details: { reason: 'bad_password' } })
          return null
        }

        // Connexion réussie : on réinitialise le compteur d'échecs
        if (lockoutEnabled) recordSuccess(credentials.email)

        // ── Vérification d'e-mail obligatoire en mode démo ────────────────────────
        // Le mot de passe est correct, mais tant que l'adresse n'est pas validée
        // (OTP reçu à l'inscription), la connexion est refusée. Gate isDemoInstance()
        // → aucun impact en production. L'UI redirige vers la page de vérification.
        if (requiresEmailVerification(await isDemoInstance(), user.emailVerified)) {
          await auditLog('LOGIN_FAILED', { userId: user.id, userEmail: user.email, details: { reason: 'email_not_verified' } })
          throw new Error('EMAIL_NOT_VERIFIED')
        }

        // ── Authentification multi-facteurs (si exigée par la politique) ──────────
        // Pattern next-auth « credentials 2 étapes » : 1re soumission (sans code) →
        // on génère et envoie un code, puis on lève MFA_REQUIRED ; 2e soumission
        // (avec mfaCode) → on vérifie le code avant d'émettre la session.
        if (isMfaRequired(loginPolicy.mfa, user.role)) {
          const code = (credentials.mfaCode ?? '').trim()
          if (!code) {
            const channel = resolveChannel(loginPolicy.mfa, !!user.phone, credentials.mfaChannel)
            if (!channel) {
              await auditLog('LOGIN_FAILED', { userId: user.id, userEmail: user.email, details: { reason: 'mfa_no_channel' } })
              throw new Error('MFA_NO_METHOD')
            }
            const destination = channel === 'SMS' ? (user.phone as string) : user.email
            const sent = await createAndSendChallenge({ userId: user.id, channel, destination })
            if (!sent.ok) {
              await auditLog('LOGIN_FAILED', { userId: user.id, userEmail: user.email, details: { reason: 'mfa_send_failed', error: sent.error } })
              throw new Error('MFA_SEND_FAILED')
            }
            await auditLog('MFA_CHALLENGE_SENT', { userId: user.id, userEmail: user.email, details: { channel } })
            // Encode canal + destination masquée pour l'UI (séparateur ::)
            throw new Error(`MFA_REQUIRED::${channel}::${sent.masked ?? ''}`)
          }
          const verified = await verifyChallenge(user.id, code)
          if (!verified.ok) {
            await auditLog('LOGIN_FAILED', { userId: user.id, userEmail: user.email, details: { reason: 'mfa_invalid', mfa: verified.error } })
            throw new Error(`MFA_INVALID::${verified.error ?? 'invalid'}`)
          }
          await auditLog('MFA_VERIFIED', { userId: user.id, userEmail: user.email })
        }

        // #11 — expiration du mot de passe : force le changement à la connexion
        const expired = isPasswordExpired(user.passwordChangedAt, loginPolicy.maxAgeDays)
        const mustChange = user.mustChangePassword === true || expired

        // Met à jour la dernière connexion (#12) et marque le changement forcé si expiré
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma.user as any).update({
          where: { id: user.id },
          data: {
            lastLoginAt: new Date(),
            ...(expired && !user.mustChangePassword ? { mustChangePassword: true } : {}),
          },
        }).catch(() => { /* best-effort */ })

        await auditLog('LOGIN_SUCCESS', { userId: user.id, userEmail: user.email, userRole: user.role })
        // Mode démo : la connexion compte comme activité (repousse la purge). No-op hors démo.
        await touchOrgActivityForUser(user.id).catch(() => { /* best-effort */ })
        return { id: user.id, email: user.email, name: user.name, role: user.role, mustChangePassword: mustChange }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: { token: any; user: any }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role ?? 'ANALYSTE'
        token.mustChangePassword = (user as any).mustChangePassword === true
      }
      // Rafraîchir le rôle, isActive ET mustChangePassword depuis la DB à chaque requête
      if (token.id && !user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dbUser = await (prisma.user as any).findUnique({
          where: { id: token.id as string },
          select: { role: true, isActive: true, mustChangePassword: true },
        })
        // Si l'utilisateur est suspendu ou supprimé, invalider le token
        if (!dbUser || dbUser.isActive === false) {
          return { ...token, suspended: true }
        }
        token.role = dbUser.role
        token.suspended = false
        token.mustChangePassword = dbUser.mustChangePassword === true
      }
      return token
    },
    async session({ session, token }: { session: any; token: any }) {
      // Refuser la session si le compte est suspendu (force re-login)
      if (token.suspended) return { ...session, user: undefined as unknown as typeof session.user }
      if (session.user) {
        (session.user as any).id   = token.id   as string
        ;(session.user as any).role = token.role as string
        ;(session.user as any).mustChangePassword = token.mustChangePassword === true
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}
