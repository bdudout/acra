import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canAdmin } from '@/lib/permissions'
import { getAdminOrgIds } from '@/lib/org-context.server'
import { purgeThreshold, daysRemaining, RECOVERY_RETENTION_DAYS } from '@/lib/recovery'

// GET /api/admin/recovery — corbeille des analyses et des éléments supprimés (incidents) (ADMIN). Purge paresseuse > 30 j.
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const userId   = (session.user as any).id
  const userRole = (session.user as any).role ?? 'ANALYSTE'
  if (!canAdmin({ id: userId, role: userRole })) {
    return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 })
  }

  const now = new Date()
  // Purge définitive des analyses supprimées depuis plus de 30 jours (cascade).
  await prisma.analyse.deleteMany({ where: { deletedAt: { not: null, lte: purgeThreshold(now) } } })

  // Isolation multi-organisation : un admin ne voit que la corbeille des organisations
  // qu'il ADMINISTRE (rôle effectif, T25) ; SUPER_ADMIN voit tout.
  const { all, ids } = await getAdminOrgIds(userId, userRole)
  const orgFilter = all ? {} : { organizationId: { in: ids } }

  const rows = await prisma.analyse.findMany({
    where: { deletedAt: { not: null }, ...orgFilter },
    select: {
      id: true, nom: true, organisation: true, secteur: true, statut: true, deletedAt: true,
      user: { select: { name: true, email: true } },
    },
    orderBy: { deletedAt: 'desc' },
  })

  const analyses = rows.map(a => ({
    ...a,
    daysRemaining: a.deletedAt ? daysRemaining(a.deletedAt, now) : 0,
  }))

  // Éléments supprimés (incidents) : même rétention, même périmètre ; purge paresseuse au-delà.
  await prisma.elementSupprime.deleteMany({ where: { supprimeLe: { lte: purgeThreshold(now) } } })
  const elements = (await prisma.elementSupprime.findMany({
    where: orgFilter, select: { id: true, type: true, intitule: true, supprimeLe: true, supprimeParId: true, organizationId: true },
    orderBy: { supprimeLe: 'desc' }, take: 500,
  })).map(e => ({ ...e, daysRemaining: daysRemaining(e.supprimeLe, now) }))
  return NextResponse.json({ analyses, elements, retentionDays: RECOVERY_RETENTION_DAYS })
}
