// POST : soumission par le répondant (complétude vérifiée : réponses obligatoires et preuves requises).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditLog, getClientIp } from '@/lib/logger'
import { chargerReponse, refuse } from '@/lib/questionnaire.server'
import { peutRepondre, questionsIncompletes, sanitizeQuestions, type Reponse } from '@/lib/questionnaire'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  const c = await chargerReponse(id)
  if (!c.ctx) return c.response!
  if (c.reponse.repondantId !== c.ctx.userId) return refuse(403, 'forbidden')
  if (!peutRepondre(c.reponse.statut) || c.reponse.envoi.statut !== 'OUVERT') return refuse(409, 'reponse_figee')
  const manquantes = questionsIncompletes(sanitizeQuestions(c.reponse.envoi.questions), c.reponse.reponses as unknown as Reponse[])
  if (manquantes.length) return NextResponse.json({ error: 'reponse_incomplete', questions: manquantes }, { status: 400 })
  // Écriture conditionnelle : deux soumissions simultanées n'en produisent qu'une.
  const res = await prisma.questionnaireReponse.updateMany({ where: { id, statut: c.reponse.statut }, data: { statut: 'SOUMISE', soumiseLe: new Date() } })
  if (!res.count) return refuse(409, 'reponse_figee')
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: c.ctx.userId, userRole: c.ctx.role, organizationId: c.ctx.orgId, ip: getClientIp(req), details: { scope: 'questionnaire', action: 'soumission', reponseId: id, envoiId: c.reponse.envoiId } })
  return NextResponse.json({ ok: true, statut: 'SOUMISE' })
}
