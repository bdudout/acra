// GET : une réponse (son répondant, ou la 2ᵉ ligne). PUT { reponses } : enregistrement en brouillon par
// le répondant, tant que la réponse est à répondre / à compléter et l'envoi ouvert.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { chargerReponse, refuse } from '@/lib/questionnaire.server'
import { peutRepondre, sanitizeQuestions, sanitizeReponses, type Reponse } from '@/lib/questionnaire'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }


export async function GET(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  const c = await chargerReponse(id)
  if (!c.ctx) return c.response!
  const { envoi, ...reponse } = c.reponse
  return NextResponse.json({ reponse, envoi: { id: envoi.id, titre: envoi.titre, questions: sanitizeQuestions(envoi.questions), echeance: envoi.echeance, statut: envoi.statut }, estRepondant: reponse.repondantId === c.ctx.userId })
}

export async function PUT(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  const c = await chargerReponse(id)
  if (!c.ctx) return c.response!
  if (c.reponse.repondantId !== c.ctx.userId) return refuse(403, 'forbidden')
  if (!peutRepondre(c.reponse.statut) || c.reponse.envoi.statut !== 'OUVERT') return refuse(409, 'reponse_figee')
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const reponses = sanitizeReponses(sanitizeQuestions(c.reponse.envoi.questions), body.reponses, c.reponse.reponses as unknown as Reponse[])
  await prisma.questionnaireReponse.update({ where: { id }, data: { reponses: reponses as object[] } })
  return NextResponse.json({ ok: true, reponses })
}
