import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { type UserRole } from '@/lib/permissions'
import { mapAnalyseRisques } from '@/lib/risk-publication'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

async function ctx(session: { user: { id: string; role?: string } }) {
  const userId = session.user.id
  const userRole = (session.user.role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, userRole)
  return { userId, userRole, orgId: scope.activeOrgId }
}

// GET /api/risk-items/publish — analyses APPROUVÉES de l'org active, publiables
// vers le registre (avec nombre de risques et nombre déjà publiés).
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { orgId } = await ctx(session as unknown as { user: { id: string; role?: string } })
  if (!orgId) return NextResponse.json({ analyses: [] })
  const orgConfig = await getOrgConfig(orgId)
  if (!orgConfig.registreRisquesActive) return NextResponse.json({ analyses: [] })

  const analyses = await prisma.analyse.findMany({
    where: { organizationId: orgId, statut: 'APPROUVE', deletedAt: null },
    orderBy: [{ approuveLe: 'desc' }],
    select: { id: true, nom: true, organisation: true, approuveLe: true, _count: { select: { risques: true } } },
  })
  // Combien de risques de chaque analyse sont déjà présents dans le registre.
  const publies = await prisma.riskItem.groupBy({
    by: ['sourceId'],
    where: { organizationId: orgId, provenance: 'ACRA', sourceType: 'analyse', sourceId: { not: null } },
    _count: true,
  })
  const risqueIdsParAnalyse = analyses.length
    ? await prisma.risque.findMany({ where: { analyseId: { in: analyses.map(a => a.id) } }, select: { id: true, analyseId: true } })
    : []
  const publiedSourceIds = new Set(publies.map(p => p.sourceId))
  const dejaParAnalyse = new Map<string, number>()
  for (const r of risqueIdsParAnalyse) {
    if (publiedSourceIds.has(r.id)) dejaParAnalyse.set(r.analyseId, (dejaParAnalyse.get(r.analyseId) ?? 0) + 1)
  }

  return NextResponse.json({
    analyses: analyses.map(a => ({
      id: a.id, nom: a.nom, organisation: a.organisation, approuveLe: a.approuveLe,
      risquesCount: a._count.risques, dejaPublies: dejaParAnalyse.get(a.id) ?? 0,
    })),
  })
}

// POST /api/risk-items/publish { analyseId } — publie les risques d'une analyse
// APPROUVÉE dans le registre. Idempotent : upsert par (provenance, sourceType, sourceId).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { userId, userRole, orgId } = await ctx(session as unknown as { user: { id: string; role?: string } })
  if (userRole === 'LECTEUR') return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  if (!orgId) return NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 })
  const orgConfig = await getOrgConfig(orgId)
  if (!orgConfig.registreRisquesActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const analyseId = typeof body.analyseId === 'string' ? body.analyseId : ''
  if (!analyseId) return NextResponse.json({ error: 'analyse_requise' }, { status: 400 })

  const analyse = await prisma.analyse.findFirst({
    where: { id: analyseId, organizationId: orgId, deletedAt: null },
    select: { id: true, nom: true, organisation: true, statut: true, risques: {
      select: { id: true, nom: true, description: true, gravite: true, vraisemblance: true, graviteResiduelle: true, vraisemblanceResiduelle: true },
    } },
  })
  if (!analyse) return NextResponse.json({ error: 'analyse_introuvable' }, { status: 404 })
  if (analyse.statut !== 'APPROUVE') return NextResponse.json({ error: 'analyse_non_approuvee' }, { status: 400 })

  const items = mapAnalyseRisques(analyse.risques, { id: analyse.id, nom: analyse.nom, organisation: analyse.organisation })
  let crees = 0, maj = 0
  for (const item of items) {
    const existing = await prisma.riskItem.findFirst({
      where: { organizationId: orgId, provenance: 'ACRA', sourceType: 'analyse', sourceId: item.sourceId },
      select: { id: true },
    })
    if (existing) {
      // On rafraîchit la cotation/intitulé mais on PRÉSERVE le statut décidé dans le registre.
      await prisma.riskItem.update({
        where: { id: existing.id },
        data: {
          intitule: item.intitule, description: item.description, entite: item.entite,
          graviteInherente: item.graviteInherente, vraisemblanceInherente: item.vraisemblanceInherente,
          graviteResiduelle: item.graviteResiduelle, vraisemblanceResiduelle: item.vraisemblanceResiduelle,
        },
      })
      maj++
    } else {
      await prisma.riskItem.create({ data: { ...item, organizationId: orgId } })
      crees++
    }
  }
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId, userRole, ip: getClientIp(req), details: { scope: 'risk-item', action: 'publish', analyseId, crees, maj } })
  return NextResponse.json({ ok: true, crees, maj, total: items.length })
}
