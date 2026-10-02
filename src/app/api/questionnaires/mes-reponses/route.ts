// GET : questionnaires adressés à l'utilisateur dans l'organisation active (répondant, 1ʳᵉ ligne).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { questionnaireContext } from '@/lib/questionnaire.server'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  const r = await questionnaireContext()
  if (!r.ok) return r.response
  const reponses = await prisma.questionnaireReponse.findMany({
    where: { organizationId: r.ctx.orgId, repondantId: r.ctx.userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, statut: true, soumiseLe: true, revueLe: true, envoi: { select: { titre: true, echeance: true, statut: true } } },
  })
  return NextResponse.json({ reponses })
}
