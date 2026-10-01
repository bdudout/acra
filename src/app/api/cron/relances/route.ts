import { NextRequest, NextResponse } from 'next/server'
import { assertCronAuth } from '@/lib/cron-auth'
import { prisma } from '@/lib/prisma'
import { getOrgConfig } from '@/lib/org-config.server'
import { sanitizeRelancesConfig, typeRelance, type RelancesConfig } from '@/lib/relances'
import { sendEmail } from '@/lib/email'
import { relancesEmail, type RelanceItem } from '@/lib/email-i18n'
import { appUrl } from '@/lib/org-invitation.server'

export const dynamic = 'force-dynamic'

// Repli quand un plan d'action ou une préconisation n'a pas de responsable identifiable.
const GOUVERNANCE = ['RSSI', 'ADMIN', 'RISK_MANAGER']
type Destinataire = { email: string; locale: string | null }
type Membre = { role: string; user: { id: string; email: string; name: string | null; isActive: boolean; locale: string | null } }

/**
 * POST /api/cron/relances — RELANCES automatiques (quotidien) : questionnaires à répondre (répondant),
 * préconisations ouvertes (responsable) et plans d'action ouverts (responsable de la préconisation
 * liée, sinon porteur reconnu parmi les membres, sinon gouvernance de l'organisation).
 * Avant l'échéance, au retard, puis périodiquement (mensuel par défaut) — cf. lib/relances.
 * Un seul e-mail par personne et par organisation. Anti-doublon : `rappelLe` de chaque élément.
 * Planificateur externe, `Authorization: Bearer <CRON_SECRET>` ; 503 sans secret, 401 si invalide.
 */
export async function POST(req: NextRequest) {
  const denied = assertCronAuth(req)
  if (denied) return denied
  const now = new Date()

  const [reponses, preconisations, plans] = await Promise.all([
    prisma.questionnaireReponse.findMany({
      where: { statut: { in: ['A_REPONDRE', 'A_COMPLETER'] }, envoi: { statut: 'OUVERT' } },
      select: { id: true, organizationId: true, createdAt: true, rappelLe: true, repondantId: true, envoi: { select: { titre: true, echeance: true } } },
      take: 10000,
    }),
    prisma.preconisation.findMany({
      where: { statut: { in: ['OUVERT', 'EN_COURS'] } },
      select: { id: true, organizationId: true, intitule: true, echeance: true, createdAt: true, rappelLe: true, responsableId: true },
      take: 10000,
    }),
    prisma.planAction.findMany({
      where: { statut: { in: ['A_FAIRE', 'EN_COURS'] } },
      select: { id: true, organizationId: true, titre: true, echeance: true, createdAt: true, rappelLe: true, porteur: true, liens: { where: { type: 'PRECONISATION' }, select: { targetId: true } } },
      take: 10000,
    }),
  ])

  const cfgCache = new Map<string, { relances: RelancesConfig; controle: boolean }>()
  const cfgOf = async (orgId: string) => {
    if (!cfgCache.has(orgId)) { const c = await getOrgConfig(orgId); cfgCache.set(orgId, { relances: sanitizeRelancesConfig(c.relancesConfig), controle: c.controlePermanentActive }) }
    return cfgCache.get(orgId)!
  }
  const membresCache = new Map<string, Membre[]>()
  const membres = async (orgId: string) => {
    if (!membresCache.has(orgId)) membresCache.set(orgId, await prisma.orgMembership.findMany({ where: { organizationId: orgId }, select: { role: true, user: { select: { id: true, email: true, name: true, isActive: true, locale: true } } } }))
    return membresCache.get(orgId)!
  }
  const userIds = [...new Set([...reponses.map(r => r.repondantId), ...preconisations.map(p => p.responsableId)].filter((v): v is string => !!v))]
  const users = new Map((userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, isActive: true, locale: true } }) : []).map(u => [u.id, u]))
  const versDest = (u: { email: string; isActive: boolean; locale: string | null } | undefined): Destinataire[] => (u?.isActive && u.email ? [{ email: u.email, locale: u.locale }] : [])
  const gouvernance = async (orgId: string) => (await membres(orgId)).filter(m => GOUVERNANCE.includes(m.role)).flatMap(m => versDest(m.user))
  const responsablePreco = new Map(preconisations.map(p => [p.id, p.responsableId]))

  // Boîte d'envoi : organisation → e-mail → éléments.
  const boite = new Map<string, Map<string, { email: string; locale: string | null; items: RelanceItem[] }>>()
  const ajouter = (orgId: string, dests: Destinataire[], item: RelanceItem) => {
    const parOrg = boite.get(orgId) ?? new Map()
    boite.set(orgId, parOrg)
    for (const [cle, d] of new Map(dests.map(x => [x.email.toLowerCase(), x]))) {
      const e = parOrg.get(cle) ?? { email: d.email, locale: d.locale, items: [] }
      e.items.push(item)
      parOrg.set(cle, e)
    }
  }
  const jour = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)
  const relances = { questionnaires: [] as string[], preconisations: [] as string[], plans: [] as string[] }

  for (const r of reponses) {
    const cfg = await cfgOf(r.organizationId)
    const type = cfg.controle ? typeRelance({ echeance: r.envoi.echeance, rappelLe: r.rappelLe, createdAt: r.createdAt }, cfg.relances, now) : null
    if (!type) continue
    ajouter(r.organizationId, versDest(users.get(r.repondantId)), { categorie: 'QUESTIONNAIRE', intitule: r.envoi.titre, type, echeance: jour(r.envoi.echeance) })
    relances.questionnaires.push(r.id)
  }
  for (const p of preconisations) {
    const cfg = await cfgOf(p.organizationId)
    const type = cfg.controle ? typeRelance(p, cfg.relances, now) : null
    if (!type) continue
    const dests = p.responsableId ? versDest(users.get(p.responsableId)) : await gouvernance(p.organizationId)
    ajouter(p.organizationId, dests, { categorie: 'PRECONISATION', intitule: p.intitule, type, echeance: jour(p.echeance) })
    relances.preconisations.push(p.id)
  }
  for (const pa of plans) {
    const cfg = await cfgOf(pa.organizationId)
    const type = typeRelance(pa, cfg.relances, now)
    if (!type) continue
    // Responsable : celui de la préconisation liée, sinon le porteur reconnu (e-mail ou nom), sinon la gouvernance.
    const viaPreco = pa.liens.map(l => responsablePreco.get(l.targetId)).filter((v): v is string => !!v)
    let dests: Destinataire[] = viaPreco.flatMap(id => versDest(users.get(id)))
    if (!dests.length && pa.porteur) {
      const cle = pa.porteur.trim().toLowerCase()
      dests = (await membres(pa.organizationId)).filter(m => m.user.email.toLowerCase() === cle || (m.user.name ?? '').trim().toLowerCase() === cle).flatMap(m => versDest(m.user))
    }
    if (!dests.length) dests = await gouvernance(pa.organizationId)
    ajouter(pa.organizationId, dests, { categorie: 'PLAN_ACTION', intitule: pa.titre, type, echeance: jour(pa.echeance) })
    relances.plans.push(pa.id)
  }

  const orgs = new Map((boite.size ? await prisma.organization.findMany({ where: { id: { in: [...boite.keys()] } }, select: { id: true, nom: true } }) : []).map(o => [o.id, o.nom]))
  let emailsSent = 0, emailsSkipped = 0
  for (const [orgId, parEmail] of boite) {
    for (const { email, locale, items } of parEmail.values()) {
      const chemin = items.some(i => i.categorie !== 'PLAN_ACTION') ? '/controles/questionnaires' : '/plans-actions'
      const mail = relancesEmail(locale, { orgNom: orgs.get(orgId) ?? '', items, url: appUrl(chemin) })
      const res = await sendEmail({ to: email, subject: mail.subject, text: mail.text, html: mail.html })
      if (res.ok) emailsSent++; else emailsSkipped++
    }
  }
  await Promise.all([
    relances.questionnaires.length && prisma.questionnaireReponse.updateMany({ where: { id: { in: relances.questionnaires } }, data: { rappelLe: now } }),
    relances.preconisations.length && prisma.preconisation.updateMany({ where: { id: { in: relances.preconisations } }, data: { rappelLe: now } }),
    relances.plans.length && prisma.planAction.updateMany({ where: { id: { in: relances.plans } }, data: { rappelLe: now } }),
  ])
  return NextResponse.json({
    ok: true, checked: reponses.length + preconisations.length + plans.length,
    reminded: { questionnaires: relances.questionnaires.length, preconisations: relances.preconisations.length, plansAction: relances.plans.length },
    emailsSent, emailsSkipped,
  })
}
