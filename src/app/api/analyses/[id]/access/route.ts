import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { canManageAccess } from '@/lib/permissions'
import { z } from 'zod'
import { auditLog, getClientIp } from '@/lib/logger'
import { withAccess } from '@/lib/with-access.server'

// Accès à l'analyse (404 hors périmètre) et rôle EFFECTIF dans son organisation (#130) : `withAccess`.
// La gestion des accès (`canManageAccess`) reste évaluée ici, sur ce rôle effectif.
const lecture = { org: { analyse: 'id' } } as const
const ecriture = { org: { analyse: 'id' }, rateLimit: { bucket: 'analyse-access' } } as const
// Permission dans l'énumération Prisma (une valeur hors liste provoquait une erreur 500).
const invitation = z.object({ email: z.string().trim().min(1).max(320), permission: z.enum(['LECTURE', 'EDITION', 'APPROBATION']) })

const refuse = () => NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

// GET /api/analyses/[id]/access — liste des accès de l'analyse
export const GET = withAccess(lecture, async (_req, { user, role, analyse }) => {
  if (!canManageAccess({ id: user.id, role }, analyse)) return refuse()

  const detail = await prisma.analyse.findFirst({
    where: { id: analyse.id },
    select: { accesUtilisateurs: { include: { user: { select: { id: true, name: true, email: true, role: true } } } } },
  })
  return NextResponse.json(detail?.accesUtilisateurs ?? [])
})

// POST /api/analyses/[id]/access — inviter un utilisateur
export const POST = withAccess({ ...ecriture, body: invitation }, async (req, { user, role, analyse, body: { email, permission } }) => {
  if (!canManageAccess({ id: user.id, role }, analyse)) return refuse()
  const id = analyse.id

  // Retrouver l'utilisateur par email
  const targetUser = await prisma.user.findUnique({ where: { email } })
  if (!targetUser) {
    return NextResponse.json({ error: `Aucun compte trouvé pour ${email}` }, { status: 404 })
  }

  if (targetUser.id === analyse.userId) {
    return NextResponse.json({ error: 'Le propriétaire a déjà tous les droits' }, { status: 400 })
  }

  // Upsert de l'accès
  const acces = await prisma.analyseAcces.upsert({
    where: { analyseId_userId: { analyseId: id, userId: targetUser.id } },
    update: { permission },
    create: { analyseId: id, userId: targetUser.id, permission, invitePar: user.id },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  })

  await auditLog('ACCESS_GRANTED', { userId: user.id, userRole: role, organizationId: analyse.organizationId, ip: getClientIp(req), targetId: id, targetType: 'analyse', details: { beneficiaireId: targetUser.id, permission } })
  return NextResponse.json(acces, { status: 201 })
})

// DELETE /api/analyses/[id]/access?targetUserId=xxx — retirer un accès
export const DELETE = withAccess(ecriture, async (req, { user, role, analyse }) => {
  if (!canManageAccess({ id: user.id, role }, analyse)) return refuse()

  const { searchParams } = new URL(req.url)
  const targetUserId = searchParams.get('targetUserId')
  if (!targetUserId) return NextResponse.json({ error: 'targetUserId manquant' }, { status: 400 })

  const { count } = await prisma.analyseAcces.deleteMany({
    where: { analyseId: analyse.id, userId: targetUserId },
  })
  if (count) await auditLog('ACCESS_REVOKED', { userId: user.id, userRole: role, organizationId: analyse.organizationId, ip: getClientIp(req), targetId: analyse.id, targetType: 'analyse', details: { beneficiaireId: targetUserId } })

  return NextResponse.json({ ok: true })
})
