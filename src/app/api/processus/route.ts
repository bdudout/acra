import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { isAdminRole } from '@/lib/permissions'
import { requireSession } from '@/lib/route-guard.server'
import { withAccess } from '@/lib/with-access.server'
import { validateProcessusInput, cleanProcessus } from '@/lib/processus'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// GET /api/processus — liste des processus de l'organisation active (arbre plat).
// Sans organisation active : liste vide (pas de 400) → requireSession.
export async function GET() {
  const g = await requireSession()
  if (g.error) return g.error
  const { activeOrgId: orgId } = await getAnalyseScope(g.user.id, g.user.role)
  if (!orgId) return NextResponse.json({ processus: [], active: false })
  const orgConfig = await getOrgConfig(orgId)
  const processus = orgConfig.registreRisquesActive
    ? await prisma.processus.findMany({
        where: { organizationId: orgId },
        orderBy: [{ ordre: 'asc' }, { nom: 'asc' }],
        select: { id: true, parentId: true, nom: true, description: true, proprietaire: true, criticite: true, criticiteDora: true, rtoMinutes: true, rpoMinutes: true, ordre: true, actif: true, derniereRevue: true, createdAt: true },
      })
    : []
  return NextResponse.json({ processus, active: orgConfig.registreRisquesActive })
}

// POST /api/processus — créer un processus (ADMIN, module registre actif).
// Rôle EFFECTIF dans l'organisation active (pas le rôle d'instance) → A01/CWE-863.
export const POST = withAccess({ org: 'active', allow: isAdminRole, rateLimit: { bucket: 'processus' } }, async (req, { user, role: userRole, orgId }) => {
  const userId = user.id
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
})
