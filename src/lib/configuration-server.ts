/**
 * configuration-server.ts — Récupération server-only de l'échelle commune.
 *
 * Isolé de `risk-scale.ts` (pur, importable côté client) car ce module dépend de
 * Prisma et ne doit jamais être embarqué dans un bundle client.
 *
 * L'échelle/seuils sont un singleton global (`Configuration` id="global") défini
 * par l'ADMIN et partagé par toutes les analyses. À défaut, valeurs par défaut.
 */

import { prisma } from '@/lib/prisma'
import { resolveScaleConfig, type ScaleConfig } from '@/lib/risk-scale'

export const ROOT_ORG_ID = 'global'
export type ScalesScope = 'SHARED' | 'PER_ORG'

/**
 * Portée des échelles (réglage INSTANCE, lu sur la config racine) :
 *  - SHARED  : échelle/matrice commune à toutes les organisations (mode « groupe ») ;
 *  - PER_ORG : chaque organisation peut avoir ses propres échelles (mode « consultant »).
 */
export async function getScalesScope(): Promise<ScalesScope> {
  const root = await prisma.organizationConfig.findUnique({ where: { id: ROOT_ORG_ID }, select: { scalesScope: true } })
  return (root as any)?.scalesScope === 'PER_ORG' ? 'PER_ORG' : 'SHARED'
}

/** Id de la Configuration à ÉDITER pour une organisation, selon le mode. */
export async function resolveScaleConfigTargetId(orgId?: string | null): Promise<string> {
  const scope = await getScalesScope()
  return scope === 'PER_ORG' && orgId ? orgId : ROOT_ORG_ID
}

/**
 * Échelle EFFECTIVE pour une organisation. En mode SHARED (ou sans org) : la config
 * racine. En mode PER_ORG : la Configuration la plus proche en remontant le chemin
 * (org → ancêtres → racine), sinon valeurs par défaut.
 */
export async function getEffectiveScaleConfig(orgId?: string | null): Promise<ScaleConfig> {
  const scope = await getScalesScope()
  if (scope === 'SHARED' || !orgId) {
    const config = await prisma.configuration.findUnique({ where: { id: ROOT_ORG_ID } })
    return resolveScaleConfig(config as unknown as Partial<ScaleConfig> | null)
  }
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { path: true } })
  const idsRootToSelf = org?.path ? org.path.split('/').filter(Boolean) : [orgId]
  const rows = await prisma.configuration.findMany({ where: { id: { in: idsRootToSelf } } })
  const byId = new Map(rows.map(r => [r.id, r]))
  for (const id of idsRootToSelf.slice().reverse()) {
    const r = byId.get(id)
    if (r) return resolveScaleConfig(r as unknown as Partial<ScaleConfig>)
  }
  return resolveScaleConfig(null)
}
