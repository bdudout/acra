import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateApiRequest } from '@/lib/api-auth.server'
import { perteNette as calcPerteNette } from '@/lib/incident'

export const dynamic = 'force-dynamic'

// GET /api/v1/incidents — incidents & pertes (LDC) de l'organisation — scope read.
export async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req, 'read')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const rows = await prisma.incident.findMany({
    where: { organizationId: auth.organizationId },
    orderBy: [{ createdAt: 'desc' }],
    select: {
      id: true, intitule: true, description: true, statut: true, taxonomieCode: true,
      entite: true, dateSurvenance: true, dateDetection: true,
      montantBrut: true, recuperations: true, createdAt: true,
    },
  })
  const num = (v: unknown) => (v == null ? null : Number(v))
  const data = rows.map(r => {
    const brut = num(r.montantBrut), recup = num(r.recuperations)
    return {
      id: r.id, intitule: r.intitule, description: r.description, statut: r.statut,
      categorie: r.taxonomieCode, entite: r.entite,
      dateSurvenance: r.dateSurvenance, dateDetection: r.dateDetection,
      montantBrut: brut, recuperations: recup, perteNette: calcPerteNette(brut, recup),
      createdAt: r.createdAt,
    }
  })
  return NextResponse.json({ data, count: data.length })
}
