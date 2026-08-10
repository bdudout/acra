import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { validateCampagneInput, cleanCampagneInput, avancementCampagne } from '@/lib/campagne'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/** Piloter une campagne relève de la 2ᵉ ligne (risk manager / RSSI / admin). */
export function peutPiloter(role: UserRole): boolean {
  return isAdminRole(role) || role === 'RISK_MANAGER' || role === 'RSSI'
}

async function ctx(session: { user: { id: string; role?: string } }) {
  const userId = session.user.id
  const userRole = (session.user.role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, userRole)
  return { userId, userRole, orgId: scope.activeOrgId }
}

// GET /api/campagnes — campagnes de l'organisation active + avancement.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { orgId } = await ctx(session as unknown as { user: { id: string; role?: string } })
  if (!orgId) return NextResponse.json({ campagnes: [], active: false })
  // Les campagnes portent sur le registre : elles suivent le module registre.
  const cfg = await getOrgConfig(orgId)
  if (!cfg.registreRisquesActive) return NextResponse.json({ campagnes: [], active: false })

  const rows = await prisma.campagne.findMany({
    where: { organizationId: orgId },
    orderBy: [{ createdAt: 'desc' }],
    include: { evaluations: { select: { statut: true } } },
  })
  const campagnes = rows.map(({ evaluations, ...c }) => ({
    ...c,
    avancement: avancementCampagne(evaluations),
  }))
  return NextResponse.json({ campagnes, active: true })
}

// POST /api/campagnes — créer une campagne (BROUILLON, 2ᵉ ligne).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { userId, userRole, orgId } = await ctx(session as unknown as { user: { id: string; role?: string } })
  if (!peutPiloter(userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  if (!orgId) return NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 })
  const cfg = await getOrgConfig(orgId)
  if (!cfg.registreRisquesActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const erreur = validateCampagneInput(body)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanCampagneInput(body)

  const campagne = await prisma.campagne.create({ data: { ...data, organizationId: orgId, statut: 'BROUILLON' } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'campagne', action: 'create', id: campagne.id },
  })
  return NextResponse.json(campagne, { status: 201 })
}
