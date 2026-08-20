import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { type UserRole } from '@/lib/permissions'
import { evaluerReportingIncident } from '@/lib/dora-reporting'
import { type DoraCriteres } from '@/lib/dora'
import { buildDoraItsRow, estDeclarableIts, DORA_ITS_CSV_HEADER } from '@/lib/dora-its-export'

export const dynamic = 'force-dynamic'

// GET /api/reglementaire/dora-its — registre ITS des incidents TIC MAJEURS (CSV).
// État des trois phases de déclaration (art. 19) par incident déclarable.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole

  const scope = await getAnalyseScope(userId, instanceRole)
  const role = scope.role
  const orgId = scope.activeOrgId
  if (!orgId) return NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 })
  if (role === 'LECTEUR' || role === 'METIER') return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const cfg = await getOrgConfig(orgId)
  if (!cfg.reglementaireActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })

  const rows = await prisma.incident.findMany({
    where: { organizationId: orgId, statut: { not: 'REJETE' } },
    select: {
      id: true, intitule: true, dateDetection: true, doraCriteres: true, doraClasseMajeurLe: true,
      doraInitialeSoumiseLe: true, doraIntermediaireSoumiseLe: true, doraFinaleSoumiseLe: true,
    },
    orderBy: [{ dateDetection: 'desc' }],
  })

  const now = new Date()
  const lignes: string[] = []
  for (const r of rows) {
    const reporting = evaluerReportingIncident({
      doraCriteres: (r.doraCriteres ?? {}) as DoraCriteres,
      dateDetection: r.dateDetection,
      doraClasseMajeurLe: r.doraClasseMajeurLe,
      doraInitialeSoumiseLe: r.doraInitialeSoumiseLe,
      doraIntermediaireSoumiseLe: r.doraIntermediaireSoumiseLe,
      doraFinaleSoumiseLe: r.doraFinaleSoumiseLe,
    }, now)
    if (!estDeclarableIts(reporting)) continue
    lignes.push(buildDoraItsRow({ id: r.id, intitule: r.intitule, dateDetection: r.dateDetection, doraClasseMajeurLe: r.doraClasseMajeurLe }, reporting).join(','))
  }

  const csv = '﻿' + [DORA_ITS_CSV_HEADER.join(','), ...lignes].join('\r\n')
  const stamp = now.toISOString().slice(0, 10)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="dora-its-${stamp}.csv"`,
    },
  })
}
