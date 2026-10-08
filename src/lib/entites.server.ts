// ─── Référentiel des entités : accès serveur (lot E1) ─────────────────────────
// Contexte (organisation active, droit de modification), contrôles d'appartenance et décompte des références.
// Règles pures : lib/entites.ts. Routes : /api/referentiel-entites/**.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { prisma } from './prisma'
import { getAnalyseScope } from './org-context.server'
import { isInSubtree } from './org-context'
import { isAdminRole, type UserRole } from './permissions'
import { configConnecteur, connecteurConfigure } from './entity-sync.server'
import { creeraitUnCycle, sourceVeriteDe, type EntiteSaisie, type SourceVerite } from './entites'
import type { SourceTexte } from './entites-rapprochement'
import { resoudreEntite } from './entites-filtre'

export interface ContexteEntites { userId: string; email?: string; role: UserRole; orgId: string; orgPath: string; admin: boolean; sourceVerite: SourceVerite; connecteur: boolean }

/** Lecture : tout membre de l'organisation active (le sélecteur d'entité en a besoin) ; écriture : ADMIN. */
export async function contexteEntites(): Promise<ContexteEntites | { error: NextResponse }> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const user = session.user as { id: string; email?: string | null; role?: string }
  const scope = await getAnalyseScope(user.id, (user.role ?? 'ANALYSTE') as UserRole)
  if (!scope.activeOrgId) return { error: NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 }) }
  const [org, cfg] = await Promise.all([
    prisma.organization.findUnique({ where: { id: scope.activeOrgId }, select: { path: true } }),
    prisma.organizationConfig.findUnique({ where: { id: scope.activeOrgId }, select: { entitesSyncConfig: true } }),
  ])
  if (!org) return { error: NextResponse.json({ error: 'Organisation introuvable' }, { status: 404 }) }
  const role = scope.role as UserRole
  return { userId: user.id, email: user.email ?? undefined, role, orgId: scope.activeOrgId, orgPath: org.path, admin: isAdminRole(role), sourceVerite: sourceVeriteDe(cfg?.entitesSyncConfig), connecteur: connecteurConfigure(configConnecteur(cfg?.entitesSyncConfig)) }
}

/** Parent dans la même organisation, sans boucle ; organisation liée dans le sous-arbre de l'organisation active. */
export async function verifierLiens(c: ContexteEntites, saisie: Partial<EntiteSaisie>, id?: string): Promise<string | null> {
  if (saisie.parentId) {
    const entites = await prisma.entite.findMany({ where: { organizationId: c.orgId }, select: { id: true, parentId: true } })
    if (!entites.some(e => e.id === saisie.parentId)) return 'parent_invalide'
    if (id && creeraitUnCycle(entites, id, saisie.parentId)) return 'cycle'
  }
  if (saisie.organisationLieeId) {
    const o = await prisma.organization.findUnique({ where: { id: saisie.organisationLieeId }, select: { path: true } })
    if (!o || !isInSubtree(o.path, c.orgPath)) return 'organisation_invalide'
  }
  if (saisie.codeExterne) {
    const autre = await prisma.entite.findFirst({ where: { organizationId: c.orgId, codeExterne: saisie.codeExterne, ...(id ? { id: { not: id } } : {}) }, select: { id: true } })
    if (autre) return 'code_existant'
  }
  return null
}

export const COMPTE_REFERENCES = { risques: true, incidents: true, conformites: true, plansAction: true, traitementsConformite: true, mesures: true, enfants: true } as const

export function totalReferences(c: Record<keyof typeof COMPTE_REFERENCES, number>): number {
  return Object.values(c).reduce((a, b) => a + b, 0)
}

/** Périmètre d'une source d'objets rattachables à une entité : l'organisation (les mesures, via leur analyse). */
export const perimetreSource = (orgId: string, source: SourceTexte) => (source === 'mesures' ? { analyse: { organizationId: orgId } } : { organizationId: orgId })

type LecteurEntites = { entite: { findMany(a: object): Promise<{ id: string; nom: string; type: string; alias: unknown; codeExterne: string | null; parentId: string | null; source: string; valideAu: Date | null }[]> } }

/** Lien automatique à l'écriture (lot E5) : entité ACTIVE dont le nom, un alias ou le code est identique au texte saisi.
 *  Jamais de lien sur une simple proximité ; une erreur de lecture ne bloque pas la saisie (pas de lien). */
export async function entiteIdPourTexte(orgId: string, texte: string | null | undefined, db: LecteurEntites = prisma as unknown as LecteurEntites): Promise<string | null> {
  if (!texte?.trim()) return null
  try {
    const rows = await db.entite.findMany({ where: { organizationId: orgId }, select: { id: true, nom: true, type: true, alias: true, codeExterne: true, parentId: true, source: true, valideAu: true } })
    const actives = rows.filter(r => !r.valideAu || r.valideAu > new Date()).map(r => ({ ...r, alias: Array.isArray(r.alias) ? (r.alias as string[]) : [] }))
    return resoudreEntite(null, texte, actives)
  } catch { return null }
}
