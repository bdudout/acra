import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { type UserRole } from '@/lib/permissions'
import { niveauRisque } from '@/lib/risk-item'
import { summarizeActions } from '@/lib/risk-action'
import { applyFilters, parseFilters } from '@/lib/risk-filters'
import { toCsvCell } from '@/lib/spreadsheet-safe'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const HEADERS = [
  'intitule', 'categorie', 'processus', 'entite', 'proprietaire', 'statut', 'provenance',
  'graviteInherente', 'vraisemblanceInherente', 'niveauInherent',
  'graviteResiduelle', 'vraisemblanceResiduelle', 'niveauResiduel',
  'actionsTotal', 'actionsFaites', 'actionsEnRetard', 'tauxAvancement', 'creeLe',
]

// GET /api/risk-items/export — export CSV du registre de l'organisation active.
// Applique EXACTEMENT les mêmes filtres que l'affichage (lib/risk-filters), afin
// que l'export corresponde à ce que l'utilisateur voit. Injection de formules
// neutralisée via toCsvCell (CWE-1236), comme les autres exports.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const userRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole

  const scope = await getAnalyseScope(userId, userRole)
  const orgId = scope.activeOrgId
  if (!orgId) return NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 })
  const orgConfig = await getOrgConfig(orgId)
  if (!orgConfig.registreRisquesActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })

  const rows = await prisma.riskItem.findMany({
    where: { organizationId: orgId },
    orderBy: [{ createdAt: 'desc' }],
    include: { processus: { select: { nom: true } }, actions: { select: { statut: true, echeance: true } } },
  })

  const now = new Date()
  const enriched = rows.map(r => ({
    ...r,
    processusNom: r.processus?.nom ?? null,
    niveauInherent: niveauRisque(r.graviteInherente, r.vraisemblanceInherente),
    niveauResiduel: niveauRisque(r.graviteResiduelle, r.vraisemblanceResiduelle),
    actionsSummary: summarizeActions(r.actions, now),
  }))

  const { searchParams } = new URL(req.url)
  const filtered = applyFilters(enriched, parseFilters(searchParams))

  const lignes = filtered.map(r => [
    r.intitule, r.taxonomieCode ?? '', r.processusNom ?? '', r.entite ?? '', r.proprietaire ?? '', r.statut, r.provenance,
    r.graviteInherente ?? '', r.vraisemblanceInherente ?? '', r.niveauInherent ?? '',
    r.graviteResiduelle ?? '', r.vraisemblanceResiduelle ?? '', r.niveauResiduel ?? '',
    r.actionsSummary.total, r.actionsSummary.faits, r.actionsSummary.enRetard, r.actionsSummary.tauxAvancement,
    r.createdAt.toISOString().slice(0, 10),
  ].map(toCsvCell).join(','))

  // BOM UTF-8 : Excel reconnaît l'encodage et affiche correctement les accents.
  const csv = '﻿' + [HEADERS.join(','), ...lignes].join('\r\n')

  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'risk-item', action: 'export', lignes: filtered.length },
  })

  const stamp = now.toISOString().slice(0, 10)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="acra-registre-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
