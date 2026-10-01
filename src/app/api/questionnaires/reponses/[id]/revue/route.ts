// POST { revues: [{ questionId, statut, commentaire? }] } : revue par le contrôleur (2ᵉ ligne), jamais
// par le répondant lui-même. Statut résultant : REVUE, ou A_COMPLETER (renvoyée au métier).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditLog, getClientIp } from '@/lib/logger'
import { chargerReponse, refuse } from '@/lib/questionnaire.server'
import { appliquerRevue, peutReviser, type Reponse } from '@/lib/questionnaire'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  const c = await chargerReponse(id)
  if (!c.ctx) return c.response!
  if (!c.ctx.canDefine) return refuse(403, 'forbidden')
  if (c.reponse.repondantId === c.ctx.userId) return refuse(403, 'revue_meme_personne')
  if (!peutReviser(c.reponse.statut)) return refuse(409, 'pas_a_reviser')
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const res = appliquerRevue(c.reponse.reponses as unknown as Reponse[], body.revues, { acteur: c.ctx.userName, now: new Date() })
  if (!res.ok) return refuse(400, res.error)
  const upd = await prisma.questionnaireReponse.updateMany({ where: { id, statut: 'SOUMISE' }, data: { reponses: res.reponses as object[], statut: res.statut, revueLe: new Date(), revueParId: c.ctx.userId } })
  if (!upd.count) return refuse(409, 'pas_a_reviser')
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: c.ctx.userId, userRole: c.ctx.role, organizationId: c.ctx.orgId, ip: getClientIp(req), details: { scope: 'questionnaire', action: 'revue', reponseId: id, statut: res.statut, nonConformes: res.reponses.filter(x => x.revue?.statut === 'NON_CONFORME').length } })
  return NextResponse.json({ ok: true, statut: res.statut })
}
