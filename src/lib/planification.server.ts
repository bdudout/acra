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
import { sanitizePlanificationConfig, type PlanificationConfig, type TypePlan } from './planification'
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
