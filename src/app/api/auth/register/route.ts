import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import { auditLog, getClientIp } from '@/lib/logger'
import { validatePassword, DEFAULT_POLICY, type PasswordPolicyShape } from '@/lib/password-policy'
import { demoOrgCapReached, createDemoOrgForUser, isDemoInstance } from '@/lib/demo-server'
import { createAndSendChallenge } from '@/lib/mfa-service'

const schema = z.object({
  name:     z.string().min(2).max(100),
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
  // AUDIT [F003] MEDIUM — CWE-290 / OWASP A07:2021 — Rate-limit contournable (XFF spoofé)
  // CVSS: 5.3 (AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:N)
  // EVIDENCE: l'IP provient de l'en-tête client X-Forwarded-For, falsifiable. Un
  //   attaquant fait varier XFF à chaque requête → la limite "5/h par IP" ne
  //   s'applique jamais (clé toujours différente). Le store est aussi in-memory,
  //   donc non partagé entre instances (limite réinitialisée par instance).
  // FIX: dériver l'IP d'une source de confiance (req.ip / dernier hop du proxy de
  //   confiance), valider XFF contre une allowlist de proxys, et utiliser un store
  //   distribué (Redis) en multi-instance.
  // Rate limiting : 5 inscriptions par IP par heure
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = rateLimit(`register:${ip}`, 5, 60 * 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Trop de tentatives. Réessayez dans une heure.' },
      { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) }
    )
  }

  try {
    const body = await req.json()
    const { name, email, password } = schema.parse(body)

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

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    })

    if (existing) {
      return NextResponse.json({ error: 'Un compte existe déjà avec cet email.' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    // AUDIT [F004b] MEDIUM — CWE-269 / OWASP A01:2021 — Amorçage de privilège (premier compte = ADMIN)
    // CVSS: 6.5 (AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:H/A:N)
    // EVIDENCE: si la table user est vide (déploiement neuf, ou base réinitialisée),
    //   le PREMIER inscrit anonyme devient ADMIN. Course critique : un attaquant qui
    //   s'inscrit avant l'exploitant légitime prend le contrôle complet (gestion des
    //   comptes, rôles, politiques). Combiné à F004 (inscription ouverte) → fort impact.
    // FIX: provisionner l'ADMIN initial hors-ligne (seed/CLI protégé, variable d'env),
    //   ne jamais attribuer ADMIN via un endpoint public.
    // Instance de démo PROUVÉE (env + marqueur figé) — jamais isDemoMode() seul,
    // pour qu'une instance de prod flippée par erreur ne bascule pas en self-service.
    const demo = await isDemoInstance()
    const userCount = await prisma.user.count()
    const isFirstUser = userCount === 0

    // Amorçage : le PREMIER compte de l'instance est l'exploitant — SUPER_ADMIN,
    // e-mail pré-vérifié (aucun SMTP au tout premier démarrage), rattaché à
    // l'organisation racine. Cela vaut AUSSI en démo (l'exploitant s'inscrit avant
    // d'ouvrir le site), ce qui évite tout amorçage manuel en base. Les inscrits
    // démo SUIVANTS sont des testeurs : organisation isolée + vérification d'e-mail.
    const demoTester = demo && !isFirstUser

    // Mode démo : plafond d'organisations actives (anti-abus) — testeurs uniquement.
    if (demoTester && await demoOrgCapReached()) {
      return NextResponse.json({ error: 'DEMO_FULL' }, { status: 503 })
    }

    const instanceRole = isFirstUser ? 'SUPER_ADMIN' : 'ANALYSTE'

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase().trim(),
        passwordHash,
        role: instanceRole,
        // Le premier compte est pré-vérifié pour pouvoir se connecter immédiatement.
        emailVerified: isFirstUser ? new Date() : undefined,
      },
      select: { id: true, email: true, name: true, role: true },
    })

    if (demoTester) {
      // Chaque testeur = sa propre organisation, dont il est ADMIN (SUBTREE).
      const org = await createDemoOrgForUser(user.id, name)
      await auditLog('REGISTER', {
        userId: user.id, userEmail: user.email, ip: getClientIp(req),
        details: { demo: true, orgId: org.id, role: 'ADMIN' },
      })
      // Vérification d'e-mail obligatoire (démo) : le compte reste emailVerified=null
      // et la connexion est bloquée tant que l'OTP envoyé ici n'est pas validé.
      // Anti mail-bombing : rate-limit supplémentaire par ADRESSE de destination.
      const destRl = rateLimit(`emailverif:${user.email}`, 3, 15 * 60 * 1000)
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
        details: isFirstUser ? { role: 'ADMIN', reason: 'premier compte créé' } : undefined,
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
