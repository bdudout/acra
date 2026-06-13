import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canAdmin } from '@/lib/permissions'
import type { UserRole } from '@/lib/permissions'
import { UserRole as PrismaUserRole } from '@prisma/client'
import { auditLog, getClientIp } from '@/lib/logger'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { generateCompliantPassword, DEFAULT_POLICY, type PasswordPolicyShape } from '@/lib/password-policy'
import { deactivateInactiveAccounts } from '@/lib/account-lifecycle'

const createSchema = z.object({
  name:  z.string().min(2).max(100),
  email: z.string().email(),
  role:  z.enum(['LECTEUR', 'ANALYSTE', 'RISK_MANAGER', 'RSSI', 'ADMIN']),
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

  await auditLog('USER_CREATED', {
    userId: currentUserId, userRole,
    targetId: user.id, targetType: 'user',
    ip: getClientIp(req),
    details: { targetEmail: emailNorm, role },
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const users = await (prisma.user as any).findMany({
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

    return NextResponse.json({ user: updated, tempPassword })
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

  const validRoles: UserRole[] = ['LECTEUR', 'ANALYSTE', 'RISK_MANAGER', 'RSSI', 'ADMIN']
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })
  }

  // Empêcher de se retirer ses propres droits admin
  if (targetId === currentUserId && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Vous ne pouvez pas retirer vos propres droits administrateur' }, { status: 400 })
  }

  // Récupérer l'ancien rôle pour l'audit
  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { role: true, email: true } })

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
