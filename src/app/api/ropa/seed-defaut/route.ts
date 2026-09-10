import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma as db } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { canManageRopa, type UserRole } from '@/lib/permissions'
import { buildRopaDefaut } from '@/lib/ropa-catalogue'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// POST /api/ropa/seed-defaut — pré-remplit le registre RGPD avec les traitements
// habituels (socle CNIL simplifié). N'insère QUE ceux dont le nom n'existe pas
// déjà → idempotent et cumulable. Réservé DPO / ADMIN.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  const orgId = scope.activeOrgId
  if (!orgId) return NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 })
  if (!canManageRopa(scope.role)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  const socle = buildRopaDefaut()
  const existants = await db.traitement.findMany({ where: { organizationId: orgId }, select: { nom: true } })
  const dejaLa = new Set(existants.map((x) => x.nom.trim().toLowerCase()))
  const aInserer = socle.filter((t) => !dejaLa.has(t.nom.trim().toLowerCase()))

  for (const t of aInserer) {
    const { id: _drop, ...data } = t
    await db.traitement.create({ data: { ...data, organizationId: orgId, createdBy: userId } })
  }

  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole: scope.role, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'ropa', action: 'seed-defaut', inserted: aInserer.length, skipped: socle.length - aInserer.length },
  })
  return NextResponse.json({ inserted: aInserer.length, skipped: socle.length - aInserer.length }, { status: 201 })
}
