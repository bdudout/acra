// GET : envoi, questions et réponses (avec le nom des répondants) pour la revue — 2ᵉ ligne.
// PATCH { statut: 'CLOTURE' | 'OUVERT' } : clôture / réouverture de l'envoi.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditLog, getClientIp } from '@/lib/logger'
import { questionnaireContext, refuse } from '@/lib/questionnaire.server'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  const r = await questionnaireContext()
  if (!r.ok) return r.response
  if (!r.ctx.canDefine) return refuse(403, 'forbidden')
  const envoi = await prisma.questionnaireEnvoi.findFirst({ where: { id, organizationId: r.ctx.orgId }, include: { reponses: { orderBy: { createdAt: 'asc' } } } })
  if (!envoi) return refuse(404, 'not_found')
  const users = await prisma.user.findMany({ where: { id: { in: envoi.reponses.map(x => x.repondantId) } }, select: { id: true, name: true, email: true } })
  const nom = new Map(users.map(u => [u.id, u.name ?? u.email]))
  return NextResponse.json({ envoi: { ...envoi, reponses: envoi.reponses.map(x => ({ ...x, repondant: nom.get(x.repondantId) ?? '—' })) } })
}

export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  const r = await questionnaireContext()
  if (!r.ok) return r.response
  if (!r.ctx.canDefine) return refuse(403, 'forbidden')
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  if (body.statut !== 'CLOTURE' && body.statut !== 'OUVERT') return refuse(400, 'statut_invalide')
  const res = await prisma.questionnaireEnvoi.updateMany({ where: { id, organizationId: r.ctx.orgId }, data: { statut: body.statut } })
  if (!res.count) return refuse(404, 'not_found')
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: r.ctx.userId, userRole: r.ctx.role, organizationId: r.ctx.orgId, ip: getClientIp(req), details: { scope: 'questionnaire', action: 'envoi-statut', id, statut: body.statut } })
  return NextResponse.json({ ok: true })
}
