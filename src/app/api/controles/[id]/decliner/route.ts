import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAccessibleOrgIds, getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { peutDefinir, type UserRole } from '@/lib/permissions'
import { donneesDeclinaison, planDeclinaison } from '@/lib/controle-reseau'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// POST /api/controles/[id]/decliner — fait du contrôle un contrôle « de référence » et le décline dans les entités
// descendantes visibles (body facultatif : { organizationIds }). Idempotent ; n'écrase jamais une déclinaison.
// Spec : docs/specs/protection-sociale-specs.md (P3).
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const { id } = await params

  const ref = await prisma.controle.findUnique({ where: { id } })
  const acces = await getAccessibleOrgIds(userId, instanceRole)
  const visible = (orgId: string) => acces.all || acces.ids.includes(orgId)
  if (!ref || !visible(ref.organizationId)) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  const cfg = await getOrgConfig(ref.organizationId)
  if (!cfg.controlePermanentActive) return NextResponse.json({ error: 'Module inactif' }, { status: 403 })
  // Rôle EFFECTIF dans l'organisation mère : définir le plan de contrôle du réseau relève de la 2ᵉ ligne.
  const role = ((await getEffectiveRoleForOrg(userId, instanceRole, ref.organizationId)) ?? instanceRole) as UserRole
  if (!peutDefinir(role, { secondeLigneActive: cfg.secondeLigneActive })) return NextResponse.json({ error: 'Action non autorisée' }, { status: 403 })
  if (ref.referenceId) return NextResponse.json({ error: 'deja_declinaison' }, { status: 409 })

  const mere = await prisma.organization.findUnique({ where: { id: ref.organizationId }, select: { path: true } })
  if (!mere?.path || mere.path === '/') return NextResponse.json({ error: 'sans_entites' }, { status: 409 })
  const orgs = await prisma.organization.findMany({ where: { path: { startsWith: mere.path }, actif: true }, select: { id: true, path: true } })
  const descendantsVisibles = orgs.filter(o => o.path !== mere.path && visible(o.id)).map(o => o.id)

  const body = await req.json().catch(() => ({})) as { organizationIds?: unknown }
  const demandees = Array.isArray(body.organizationIds)
    ? body.organizationIds.filter((v): v is string => typeof v === 'string' && descendantsVisibles.includes(v))
    : descendantsVisibles
  const existants = (await prisma.controle.findMany({ where: { referenceId: ref.id }, select: { organizationId: true } })).map(c => c.organizationId)
  const plan = planDeclinaison(mere.path, orgs, demandees, existants)

  const crees: string[] = []
  const ignores: { organizationId: string; raison: string }[] = []
  for (const orgId of plan) {
    if (!(await getOrgConfig(orgId)).controlePermanentActive) { ignores.push({ organizationId: orgId, raison: 'module_inactif' }); continue }
    try {
      await prisma.controle.create({ data: donneesDeclinaison(ref as unknown as { id: string } & Record<string, unknown>, orgId) as never })
      crees.push(orgId)
    } catch {
      // Course avec un autre appel : l'unicité (organisation, référence) garantit une seule déclinaison.
      ignores.push({ organizationId: orgId, raison: 'deja_declinee' })
    }
  }
  if (!ref.estReference) await prisma.controle.update({ where: { id: ref.id }, data: { estReference: true } })
  await auditLog('CONTROLE_DECLINE', { userId, userRole: role, targetId: ref.id, targetType: 'controle', ip: getClientIp(req), details: { intitule: ref.intitule, crees: crees.length, ignores: ignores.length } })
  return NextResponse.json({ crees, ignores, dejaDeclinees: demandees.filter(o => existants.includes(o)).length })
}
