import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canAdmin } from '@/lib/permissions'
import { getAccessibleOrgIds } from '@/lib/org-context.server'
import { auditLog, getClientIp } from '@/lib/logger'

type Params = { params: Promise<{ id: string }> }

// Filtre d'organisation pour la corbeille (SUPER_ADMIN : tout ; sinon son périmètre).
async function recoveryOrgFilter(userId: string, userRole: string) {
  const { all, ids } = await getAccessibleOrgIds(userId, userRole as any)
  return all ? {} : { organizationId: { in: ids } }
}

async function authoriseAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const userId   = (session.user as any).id
  const userRole = (session.user as any).role ?? 'ANALYSTE'
  if (!canAdmin({ id: userId, role: userRole })) {
    return { error: NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 }) }
  }
  return { userId, userRole }
}

// PATCH /api/admin/recovery/:id — restaurer une analyse de la corbeille (ADMIN).
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await authoriseAdmin()
  if (auth.error) return auth.error
  const { id } = await params

  const a = await prisma.analyse.findFirst({ where: { id, ...(await recoveryOrgFilter(auth.userId!, auth.userRole!)) }, select: { id: true, nom: true, deletedAt: true } })
  if (!a || !a.deletedAt) return NextResponse.json({ error: 'Analyse introuvable dans la corbeille' }, { status: 404 })

  await prisma.analyse.update({ where: { id }, data: { deletedAt: null, deletedById: null } })
  await auditLog('ANALYSE_RESTORED', {
    userId: auth.userId, userRole: auth.userRole,
    targetId: id, targetType: 'analyse', ip: getClientIp(req),
    details: { nom: a.nom },
  })
  return NextResponse.json({ ok: true })
}

// DELETE /api/admin/recovery/:id — purge définitive (ADMIN). Cascade sur les ateliers.
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await authoriseAdmin()
  if (auth.error) return auth.error
  const { id } = await params

  const a = await prisma.analyse.findFirst({ where: { id, ...(await recoveryOrgFilter(auth.userId!, auth.userRole!)) }, select: { id: true, nom: true, deletedAt: true } })
  if (!a || !a.deletedAt) return NextResponse.json({ error: 'Analyse introuvable dans la corbeille' }, { status: 404 })

  await prisma.analyse.delete({ where: { id } })
  await auditLog('ANALYSE_PURGED', {
    userId: auth.userId, userRole: auth.userRole,
    targetId: id, targetType: 'analyse', ip: getClientIp(req),
    details: { nom: a.nom },
  })
  return NextResponse.json({ ok: true })
}
