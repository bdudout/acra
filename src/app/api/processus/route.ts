import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { validateProcessusInput, cleanProcessus } from '@/lib/processus'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// Contexte commun : session + organisation active + garde module.
async function ctx(session: { user: { id: string; role?: string } }) {
  const userId = session.user.id
  const userRole = (session.user.role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, userRole)
  return { userId, userRole, orgId: scope.activeOrgId }
}

// GET /api/processus — liste des processus de l'organisation active (arbre plat).
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { orgId } = await ctx(session as unknown as { user: { id: string; role?: string } })
  if (!orgId) return NextResponse.json({ processus: [], active: false })
  const orgConfig = await getOrgConfig(orgId)
  const processus = orgConfig.registreRisquesActive
    ? await prisma.processus.findMany({
        where: { organizationId: orgId },
        orderBy: [{ ordre: 'asc' }, { nom: 'asc' }],
        select: { id: true, parentId: true, nom: true, description: true, proprietaire: true, criticite: true, ordre: true, actif: true },
      })
    : []
  return NextResponse.json({ processus, active: orgConfig.registreRisquesActive })
}

// POST /api/processus — créer un processus (ADMIN, module registre actif).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { userId, userRole, orgId } = await ctx(session as unknown as { user: { id: string; role?: string } })
  if (!isAdminRole(userRole)) return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })
  if (!orgId) return NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 })
  const orgConfig = await getOrgConfig(orgId)
  if (!orgConfig.registreRisquesActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const erreur = validateProcessusInput(body)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanProcessus(body)
  // Un parent éventuel doit appartenir à la même organisation.
  if (data.parentId) {
    const parent = await prisma.processus.findFirst({ where: { id: data.parentId, organizationId: orgId }, select: { id: true } })
    if (!parent) return NextResponse.json({ error: 'parent_invalide' }, { status: 400 })
  }
  const processus = await prisma.processus.create({ data: { ...data, organizationId: orgId } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId, userRole, ip: getClientIp(req), details: { scope: 'processus', action: 'create', id: processus.id, nom: data.nom } })
  return NextResponse.json(processus, { status: 201 })
}
