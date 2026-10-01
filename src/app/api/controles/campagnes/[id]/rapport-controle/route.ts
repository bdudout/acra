// ─── Rapport de contrôle d'une mission de contrôle permanent ─────────────────
// GET : document Word compilant, pour la campagne (mission), les exécutions des
// contrôles du périmètre dans la fenêtre de la mission, les questionnaires envoyés
// au titre de la mission (taux de réponse, non-conformités relevées en revue), les
// préconisations et leur suivi (plans d'action liés, acceptations de risque).
// 2ᵉ ligne uniquement ; rate limit d'export ; journal EXPORT.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerT, getServerLocale } from '@/lib/i18n'
import { questionnaireContext, refuse } from '@/lib/questionnaire.server'
import { sanitizeQuestions, type Reponse } from '@/lib/questionnaire'
import { rapportMissionControleMarkdown, type MissionControleRapportData } from '@/lib/rapport-mission-controle'
import { markdownToDocxBuffer } from '@/lib/markdown-docx'
import { auditLog, getClientIp } from '@/lib/logger'
import { rateLimit, rateLimitHeaders, LIMIT_EXPORT } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const r = await questionnaireContext()
  if (!r.ok) return r.response
  const { ctx } = r
  if (!ctx.canDefine) return refuse(403, 'forbidden')
  const { id } = await params
  const campagne = await prisma.campagneControle.findFirst({ where: { id, organizationId: ctx.orgId } })
  if (!campagne) return refuse(404, 'not_found')
  const rl = await rateLimit(`rapport-mission-controle:${ctx.userId}`, LIMIT_EXPORT.limit, LIMIT_EXPORT.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })

  const controleIds = (Array.isArray(campagne.controleIds) ? campagne.controleIds : []).filter((v): v is string => typeof v === 'string')
  const fenetre = {
    ...(campagne.dateDebut ? { gte: campagne.dateDebut } : {}),
    ...(campagne.dateFin ? { lte: new Date(campagne.dateFin.getTime() + 86_399_999) } : {}),
  }
  const [controles, envois, preconisations] = await Promise.all([
    controleIds.length ? prisma.controle.findMany({
      where: { organizationId: ctx.orgId, id: { in: controleIds } },
      select: { intitule: true, executions: { where: Object.keys(fenetre).length ? { dateRealisation: fenetre } : {}, select: { resultat: true } } },
      orderBy: { intitule: 'asc' },
    }) : Promise.resolve([]),
    prisma.questionnaireEnvoi.findMany({
      where: { organizationId: ctx.orgId, campagneId: id },
      select: { titre: true, questions: true, reponses: { select: { statut: true, reponses: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.preconisation.findMany({ where: { organizationId: ctx.orgId, campagneId: id }, orderBy: [{ criticite: 'desc' }, { createdAt: 'asc' }] }),
  ])

  // Rattachements des non-conformités : libellés résolus dans l'organisation active uniquement.
  const questionsParEnvoi = envois.map(e => sanitizeQuestions(e.questions))
  const cibles = questionsParEnvoi.flat().map(q => q.cible).filter(Boolean)
  const idsDe = (type: string) => [...new Set(cibles.flatMap(c => (c && c.type === type && 'id' in c ? [c.id] : [])))]
  const [ctrlCibles, risques, processus] = await Promise.all([
    idsDe('CONTROLE').length ? prisma.controle.findMany({ where: { organizationId: ctx.orgId, id: { in: idsDe('CONTROLE') } }, select: { id: true, intitule: true } }) : [],
    idsDe('RISQUE').length ? prisma.riskItem.findMany({ where: { organizationId: ctx.orgId, id: { in: idsDe('RISQUE') } }, select: { id: true, intitule: true } }) : [],
    idsDe('PROCESSUS').length ? prisma.processus.findMany({ where: { organizationId: ctx.orgId, id: { in: idsDe('PROCESSUS') } }, select: { id: true, nom: true } }) : [],
  ])
  const noms = new Map<string, string>([...ctrlCibles.map(c => [c.id, c.intitule] as const), ...risques.map(c => [c.id, c.intitule] as const), ...processus.map(c => [c.id, c.nom] as const)])

  const liens = preconisations.length ? await prisma.planActionLien.findMany({
    where: { type: 'PRECONISATION', targetId: { in: preconisations.map(p => p.id) }, planAction: { organizationId: ctx.orgId } },
    select: { targetId: true, planAction: { select: { titre: true } } },
  }) : []
  const plans = new Map<string, string[]>()
  for (const l of liens) plans.set(l.targetId, [...(plans.get(l.targetId) ?? []), l.planAction.titre])

  const data: MissionControleRapportData = {
    mission: { intitule: campagne.intitule, description: campagne.description, niveau: campagne.niveau, statut: campagne.statut, dateDebut: campagne.dateDebut, dateFin: campagne.dateFin },
    controles: controles.map(c => ({
      intitule: c.intitule,
      conformes: c.executions.filter(e => e.resultat === 'CONFORME').length,
      anomalies: c.executions.filter(e => e.resultat === 'ANOMALIE').length,
      nonApplicables: c.executions.filter(e => e.resultat === 'NON_APPLICABLE').length,
    })),
    questionnaires: envois.map((e, i) => {
      const questions = questionsParEnvoi[i]
      const nonConformes = e.reponses.flatMap(rep => (Array.isArray(rep.reponses) ? (rep.reponses as unknown as Reponse[]) : [])
        .filter(x => x?.revue?.statut === 'NON_CONFORME')
        .map(x => {
          const q = questions.find(qq => qq.id === x.questionId)
          const c = q?.cible
          const cible = !c ? null : c.type === 'EXIGENCE' ? `${c.referentielCode} ${c.ref}` : (noms.get(c.id) ?? null)
          return { question: q?.libelle ?? x.questionId, cible }
        }))
      return {
        titre: e.titre, total: e.reponses.length,
        soumises: e.reponses.filter(x => x.statut === 'SOUMISE' || x.statut === 'REVUE').length,
        revues: e.reponses.filter(x => x.statut === 'REVUE').length,
        nonConformes,
      }
    }),
    preconisations: preconisations.map(p => ({
      intitule: p.intitule, criticite: p.criticite, responsable: p.responsableAction, echeance: p.echeance, statut: p.statut,
      exigence: p.referentielCode && p.exigenceRef ? `${p.referentielCode} ${p.exigenceRef}` : null,
      plans: plans.get(p.id) ?? [], acceptation: p.statut === 'ACCEPTE' ? p.acceptationJustification : null,
    })),
  }

  const tAll = await getServerT()
  const t = tAll.campagneControle
  const md = rapportMissionControleMarkdown(data, {
    ...t.rapportControle,
    statutsMission: t.statutOpt as Record<string, string>,
    statutsPreco: tAll.questionnaires.statutsPreco as Record<string, string>,
  }, await getServerLocale(), new Date())
  const buffer = await markdownToDocxBuffer(t.rapportControle.titre, md)
  await auditLog('EXPORT', { userId: ctx.userId, userRole: ctx.role, organizationId: ctx.orgId, ip: getClientIp(req), targetType: 'campagne-controle', targetId: id, details: { format: 'docx', rapport: 'mission-controle' } })
  const slug = campagne.intitule.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60).toLowerCase() || 'mission'
  return new NextResponse(buffer as unknown as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="rapport-controle-${slug}.docx"`,
    },
  })
}
