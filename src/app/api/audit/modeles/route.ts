// GET /api/audit/modeles?locale=fr — modèles de mission (programmes par référentiel + missions types du
// catalogue des secteurs de l'organisation), avec les processus et risques de l'organisation issus du
// catalogue (pour préremplir le périmètre). Lecture seule ; réservé aux rôles qui écrivent l'audit.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { peutEcrireAudit, type UserRole } from '@/lib/permissions'
import { listAuditTemplates } from '@/lib/audit-templates'
import { orgSectors } from '@/lib/sector-context.server'
import type { CatalogueLocale } from '@/lib/sector-suggestions'

export const dynamic = 'force-dynamic'
const LOCALES: CatalogueLocale[] = ['fr', 'en', 'de', 'es', 'it']

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const scope = await getAnalyseScope(userId, ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole)
  if (!scope.activeOrgId) return NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 })
  if (!(await getOrgConfig(scope.activeOrgId)).auditInterneActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })
  if (!peutEcrireAudit(scope.role)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const requested = new URL(req.url).searchParams.get('locale') as CatalogueLocale
  const locale = LOCALES.includes(requested) ? requested : 'fr'
  const { effective } = await orgSectors(scope.activeOrgId)
  const [processes, risks] = await Promise.all([
    prisma.processus.findMany({ where: { organizationId: scope.activeOrgId, catalogueKey: { not: null } }, select: { id: true, catalogueKey: true } }),
    prisma.riskItem.findMany({ where: { organizationId: scope.activeOrgId, catalogueKey: { not: null } }, select: { catalogueKey: true } }),
  ])
  return NextResponse.json({
    ...listAuditTemplates(effective, locale),
    ownedProcesses: Object.fromEntries(processes.map(p => [p.catalogueKey!, p.id])),
    ownedRiskKeys: risks.map(r => r.catalogueKey!),
  })
}
