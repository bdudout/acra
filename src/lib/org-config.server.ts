/**
 * org-config.server.ts — Résolution SERVEUR de la configuration d'une organisation
 * (multi-organisation, L2). Récupère le row de l'organisation et de ses ancêtres
 * (via le chemin matérialisé), puis applique l'héritage (`resolveOrgConfig`).
 *
 * Rétrocompatible : sans organisation (ou organisation racine « global »), renvoie
 * la config de la racine fusionnée aux défauts — identique au comportement singleton.
 */

import { prisma } from '@/lib/prisma'
import { resolveOrgConfig, type RawOrgConfig, type OrgConfigResolved } from '@/lib/org-config'

const CONFIG_SELECT = {
  entitesMesures: true,
  typesImpacts: true,
  referentielsActifs: true,
  strategiesTraitement: true,
  exemplesAteliers: true,
  echellesEcosysteme: true,
  qualificationActive: true,
  qualificationObligatoire: true,
  conformiteActive: true,
  conformiteNiveau: true,
  conformiteSnapshotMode: true,
  conseilsAteliersActive: true,
} as const

/**
 * Configuration effective d'une organisation (héritage des ancêtres appliqué).
 * `orgId` absent/inconnu ⇒ valeurs par défaut.
 */
export async function getOrgConfig(orgId: string | null | undefined): Promise<OrgConfigResolved> {
  if (!orgId) return resolveOrgConfig([])

  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { path: true } })
  // Chaîne d'ids racine→nœud déduite du chemin "/racine/…/nœud/".
  const idsRootToSelf = org?.path ? org.path.split('/').filter(Boolean) : [orgId]

  const rows = await prisma.organizationConfig.findMany({
    where: { id: { in: idsRootToSelf } },
    select: { id: true, ...CONFIG_SELECT },
  })
  const byId = new Map(rows.map(r => [r.id, r as unknown as RawOrgConfig]))

  // Chaîne SELF-first (nœud → racine) pour resolveOrgConfig.
  const chainSelfFirst = idsRootToSelf.slice().reverse().map(id => byId.get(id) ?? null)
  return resolveOrgConfig(chainSelfFirst)
}
