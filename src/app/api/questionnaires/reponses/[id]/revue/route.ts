// POST { revues: [{ questionId, statut, commentaire? }] } : revue par le contrôleur (2ᵉ ligne), jamais
// par le répondant lui-même. Statut résultant : REVUE, ou A_COMPLETER (renvoyée au métier).
// Revue conclue (REVUE) : chaque question NON_CONFORME rattachée à un point de contrôle actif de
// l'organisation enregistre une exécution ANOMALIE de ce contrôle (source QUESTIONNAIRE), dans la
// même transaction ; la préconisation reste facultative.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditLog, getClientIp } from '@/lib/logger'
import { chargerReponse, refuse } from '@/lib/questionnaire.server'
import { appliquerRevue, peutReviser, anomaliesControles, sanitizeQuestions, type Reponse } from '@/lib/questionnaire'
import { getServerT } from '@/lib/i18n'

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
  const now = new Date()
  const anomalies = res.statut === 'REVUE' ? anomaliesControles(sanitizeQuestions(c.reponse.envoi.questions), res.reponses) : []
  const actifs = anomalies.length
    ? new Set((await prisma.controle.findMany({ where: { organizationId: c.ctx.orgId, actif: true, id: { in: [...new Set(anomalies.map(a => a.controleId))] } }, select: { id: true } })).map(x => x.id))
    : new Set<string>()
  const libelle = (await getServerT()).questionnaires.constatExecution
  const executions = await prisma.$transaction(async tx => {
    const upd = await tx.questionnaireReponse.updateMany({ where: { id, statut: 'SOUMISE' }, data: { reponses: res.reponses as object[], statut: res.statut, revueLe: now, revueParId: c.ctx.userId } })
    if (!upd.count) return null
    const ids: string[] = []
    for (const a of anomalies.filter(x => actifs.has(x.controleId))) {
      const e = await tx.controleExecution.create({
        data: {
          controleId: a.controleId, organizationId: c.ctx.orgId, resultat: 'ANOMALIE', dateRealisation: now, source: 'QUESTIONNAIRE',
          constat: libelle.replace('{titre}', c.reponse.envoi.titre).replace('{question}', a.libelle).replace('{commentaire}', a.commentaire).slice(0, 5000),
          preuves: a.preuves as unknown as object, executantId: c.ctx.userId,
        },
      })
      // Nouvelle exécution ⇒ nouvelle période : l'alerte d'échéance du contrôle peut repartir.
      await tx.controle.update({ where: { id: a.controleId }, data: { alerteeLe: null } })
      ids.push(e.id)
    }
    return ids
  })
  if (!executions) return refuse(409, 'pas_a_reviser')
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: c.ctx.userId, userRole: c.ctx.role, organizationId: c.ctx.orgId, ip: getClientIp(req), details: { scope: 'questionnaire', action: 'revue', reponseId: id, statut: res.statut, nonConformes: res.reponses.filter(x => x.revue?.statut === 'NON_CONFORME').length, executionsAnomalie: executions.length } })
  return NextResponse.json({ ok: true, statut: res.statut, executionsAnomalie: executions.length })
}
