import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { getServerLocale } from '@/lib/i18n'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { validateReferentielInput, cleanReferentielInput } from '@/lib/referentiel'
import { listReferentiels } from '@/lib/referentiel.server'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// Le socle référentiels relève de la gouvernance (RSSI / conformité / risques).
export function peutGererReferentiels(role: UserRole): boolean {
  return isAdminRole(role) || role === 'RSSI' || role === 'RISK_MANAGER' || role === 'CONFORMITE' || role === 'DPO'
}

async function ctx(session: { user: { id: string; role?: string } }) {
  const userId = session.user.id
  const instanceRole = (session.user.role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  return { userId, userRole: scope.role, orgId: scope.activeOrgId }
}

// GET /api/referentiels — cadres livrés + référentiels custom de l'organisation.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { userRole, orgId } = await ctx(session as unknown as { user: { id: string; role?: string } })
  if (!orgId) return NextResponse.json({ active: false, referentiels: [] })
  const cfg = await getOrgConfig(orgId)
  if (!cfg.conformiteActive) return NextResponse.json({ active: false, referentiels: [] })

  const locale = await getServerLocale()
  const referentiels = await listReferentiels(orgId, locale)
  return NextResponse.json({ active: true, referentiels, canManage: peutGererReferentiels(userRole) })
}

// POST /api/referentiels — crée un référentiel custom (PSSI, politique…).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { userId, userRole, orgId } = await ctx(session as unknown as { user: { id: string; role?: string } })
  if (!orgId) return NextResponse.json({ error: 'org_absente' }, { status: 400 })
  const cfg = await getOrgConfig(orgId)
  if (!cfg.conformiteActive) return NextResponse.json({ error: 'module_inactif' }, { status: 403 })
  if (!peutGererReferentiels(userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const erreur = validateReferentielInput(body)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanReferentielInput(body)

  const exists = await prisma.referentiel.findFirst({ where: { organizationId: orgId, code: data.code }, select: { id: true } })
  if (exists) return NextResponse.json({ error: 'code_existant' }, { status: 409 })

  const created = await prisma.referentiel.create({
    data: {
      organizationId: orgId, createdBy: userId,
      code: data.code, nom: data.nom, type: data.type, version: data.version, description: data.description,
      exigences: data.exigences as unknown as Prisma.InputJsonValue,
    },
  })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'referentiel', action: 'create', code: data.code },
  })
  return NextResponse.json(created, { status: 201 })
}
