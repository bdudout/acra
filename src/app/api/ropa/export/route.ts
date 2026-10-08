// ─── Registre des traitements (RGPD art. 30) — export Excel ───────────────────
// Art. 30 §4 : le registre est mis à la disposition de l'autorité de contrôle sur demande. Réservé au DPO (+ ADMIN),
// borné à l'organisation active ; export journalisé. Classeur : lib/ropa-xlsx.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { canManageRopa, type UserRole } from '@/lib/permissions'
import { evaluerTraitement, sanitizeTraitement } from '@/lib/ropa'
import { buildRopaXlsx } from '@/lib/ropa-xlsx'
import { getServerLocale, getT } from '@/lib/i18n'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const user = session.user as { id: string; role?: string }
  const scope = await getAnalyseScope(user.id, (user.role ?? 'ANALYSTE') as UserRole)
  if (!scope.activeOrgId) return NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 })
  if (!canManageRopa(scope.role as UserRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  const [rows, org] = await Promise.all([
    prisma.traitement.findMany({ where: { organizationId: scope.activeOrgId }, orderBy: [{ nom: 'asc' }] }),
    prisma.organization.findUnique({ where: { id: scope.activeOrgId }, select: { nom: true } }),
  ])
  const traitements = rows.map(r => { const t = sanitizeTraitement(r); return { ...t, evaluation: evaluerTraitement(t) } })
  const now = new Date()
  const buf = await buildRopaXlsx({ t: getT(await getServerLocale()), now, organisation: org?.nom ?? '', traitements })
  await auditLog('EXPORT', { userId: user.id, userRole: scope.role, organizationId: scope.activeOrgId, ip: getClientIp(req), targetType: 'ropa', details: { format: 'xlsx', traitements: traitements.length } })
  return new NextResponse(new Uint8Array(buf), { headers: {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="registre-traitements-${now.toISOString().slice(0, 10)}.xlsx"`,
    'Cache-Control': 'no-store',
  } })
}
