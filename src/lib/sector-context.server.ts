// Secteurs d'activité effectifs d'une organisation (déclarés, sinon hérités de l'ancêtre le plus proche).
import { prisma } from './prisma'
import { effectiveSectors } from './sector-selection'

export async function orgSectors(orgId: string) {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { path: true, secteursActivite: true } })
  const ancestorIds = (org?.path ?? '').split('/').filter(id => id && id !== orgId).reverse()
  if (Array.isArray(org?.secteursActivite) && org.secteursActivite.length) return effectiveSectors([org.secteursActivite])
  if (!ancestorIds.length) return effectiveSectors([org?.secteursActivite])
  const ancestors = await prisma.organization.findMany({ where: { id: { in: ancestorIds } }, select: { id: true, secteursActivite: true } })
  const byId = new Map(ancestors.map(a => [a.id, a.secteursActivite]))
  return effectiveSectors([org?.secteursActivite, ...ancestorIds.map(id => byId.get(id))])
}
