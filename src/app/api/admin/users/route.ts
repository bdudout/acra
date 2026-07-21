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
import { getAnalyseScope } from '@/lib/org-context.server'

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

/** Vrai si l'admin (selon son périmètre) a le droit de gérer le compte cible. */
async function canManageTarget(scope: { all: boolean; visibleOrgIds: string[] }, targetId: string): Promise<boolean> {
  if (scope.all) return true
  if (scope.visibleOrgIds.length === 0) return false
  const n = await prisma.orgMembership.count({
    where: { userId: targetId, organizationId: { in: scope.visibleOrgIds } },
  })
  return n > 0
}

const createSchema = z.object({
  name:  z.string().min(2).max(100),
  email: z.string().email(),
  role:  z.enum(['LECTEUR', 'ANALYSTE', 'RISK_MANAGER', 'RSSI', 'ADMIN', 'DIRECTION_METIER']),
})

async function loadPasswordPolicy(): Promise<PasswordPolicyShape> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = await (prisma as any).passwordPolicy.findUnique({ where: { id: 'global' } })
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  const users = await (prisma.user as any).findMany({
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

  const body = await req.json() as { userId: string; role?: UserRole; action?: 'suspend' | 'activate' | 'reset-password' }
  const { userId: targetId, role, action } = body

  // Périmètre : un ADMIN ne peut agir que sur les comptes de SON organisation.
  const scope = await usersScope(currentUserId, userRole)
  if (!(await canManageTarget(scope, targetId))) {
    return NextResponse.json({ error: 'Compte hors de votre périmètre' }, { status: 403 })
  }

  // ── Réinitialisation du mot de passe (#6) ──
  // Génère un MDP temporaire conforme, force le changement, et le renvoie 1× à l'admin.
  if (action === 'reset-password') {
    const target = await prisma.user.findUnique({ where: { id: targetId }, select: { email: true } })
    if (!target) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

    const policy = await loadPasswordPolicy()
    const tempPassword = generateCompliantPassword(policy)
    const passwordHash = await bcrypt.hash(tempPassword, 12)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = await (prisma.user as any).update({
      where: { id: targetId },
      data: { passwordHash, mustChangePassword: true, passwordChangedAt: null },
      select: { id: true, name: true, email: true, role: true, isActive: true },
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
      html: `<div style="font-family:sans-serif;font-size:14px;color:#1f2937">
        <h2 style="color:#4f46e5">Réinitialisation de votre mot de passe</h2>
        <p>Votre mot de passe ACRA a été réinitialisé par un administrateur.</p>
        <p>Mot de passe temporaire : <strong style="font-family:monospace;font-size:16px">${tempPassword}</strong></p>
        <p style="color:#6b7280;font-size:12px">Vous devrez le changer à votre prochaine connexion.</p>
      </div>`,
    })

    return NextResponse.json({ user: updated, tempPassword, emailed: mail.ok })
  }

  // ── Suspend / Activate ──
  if (action === 'suspend' || action === 'activate') {
    if (targetId === currentUserId) {
      return NextResponse.json({ error: 'Vous ne pouvez pas vous suspendre vous-même' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const target = await (prisma.user as any).findUnique({ where: { id: targetId }, select: { email: true, isActive: true } })
    if (!target) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

    const isActive = action === 'activate'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = await (prisma.user as any).update({
      where: { id: targetId },
      data: { isActive },
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updated = await (prisma.user as any).update({
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

  // Périmètre : un ADMIN ne peut supprimer que les comptes de SON organisation.
  const scope = await usersScope(currentUserId, userRole)
  if (!(await canManageTarget(scope, targetId))) {
    return NextResponse.json({ error: 'Compte hors de votre périmètre' }, { status: 403 })
  }

  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { email: true, name: true } })
  if (!target) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

  await prisma.user.delete({ where: { id: targetId } })

  await auditLog('USER_DELETED', {
    userId: currentUserId, userRole,
    targetId, targetType: 'user',
    ip: getClientIp(req),
    details: { targetEmail: target.email, targetName: target.name },
  })

  return NextResponse.json({ success: true })
}

// POST /api/admin/users — créer un compte utilisateur (ADMIN seulement)
// body: { name: string, email: string, password: string, role: UserRole }
