// ─── Tableau de bord mensuel : collecte, destinataires, envoi ────────────────
// Le 1er du mois, pour le mois écoulé : un e-mail par RSSI / gestionnaire des risques (administrateurs
// à défaut), avec une section par organisation dont il est destinataire (y compris les filiales d'un
// groupe où il a une portée « sous-arbre »). Remplace la synthèse mensuelle des dérogations, qui y est
// intégrée. Une seule exécution par mois (`EnvoiPeriodique`), même si la tâche est rappelée.
import { Prisma, type UserRole } from '@prisma/client'
import { prisma } from './prisma'
import { getOrgConfig } from './org-config.server'
import { sanitizeRelancesConfig } from './relances'
import { cleanAppetitConfig } from './appetit'
import { isGrcActive } from './projet360'
import { niveauRisque } from './risk-item'
import { construireTableauBord, moisEcoule, type TableauBord } from './tableau-bord-mensuel'
import { sendEmail } from './email'
import { tableauBordEmail } from './email-i18n'
import { appUrl } from './org-invitation.server'

export const TACHE_TABLEAU_BORD = 'tableau-bord-mensuel'
const DESTINATAIRES: UserRole[] = ['RSSI', 'RISK_MANAGER']
const REPLI: UserRole[] = ['ADMIN']

export type ResultatTableauBord =
  | { dejaEnvoye: true; periode: string }
  | { dejaEnvoye: false; periode: string; organisations: number; emailsSent: number; emailsSkipped: number }

async function donneesOrganisation(orgId: string, cfg: Awaited<ReturnType<typeof getOrgConfig>>, debut: Date, fin: Date, now: Date): Promise<TableauBord> {
  const org = { organizationId: orgId }
  const appetit = cleanAppetitConfig(cfg.appetitRisque)
  const [risques, plans, incidents, executions, constats, preconisations, kri, derogations, analysesSoumises, derogationsRevue, aVerifier] = await Promise.all([
    cfg.registreRisquesActive ? prisma.riskItem.findMany({ where: org, select: { intitule: true, taxonomieCode: true, graviteInherente: true, vraisemblanceInherente: true, graviteResiduelle: true, vraisemblanceResiduelle: true } }) : [],
    prisma.planAction.findMany({ where: { ...org, statut: { not: 'FAIT' } }, select: { titre: true, statut: true, echeance: true } }),
    cfg.incidentsActive ? prisma.incident.findMany({ where: { ...org, createdAt: { gte: debut, lt: fin } }, select: { intitule: true, statut: true, montantBrut: true, recuperations: true, doraCriteres: true } }) : [],
    cfg.controlePermanentActive ? prisma.controleExecution.findMany({ where: { ...org, dateRealisation: { gte: debut, lt: fin } }, select: { resultat: true, dateRealisation: true } }) : [],
    cfg.auditInterneActive ? prisma.auditConstat.findMany({ where: org, select: { intitule: true, criticite: true, statut: true, echeance: true } }) : [],
    cfg.controlePermanentActive ? prisma.preconisation.findMany({ where: { ...org, statut: { in: ['OUVERT', 'EN_COURS'] } }, select: { intitule: true, statut: true, echeance: true } }) : [],
    cfg.kriActive ? prisma.kri.findMany({ where: { ...org, actif: true }, select: { intitule: true, sens: true, seuilAlerte: true, seuilCritique: true, mesures: { orderBy: { dateMesure: 'desc' }, take: 1, select: { valeur: true } } } }) : [],
    cfg.derogationsActive ? prisma.derogation.findMany({ where: { ...org, statut: 'ACTIVE' }, select: { intitule: true, statut: true, dateFin: true } }) : [],
    prisma.analyse.count({ where: { ...org, statut: 'SOUMIS' } }),
    cfg.derogationsActive ? prisma.derogation.count({ where: { ...org, statut: { in: ['DEMANDEE', 'DOUBLE_REGARD', 'VALIDATION_METIER'] } } }) : 0,
    cfg.controlePermanentActive ? prisma.preconisation.count({ where: { ...org, statut: 'RESOLU' } }) : 0,
  ])
  return construireTableauBord({
    modules: {
      registre: cfg.registreRisquesActive, incidents: !!cfg.incidentsActive, dora: !!cfg.reglementaireActive, controles: cfg.controlePermanentActive,
      audit: cfg.auditInterneActive, kri: !!cfg.kriActive, derogations: cfg.derogationsActive,
    },
    appetit: appetit.seuilGlobal != null || Object.keys(appetit.parCategorie).length > 0 ? appetit : null,
    risques: risques.map(r => ({ intitule: r.intitule, taxonomieCode: r.taxonomieCode, niveauInherent: niveauRisque(r.graviteInherente, r.vraisemblanceInherente), niveauResiduel: niveauRisque(r.graviteResiduelle, r.vraisemblanceResiduelle) })),
    plans,
    incidents: incidents.map(i => ({ ...i, montantBrut: i.montantBrut == null ? null : Number(i.montantBrut), recuperations: i.recuperations == null ? null : Number(i.recuperations) })),
    executions, constats, preconisations,
    kri: kri.map(k => ({ intitule: k.intitule, sens: k.sens, seuilAlerte: k.seuilAlerte, seuilCritique: k.seuilCritique, derniereValeur: k.mesures[0]?.valeur ?? null })),
    derogations, derogationAlerteJours: cfg.derogationAlerteJours ?? 30,
    decisionsEnAttente: analysesSoumises + derogationsRevue + aVerifier,
  }, now)
}

export async function envoyerTableauBordMensuel(now: Date = new Date()): Promise<ResultatTableauBord> {
  const { debut, fin, periode } = moisEcoule(now)
  // Réservation de la période AVANT l'envoi : jamais deux e-mails pour un même mois.
  try {
    await prisma.envoiPeriodique.create({ data: { tache: TACHE_TABLEAU_BORD, periode } })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return { dejaEnvoye: true, periode }
    throw e
  }

  // Seules les organisations ayant un destinataire possible (membre direct, ou membre d'un parent
  // à portée « sous-arbre ») : inutile de calculer un tableau de bord que personne ne recevrait.
  const gouvernance = await prisma.orgMembership.findMany({
    where: { role: { in: [...DESTINATAIRES, ...REPLI] }, user: { isActive: true } },
    select: { organizationId: true, scope: true },
  })
  const racines = [...new Set(gouvernance.filter(g => g.scope === 'SUBTREE').map(g => g.organizationId))]
  const organisations = gouvernance.length ? await prisma.organization.findMany({
    where: { OR: [{ id: { in: [...new Set(gouvernance.map(g => g.organizationId))] } }, ...racines.map(id => ({ path: { contains: `/${id}/` } }))] },
    select: { id: true, nom: true, path: true }, orderBy: { nom: 'asc' },
  }) : []
  const boite = new Map<string, { email: string; locale: string | null; sections: ({ organisation: string } & TableauBord)[] }>()
  let couvertes = 0
  for (const org of organisations) {
    const cfg = await getOrgConfig(org.id)
    if (!sanitizeRelancesConfig(cfg.relancesConfig).tableauBordMensuel || !(isGrcActive(cfg) || cfg.derogationsActive)) continue
    const ancetres = (org.path ?? '').split('/').filter(id => id && id !== org.id)
    const membres = await prisma.orgMembership.findMany({
      where: { OR: [{ organizationId: org.id }, ...(ancetres.length ? [{ organizationId: { in: ancetres }, scope: 'SUBTREE' as const }] : [])] },
      select: { organizationId: true, role: true, user: { select: { email: true, isActive: true, locale: true } } },
    })
    let dests = membres.filter(m => DESTINATAIRES.includes(m.role))
    if (!dests.length) dests = membres.filter(m => REPLI.includes(m.role) && m.organizationId === org.id)
    dests = dests.filter(m => m.user.isActive && m.user.email)
    if (!dests.length) continue
    const tableau = await donneesOrganisation(org.id, cfg, debut, fin, now)
    couvertes++
    for (const m of dests) {
      const cle = m.user.email.toLowerCase()
      const p = boite.get(cle) ?? { email: m.user.email, locale: m.user.locale, sections: [] }
      if (!p.sections.some(s => s.organisation === org.nom)) p.sections.push({ organisation: org.nom, ...tableau })
      boite.set(cle, p)
    }
  }

  let emailsSent = 0, emailsSkipped = 0
  const url = appUrl('/pilotage')
  for (const { email, locale, sections } of boite.values()) {
    const mail = tableauBordEmail(locale, { mois: debut, sections, url })
    const res = await sendEmail({ to: email, subject: mail.subject, text: mail.text, html: mail.html })
    if (res.ok) emailsSent++; else emailsSkipped++
  }
  await prisma.envoiPeriodique.update({ where: { tache_periode: { tache: TACHE_TABLEAU_BORD, periode } }, data: { bilan: { organisations: couvertes, emailsSent, emailsSkipped } } })
  return { dejaEnvoye: false, periode, organisations: couvertes, emailsSent, emailsSkipped }
}
