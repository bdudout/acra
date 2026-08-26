import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateApiRequest } from '@/lib/api-auth.server'
import { prochaineEcheance, etatEcheance, evaluerEfficacite, type Periodicite } from '@/lib/controle'

export const dynamic = 'force-dynamic'

// GET /api/v1/controls — bibliothèque de contrôles (échéance + efficacité) — scope read.
export async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req, 'read')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const rows = await prisma.controle.findMany({
    where: { organizationId: auth.organizationId },
    orderBy: [{ actif: 'desc' }, { createdAt: 'desc' }],
    include: { executions: { orderBy: { dateRealisation: 'desc' }, select: { resultat: true, dateRealisation: true } } },
  })
  const now = new Date()
  const data = rows.map(({ executions, ...c }) => {
    const derniere = executions[0]?.dateRealisation ?? null
    const echeance = prochaineEcheance(c.periodicite as Periodicite, derniere, c.createdAt)
    const eff = evaluerEfficacite(executions)
    return {
      id: c.id, intitule: c.intitule, niveau: c.niveau, periodicite: c.periodicite,
      responsable: c.responsable, actif: c.actif, referentielCode: c.referentielCode,
      derniereExecution: derniere, prochaineEcheance: echeance,
      etatEcheance: c.actif ? etatEcheance(echeance, now) : null,
      tauxConformite: eff.tauxConformite, efficacite: eff.efficacite, nbExecutions: executions.length,
    }
  })
  return NextResponse.json({ data, count: data.length })
}
