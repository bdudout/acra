import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import { auditLog, getClientIp } from '@/lib/logger'
import { validatePassword, DEFAULT_POLICY, type PasswordPolicyShape } from '@/lib/password-policy'
import { demoOrgCapReached, createDemoOrgForUser, isSignupOpen } from '@/lib/demo-server'
import { resolveSignupDecision } from '@/lib/demo'
import { createAndSendChallenge } from '@/lib/mfa-service'

const schema = z.object({
  name:     z.string().min(2).max(100),
  organizationName: z.string().min(2).max(100).optional(),
  email:    z.string().email(),
  password: z.string().min(1).max(100),
})

// AUDIT [F004] MEDIUM — CWE-862 / OWASP A01:2021 — Inscription anonyme ouverte
// CVSS: 5.3 (AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:N)
// EVIDENCE: ce endpoint POST est public (voir lib/public-paths.ts → "/api/auth" est
//   en accès libre). N'importe quel anonyme peut créer un compte ANALYSTE, accéder
//   à l'app et à la base. Pour un outil d'analyse de risques d'entreprise,
//   l'auto-inscription ouverte est probablement non désirée.
// FIX: gater l'inscription (invitation ADMIN obligatoire / domaine email autorisé /
//   feature-flag REGISTRATION_OPEN), ou supprimer ce endpoint au profit de la
//   création par /api/admin/users.
export async function POST(req: NextRequest) {
  // Rate limiting : 5 inscriptions par IP par heure
  const ip = getClientIp(req)
  const rl = await rateLimit(`register:${ip}`, 5, 60 * 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Trop de tentatives. Réessayez dans une heure.' },
      { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) }
    )
  }

  try {
    const body = await req.json()
    const { name, organizationName, email, password } = schema.parse(body)

    // Charger la politique de mot de passe configurée par l'admin
    let policy: PasswordPolicyShape = DEFAULT_POLICY
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stored = await (prisma as any).passwordPolicy.findUnique({ where: { id: 'global' } })
      if (stored) {
        policy = {
          minLength:        stored.minLength,
          requireUppercase: stored.requireUppercase,
          requireLowercase: stored.requireLowercase,
          requireNumbers:   stored.requireNumbers,
          requireSpecial:   stored.requireSpecial,
          maxAgeDays:       stored.maxAgeDays,
        }
      }
    } catch { /* table absente — utiliser la politique par défaut */ }

    if (validatePassword(password, policy).length > 0) {
      // Code générique traduit côté client (le détail par règle est validé en direct dans le formulaire)
      return NextResponse.json({ error: 'PASSWORD_POLICY' }, { status: 400 })
    }

    // F06 (CWE-204) : décider de l'OUVERTURE de l'inscription AVANT toute recherche
    // d'e-mail. Une instance fermée renvoie le même 403 quel que soit l'e-mail —
    // elle ne divulgue pas l'existence d'un compte à un visiteur anonyme.
    // Inscription publique ouverte : instance de démo PROUVÉE (env + marqueur figé)
    // OU toggle runtime `publicSignupActive` (SUPER_ADMIN). Jamais isDemoMode() seul.
    const [signupOpen, userCount] = await Promise.all([
      isSignupOpen(), prisma.user.count(),
    ])
    const isFirstUser = userCount === 0

    // Toute instance vide doit être initialisée localement par create-admin.mjs,
    // avant son exposition réseau (anti CWE-269 / OWASP A01).
    const decision = resolveSignupDecision({ isFirstUser, signupOpen })
    if (!decision.allowed) {
      return NextResponse.json({ error: 'REGISTRATION_CLOSED' }, { status: 403 })
    }

    // Plafond d'organisations actives (anti-abus) — inscrits self-service uniquement.
    if (decision.enforceCap && await demoOrgCapReached()) {
      return NextResponse.json({ error: 'DEMO_FULL' }, { status: 503 })
    }

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    })

    if (existing) {
      return NextResponse.json({ error: 'Un compte existe déjà avec cet email.' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase().trim(),
        passwordHash,
        role: decision.instanceRole,
        // Vérification d'e-mail requise pour les inscrits self-service ; le 1er compte
        // (exploitant) est pré-vérifié pour se connecter immédiatement.
        emailVerified: decision.requireEmailVerif ? undefined : new Date(),
        // F07 (CWE-841) : obligation portée par le compte (indépendante du mode démo)
        // → la connexion est bloquée hors démo aussi tant que l'e-mail n'est pas validé.
        emailVerificationRequired: decision.requireEmailVerif === true,
      },
      select: { id: true, email: true, name: true, role: true },
    })

    if (decision.provisionOrg) {
      // Chaque inscrit self-service = sa propre organisation, dont il est ADMIN (SUBTREE).
      const org = await createDemoOrgForUser(user.id, organizationName?.trim() || name)
      await auditLog('REGISTER', {
        userId: user.id, userEmail: user.email, ip: getClientIp(req),
        details: { selfService: true, orgId: org.id, role: 'ADMIN' },
      })
      // Vérification d'e-mail obligatoire (démo) : le compte reste emailVerified=null
      // et la connexion est bloquée tant que l'OTP envoyé ici n'est pas validé.
      // Anti mail-bombing : rate-limit supplémentaire par ADRESSE de destination.
      const destRl = await rateLimit(`emailverif:${user.email}`, 3, 15 * 60 * 1000)
      if (destRl.allowed) {
        const sent = await createAndSendChallenge({ userId: user.id, channel: 'EMAIL', destination: user.email })
        if (sent.ok) {
          await auditLog('EMAIL_VERIFICATION_SENT', { userId: user.id, userEmail: user.email, ip: getClientIp(req) })
        }
      }
      return NextResponse.json({ user, verificationRequired: true }, { status: 201 })
    } else {
      // Multi-organisation : rattacher le nouvel utilisateur à l'organisation racine.
      // (upsert défensif de la racine — normalement créée par la migration.)
      await prisma.organization.upsert({
        where: { id: 'global' },
        create: { id: 'global', nom: 'Organisation principale', slug: 'principale', path: '/global/' },
        update: {},
      })
      await prisma.orgMembership.create({
        data: {
          userId: user.id,
          organizationId: 'global',
          role: isFirstUser ? 'ADMIN' : 'ANALYSTE',
          scope: isFirstUser ? 'SUBTREE' : 'NODE',
        },
      })
      await auditLog('REGISTER', {
        userId: user.id, userEmail: user.email, ip: getClientIp(req),
      })
    }

    return NextResponse.json({ user }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: err.errors }, { status: 400 })
    }
    console.error(err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
