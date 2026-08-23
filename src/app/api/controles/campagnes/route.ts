import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { type UserRole } from '@/lib/permissions'
import { peutDefinir } from '../route'
import { validateCampagneControleInput, cleanCampagneControleInput, avancementCampagne, campagneEnRetard, type ExecutionControleLite } from '@/lib/campagne-controle'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

async function ctx(session: { user: { id: string; role?: string } }) {
  const userId = session.user.id
  const instanceRole = (session.user.role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  // Rôle EFFECTIF dans l'organisation active (A01/CWE-863).
  return { userId, userRole: scope.role, orgId: scope.activeOrgId }
}

// GET /api/controles/campagnes — campagnes + avancement + contrôles disponibles.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { userRole, orgId } = await ctx(session as unknown as { user: { id: string; role?: string } })
  if (!orgId) return NextResponse.json({ active: false, campagnes: [], controles: [] })
  const cfg = await getOrgConfig(orgId)
  if (!cfg.controlePermanentActive) return NextResponse.json({ active: false, campagnes: [], controles: [] })

  const [rows, controles, execs] = await Promise.all([
    prisma.campagneControle.findMany({ where: { organizationId: orgId }, orderBy: [{ createdAt: 'desc' }] }),
    prisma.controle.findMany({ where: { organizationId: orgId }, select: { id: true, intitule: true, niveau: true, actif: true }, orderBy: [{ intitule: 'asc' }] }),
    prisma.controleExecution.findMany({ where: { organizationId: orgId }, select: { controleId: true, dateRealisation: true, resultat: true } }),
  ])
  const executions: ExecutionControleLite[] = execs.map(e => ({ controleId: e.controleId, dateRealisation: e.dateRealisation, resultat: e.resultat }))
  const now = new Date()

  const campagnes = rows.map(c => {
    const controleIds = Array.isArray(c.controleIds) ? (c.controleIds as string[]) : []
    const av = avancementCampagne({ controleIds, dateDebut: c.dateDebut, dateFin: c.dateFin }, executions)
    return { ...c, controleIds, avancement: av, enRetard: campagneEnRetard({ dateFin: c.dateFin }, av, now) }
  })

  return NextResponse.json({ active: true, campagnes, controles, canDefine: peutDefinir(userRole) })
}

// POST /api/controles/campagnes — crée une campagne (2ᵉ ligne).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { userId, userRole, orgId } = await ctx(session as unknown as { user: { id: string; role?: string } })
  if (!orgId) return NextResponse.json({ error: 'org_absente' }, { status: 400 })
  const cfg = await getOrgConfig(orgId)
  if (!cfg.controlePermanentActive) return NextResponse.json({ error: 'module_inactif' }, { status: 403 })
  if (!peutDefinir(userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const erreur = validateCampagneControleInput(body)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanCampagneControleInput(body)

  const created = await prisma.campagneControle.create({
    data: {
      organizationId: orgId, createdBy: userId,
      intitule: data.intitule, description: data.description,
      niveau: data.niveau, statut: data.statut, recurrence: data.recurrence,
      dateDebut: data.dateDebut, dateFin: data.dateFin, controleIds: data.controleIds,
    },
  })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'campagne-controle', action: 'create', id: created.id },
  })
  return NextResponse.json(created, { status: 201 })
}
