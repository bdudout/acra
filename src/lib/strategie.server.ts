// ─── Stratégie cyber / IT / résilience — accès serveur (lot S1a) ─────────────
// Helpers partagés des routes /api/strategies/** : module requis (`strategieActive`, 404 sans divulgation), chargement
// DANS l'organisation active (404 sinon), existence d'une source du store d'actions dans l'org (gatherActionItems,
// mêmes règles de visibilité que /actions), historisation des évolutions après validation.
// Toute écriture décide sous verrou de la ligne Strategie (`sousVerrouStrategie`, SELECT … FOR UPDATE) : statut relu,
// décision, écriture et historique dans la même transaction (aucune course entre décision et écriture).
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { getOrgConfig } from './org-config.server'
import { gatherActionItems } from './action-items.server'
import type { OrgScopeContext, UserRole } from './permissions'
import type { OrgConfigResolved } from './org-config'
import { changementIdentifiants, decisionModifIdentifiants, type Decision, type EvolutionType, type Identifiants } from './strategie'

export const echec = (status: number, error: string, extra?: Record<string, unknown>) => NextResponse.json({ error, ...extra }, { status })

/** Configuration de l'org si le module Stratégie y est actif (valeur effective, politique d'instance comprise), sinon null. */
export async function configStrategie(orgId: string): Promise<OrgConfigResolved | null> {
  const cfg = await getOrgConfig(orgId)
  return cfg.strategieActive ? cfg : null
}

/** Stratégie de l'organisation (null si absente ou d'une autre organisation). */
export function strategieDeLOrg(orgId: string, id: string) {
  return prisma.strategie.findFirst({ where: { id, organizationId: orgId } })
}

/** Contexte d'une route sur une stratégie : module actif (404 `module_inactif`) et stratégie DANS l'org (404 `not_found`). */
type StrategieRow = NonNullable<Awaited<ReturnType<typeof strategieDeLOrg>>>
export type ContexteStrategie = { erreur: NextResponse } | { cfg: OrgConfigResolved; strategie: StrategieRow }

export async function contexteStrategie(orgId: string, id: string): Promise<ContexteStrategie> {
  const cfg = await configStrategie(orgId)
  if (!cfg) return { erreur: echec(404, 'module_inactif') }
  const strategie = await strategieDeLOrg(orgId, id)
  if (!strategie) return { erreur: echec(404, 'not_found') }
  return { cfg, strategie }
}

type Tx = Prisma.TransactionClient
type Client = Tx | typeof prisma

/**
 * Exécute `fn` dans une transaction après avoir verrouillé la ligne Strategie de l'organisation (FOR UPDATE) et relu
 * la stratégie sous ce verrou : la décision (statut, figeage, justification) repose sur cette relecture.
 * Stratégie absente (ou d'une autre organisation) : 404 `not_found`, `fn` n'est pas appelée.
 */
export function sousVerrouStrategie<T>(orgId: string, id: string, fn: (tx: Tx, strategie: StrategieRow) => Promise<T>): Promise<T | Refus> {
  return prisma.$transaction(async tx => {
    const verrou = await tx.$queryRaw<{ id: string; statut: string }[]>`SELECT id, statut FROM "Strategie" WHERE id = ${id} AND "organizationId" = ${orgId} FOR UPDATE`
    if (!verrou.length) return { erreur: echec(404, 'not_found') }
    const strategie = await tx.strategie.findFirst({ where: { id, organizationId: orgId } })
    if (!strategie) return { erreur: echec(404, 'not_found') }
    return fn(tx, { ...strategie, statut: verrou[0].statut })
  })
}

/** Refus produit sous verrou (réponse HTTP prête) ; garde de type pour les résultats de `sousVerrouStrategie`. */
export type Refus = { erreur: NextResponse }
export function estRefus<T>(r: T | Refus): r is Refus {
  return !!r && typeof r === 'object' && (r as { erreur?: unknown }).erreur instanceof Response
}

/** KRI de l'organisation (null sinon) : un objectif ne référence qu'un KRI de sa propre organisation. */
export function kriDeLOrg(client: Client, orgId: string, kriId: string) {
  return client.kri.findFirst({ where: { id: kriId, organizationId: orgId }, select: { id: true } })
}

/** Cadre courant d'une stratégie : axes ordonnés avec leurs objectifs et rattachements. */
export async function chargerCadre(strategieId: string, client: Client = prisma) {
  const [axes, objectifs, rattachements] = await Promise.all([
    client.axeStrategique.findMany({ where: { strategieId }, orderBy: [{ ordre: 'asc' }, { createdAt: 'asc' }] }),
    client.objectifStrategique.findMany({ where: { axe: { strategieId } }, orderBy: { createdAt: 'asc' } }),
    client.rattachementStrategique.findMany({ where: { axe: { strategieId } }, orderBy: { createdAt: 'asc' } }),
  ])
  return axes.map(a => ({
    ...a,
    objectifs: objectifs.filter(o => o.axeId === a.id),
    rattachements: rattachements.filter(r => r.axeId === a.id),
  }))
}

/** Axe d'une stratégie donnée (elle-même déjà vérifiée dans l'org). */
export function axeDeLaStrategie(strategieId: string, axeId: string, client: Client = prisma) {
  return client.axeStrategique.findFirst({ where: { id: axeId, strategieId } })
}

/** Objectif d'une stratégie donnée. */
export function objectifDeLaStrategie(strategieId: string, objectifId: string, client: Client = prisma) {
  return client.objectifStrategique.findFirst({ where: { id: objectifId, axe: { strategieId } } })
}

/**
 * Vrai si la source (`sourceType`, `sourceId`) existe dans l'organisation ET est visible du demandeur : on réutilise
 * le chargement du store d'actions unifié (modules actifs, analyses accessibles) — aucune existence révélée hors périmètre.
 */
export async function sourceExisteDansOrg(
  orgId: string, cfg: OrgConfigResolved, access: { userId: string; role: UserRole; scope: OrgScopeContext },
  sourceType: string, sourceId: string,
): Promise<boolean> {
  const items = await gatherActionItems(orgId, {
    incidentsActive: cfg.incidentsActive, controlePermanentActive: cfg.controlePermanentActive,
    auditInterneActive: cfg.auditInterneActive, registreRisquesActive: cfg.registreRisquesActive, conformiteActive: cfg.conformiteActive,
  }, access)
  return items.some(i => i.source === sourceType && i.sourceId === sourceId)
}

/** Historise une évolution (après validation) : qui, quand, quoi, justification. */
export function historiser(
  tx: Client,
  e: { strategieId: string; organizationId: string; type: EvolutionType; cibleId?: string | null; avant?: unknown; apres?: unknown; justification: string; auteurId: string },
) {
  return tx.strategieEvolution.create({
    data: {
      strategieId: e.strategieId, organizationId: e.organizationId, type: e.type, cibleId: e.cibleId ?? null,
      avant: e.avant == null ? undefined : (JSON.parse(JSON.stringify(e.avant)) as Prisma.InputJsonValue),
      apres: e.apres == null ? undefined : (JSON.parse(JSON.stringify(e.apres)) as Prisma.InputJsonValue),
      justification: e.justification, auteurId: e.auteurId,
    },
  })
}

type DonneesIds = { referenceInterne?: string | null; identifiantsExternes?: Prisma.InputJsonValue | typeof Prisma.DbNull }

/** Identifiants normalisés → données Prisma (null d'un champ JSON ⇒ `Prisma.DbNull`). */
export function donneesIdentifiants(ids: Identifiants): DonneesIds {
  const out: DonneesIds = {}
  if (ids.referenceInterne !== undefined) out.referenceInterne = ids.referenceInterne
  if (ids.identifiantsExternes !== undefined) {
    out.identifiantsExternes = ids.identifiantsExternes === null ? Prisma.DbNull : (ids.identifiantsExternes as unknown as Prisma.InputJsonValue)
  }
  return out
}

/**
 * Modification d'un élément (stratégie, axe, objectif), sous verrou de la stratégie : l'élément (`charger`) et le
 * statut sont relus dans la transaction, puis les champs du cadre (`reste`) suivent `decisionReste` (figeage,
 * justification) et les identifiants internes `decisionModifIdentifiants` (modifiables même si figé). Écriture et
 * historique (type du cadre + IDENTIFIANTS) dans cette même transaction.
 */
export async function appliquerModification<T>(p: {
  strategieId: string; organizationId: string
  charger: (tx: Tx, strategie: StrategieRow) => Promise<Record<string, unknown> | null>
  reste: Record<string, unknown>
  ids: Identifiants
  decisionReste: (strategie: StrategieRow, row: Record<string, unknown>) => Decision | { ok: true } | { ok: false; reponse: NextResponse }
  typeCadre: EvolutionType | null
  cibleId: string; auteurId: string
  justification: string | null
  ecrire: (tx: Tx, data: Record<string, unknown>) => Promise<T>
}): Promise<{ erreur: NextResponse } | { valeur: T; historise: boolean }> {
  return sousVerrouStrategie(p.organizationId, p.strategieId, async (tx, strategie) => {
    const row = await p.charger(tx, strategie)
    if (!row) return { erreur: echec(404, 'not_found') }
    let historiserReste = false
    if (Object.keys(p.reste).length > 0) {
      const d = p.decisionReste(strategie, row)
      if (!d.ok) return { erreur: 'reponse' in d ? d.reponse : echec(d.status, d.error) }
      historiserReste = 'historiser' in d && d.historiser
    }
    let historiserIds = false
    if (Object.keys(p.ids).length) {
      const di = decisionModifIdentifiants(strategie.statut)
      if (!di.ok) return { erreur: echec(di.status, di.error) }
      historiserIds = di.historiser
    }
    // Avant / après calculés AVANT l'écriture.
    const changement = changementIdentifiants(row, p.ids)
    const avantReste = Object.fromEntries(Object.keys(p.reste).map(k => [k, row[k]]))
    const valeur = await p.ecrire(tx, { ...p.reste, ...donneesIdentifiants(p.ids) })
    const base = { strategieId: p.strategieId, organizationId: p.organizationId, cibleId: p.cibleId, auteurId: p.auteurId }
    if (historiserReste && p.typeCadre) {
      await historiser(tx, { ...base, type: p.typeCadre, avant: avantReste, apres: p.reste, justification: p.justification ?? '' })
    }
    // Métadonnée administrative : tracée sans justification obligatoire.
    if (historiserIds && changement) await historiser(tx, { ...base, type: 'IDENTIFIANTS', avant: changement.avant, apres: changement.apres, justification: p.justification ?? '' })
    return { valeur, historise: historiserReste || (historiserIds && !!changement) }
  })
}

/** Noms affichables (nom, sinon e-mail) des utilisateurs cités par la stratégie (validation, auteurs d'évolutions). */
export async function nomsUtilisateurs(ids: (string | null | undefined)[]): Promise<Record<string, string>> {
  const uniques = [...new Set(ids.filter((v): v is string => !!v))]
  if (!uniques.length) return {}
  const users = await prisma.user.findMany({ where: { id: { in: uniques } }, select: { id: true, name: true, email: true } })
  return Object.fromEntries(users.map(u => [u.id, u.name || u.email]))
}
