// ─── Relances : passage unique et e-mail de synthèse par personne ────────────
// Toutes les relances d'ACRA partent d'un même passage : un seul e-mail par personne, toutes
// organisations confondues, qui regroupe ses éléments à traiter et les décisions qu'elle doit prendre.
//  - à traiter : questionnaires, préconisations, plans d'action (lib/relances) ; recommandations
//    d'audit (audit-config / audit-rappels) ; contrôles à exécuter (lib/controle) ; dérogations
//    arrivant à expiration (lib/derogation) ;
//  - décisions en attente : préconisation et recommandation d'audit réalisées à vérifier, analyse /
//    projet 360 à approuver, dérogation en revue.
// Chaque source garde ses règles, son paramétrage et son marqueur anti-doublon (`rappelLe` ou
// `alerteeLe`) : le passage est idempotent, quel que soit le nombre d'appels.
import { prisma } from './prisma'
import { getOrgConfig } from './org-config.server'
import { sanitizeRelancesConfig, typeRelance, typeEcheance, controlesNonExecutes, PREAVIS_CONTRAT_TIC_JOURS, PREAVIS_INVITATION_JOURS, relanceAttenteDue, approbateursAnalyse, valideursDerogation, attenteDerogationDepuis, type RelancesConfig } from './relances'
import { resolveAuditConfig, type AuditConfig } from './audit-config'
import { calculerRappels } from './audit-rappels'
import { prochaineEcheance, etatEcheance, type Periodicite } from './controle'
import { needsExpiryAlert, joursAvantExpiration, type DerogationStatut } from './derogation'
import { sanitizeApprobations } from './projet360'
import { peutDefinir2eLigne, type UserRole } from './permissions'
import { sendEmail } from './email'
import { relancesEmail, type RelanceItem } from './email-i18n'
import { appUrl } from './org-invitation.server'
import { auditLog } from './logger'

// Gouvernance de l'organisation : repli des éléments sans responsable identifiable, destinataire
// des contrôles à exécuter et des dérogations arrivant à expiration.
const GOUVERNANCE = ['RSSI', 'ADMIN', 'RISK_MANAGER']
// Recommandations d'audit : l'audité (gouvernance) pour l'échéance, l'audit pour la vérification.
const AUDIT_ROLES = { AUDITE: GOUVERNANCE, AUDIT: ['AUDITEUR', 'ADMIN'] }
// Page ouverte par le lien de l'e-mail : celle du premier élément listé.
const CHEMINS: Record<RelanceItem['categorie'], string> = {
  QUESTIONNAIRE: '/controles/questionnaires', PRECONISATION: '/controles/questionnaires', PRECONISATION_A_VERIFIER: '/controles/questionnaires',
  PLAN_ACTION: '/plans-actions', ANALYSE_A_APPROUVER: '/analyses', PROJET360_A_APPROUVER: '/projets',
  DEROGATION_AVIS: '/derogations', DEROGATION_DOUBLE_REGARD: '/derogations', DEROGATION_VALIDATION: '/derogations', DEROGATION_EXPIRATION: '/derogations',
  CONSTAT_AUDIT: '/audit', CONSTAT_A_VERIFIER: '/audit', CONTROLE_A_EXECUTER: '/controles',
  CONTRAT_TIC: '/registre-tic', TEST_RESILIENCE: '/reglementaire/tests-resilience', KRI_MESURE: '/kri', DOCUMENT_A_REVOIR: '/documents',
  CAMPAGNE_CONTROLE: '/controles/campagnes', MISSION_AUDIT: '/audit', ANALYSE_ECHEANCE: '/analyses', INVITATION: '/configuration/entites', ACCEPTATION_RISQUES: '/analyses',
}
// Ordre de l'e-mail : le plus urgent d'abord.
const URGENCE: Record<RelanceItem['type'], number> = { EN_RETARD: 0, EN_ATTENTE: 1, ECHEANCE_PROCHE: 2, PERIODIQUE: 3 }

type Destinataire = { email: string; locale: string | null }
type Membre = { role: string; user: { id: string; email: string; name: string | null; isActive: boolean; locale: string | null } }
type Config = {
  relances: RelancesConfig; controle: boolean; audit: boolean; auditConfig: AuditConfig; derogations: boolean; derogationAlerteJours: number; secondeLigne: boolean
  reglementaire: boolean; kri: boolean; conformite: boolean; acceptationRisques: boolean
}

export interface ResultatRelances {
  checked: number
  reminded: Record<string, number>
  emailsSent: number
  emailsSkipped: number
}

const jour = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)
const versDest = (u: { email: string; isActive: boolean; locale: string | null } | undefined): Destinataire[] => (u?.isActive && u.email ? [{ email: u.email, locale: u.locale }] : [])

export async function executerRelances(now: Date = new Date()): Promise<ResultatRelances> {
  const [reponses, preconisations, plans, aVerifier, analyses, derogationsRevue, constats, controles, derogationsActives] = await Promise.all([
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
    prisma.auditConstat.findMany({
      where: { statut: { in: ['OUVERT', 'EN_COURS', 'RESOLU'] } },
      select: { id: true, organizationId: true, intitule: true, statut: true, echeance: true, rappelLe: true, realiseeLe: true, responsableAction: true, mission: { select: { intitule: true } } },
      take: 10000,
    }),
    prisma.controle.findMany({
      where: { actif: true, alerteeLe: null },
      select: { id: true, organizationId: true, intitule: true, periodicite: true, createdAt: true, executions: { orderBy: { dateRealisation: 'desc' }, take: 1, select: { dateRealisation: true } } },
      take: 10000,
    }),
    prisma.derogation.findMany({
      where: { statut: 'ACTIVE', alerteeLe: null },
      select: { id: true, organizationId: true, intitule: true, statut: true, dateFin: true, demandeurId: true },
      take: 10000,
    }),
  ])
  // Sources « à échéance » et décisions complémentaires.
  const [contrats, tests, kris, documents, campagnes, missions, analysesEcheance, acceptations, invitations] = await Promise.all([
    prisma.arrangementTic.findMany({ where: { dateFin: { not: null } }, select: { id: true, organizationId: true, reference: true, prestataireNom: true, dateFin: true, createdAt: true, rappelLe: true }, take: 10000 }),
    prisma.testResilience.findMany({ where: { statut: { in: ['PLANIFIE', 'EN_COURS'] }, datePrevue: { not: null } }, select: { id: true, organizationId: true, intitule: true, datePrevue: true, createdAt: true, rappelLe: true }, take: 10000 }),
    prisma.kri.findMany({ where: { actif: true }, select: { id: true, organizationId: true, intitule: true, frequence: true, responsable: true, createdAt: true, rappelLe: true, mesures: { orderBy: { dateMesure: 'desc' }, take: 1, select: { dateMesure: true } } }, take: 10000 }),
    prisma.document.findMany({ where: { dateRevue: { not: null } }, select: { id: true, organizationId: true, titre: true, dateRevue: true, createdAt: true, rappelLe: true, uploadedBy: true }, take: 10000 }),
    prisma.campagneControle.findMany({ where: { statut: { not: 'CLOTUREE' }, archiveLe: null, dateFin: { not: null } }, select: { id: true, organizationId: true, intitule: true, dateDebut: true, dateFin: true, createdAt: true, rappelLe: true, controleIds: true }, take: 10000 }),
    prisma.auditMission.findMany({ where: { statut: 'PLANIFIEE', dateDebut: { not: null } }, select: { id: true, organizationId: true, intitule: true, dateDebut: true, createdAt: true, rappelLe: true }, take: 10000 }),
    prisma.analyse.findMany({ where: { statut: { in: ['EN_COURS', 'REJETE'] }, dateEcheance: { not: null } }, select: { id: true, organizationId: true, nom: true, userId: true, dateEcheance: true, createdAt: true, rappelEcheanceLe: true }, take: 10000 }),
    prisma.analyse.findMany({ where: { statut: 'APPROUVE', risquesResiduelsStatut: 'EN_ATTENTE' }, select: { id: true, organizationId: true, nom: true, userId: true, approuveLe: true, updatedAt: true, rappelLe: true }, take: 10000 }),
    prisma.orgInvitation.findMany({ where: { acceptedAt: null }, select: { id: true, organizationId: true, email: true, invitedById: true, expiresAt: true, createdAt: true, rappelLe: true }, take: 10000 }),
  ])
  // Versions remplacées d'un document : seule la version en vigueur est à revoir.
  const remplaces = new Set((documents.length ? await prisma.document.findMany({ where: { remplaceId: { in: documents.map(d => d.id) } }, select: { remplaceId: true } }) : []).map(d => d.remplaceId))
  const ctrlIdsCampagnes = [...new Set(campagnes.flatMap(c => (Array.isArray(c.controleIds) ? c.controleIds : []).filter((v): v is string => typeof v === 'string')))]
  const executionsCampagnes = ctrlIdsCampagnes.length ? await prisma.controleExecution.findMany({ where: { controleId: { in: ctrlIdsCampagnes } }, select: { controleId: true, dateRealisation: true } }) : []

  // ─── Caches : configuration, membres, décideurs, comptes ───
  const cfgCache = new Map<string, Config>()
  const cfgOf = async (orgId: string) => {
    if (!cfgCache.has(orgId)) {
      const c = await getOrgConfig(orgId)
      cfgCache.set(orgId, {
        relances: sanitizeRelancesConfig(c.relancesConfig), controle: c.controlePermanentActive,
        audit: c.auditInterneActive, auditConfig: resolveAuditConfig(c.auditConfig),
        derogations: c.derogationsActive, derogationAlerteJours: c.derogationAlerteJours ?? 30, secondeLigne: c.secondeLigneActive,
        reglementaire: !!c.reglementaireActive, kri: !!c.kriActive, conformite: c.conformiteActive, acceptationRisques: c.acceptationRisquesActive,
      })
    }
    return cfgCache.get(orgId)!
  }
  const membresCache = new Map<string, Membre[]>()
  const membres = async (orgId: string) => {
    if (!membresCache.has(orgId)) membresCache.set(orgId, await prisma.orgMembership.findMany({ where: { organizationId: orgId }, select: { role: true, user: { select: { id: true, email: true, name: true, isActive: true, locale: true } } } }))
    return membresCache.get(orgId)!
  }
  const parRoles = async (orgId: string, roles: string[]) => (await membres(orgId)).filter(m => roles.includes(m.role)).flatMap(m => versDest(m.user))
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
  const userIds = [...new Set([
    ...reponses.map(r => r.repondantId), ...preconisations.map(p => p.responsableId), ...derogationsActives.map(d => d.demandeurId),
    ...analysesEcheance.map(a => a.userId), ...invitations.map(i => i.invitedById), ...documents.map(d => d.uploadedBy),
  ].filter((v): v is string => !!v))]
  const users = new Map((userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, isActive: true, locale: true } }) : []).map(u => [u.id, u]))
  const responsablePreco = new Map(preconisations.map(p => [p.id, p.responsableId]))

  // ─── Boîte d'envoi : une entrée par personne (e-mail), toutes organisations confondues ───
  const boite = new Map<string, { email: string; locale: string | null; items: (RelanceItem & { orgId: string })[] }>()
  const ajouter = (orgId: string, dests: Destinataire[], item: RelanceItem) => {
    for (const [cle, d] of new Map(dests.map(x => [x.email.toLowerCase(), x]))) {
      const e = boite.get(cle) ?? { email: d.email, locale: d.locale, items: [] }
      e.items.push({ ...item, orgId })
      boite.set(cle, e)
    }
  }
  const marques = {
    questionnaires: [] as string[], preconisations: [] as string[], plansAction: [] as string[], preconisationsAVerifier: [] as string[],
    analyses: [] as string[], derogations: [] as string[], constatsAudit: [] as string[], controles: [] as string[], derogationsExpiration: [] as string[],
    contratsTic: [] as string[], testsResilience: [] as string[], kri: [] as string[], documents: [] as string[], campagnes: [] as string[],
    missionsAudit: [] as string[], analysesEcheance: [] as string[], acceptationsRisques: [] as string[], invitations: [] as string[],
  }

  // ─── Éléments à traiter ───
  for (const r of reponses) {
    const cfg = await cfgOf(r.organizationId)
    const type = cfg.controle ? typeRelance({ echeance: r.envoi.echeance, rappelLe: r.rappelLe, createdAt: r.createdAt }, cfg.relances, now) : null
    if (!type) continue
    ajouter(r.organizationId, versDest(users.get(r.repondantId)), { categorie: 'QUESTIONNAIRE', intitule: r.envoi.titre, type, echeance: jour(r.envoi.echeance) })
    marques.questionnaires.push(r.id)
  }
  for (const p of preconisations) {
    const cfg = await cfgOf(p.organizationId)
    const type = cfg.controle ? typeRelance(p, cfg.relances, now) : null
    if (!type) continue
    const dests = p.responsableId ? versDest(users.get(p.responsableId)) : await parRoles(p.organizationId, GOUVERNANCE)
    ajouter(p.organizationId, dests, { categorie: 'PRECONISATION', intitule: p.intitule, type, echeance: jour(p.echeance) })
    marques.preconisations.push(p.id)
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
    if (!dests.length) dests = await parRoles(pa.organizationId, GOUVERNANCE)
    ajouter(pa.organizationId, dests, { categorie: 'PLAN_ACTION', intitule: pa.titre, type, echeance: jour(pa.echeance) })
    marques.plansAction.push(pa.id)
  }
  // Recommandations d'audit : règles et paramétrage de l'audit interne (auditConfig).
  const constatsParOrg = new Map<string, typeof constats>()
  for (const c of constats) constatsParOrg.set(c.organizationId, [...(constatsParOrg.get(c.organizationId) ?? []), c])
  for (const [orgId, liste] of constatsParOrg) {
    const cfg = await cfgOf(orgId)
    if (!cfg.audit) continue
    const parId = new Map(liste.map(c => [c.id, c]))
    for (const r of calculerRappels(liste, cfg.auditConfig, now)) {
      const c = parId.get(r.constatId)!
      const intitule = `${c.intitule} (${c.mission.intitule})`
      const item: RelanceItem = r.type === 'A_VERIFIER'
        ? { categorie: 'CONSTAT_A_VERIFIER', intitule, type: 'EN_ATTENTE', echeance: jour(c.realiseeLe) }
        : { categorie: 'CONSTAT_AUDIT', intitule, type: r.type, echeance: jour(c.echeance) }
      ajouter(orgId, await parRoles(orgId, AUDIT_ROLES[r.destinataire]), item)
      marques.constatsAudit.push(c.id)
    }
  }
  // Contrôles à exécuter : une alerte par période (le marqueur est levé à la prochaine exécution).
  for (const c of controles) {
    const cfg = await cfgOf(c.organizationId)
    if (!cfg.controle) continue
    const echeance = prochaineEcheance(c.periodicite as Periodicite, c.executions[0]?.dateRealisation ?? null, c.createdAt)
    const etat = etatEcheance(echeance, now)
    if (etat === 'A_VENIR') continue
    ajouter(c.organizationId, await parRoles(c.organizationId, GOUVERNANCE), { categorie: 'CONTROLE_A_EXECUTER', intitule: c.intitule, type: etat === 'EN_RETARD' ? 'EN_RETARD' : 'ECHEANCE_PROCHE', echeance: jour(echeance) })
    marques.controles.push(c.id)
  }
  // Dérogations arrivant à expiration : une alerte par période d'acceptation, au demandeur et à la gouvernance.
  for (const d of derogationsActives) {
    const cfg = await cfgOf(d.organizationId)
    if (!needsExpiryAlert({ statut: d.statut as DerogationStatut, dateFin: d.dateFin }, cfg.derogationAlerteJours, now)) continue
    const jours = joursAvantExpiration(d.dateFin ?? null, now)
    const dests = [...await parRoles(d.organizationId, GOUVERNANCE), ...versDest(users.get(d.demandeurId))]
    ajouter(d.organizationId, dests, { categorie: 'DEROGATION_EXPIRATION', intitule: d.intitule, type: jours < 0 ? 'EN_RETARD' : 'ECHEANCE_PROCHE', echeance: jour(d.dateFin) })
    marques.derogationsExpiration.push(d.id)
    await auditLog('DEROGATION_EXPIRING', { organizationId: d.organizationId, details: { derogationId: d.id, jours, recipients: new Set(dests.map(x => x.email.toLowerCase())).size } })
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
    marques.preconisationsAVerifier.push(p.id)
  }
  for (const a of analyses) {
    const cfg = await cfgOf(a.organizationId)
    const depuis = a.soumisLe ?? a.updatedAt
    if (!relanceAttenteDue({ depuis, rappelLe: a.rappelLe }, cfg.relances, now)) continue
    const projet360 = a.methode === 'PROJET_360'
    const ids = approbateursAnalyse((await decideurs(a.organizationId)).map(m => ({ role: m.role, userId: m.user.id })), {
      auteurId: a.userId, projet360, rolesDejaApprouves: sanitizeApprobations(a.approbations).map(x => x.role), acces: a.accesUtilisateurs,
    })
    ajouter(a.organizationId, await destsParIds(a.organizationId, ids), { categorie: projet360 ? 'PROJET360_A_APPROUVER' : 'ANALYSE_A_APPROUVER', intitule: a.nom, type: 'EN_ATTENTE', echeance: jour(depuis) })
    marques.analyses.push(a.id)
  }
  for (const d of derogationsRevue) {
    const cfg = await cfgOf(d.organizationId)
    const depuis = attenteDerogationDepuis(d)
    if (!cfg.derogations || !relanceAttenteDue({ depuis, rappelLe: d.rappelLe }, cfg.relances, now)) continue
    const ids = valideursDerogation((await decideurs(d.organizationId)).map(m => ({ role: m.role, userId: m.user.id })), d)
    const categorie = d.statut === 'DEMANDEE' ? 'DEROGATION_AVIS' : d.statut === 'DOUBLE_REGARD' ? 'DEROGATION_DOUBLE_REGARD' : 'DEROGATION_VALIDATION'
    ajouter(d.organizationId, await destsParIds(d.organizationId, ids), { categorie, intitule: d.intitule, type: 'EN_ATTENTE', echeance: jour(depuis) })
    marques.derogations.push(d.id)
  }

  // ─── Échéances : contrats TIC, tests de résilience, KRI, documents, campagnes, missions, analyses, invitations ───
  // Porteur reconnu parmi les membres (e-mail ou nom), sinon la gouvernance de l'organisation.
  const parPorteur = async (orgId: string, porteur: string | null) => {
    const cle = (porteur ?? '').trim().toLowerCase()
    const trouves = cle ? (await membres(orgId)).filter(m => m.user.email.toLowerCase() === cle || (m.user.name ?? '').trim().toLowerCase() === cle).flatMap(m => versDest(m.user)) : []
    return trouves.length ? trouves : parRoles(orgId, GOUVERNANCE)
  }
  for (const c of contrats) {
    const cfg = await cfgOf(c.organizationId)
    const type = cfg.reglementaire ? typeEcheance({ echeance: c.dateFin, rappelLe: c.rappelLe, createdAt: c.createdAt }, cfg.relances, now, { joursAvant: PREAVIS_CONTRAT_TIC_JOURS }) : null
    if (!type) continue
    ajouter(c.organizationId, await parRoles(c.organizationId, GOUVERNANCE), { categorie: 'CONTRAT_TIC', intitule: `${c.prestataireNom} — ${c.reference}`, type, echeance: jour(c.dateFin) })
    marques.contratsTic.push(c.id)
  }
  for (const t of tests) {
    const cfg = await cfgOf(t.organizationId)
    const type = cfg.reglementaire ? typeEcheance({ echeance: t.datePrevue, rappelLe: t.rappelLe, createdAt: t.createdAt }, cfg.relances, now) : null
    if (!type) continue
    ajouter(t.organizationId, await parRoles(t.organizationId, GOUVERNANCE), { categorie: 'TEST_RESILIENCE', intitule: t.intitule, type, echeance: jour(t.datePrevue) })
    marques.testsResilience.push(t.id)
  }
  for (const k of kris) {
    const cfg = await cfgOf(k.organizationId)
    if (!cfg.kri) continue
    // Mesure attendue selon la fréquence du KRI (même calcul que l'échéance d'un contrôle) ; relance du seul retard.
    const attendue = prochaineEcheance(k.frequence as Periodicite, k.mesures[0]?.dateMesure ?? null, k.createdAt)
    if (typeEcheance({ echeance: attendue, rappelLe: k.rappelLe, createdAt: k.createdAt }, cfg.relances, now) !== 'EN_RETARD') continue
    ajouter(k.organizationId, await parPorteur(k.organizationId, k.responsable), { categorie: 'KRI_MESURE', intitule: k.intitule, type: 'EN_RETARD', echeance: jour(attendue) })
    marques.kri.push(k.id)
  }
  for (const d of documents) {
    const cfg = await cfgOf(d.organizationId)
    const type = cfg.conformite && !remplaces.has(d.id) ? typeEcheance({ echeance: d.dateRevue, rappelLe: d.rappelLe, createdAt: d.createdAt }, cfg.relances, now) : null
    if (!type) continue
    const auteur = d.uploadedBy ? versDest(users.get(d.uploadedBy)) : []
    const membre = auteur.length && (await membres(d.organizationId)).some(m => m.user.email.toLowerCase() === auteur[0].email.toLowerCase())
    ajouter(d.organizationId, membre ? auteur : await parRoles(d.organizationId, GOUVERNANCE), { categorie: 'DOCUMENT_A_REVOIR', intitule: d.titre, type, echeance: jour(d.dateRevue) })
    marques.documents.push(d.id)
  }
  for (const c of campagnes) {
    const cfg = await cfgOf(c.organizationId)
    const type = cfg.controle ? typeEcheance({ echeance: c.dateFin, rappelLe: c.rappelLe, createdAt: c.createdAt }, cfg.relances, now) : null
    if (!type) continue
    const ids = (Array.isArray(c.controleIds) ? c.controleIds : []).filter((v): v is string => typeof v === 'string')
    // Rien à relancer si tous les contrôles du périmètre ont été exécutés depuis le début de la campagne.
    if (!controlesNonExecutes(ids, executionsCampagnes, c.dateDebut ?? c.createdAt).length) continue
    const deuxiemeLigne = (await decideurs(c.organizationId)).filter(m => peutDefinir2eLigne(m.role as UserRole, { secondeLigneActive: cfg.secondeLigne }))
    ajouter(c.organizationId, deuxiemeLigne.flatMap(m => versDest(m.user)), { categorie: 'CAMPAGNE_CONTROLE', intitule: c.intitule, type, echeance: jour(c.dateFin) })
    marques.campagnes.push(c.id)
  }
  for (const m of missions) {
    const cfg = await cfgOf(m.organizationId)
    const type = cfg.audit ? typeEcheance({ echeance: m.dateDebut, rappelLe: m.rappelLe, createdAt: m.createdAt }, cfg.relances, now) : null
    if (!type) continue
    ajouter(m.organizationId, await parRoles(m.organizationId, AUDIT_ROLES.AUDIT), { categorie: 'MISSION_AUDIT', intitule: m.intitule, type, echeance: jour(m.dateDebut) })
    marques.missionsAudit.push(m.id)
  }
  for (const a of analysesEcheance) {
    const cfg = await cfgOf(a.organizationId)
    const type = typeEcheance({ echeance: a.dateEcheance, rappelLe: a.rappelEcheanceLe, createdAt: a.createdAt }, cfg.relances, now)
    if (!type) continue
    ajouter(a.organizationId, versDest(users.get(a.userId)), { categorie: 'ANALYSE_ECHEANCE', intitule: a.nom, type, echeance: jour(a.dateEcheance) })
    marques.analysesEcheance.push(a.id)
  }
  for (const i of invitations) {
    const cfg = await cfgOf(i.organizationId)
    const type = typeEcheance({ echeance: i.expiresAt, rappelLe: i.rappelLe, createdAt: i.createdAt }, cfg.relances, now, { joursAvant: PREAVIS_INVITATION_JOURS, uneFois: true })
    if (!type) continue
    ajouter(i.organizationId, versDest(users.get(i.invitedById)), { categorie: 'INVITATION', intitule: i.email, type, echeance: jour(i.expiresAt) })
    marques.invitations.push(i.id)
  }
  // Acceptation des risques résiduels par la direction métier (administrateurs à défaut), après approbation.
  for (const a of acceptations) {
    const cfg = await cfgOf(a.organizationId)
    const depuis = a.approuveLe ?? a.updatedAt
    if (!cfg.acceptationRisques || !relanceAttenteDue({ depuis, rappelLe: a.rappelLe }, cfg.relances, now)) continue
    const decid = (await decideurs(a.organizationId)).filter(m => m.user.id !== a.userId)
    const metier = decid.filter(m => m.role === 'DIRECTION_METIER')
    ajouter(a.organizationId, (metier.length ? metier : decid.filter(m => m.role === 'ADMIN')).flatMap(m => versDest(m.user)), { categorie: 'ACCEPTATION_RISQUES', intitule: a.nom, type: 'EN_ATTENTE', echeance: jour(depuis) })
    marques.acceptationsRisques.push(a.id)
  }

  // ─── Envoi : un e-mail de synthèse par personne ───
  const orgIds = [...new Set([...boite.values()].flatMap(e => e.items.map(i => i.orgId)))]
  const orgs = new Map((orgIds.length ? await prisma.organization.findMany({ where: { id: { in: orgIds } }, select: { id: true, nom: true } }) : []).map(o => [o.id, o.nom]))
  let emailsSent = 0, emailsSkipped = 0
  for (const { email, locale, items } of boite.values()) {
    const tries = [...items].sort((a, b) => URGENCE[a.type] - URGENCE[b.type] || (orgs.get(a.orgId) ?? '').localeCompare(orgs.get(b.orgId) ?? ''))
    const mail = relancesEmail(locale, { items: tries.map(({ orgId, ...i }) => ({ ...i, organisation: orgs.get(orgId) ?? '' })), url: appUrl(CHEMINS[tries[0].categorie]) })
    const res = await sendEmail({ to: email, subject: mail.subject, text: mail.text, html: mail.html })
    if (res.ok) emailsSent++; else emailsSkipped++
  }

  // ─── Marqueurs anti-doublon ───
  const maj = (ids: string[], f: (ids: string[]) => Promise<unknown>) => (ids.length ? f(ids) : null)
  await Promise.all([
    maj(marques.questionnaires, ids => prisma.questionnaireReponse.updateMany({ where: { id: { in: ids } }, data: { rappelLe: now } })),
    maj([...marques.preconisations, ...marques.preconisationsAVerifier], ids => prisma.preconisation.updateMany({ where: { id: { in: ids } }, data: { rappelLe: now } })),
    maj(marques.plansAction, ids => prisma.planAction.updateMany({ where: { id: { in: ids } }, data: { rappelLe: now } })),
    maj([...marques.analyses, ...marques.acceptationsRisques], ids => prisma.analyse.updateMany({ where: { id: { in: ids } }, data: { rappelLe: now } })),
    maj(marques.analysesEcheance, ids => prisma.analyse.updateMany({ where: { id: { in: ids } }, data: { rappelEcheanceLe: now } })),
    maj(marques.contratsTic, ids => prisma.arrangementTic.updateMany({ where: { id: { in: ids } }, data: { rappelLe: now } })),
    maj(marques.testsResilience, ids => prisma.testResilience.updateMany({ where: { id: { in: ids } }, data: { rappelLe: now } })),
    maj(marques.kri, ids => prisma.kri.updateMany({ where: { id: { in: ids } }, data: { rappelLe: now } })),
    maj(marques.documents, ids => prisma.document.updateMany({ where: { id: { in: ids } }, data: { rappelLe: now } })),
    maj(marques.campagnes, ids => prisma.campagneControle.updateMany({ where: { id: { in: ids } }, data: { rappelLe: now } })),
    maj(marques.missionsAudit, ids => prisma.auditMission.updateMany({ where: { id: { in: ids } }, data: { rappelLe: now } })),
    maj(marques.invitations, ids => prisma.orgInvitation.updateMany({ where: { id: { in: ids } }, data: { rappelLe: now } })),
    maj(marques.derogations, ids => prisma.derogation.updateMany({ where: { id: { in: ids } }, data: { rappelLe: now } })),
    maj(marques.constatsAudit, ids => prisma.auditConstat.updateMany({ where: { id: { in: ids } }, data: { rappelLe: now } })),
    maj(marques.controles, ids => prisma.controle.updateMany({ where: { id: { in: ids } }, data: { alerteeLe: now } })),
    maj(marques.derogationsExpiration, ids => prisma.derogation.updateMany({ where: { id: { in: ids } }, data: { alerteeLe: now } })),
  ])

  return {
    checked: reponses.length + preconisations.length + plans.length + aVerifier.length + analyses.length + derogationsRevue.length + constats.length + controles.length + derogationsActives.length
      + contrats.length + tests.length + kris.length + documents.length + campagnes.length + missions.length + analysesEcheance.length + acceptations.length + invitations.length,
    reminded: Object.fromEntries(Object.entries(marques).map(([k, v]) => [k, v.length])),
    emailsSent, emailsSkipped,
  }
}
