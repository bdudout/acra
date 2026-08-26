import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateApiRequest } from '@/lib/api-auth.server'
import { niveauRisque } from '@/lib/risk-item'

export const dynamic = 'force-dynamic'

// GET /api/v1/risks — registre de risques de l'organisation de la clé (scope read).
export async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req, 'read')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const rows = await prisma.riskItem.findMany({
    where: { organizationId: auth.organizationId },
    orderBy: [{ createdAt: 'desc' }],
    select: {
      id: true, intitule: true, description: true, taxonomieCode: true, proprietaire: true,
      graviteInherente: true, vraisemblanceInherente: true,
      graviteResiduelle: true, vraisemblanceResiduelle: true, statut: true, createdAt: true,
    },
  })
  const data = rows.map(r => ({
    id: r.id, intitule: r.intitule, description: r.description,
    categorie: r.taxonomieCode, proprietaire: r.proprietaire, statut: r.statut,
    niveauInherent: niveauRisque(r.graviteInherente, r.vraisemblanceInherente),
    niveauResiduel: niveauRisque(r.graviteResiduelle, r.vraisemblanceResiduelle),
    cotation: {
      graviteInherente: r.graviteInherente, vraisemblanceInherente: r.vraisemblanceInherente,
      graviteResiduelle: r.graviteResiduelle, vraisemblanceResiduelle: r.vraisemblanceResiduelle,
    },
    createdAt: r.createdAt,
  }))
  return NextResponse.json({ data, count: data.length })
}
