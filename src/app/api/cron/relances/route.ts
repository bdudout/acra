import { NextRequest, NextResponse } from 'next/server'
import { assertCronAuth } from '@/lib/cron-auth'
import { prisma } from '@/lib/prisma'
import { getOrgConfig } from '@/lib/org-config.server'
import { sanitizeRelancesConfig, typeRelance, relanceAttenteDue, approbateursAnalyse, valideursDerogation, attenteDerogationDepuis, type RelancesConfig } from '@/lib/relances'
import { sanitizeApprobations } from '@/lib/projet360'
import { peutDefinir2eLigne, type UserRole } from '@/lib/permissions'
import { sendEmail } from '@/lib/email'
import { relancesEmail, type RelanceItem } from '@/lib/email-i18n'
import { appUrl } from '@/lib/org-invitation.server'

export const dynamic = 'force-dynamic'

// Repli quand un plan d'action ou une préconisation n'a pas de responsable identifiable.
const GOUVERNANCE = ['RSSI', 'ADMIN', 'RISK_MANAGER']
type Destinataire = { email: string; locale: string | null }
// Page ouverte par le lien de l'e-mail : celle du premier élément listé.
const CHEMINS: Record<RelanceItem['categorie'], string> = {
  QUESTIONNAIRE: '/controles/questionnaires', PRECONISATION: '/controles/questionnaires', PRECONISATION_A_VERIFIER: '/controles/questionnaires',
  PLAN_ACTION: '/plans-actions', ANALYSE_A_APPROUVER: '/analyses', PROJET360_A_APPROUVER: '/projets',
  DEROGATION_AVIS: '/derogations', DEROGATION_DOUBLE_REGARD: '/derogations', DEROGATION_VALIDATION: '/derogations',
}
type Membre = { role: string; user: { id: string; email: string; name: string | null; isActive: boolean; locale: string | null } }

/**
 * POST /api/cron/relances — RELANCES automatiques (quotidien) : questionnaires à répondre (répondant),
 * préconisations ouvertes (responsable) et plans d'action ouverts (responsable de la préconisation
 * liée, sinon porteur reconnu parmi les membres, sinon gouvernance de l'organisation).
 * Avant l'échéance, au retard, puis périodiquement (mensuel par défaut) — cf. lib/relances.
 * Décisions en attente (après `attenteJours`, puis périodiquement) : préconisation déclarée réalisée
 * → contrôleurs (créateur, sinon 2ᵉ ligne) ; analyse soumise → approbateurs (RSSI, Risk Manager ;
 * projet 360 : rôle manquant) ; dérogation en revue → RSSI (avis, double regard) ou direction métier.
 * Les constats d'audit réalisés à vérifier sont relancés vers l'audit par le cron `audit-rappels`.
 * Un seul e-mail par personne et par organisation. Anti-doublon : `rappelLe` de chaque élément.
 * Planificateur externe, `Authorization: Bearer <CRON_SECRET>` ; 503 sans secret, 401 si invalide.
 */
export async function POST(req: NextRequest) {
  const denied = assertCronAuth(req)
  if (denied) return denied
  const now = new Date()

  const [reponses, preconisations, plans, aVerifier, analyses, derogations] = await Promise.all([
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
    prisma.preconisation.findMany({
      where: { statut: 'RESOLU' },
      select: { id: true, organizationId: true, intitule: true, realiseeLe: true, createdAt: true, rappelLe: true, responsableId: true, createdById: true },
      take: 10000,
    }),
    prisma.analyse.findMany({
      where: { statut: 'SOUMIS' },
      select: { id: true, organizationId: true, nom: true, methode: true, userId: true, soumisLe: true, updatedAt: true, rappelLe: true, approbations: true, accesUtilisateurs: { select: { userId: true, permission: true } } },
      take: 10000,
    }),
    prisma.derogation.findMany({
      where: { statut: { in: ['DEMANDEE', 'DOUBLE_REGARD', 'VALIDATION_METIER'] } },
      select: { id: true, organizationId: true, intitule: true, statut: true, demandeurId: true, avisRssiPar: true, avisRssiLe: true, doubleRegardLe: true, prolongationDemandee: true, prolongations: true, createdAt: true, rappelLe: true },
      take: 10000,
    }),
  ])

  const cfgCache = new Map<string, { relances: RelancesConfig; controle: boolean; derogations: boolean; secondeLigne: boolean }>()
  const cfgOf = async (orgId: string) => {
    if (!cfgCache.has(orgId)) {
      const c = await getOrgConfig(orgId)
      cfgCache.set(orgId, { relances: sanitizeRelancesConfig(c.relancesConfig), controle: c.controlePermanentActive, derogations: c.derogationsActive, secondeLigne: c.secondeLigneActive })
    }
    return cfgCache.get(orgId)!
  }
  const membresCache = new Map<string, Membre[]>()
  const membres = async (orgId: string) => {
    if (!membresCache.has(orgId)) membresCache.set(orgId, await prisma.orgMembership.findMany({ where: { organizationId: orgId }, select: { role: true, user: { select: { id: true, email: true, name: true, isActive: true, locale: true } } } }))
    return membresCache.get(orgId)!
  }
  // Décideurs : membres de l'organisation et des organisations parentes à portée « sous-arbre »
  // (ex. RSSI groupe pour le double regard d'une dérogation de filiale).
  const decideursCache = new Map<string, Membre[]>()
  const decideurs = async (orgId: string) => {
    if (!decideursCache.has(orgId)) {
      const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { path: true } })
      const ancetres = (org?.path ?? '').split('/').filter(id => id && id !== orgId)
      decideursCache.set(orgId, await prisma.orgMembership.findMany({
        where: { OR: [{ organizationId: orgId }, ...(ancetres.length ? [{ organizationId: { in: ancetres }, scope: 'SUBTREE' as const }] : [])] },
        select: { role: true, user: { select: { id: true, email: true, name: true, isActive: true, locale: true } } },
      }))
    }
    return decideursCache.get(orgId)!
  }
  const destsParIds = async (orgId: string, ids: string[]) => {
    const parId = new Map((await decideurs(orgId)).map(m => [m.user.id, m.user]))
    return ids.flatMap(id => versDest(parId.get(id)))
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
  const relances = { questionnaires: [] as string[], preconisations: [] as string[], plans: [] as string[], aVerifier: [] as string[], analyses: [] as string[], derogations: [] as string[] }

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

  // ─── Décisions en attente ───
  for (const p of aVerifier) {
    const cfg = await cfgOf(p.organizationId)
    const depuis = p.realiseeLe ?? p.createdAt
    if (!cfg.controle || !relanceAttenteDue({ depuis, rappelLe: p.rappelLe }, cfg.relances, now)) continue
    // Vérificateur : le contrôleur qui a posé la préconisation, sinon la 2ᵉ ligne ; jamais le responsable.
    const eligibles = (await decideurs(p.organizationId)).filter(m => peutDefinir2eLigne(m.role as UserRole, { secondeLigneActive: cfg.secondeLigne }) && m.user.id !== p.responsableId)
    const createur = eligibles.filter(m => m.user.id === p.createdById)
    ajouter(p.organizationId, (createur.length ? createur : eligibles).flatMap(m => versDest(m.user)), { categorie: 'PRECONISATION_A_VERIFIER', intitule: p.intitule, type: 'EN_ATTENTE', echeance: jour(depuis) })
    relances.aVerifier.push(p.id)
  }
  for (const a of analyses) {
    const cfg = await cfgOf(a.organizationId)
    const depuis = a.soumisLe ?? a.updatedAt
    if (!relanceAttenteDue({ depuis, rappelLe: a.rappelLe }, cfg.relances, now)) continue
    const membres = (await decideurs(a.organizationId)).map(m => ({ role: m.role, userId: m.user.id }))
    const projet360 = a.methode === 'PROJET_360'
    const ids = approbateursAnalyse(membres, { auteurId: a.userId, projet360, rolesDejaApprouves: sanitizeApprobations(a.approbations).map(x => x.role), acces: a.accesUtilisateurs })
    ajouter(a.organizationId, await destsParIds(a.organizationId, ids), { categorie: projet360 ? 'PROJET360_A_APPROUVER' : 'ANALYSE_A_APPROUVER', intitule: a.nom, type: 'EN_ATTENTE', echeance: jour(depuis) })
    relances.analyses.push(a.id)
  }
  for (const d of derogations) {
    const cfg = await cfgOf(d.organizationId)
    const depuis = attenteDerogationDepuis(d)
    if (!cfg.derogations || !relanceAttenteDue({ depuis, rappelLe: d.rappelLe }, cfg.relances, now)) continue
    const ids = valideursDerogation((await decideurs(d.organizationId)).map(m => ({ role: m.role, userId: m.user.id })), d)
    const categorie = d.statut === 'DEMANDEE' ? 'DEROGATION_AVIS' : d.statut === 'DOUBLE_REGARD' ? 'DEROGATION_DOUBLE_REGARD' : 'DEROGATION_VALIDATION'
    ajouter(d.organizationId, await destsParIds(d.organizationId, ids), { categorie, intitule: d.intitule, type: 'EN_ATTENTE', echeance: jour(depuis) })
    relances.derogations.push(d.id)
  }

  const orgs = new Map((boite.size ? await prisma.organization.findMany({ where: { id: { in: [...boite.keys()] } }, select: { id: true, nom: true } }) : []).map(o => [o.id, o.nom]))
  let emailsSent = 0, emailsSkipped = 0
  for (const [orgId, parEmail] of boite) {
    for (const { email, locale, items } of parEmail.values()) {
      const chemin = CHEMINS[items[0].categorie]
      const mail = relancesEmail(locale, { orgNom: orgs.get(orgId) ?? '', items, url: appUrl(chemin) })
      const res = await sendEmail({ to: email, subject: mail.subject, text: mail.text, html: mail.html })
      if (res.ok) emailsSent++; else emailsSkipped++
    }
  }
  await Promise.all([
    relances.questionnaires.length && prisma.questionnaireReponse.updateMany({ where: { id: { in: relances.questionnaires } }, data: { rappelLe: now } }),
    relances.preconisations.length && prisma.preconisation.updateMany({ where: { id: { in: relances.preconisations } }, data: { rappelLe: now } }),
    relances.plans.length && prisma.planAction.updateMany({ where: { id: { in: relances.plans } }, data: { rappelLe: now } }),
    relances.aVerifier.length && prisma.preconisation.updateMany({ where: { id: { in: relances.aVerifier } }, data: { rappelLe: now } }),
    relances.analyses.length && prisma.analyse.updateMany({ where: { id: { in: relances.analyses } }, data: { rappelLe: now } }),
    relances.derogations.length && prisma.derogation.updateMany({ where: { id: { in: relances.derogations } }, data: { rappelLe: now } }),
  ])
  return NextResponse.json({
    ok: true, checked: reponses.length + preconisations.length + plans.length + aVerifier.length + analyses.length + derogations.length,
    reminded: {
      questionnaires: relances.questionnaires.length, preconisations: relances.preconisations.length, plansAction: relances.plans.length,
      preconisationsAVerifier: relances.aVerifier.length, analyses: relances.analyses.length, derogations: relances.derogations.length,
    },
    emailsSent, emailsSkipped,
  })
}
