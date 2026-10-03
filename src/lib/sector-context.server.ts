// Secteurs d'activité effectifs d'une organisation (déclarés, sinon hérités de l'ancêtre le plus proche).
import { prisma } from './prisma'
import { effectiveSectors } from './sector-selection'
import { normalizePatterns, PATTERNS_MAX_MAX } from './patterns-archi'

export async function orgSectors(orgId: string) {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { path: true, secteursActivite: true } })
  const ancestorIds = (org?.path ?? '').split('/').filter(id => id && id !== orgId).reverse()
  if (Array.isArray(org?.secteursActivite) && org.secteursActivite.length) return effectiveSectors([org.secteursActivite])
  if (!ancestorIds.length) return effectiveSectors([org?.secteursActivite])
  const ancestors = await prisma.organization.findMany({ where: { id: { in: ancestorIds } }, select: { id: true, secteursActivite: true } })
  const byId = new Map(ancestors.map(a => [a.id, a.secteursActivite]))
  return effectiveSectors([org?.secteursActivite, ...ancestorIds.map(id => byId.get(id))])
}

/**
 * Patterns d'architecture « cochés » dans l'organisation : union de ceux des analyses actives (non supprimées, non archivées).
 * Le catalogue propose les contrôles, KRI et audits rattachés à ces patterns (vision technique, indépendante du secteur).
 */
export async function orgPatterns(orgId: string): Promise<string[]> {
  const rows = await prisma.analyse.findMany({ where: { organizationId: orgId, deletedAt: null, statut: { not: 'ARCHIVE' } }, select: { patternsArchi: true }, take: 1000 })
  return normalizePatterns(rows.flatMap(r => (Array.isArray(r.patternsArchi) ? r.patternsArchi : [])), { max: PATTERNS_MAX_MAX })
}
