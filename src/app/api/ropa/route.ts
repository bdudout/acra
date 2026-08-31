import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { canManageRopa, type UserRole } from '@/lib/permissions'
import { sanitizeTraitement, evaluerTraitement } from '@/lib/ropa'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

async function ctx(session: { user: { id: string; role?: string } }) {
  const userId = session.user.id
  const instanceRole = (session.user.role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  return { userId, userRole: scope.role, orgId: scope.activeOrgId }
}

// GET /api/ropa — registre des traitements de l'org active + évaluation (art. 30 / PIA).
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { userRole, orgId } = await ctx(session as unknown as { user: { id: string; role?: string } })
  if (!orgId) return NextResponse.json({ traitements: [], canManage: false })
  if (!canManageRopa(userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  const rows = await db.traitement.findMany({ where: { organizationId: orgId }, orderBy: [{ createdAt: 'desc' }] })
  const traitements = rows.map((r: Record<string, unknown>) => ({ ...r, evaluation: evaluerTraitement(sanitizeTraitement(r)) }))
  const synthese = {
    total: traitements.length,
    complets: traitements.filter((t: { evaluation: { complet: boolean } }) => t.evaluation.complet).length,
    piaRequis: traitements.filter((t: { evaluation: { pia: { requis: boolean } } }) => t.evaluation.pia.requis).length,
  }
  return NextResponse.json({ traitements, synthese, canManage: true })
}

// POST /api/ropa — créer un traitement (DPO / ADMIN).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { userId, userRole, orgId } = await ctx(session as unknown as { user: { id: string; role?: string } })
  if (!orgId) return NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 })
  if (!canManageRopa(userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const t = sanitizeTraitement(body)
  if (!t.nom.trim()) return NextResponse.json({ error: 'nom_requis' }, { status: 400 })

  const { id: _drop, ...data } = t
  const created = await db.traitement.create({ data: { ...data, organizationId: orgId, createdBy: userId } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'ropa', action: 'create', id: created.id },
  })
  return NextResponse.json(created, { status: 201 })
}
