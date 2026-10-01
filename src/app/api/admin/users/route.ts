import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canAdmin, isAdminRole } from '@/lib/permissions'
import type { UserRole } from '@/lib/permissions'
import { UserRole as PrismaUserRole } from '@prisma/client'
import { auditLog, getClientIp } from '@/lib/logger'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { generateCompliantPassword, DEFAULT_POLICY, type PasswordPolicyShape } from '@/lib/password-policy'
import { deactivateInactiveAccounts } from '@/lib/account-lifecycle'
import { sendEmail } from '@/lib/email'
import { emailLayout } from '@/lib/email-html'
import { getAnalyseScope, getAccessibleOrgIds } from '@/lib/org-context.server'
import { decideUserDeletion, decideUserManagement, planAnalysesReassignment } from '@/lib/user-deletion'

/**
 * Périmètre de gestion des comptes. SUPER_ADMIN non focalisé → tous les comptes.
 * Sinon (ADMIN, ou super focalisé sur une org) → uniquement les comptes membres
 * d'une des organisations visibles. `where` s'applique au findMany users.
 */
async function usersScope(userId: string, role: UserRole) {
  const s = await getAnalyseScope(userId, role)
  const isSuper = s.scope.isSuperAdmin === true
  return {
    all: isSuper,
    visibleOrgIds: s.scope.visibleOrgIds,
    activeOrgId: s.activeOrgId,
    where: isSuper
      ? {}
      : { memberships: { some: { organizationId: { in: s.scope.visibleOrgIds } } } },
  }
}

const createSchema = z.object({
  name:  z.string().min(2).max(100),
  email: z.string().email(),
  role:  z.enum(['LECTEUR', 'ANALYSTE', 'RISK_MANAGER', 'RSSI', 'ADMIN', 'DIRECTION_METIER']),
})

async function loadPasswordPolicy(): Promise<PasswordPolicyShape> {
  try {
    const p = await prisma.passwordPolicy.findUnique({ where: { id: 'global' } })
    if (p) return {
      minLength: p.minLength, requireUppercase: p.requireUppercase, requireLowercase: p.requireLowercase,
      requireNumbers: p.requireNumbers, requireSpecial: p.requireSpecial, maxAgeDays: p.maxAgeDays,
    }
  } catch { /* table absente */ }
  return DEFAULT_POLICY
}

// POST /api/admin/users — créer un compte (ADMIN). Génère un mot de passe
// temporaire conforme à la politique, à changer obligatoirement à la 1re connexion.
// Le mot de passe généré est renvoyé UNE seule fois pour affichage à l'admin.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const currentUserId = (session.user as any).id
  const userRole = (session.user as any).role ?? 'ANALYSTE'
  if (!canAdmin({ id: currentUserId, role: userRole })) {
    return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Corps invalide' }, { status: 400 }) }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides', details: parsed.error.errors }, { status: 400 })
  }
  const { name, email, role } = parsed.data
  const emailNorm = email.toLowerCase().trim()

  const existing = await prisma.user.findUnique({ where: { email: emailNorm } })
  if (existing) {
    return NextResponse.json({ error: 'Un compte existe déjà avec cet email.' }, { status: 409 })
  }

  // Mot de passe temporaire conforme à la politique configurée
  const policy = await loadPasswordPolicy()
  const tempPassword = generateCompliantPassword(policy)
  const passwordHash = await bcrypt.hash(tempPassword, 12)

  const user = await prisma.user.create({
    data: {
      name,
      email: emailNorm,
      passwordHash,
      role: role as PrismaUserRole,
      mustChangePassword: true,
    } as any,
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  })

  // Rattache le compte à l'organisation active de l'admin (pour qu'il apparaisse dans
  // SON périmètre). Un ADMIN crée toujours des comptes DANS son organisation.
  const scope = await usersScope(currentUserId, userRole)
  if (scope.activeOrgId) {
    await prisma.orgMembership.create({
      data: { userId: user.id, organizationId: scope.activeOrgId, role: role as PrismaUserRole, scope: 'NODE' },
    }).catch(() => {})
  }

  await auditLog('USER_CREATED', {
    userId: currentUserId, userRole,
    targetId: user.id, targetType: 'user',
    ip: getClientIp(req),
    details: { targetEmail: emailNorm, role, orgId: scope.activeOrgId },
  })

  // Le mot de passe temporaire n'est renvoyé qu'ici, une seule fois.
  return NextResponse.json({ user: { ...user, _count: { analyses: 0 } }, tempPassword }, { status: 201 })
}

// GET /api/admin/users — liste tous les utilisateurs (ADMIN seulement)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const userId = (session.user as any).id
  const userRole = (session.user as any).role ?? 'ANALYSTE'

  if (!canAdmin({ id: userId, role: userRole })) {
    return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 })
  }

  // #12 — désactivation paresseuse des comptes inactifs (hors ADMIN) selon la politique
  await deactivateInactiveAccounts()

  // Périmètre : un ADMIN ne voit que les comptes de SON organisation.
  const scope = await usersScope(userId, userRole)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const users = await prisma.user.findMany({
    where: scope.where,
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      _count: { select: { analyses: true } },
    },
  })

  return NextResponse.json({ users })
}

// PATCH /api/admin/users — changer le rôle OU suspendre/réactiver un utilisateur
// body: { userId: string, role: UserRole }
//    OR { userId: string, action: 'suspend' | 'activate' }
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const currentUserId = (session.user as any).id
  const userRole = (session.user as any).role ?? 'ANALYSTE'

  if (!canAdmin({ id: currentUserId, role: userRole })) {
    return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 })
  }

  const body = await req.json() as { userId: string; role?: UserRole; action?: 'suspend' | 'activate' | 'reset-password' | 'reassign-analyses'; toUserId?: string }
  const { userId: targetId, role, action } = body

  // Périmètre (audit 2026-10-01, T1) : rôle global, suspension et mot de passe sont
  // GLOBAUX. Un admin restreint n'agit que sur un compte ENTIÈREMENT dans son
  // périmètre ; un SUPER_ADMIN n'est gérable que par un SUPER_ADMIN.
  const scope = await usersScope(currentUserId, userRole)
  const managed = typeof targetId === 'string'
    ? await prisma.user.findUnique({ where: { id: targetId }, select: { role: true, memberships: { select: { organizationId: true } } } })
    : null
  if (!managed) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
  const decision = decideUserManagement({
    actorRole: userRole, actorAll: scope.all, actorVisibleOrgIds: scope.visibleOrgIds,
    targetRole: managed.role, targetMembershipOrgIds: managed.memberships.map(m => m.organizationId),
  })
  if (!decision.allowed) {
    const messages = {
      SUPER_ADMIN_ONLY: 'Seul un super-administrateur peut gérer ce compte',
      OUT_OF_SCOPE: 'Compte hors de votre périmètre',
      SHARED_ACCOUNT: 'Ce compte appartient aussi à des organisations hors de votre périmètre : modifiez son rôle dans votre organisation, ou demandez au super-administrateur',
    } as const
    return NextResponse.json({ error: messages[decision.code], code: decision.code }, { status: decision.status })
  }

  // ── Réattribution des analyses (audit 2026-10-01, T2) ──
  // Préalable à la suppression d'un propriétaire d'analyses (FK Restrict, D1).
  if (action === 'reassign-analyses') {
    const toUserId = typeof body.toUserId === 'string' ? body.toUserId : ''
    if (!toUserId || toUserId === targetId) return NextResponse.json({ error: 'Destinataire invalide', code: 'INVALID_RECIPIENT' }, { status: 400 })
    const recipient = await prisma.user.findUnique({
      where: { id: toUserId },
      select: { id: true, email: true, role: true, isActive: true, memberships: { select: { organizationId: true } } },
    })
    const recipientVisible = !!recipient && (scope.all || recipient.memberships.some(m => scope.visibleOrgIds.includes(m.organizationId)))
    if (!recipient || !recipient.isActive || !recipientVisible) {
      return NextResponse.json({ error: 'Destinataire introuvable, inactif ou hors de votre périmètre', code: 'INVALID_RECIPIENT' }, { status: 400 })
    }
    const [owned, recipientAccess] = await Promise.all([
      prisma.analyse.findMany({ where: { userId: targetId }, select: { id: true, organizationId: true } }),
      getAccessibleOrgIds(recipient.id, recipient.role),
    ])
    const plan = planAnalysesReassignment({
      analyses: owned, actorAll: scope.all, actorVisibleOrgIds: scope.visibleOrgIds,
      recipientAll: recipientAccess.all, recipientOrgIds: recipientAccess.ids,
    })
    if (plan.transfer.length) {
      await prisma.analyse.updateMany({ where: { id: { in: plan.transfer }, userId: targetId }, data: { userId: recipient.id } })
      await auditLog('ANALYSE_REASSIGNED', {
        userId: currentUserId, userRole, targetId, targetType: 'user', ip: getClientIp(req),
        details: { from: targetId, to: recipient.id, toEmail: recipient.email, count: plan.transfer.length, analyseIds: plan.transfer.slice(0, 100) },
      })
    }
    const remaining = await prisma.analyse.count({ where: { userId: targetId } })
    return NextResponse.json({ transferred: plan.transfer.length, remaining, outOfScope: plan.outOfActorScope, recipientNoAccess: plan.recipientNoAccess })
  }

  // ── Réinitialisation du mot de passe (#6) ──
  // Génère un MDP temporaire conforme, force le changement, et le renvoie 1× à l'admin.
  if (action === 'reset-password') {
    const target = await prisma.user.findUnique({ where: { id: targetId }, select: { email: true } })
    if (!target) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

    const policy = await loadPasswordPolicy()
    const tempPassword = generateCompliantPassword(policy)
    const passwordHash = await bcrypt.hash(tempPassword, 12)

    // F04 : une réinitialisation admin doit RÉVOQUER les sessions/JWT antérieurs
    // (incrément de `sessionVersion`) ET les appareils de confiance, comme le
    // changement de mot de passe par l'utilisateur (api/user/password). Sinon un
    // mot de passe forcé ne coupe pas les sessions déjà ouvertes.
    const updated = await prisma.$transaction(async tx => {
      const u = await tx.user.update({
        where: { id: targetId },
        data: { passwordHash, mustChangePassword: true, passwordChangedAt: null, sessionVersion: { increment: 1 } },
        select: { id: true, name: true, email: true, role: true, isActive: true },
      })
      await tx.trustedDevice.deleteMany({ where: { userId: targetId } })
      return u
    })

    await auditLog('PASSWORD_CHANGED', {
      userId: currentUserId, userRole,
      targetId, targetType: 'user',
      ip: getClientIp(req),
      details: { targetEmail: target.email, reason: 'admin_reset' },
    })

    // Envoi du mot de passe temporaire par e-mail si le SMTP est configuré (sinon ignoré silencieusement)
    const mail = await sendEmail({
      to: target.email,
      subject: 'ACRA — Réinitialisation de votre mot de passe',
      text: `Votre mot de passe ACRA a été réinitialisé par un administrateur.\n\nMot de passe temporaire : ${tempPassword}\n\nVous devrez le changer à votre prochaine connexion.`,
      html: emailLayout({
        heading: 'Réinitialisation de votre mot de passe',
        paragraphs: ['Votre mot de passe ACRA a été réinitialisé par un administrateur.'],
        code: { value: tempPassword, label: 'Mot de passe temporaire :' },
        footer: 'Vous devrez le changer à votre prochaine connexion.',
      }),
    })

    return NextResponse.json({ user: updated, tempPassword, emailed: mail.ok })
  }

  // ── Suspend / Activate ──
  if (action === 'suspend' || action === 'activate') {
    if (targetId === currentUserId) {
      return NextResponse.json({ error: 'Vous ne pouvez pas vous suspendre vous-même' }, { status: 400 })
    }

    const target = await prisma.user.findUnique({ where: { id: targetId }, select: { email: true, isActive: true } })
    if (!target) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

    const isActive = action === 'activate'
    const updated = await prisma.user.update({
      where: { id: targetId },
      // F04 : la suspension révoque les sessions/JWT (incrément de version) →
      // les jetons restent invalides même après une éventuelle réactivation.
      data: { isActive, ...(action === 'suspend' ? { sessionVersion: { increment: 1 } } : {}) },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    })

    await auditLog(action === 'suspend' ? 'USER_SUSPENDED' : 'USER_ACTIVATED', {
      userId: currentUserId, userRole,
      targetId, targetType: 'user',
      ip: getClientIp(req),
      details: { targetEmail: target.email },
    })

    return NextResponse.json({ user: updated })
  }

  // ── Role change ──
  if (!role) {
    return NextResponse.json({ error: 'Paramètre manquant : role ou action requis' }, { status: 400 })
  }

  // Le rôle SUPER_ADMIN (niveau instance) n'est gérable que par un SUPER_ADMIN.
  const isSuper = userRole === 'SUPER_ADMIN'
  const validRoles: UserRole[] = isSuper
    ? ['LECTEUR', 'ANALYSTE', 'RISK_MANAGER', 'RSSI', 'ADMIN', 'DIRECTION_METIER', 'SUPER_ADMIN']
    : ['LECTEUR', 'ANALYSTE', 'RISK_MANAGER', 'RSSI', 'ADMIN', 'DIRECTION_METIER']
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })
  }

  // Empêcher de se retirer ses propres droits administrateur (ADMIN ou SUPER_ADMIN)
  if (targetId === currentUserId && !isAdminRole(role)) {
    return NextResponse.json({ error: 'Vous ne pouvez pas retirer vos propres droits administrateur' }, { status: 400 })
  }

  // Récupérer l'ancien rôle pour l'audit + garde-fous
  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { role: true, email: true } })
  if (!target) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

  // Un administrateur d'organisation ne peut ni créer un SUPER_ADMIN ni en modifier un.
  if (!isSuper && (target.role === 'SUPER_ADMIN' || role === 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Seul un super-administrateur peut gérer ce rôle' }, { status: 403 })
  }

  // Garde-fou : toujours conserver au moins un super-administrateur actif.
  if (target.role === 'SUPER_ADMIN' && role !== 'SUPER_ADMIN') {
    const remaining = await prisma.user.count({ where: { role: 'SUPER_ADMIN', isActive: true, id: { not: targetId } } })
    if (remaining < 1) {
      return NextResponse.json({ error: 'Au moins un super-administrateur doit subsister' }, { status: 400 })
    }
  }

  const updated = await prisma.user.update({
    where: { id: targetId },
    data: { role: role as PrismaUserRole },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  })

  await auditLog('ROLE_CHANGED', {
    userId: currentUserId, userRole,
    targetId, targetType: 'user',
    ip: getClientIp(req),
    details: { targetEmail: target?.email, oldRole: target?.role, newRole: role },
  })

  return NextResponse.json({ user: updated })
}

// DELETE /api/admin/users — supprimer définitivement un utilisateur
// body: { userId: string }
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const currentUserId = (session.user as any).id
  const userRole = (session.user as any).role ?? 'ANALYSTE'

  if (!canAdmin({ id: currentUserId, role: userRole })) {
    return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 })
  }

  const { userId: targetId } = await req.json() as { userId: string }

  if (targetId === currentUserId) {
    return NextResponse.json({ error: 'Vous ne pouvez pas supprimer votre propre compte' }, { status: 400 })
  }

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { email: true, name: true, role: true, memberships: { select: { organizationId: true } } },
  })
  if (!target) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

  // Décision centralisée (audit 2026-09-30 S1/S4/D1) : protection des SUPER_ADMIN,
  // pas de suppression d'un compte partagé avec des organisations hors périmètre,
  // pas de suppression d'un propriétaire d'analyses (preuves GRC).
  const scope = await usersScope(currentUserId, userRole)
  const [otherActiveSuperAdmins, ownedAnalyses] = await Promise.all([
    prisma.user.count({ where: { role: 'SUPER_ADMIN', isActive: true, id: { not: targetId } } }),
    prisma.analyse.count({ where: { userId: targetId } }),
  ])
  const decision = decideUserDeletion({
    actorRole: userRole, actorAll: scope.all, actorVisibleOrgIds: scope.visibleOrgIds,
    targetRole: target.role, targetMembershipOrgIds: target.memberships.map(m => m.organizationId),
    otherActiveSuperAdmins, ownedAnalyses,
  })
  if (decision.action === 'REFUSE') {
    const messages = {
      SUPER_ADMIN_ONLY: 'Seul un super-administrateur peut supprimer ce compte',
      LAST_SUPER_ADMIN: 'Au moins un super-administrateur doit subsister',
      OUT_OF_SCOPE: 'Compte hors de votre périmètre',
      OWNS_ANALYSES: `Ce compte est propriétaire de ${ownedAnalyses} analyse(s) : désactivez-le plutôt que de le supprimer, ou réattribuez ses analyses`,
    } as const
    return NextResponse.json({ error: messages[decision.code], code: decision.code }, { status: decision.status })
  }

  if (decision.action === 'DETACH') {
    // Le compte appartient aussi à d'autres organisations : on ne retire que les
    // appartenances du périmètre de l'administrateur ; le compte et ses données survivent.
    await prisma.orgMembership.deleteMany({ where: { userId: targetId, organizationId: { in: decision.organizationIds } } })
    await auditLog('ORG_MEMBER_REMOVED', {
      userId: currentUserId, userRole, targetId, targetType: 'user', ip: getClientIp(req),
      details: { targetEmail: target.email, organizationIds: decision.organizationIds, reason: 'user-delete-out-of-scope' },
    })
    return NextResponse.json({ success: true, detached: true })
  }

  await prisma.user.delete({ where: { id: targetId } })

  await auditLog('USER_DELETED', {
    userId: currentUserId, userRole,
    targetId, targetType: 'user',
    ip: getClientIp(req),
    details: { targetEmail: target.email, targetName: target.name, targetRole: target.role },
  })

  return NextResponse.json({ success: true })
}

// POST /api/admin/users — créer un compte utilisateur (ADMIN seulement)
// body: { name: string, email: string, password: string, role: UserRole }
