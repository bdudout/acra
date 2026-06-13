import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'
import { auditLog } from '@/lib/logger'
import { checkLockout, recordFailure, recordSuccess, type LockoutPolicy } from '@/lib/login-lockout'
import { isPasswordExpired } from '@/lib/password-policy'
import { resolveSessionCookie } from '@/lib/auth-cookies'

// 🔴 Cookie de session aligné sur le défaut de getToken (middleware) : sa
// sécurité dépend du SCHÉMA de NEXTAUTH_URL, pas de NODE_ENV. Sans cet
// alignement, le login pose `__Secure-...` (NODE_ENV=prod) alors que le
// middleware lit `next-auth.session-token` (schéma http) → pages protégées
// inaccessibles. Voir auth-cookies.ts.
const sessionCookie = resolveSessionCookie()

interface LoginPolicy extends LockoutPolicy {
  maxAgeDays: number
}

/**
 * Charge la politique (verrouillage + expiration) configurée par l'administrateur.
 * Retourne des valeurs neutres si la table est absente.
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
      }
    }
  } catch { /* table absente */ }
  return { maxFailedAttempts: 0, lockoutDurationMinutes: 15, maxAgeDays: 0 }
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
        email:    { label: 'Email',        type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials: Record<string, string> | undefined) {
        if (!credentials?.email || !credentials.password) return null

        // AUDIT [F003b] MEDIUM — CWE-307 / OWASP A07:2021 — Anti-brute-force partiel
        // CVSS: 5.3 (AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:N)
        // EVIDENCE: la limite est uniquement par EMAIL. Aucune limite par IP →
        //   un attaquant peut faire du credential-stuffing / spraying sur des
        //   milliers d'emails depuis une seule IP sans être freiné. Le store est
        //   in-memory (non distribué) → limite réinitialisée à chaque redéploiement
        //   et non partagée entre instances. Le lockout (login-lockout.ts) partage
        //   ces deux limites (par email, in-memory).
        // FIX: ajouter une 2e clé de rate-limit par IP (login:ip:<ip>) + store Redis
        //   en production multi-instance ; envisager un CAPTCHA après N échecs.
        // Rate limiting : 10 tentatives par email par 15 minutes (brute force)
        const emailKey = `login:email:${credentials.email.toLowerCase()}`
        const rl = rateLimit(emailKey, 10, 15 * 60 * 1000)
        if (!rl.allowed) {
          await auditLog('LOGIN_RATE_LIMITED', { userEmail: credentials.email })
          throw new Error('TOO_MANY_ATTEMPTS')
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
            id: true, email: true, name: true, role: true,
            passwordHash: true, isActive: true,
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
