import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { classifierIncident, estEvalueDora, synthetiserDora, synthetiserLdc, type DoraCriteres, type DoraClasse } from '@/lib/dora'
import { toCsvCell } from '@/lib/spreadsheet-safe'

export const dynamic = 'force-dynamic'

// L'ÉVALUATION DORA (classification réglementaire) relève de la gouvernance,
// comme la qualification d'incident.
export function peutEvaluerDora(role: UserRole): boolean {
  return isAdminRole(role) || role === 'RISK_MANAGER' || role === 'RSSI'
}

const num = (v: unknown): number | null => (v == null ? null : Number(v as unknown as string))

// GET /api/reglementaire/dora — registre d'incidents TIC (DORA) + LDC (ACPR).
// ?format=csv exporte le registre classé (durci CWE-1236).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const userRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, userRole)
  if (!scope.activeOrgId) return NextResponse.json({ active: false, incidents: [] })
  const cfg = await getOrgConfig(scope.activeOrgId)
  if (!cfg.reglementaireActive) return NextResponse.json({ active: false, incidents: [] })

  const orgId = scope.activeOrgId
  const rows = await prisma.incident.findMany({
    where: { organizationId: orgId },
    orderBy: [{ createdAt: 'desc' }],
    select: {
      id: true, intitule: true, statut: true, dateSurvenance: true, createdAt: true,
      montantBrut: true, recuperations: true, doraCriteres: true,
    },
  })

  const incidents = rows.map(r => {
    const criteres = (r.doraCriteres ?? {}) as DoraCriteres
    const evalue = estEvalueDora(criteres)
    const ev = classifierIncident(criteres)
    return {
      id: r.id, intitule: r.intitule, statut: r.statut,
      dateSurvenance: r.dateSurvenance, declareLe: r.createdAt,
      montantBrut: num(r.montantBrut), recuperations: num(r.recuperations),
      criteres, evalue,
      classe: evalue ? ev.classe : null,
      declenches: evalue ? ev.declenches : [],
    }
  })

  const classesEvaluees: DoraClasse[] = incidents.filter(i => i.evalue && i.classe).map(i => i.classe as DoraClasse)
  const synthese = synthetiserDora(classesEvaluees)
  const ldc = synthetiserLdc(rows.map(r => ({ montantBrut: num(r.montantBrut), recuperations: num(r.recuperations), statut: r.statut })))

  // Export CSV du registre classé (incidents évalués).
  if (new URL(req.url).searchParams.get('format') === 'csv') {
    const head = ['id', 'intitule', 'statut', 'dateSurvenance', 'classeDORA', 'criteresDeclenches', 'montantBrut', 'recuperations']
    const jour = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : '')
    const lignes = incidents.filter(i => i.evalue).map(i => [
      i.id, i.intitule, i.statut, jour(i.dateSurvenance), i.classe ?? '',
      i.declenches.join('|'), i.montantBrut ?? '', i.recuperations ?? '',
    ].map(toCsvCell).join(','))
    const csv = '﻿' + [head.join(','), ...lignes].join('\r\n')
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="registre-dora.csv"',
      },
    })
  }

  return NextResponse.json({ active: true, incidents, synthese, ldc, canAssess: peutEvaluerDora(userRole) })
}
