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
import { sanitizePlanificationConfig, type CandidatRealisation, type PlanificationConfig, type Realisation, type StatutRealisation, type TypePlan } from './planification'
import type { UserRole } from './permissions'

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
