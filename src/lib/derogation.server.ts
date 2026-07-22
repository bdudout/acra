import { prisma } from '@/lib/prisma'

/**
 * Ensemble des `ref` de contrôles couverts par une dérogation ACTIVE non expirée,
 * pour un référentiel donné — sert à marquer les contrôles « dérogés » du socle
 * (voir lib/conformite `marquerDerogations`). Portée : une analyse (`analyseId`),
 * ou le niveau organisation (`analyseId` null + `organizationId`).
 */
export async function derogRefsActives(
  params: { referentiel: string; analyseId?: string | null; organizationId?: string | null },
  now: Date = new Date(),
): Promise<Set<string>> {
  if (!params.referentiel) return new Set()
  const where: Record<string, unknown> = {
    portee: 'CONTROLE',
    statut: 'ACTIVE',
    referentiel: params.referentiel,
    ref: { not: null },
    // Non expirée : une dérogation ACTIVE dont la dateFin est passée est EXPIRÉE
    // (le contrôle redevient une non-conformité), donc exclue.
    OR: [{ dateFin: null }, { dateFin: { gte: now } }],
  }
  if (params.analyseId) where.analyseId = params.analyseId
  else if (params.organizationId) { where.analyseId = null; where.organizationId = params.organizationId }
  else return new Set()

  const rows = await prisma.derogation.findMany({ where, select: { ref: true } })
  return new Set(rows.map(r => r.ref).filter((r): r is string => !!r))
}
