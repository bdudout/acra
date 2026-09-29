// Création en masse d'incidents validés (import CSV, API v1) : une transaction, statut DECLARE,
// déclarant = utilisateur (ou créateur de la clé d'API). Les objets JSON sont castés pour Prisma.
import { prisma } from '@/lib/prisma'
import type { CleanIncident } from '@/lib/incident'
import { separerJson } from '@/lib/incident-json'

export async function creerIncidentsEnMasse(orgId: string, declarantId: string, valides: CleanIncident[]): Promise<number> {
  if (valides.length === 0) return 0
  const res = await prisma.incident.createMany({
    data: valides.map(({ statut: _s, ...v }) => {
      const { json, reste } = separerJson(v)
      return { ...reste, ...json, organizationId: orgId, declarantId, statut: 'DECLARE' }
    }),
  })
  return res.count
}
