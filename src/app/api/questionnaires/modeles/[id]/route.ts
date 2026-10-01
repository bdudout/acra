// PATCH : titre, description, questions, actif (les envois déjà faits gardent leur instantané).
// DELETE : suppression du modèle (les envois existants sont conservés).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditLog, getClientIp } from '@/lib/logger'
import { questionnaireContext, refuse } from '@/lib/questionnaire.server'
import { sanitizeQuestions } from '@/lib/questionnaire'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

async function charger(id: string) {
  const r = await questionnaireContext()
  if (!r.ok) return { response: r.response }
  if (!r.ctx.canDefine) return { response: refuse(403, 'forbidden') }
  const modele = await prisma.questionnaireModele.findFirst({ where: { id, organizationId: r.ctx.orgId } })
  if (!modele) return { response: refuse(404, 'not_found') }
  return { ctx: r.ctx, modele }
}

export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  const c = await charger(id)
  if (!c.ctx) return c.response!
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const data: Record<string, unknown> = {}
  if ('titre' in body) {
    const titre = typeof body.titre === 'string' ? body.titre.trim().slice(0, 200) : ''
    if (!titre) return refuse(400, 'titre_requis')
    data.titre = titre
  }
  if ('description' in body) data.description = typeof body.description === 'string' && body.description.trim() ? body.description.trim().slice(0, 4000) : null
  if ('questions' in body) {
    const questions = sanitizeQuestions(body.questions)
    if (!questions.length) return refuse(400, 'questions_requises')
    data.questions = questions
  }
  if ('actif' in body) data.actif = body.actif !== false
  const modele = await prisma.questionnaireModele.update({ where: { id }, data })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: c.ctx.userId, userRole: c.ctx.role, organizationId: c.ctx.orgId, ip: getClientIp(req), details: { scope: 'questionnaire', action: 'modele-update', id, fields: Object.keys(data) } })
  return NextResponse.json({ modele })
}

export async function DELETE(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  const c = await charger(id)
  if (!c.ctx) return c.response!
  await prisma.questionnaireModele.delete({ where: { id } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: c.ctx.userId, userRole: c.ctx.role, organizationId: c.ctx.orgId, ip: getClientIp(req), details: { scope: 'questionnaire', action: 'modele-delete', id } })
  return NextResponse.json({ ok: true })
}
