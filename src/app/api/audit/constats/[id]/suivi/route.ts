import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { appliquerSuivi, type SuiviCommande } from '@/lib/audit-l4'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const ACTIONS = ['DECLARER_REALISE', 'VERIFIER', 'REOUVRIR', 'DEMANDER_REPORT', 'DECIDER_REPORT']

// POST /api/audit/constats/[id]/suivi — suivi d'une recommandation. L'AUDITÉ (tout rôle sauf lecteur)
// déclare la réalisation et demande un report ; l'AUDIT (auditeur, admin) vérifie, rouvre et décide
// des reports. Le lecteur consulte seulement.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const scope = await getAnalyseScope(userId, ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole)
  const role = scope.role as UserRole
  const { id } = await params
  const orgIds = scope.scope.isSuperAdmin ? null : scope.scope.visibleOrgIds
  const constat = await prisma.auditConstat.findFirst({
    where: { id, ...(orgIds ? { organizationId: { in: orgIds } } : {}) },
    select: { id: true, organizationId: true, statut: true, echeance: true, echeanceInitiale: true, reports: true, realiseePar: true },
  })
  if (!constat) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const cfg = await getOrgConfig(constat.organizationId)
  if (!cfg.auditInterneActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })
  if (role === 'LECTEUR') return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  if (!ACTIONS.includes(body.action)) return NextResponse.json({ error: 'action_invalide' }, { status: 400 })
  const auditeur = role === 'AUDITEUR' || isAdminRole(role)
  const r = appliquerSuivi(constat, body as SuiviCommande, { acteur: userId, auditeur, now: new Date() })
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })

  const patch = r.patch as Prisma.AuditConstatUncheckedUpdateInput
  if (patch.reports !== undefined) patch.reports = patch.reports as unknown as Prisma.InputJsonValue
  const updated = await prisma.auditConstat.update({ where: { id }, data: patch })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole: role, organizationId: constat.organizationId, ip: getClientIp(req),
    details: { scope: 'audit', action: `recommandation:${body.action}`, id },
  })
  return NextResponse.json(updated)
}
