// ─── Programme d'audit et de contrôle — accès serveur ──────────────────────────
// Contexte d'une requête (rôle EFFECTIF dans l'organisation active, configuration), droits de lecture, chargement d'un
// plan borné à l'organisation (404 sans divulgation). Logique de décision : lib/planification (pure, testée).
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { prisma } from './prisma'
import { getAnalyseScope } from './org-context.server'
import { getOrgConfig } from './org-config.server'
import { voitTousLesResultats } from './acces-resultats'
import { sanitizePlanificationConfig, TYPES_PLAN, cleanRealisations, statutLigne, tauxRealisation, type CandidatRealisation, type PlanificationConfig, type Realisation, type StatutRealisation, type TypePlan } from './planification'
import type { UserRole } from './permissions'
import { anglesMorts, sollicitationsMultiples, type LigneVue } from './planification-vue'

export interface ContextePlan { userId: string; role: UserRole; orgId: string; cfg: PlanificationConfig; modules: Record<TypePlan, boolean> }

/** Session + organisation active + lecture globale du dispositif (les plans portent sur les résultats d'audit et de contrôle). */
export async function contextePlan(): Promise<ContextePlan | { error: NextResponse }> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const userId = (session.user as { id: string }).id
  const scope = await getAnalyseScope(userId, ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole)
  if (!scope.activeOrgId) return { error: NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 }) }
  const role = scope.role as UserRole
  if (!voitTousLesResultats(role)) return { error: NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 }) }
  const org = await getOrgConfig(scope.activeOrgId)
  const modules = { AUDIT: !!org.auditInterneActive, CONTROLE: !!org.controlePermanentActive }
  if (!modules.AUDIT && !modules.CONTROLE) return { error: NextResponse.json({ error: 'module_inactif' }, { status: 404 }) }
  return { userId, role, orgId: scope.activeOrgId, cfg: sanitizePlanificationConfig(org.planificationConfig), modules }
}

/** Plan de l'organisation active dont le module est actif ; sinon 404 (aucune divulgation). */
export async function chargerPlan(id: string, c: ContextePlan) {
  const plan = await prisma.planProgramme.findFirst({ where: { id, organizationId: c.orgId } })
  if (!plan || !c.modules[plan.type as TypePlan]) return null
  return plan
}

/** Années de l'horizon d'un plan (crée celles qui manquent, en brouillon). */
export async function assurerAnnees(planId: string, debut: number, fin: number): Promise<void> {
  const existantes = new Set((await prisma.planAnnee.findMany({ where: { planId }, select: { annee: true } })).map(a => a.annee))
  const manquantes = Array.from({ length: fin - debut + 1 }, (_, i) => debut + i).filter(a => !existantes.has(a))
  if (manquantes.length) await prisma.planAnnee.createMany({ data: manquantes.map(annee => ({ planId, annee })), skipDuplicates: true })
}

// ─── Réalisations (lot P4) : missions, contrôles, campagnes de l'organisation ─

const jourIso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null)
const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

export interface DonneesRealisations {
  missions: { id: string; intitule: string; statut: string; debut: string | null; fin: string | null; processus: string[] }[]
  controles: { id: string; intitule: string; riskItemId: string | null; processusId: string | null; executions: string[] }[]
  campagnes: { id: string; intitule: string; statut: string; debut: string | null; fin: string | null; controleIds: string[] }[]
}

/** Missions d'audit, contrôles (dates d'exécution) et campagnes de contrôle de l'organisation. */
export async function donneesRealisations(orgId: string): Promise<DonneesRealisations> {
  const [missions, controles, campagnes] = await Promise.all([
    prisma.auditMission.findMany({ where: { organizationId: orgId }, select: { id: true, intitule: true, statut: true, dateDebut: true, dateFin: true, processusIds: true }, take: 5000 }),
    prisma.controle.findMany({ where: { organizationId: orgId }, select: { id: true, intitule: true, riskItemId: true, processusId: true, executions: { select: { dateRealisation: true } } }, take: 5000 }),
    prisma.campagneControle.findMany({ where: { organizationId: orgId }, select: { id: true, intitule: true, statut: true, dateDebut: true, dateFin: true, controleIds: true }, take: 5000 }),
  ])
  return {
    missions: missions.map(m => ({ id: m.id, intitule: m.intitule, statut: m.statut, debut: jourIso(m.dateDebut), fin: jourIso(m.dateFin), processus: ids(m.processusIds) })),
    controles: controles.map(c => ({ id: c.id, intitule: c.intitule, riskItemId: c.riskItemId, processusId: c.processusId, executions: c.executions.map(e => jourIso(e.dateRealisation) as string) })),
    campagnes: campagnes.map(c => ({ id: c.id, intitule: c.intitule, statut: c.statut, debut: jourIso(c.dateDebut), fin: jourIso(c.dateFin), controleIds: ids(c.controleIds) })),
  }
}

/** État d'une réalisation rattachée pour l'année d'une ligne ; null si elle n'existe pas (ou plus) dans l'organisation. */
export function etatRealisation(r: Realisation, annee: number, d: DonneesRealisations): { statut: StatutRealisation; intitule: string } | null {
  if (r.type === 'MISSION') { const m = d.missions.find(x => x.id === r.id); return m ? { statut: m.statut as StatutRealisation, intitule: m.intitule } : null }
  if (r.type === 'CAMPAGNE') { const c = d.campagnes.find(x => x.id === r.id); return c ? { statut: c.statut as StatutRealisation, intitule: c.intitule } : null }
  const c = d.controles.find(x => x.id === r.id)
  return c ? { statut: c.executions.some(e => e.startsWith(String(annee))) ? 'EXECUTE' : 'NON_EXECUTE', intitule: c.intitule } : null
}

/** Candidats de l'année : missions et campagnes datées, contrôles (actifs toute l'année), avec leurs processus et risques. */
export function candidatsRealisation(annee: number, d: DonneesRealisations): CandidatRealisation[] {
  const ctrl = new Map(d.controles.map(c => [c.id, c]))
  return [
    ...d.missions.map(m => ({ type: 'MISSION' as const, id: m.id, intitule: m.intitule, processus: m.processus, risques: [], debut: m.debut, fin: m.fin })),
    ...d.controles.map(c => ({ type: 'CONTROLE' as const, id: c.id, intitule: c.intitule, processus: c.processusId ? [c.processusId] : [], risques: c.riskItemId ? [c.riskItemId] : [], debut: `${annee}-01-01`, fin: `${annee}-12-31` })),
    ...d.campagnes.map(c => {
      const cs = c.controleIds.map(id => ctrl.get(id)).filter((x): x is NonNullable<typeof x> => !!x)
      return { type: 'CAMPAGNE' as const, id: c.id, intitule: c.intitule, processus: [...new Set(cs.flatMap(x => (x.processusId ? [x.processusId] : [])))], risques: [...new Set(cs.flatMap(x => (x.riskItemId ? [x.riskItemId] : [])))], debut: c.debut, fin: c.fin }
    }),
  ]
}

// ─── Vue globale (lot P5), partagée par l'écran et l'export ─────────────────
const jour = jourIso
const liste = ids
/** Vue globale de l'année (lot P5) : plans, lignes, sollicitations, angles morts, taux de réalisation. */
export async function calculerVueGlobale(c: ContextePlan, annee: number) {
  const maintenant = new Date()
  const types = TYPES_PLAN.filter(t => c.modules[t])

  const plans = await prisma.planProgramme.findMany({
    where: { organizationId: c.orgId, type: { in: [...types] } },
    select: { id: true, nom: true, type: true, equipe: true, annees: { where: { annee }, select: { statut: true } }, lignes: { where: { annee: { gte: annee } } } },
    orderBy: [{ type: 'asc' }, { nom: 'asc' }],
  })
  const lignes: LigneVue[] = plans.flatMap(p => p.lignes.filter(l => l.annee === annee).map(l => ({
    ligneId: l.id, planId: p.id, planNom: p.nom, type: p.type as 'AUDIT' | 'CONTROLE', intitule: l.intitule,
    debut: jour(l.debut), fin: jour(l.fin), statutManuel: l.statutManuel, priorite: l.priorite, cibles: (l.cibles ?? {}) as LigneVue['cibles'],
  })))
  // Prévus : lignes actives de l'année affichée et des suivantes.
  const prevues = plans.flatMap(p => p.lignes).filter(l => l.statutManuel !== 'ANNULEE')
  const cibles = (k: 'risques' | 'processus') => [...new Set(prevues.flatMap(l => liste((l.cibles as Record<string, unknown>)?.[k])))]

  const org = await prisma.organization.findUnique({ where: { id: c.orgId }, select: { path: true } })
  const [organisations, tiers, risques, processus, missions, controles] = await Promise.all([
    prisma.organization.findMany({ where: { path: { startsWith: org?.path ?? `/${c.orgId}/` } }, select: { id: true, nom: true } }),
    prisma.tierOrganization.findMany({ where: { organizationId: c.orgId }, select: { tier: { select: { id: true, nom: true } } } }),
    prisma.riskItem.findMany({ where: { organizationId: c.orgId }, select: { id: true, intitule: true, graviteInherente: true, vraisemblanceInherente: true, graviteResiduelle: true, vraisemblanceResiduelle: true } }),
    prisma.processus.findMany({ where: { organizationId: c.orgId }, select: { id: true, nom: true, criticite: true, criticiteDora: true } }),
    prisma.auditMission.findMany({ where: { organizationId: c.orgId }, select: { dateDebut: true, dateFin: true, processusIds: true } }),
    prisma.controle.findMany({ where: { organizationId: c.orgId }, select: { riskItemId: true, processusId: true, executions: { select: { dateRealisation: true }, orderBy: { dateRealisation: 'desc' }, take: 1 } } }),
  ])

  // Dernière couverture réelle (passée) par risque et par processus.
  const aujourdhui = jour(maintenant) as string
  const derniere = { risques: {} as Record<string, string>, processus: {} as Record<string, string> }
  const noter = (map: Record<string, string>, id: string | null, d: string | null) => { if (id && d && d <= aujourdhui && (!map[id] || map[id] < d)) map[id] = d }
  for (const m of missions) for (const p of liste(m.processusIds)) noter(derniere.processus, p, jour(m.dateFin ?? m.dateDebut))
  for (const ct of controles) {
    const d = jour(ct.executions[0]?.dateRealisation ?? null)
    noter(derniere.risques, ct.riskItemId, d); noter(derniere.processus, ct.processusId, d)
  }

  // Statuts calculés des lignes de l'année (réalisations rattachées, période) → taux de réalisation par plan (lot P4).
  const donnees = await donneesRealisations(c.orgId)
  const statutDe = new Map(plans.flatMap(p => p.lignes.filter(l => l.annee === annee).map(l => [l.id, statutLigne(
    { debut: jour(l.debut), fin: jour(l.fin), statutManuel: l.statutManuel },
    cleanRealisations(l.realisations).flatMap(r => { const e = etatRealisation(r, annee, donnees); return e ? [{ statut: e.statut }] : [] }),
    aujourdhui,
  )] as const)))
  const noms = Object.fromEntries([...organisations.map(o => [o.id, o.nom]), ...tiers.map(t => [t.tier.id, t.tier.nom])])
  return {
    annee,
    seuilAnglesMortsAns: c.cfg.seuilAnglesMortsAns,
    plans: plans.map(p => {
      const ls = lignes.filter(l => l.planId === p.id)
      return { id: p.id, nom: p.nom, type: p.type, equipe: p.equipe, statut: p.annees[0]?.statut ?? null, lignes: ls.length, annulees: ls.filter(l => l.statutManuel === 'ANNULEE').length, reportees: ls.filter(l => l.statutManuel === 'REPORTEE').length, realisation: tauxRealisation(ls.map(l => statutDe.get(l.ligneId) ?? 'A_VENIR')) }
    }),
    lignes,
    sollicitations: sollicitationsMultiples(lignes, noms),
    anglesMorts: anglesMorts({ maintenant, seuilAns: c.cfg.seuilAnglesMortsAns, risques, processus, dernieresCouvertures: derniere, prevus: { risques: cibles('risques'), processus: cibles('processus') } }),
  }
}

/** Noms des cibles possibles (organisations du sous-arbre, tiers rattachés, risques, processus) pour les exports. */
export async function nomsCibles(orgId: string): Promise<Record<string, string>> {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { path: true } })
  const [organisations, tiers, risques, processus] = await Promise.all([
    prisma.organization.findMany({ where: { path: { startsWith: org?.path ?? `/${orgId}/` } }, select: { id: true, nom: true } }),
    prisma.tierOrganization.findMany({ where: { organizationId: orgId }, select: { tier: { select: { id: true, nom: true } } } }),
    prisma.riskItem.findMany({ where: { organizationId: orgId }, select: { id: true, intitule: true } }),
    prisma.processus.findMany({ where: { organizationId: orgId }, select: { id: true, nom: true } }),
  ])
  return Object.fromEntries([
    ...organisations.map(o => [o.id, o.nom]), ...tiers.map(t => [t.tier.id, t.tier.nom]),
    ...risques.map(r => [r.id, r.intitule]), ...processus.map(p => [p.id, p.nom]),
  ])
}
