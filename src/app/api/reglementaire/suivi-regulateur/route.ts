import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { type UserRole } from '@/lib/permissions'
import {
  synthetiserSuiviRegulateur, prochaineEcheanceRegulateur,
  suiviRegulateurToCsvRow, SUIVI_REGULATEUR_CSV_HEADER, type ConstatRegulateur,
} from '@/lib/suivi-regulateur'

export const dynamic = 'force-dynamic'

async function ctx(session: { user: { id: string; role?: string } }) {
  const userId = session.user.id
  const instanceRole = (session.user.role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  // Rôle EFFECTIF dans l'organisation active (A01/CWE-863).
  return { userId, userRole: scope.role, orgId: scope.activeOrgId }
}

// GET /api/reglementaire/suivi-regulateur — vue CONSOLIDÉE des constats REGULATEUR
// (inter-missions) + synthèse prudentielle. ?format=csv exporte (durci CWE-1236).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { orgId } = await ctx(session as unknown as { user: { id: string; role?: string } })
  if (!orgId) return NextResponse.json({ active: false, constats: [] })
  const cfg = await getOrgConfig(orgId)
  if (!cfg.reglementaireActive) return NextResponse.json({ active: false, constats: [] })

  const rows = await prisma.auditConstat.findMany({
    where: { organizationId: orgId, source: 'REGULATEUR' },
    include: { mission: { select: { intitule: true } } },
    orderBy: [{ echeance: 'asc' }, { criticite: 'desc' }],
  })
  const constats: ConstatRegulateur[] = rows.map(r => ({
    id: r.id, intitule: r.intitule, description: r.description, recommandation: r.recommandation,
    criticite: r.criticite, source: r.source, statut: r.statut, echeance: r.echeance,
    responsableAction: r.responsableAction, missionIntitule: r.mission?.intitule ?? null,
  }))

  if (new URL(req.url).searchParams.get('format') === 'csv') {
    const lignes = constats.map(c => suiviRegulateurToCsvRow(c).join(','))
    const csv = '﻿' + [SUIVI_REGULATEUR_CSV_HEADER.join(','), ...lignes].join('\r\n')
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="suivi-regulateur.csv"',
      },
    })
  }

  const prochaine = prochaineEcheanceRegulateur(constats)
  return NextResponse.json({
    active: true,
    constats,
    synthese: synthetiserSuiviRegulateur(constats),
    prochaineEcheance: prochaine ? prochaine.toISOString() : null,
  })
}
