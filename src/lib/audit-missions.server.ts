// ─── Plan d'audit : requête LÉGÈRE partagée (lot V1) ─────────────────────────
// Une seule lecture des missions d'une organisation et de leurs constats résumés, partagée par la liste paginée
// (GET /api/audit/missions) et l'outil MCP read_audits. Bornée à `orgId` ; la visibilité selon le rôle
// (visibiliteMission) reste à l'appelant.
import { prisma } from '@/lib/prisma'

/** Constats résumés : de quoi calculer la synthèse, la visibilité (responsable) et lister les constats ouverts. */
export const CONSTATS_RESUMES = {
  select: { id: true, intitule: true, criticite: true, statut: true, echeance: true, responsableAction: true, source: true },
} as const

export function chargerMissionsLegeres(orgId: string) {
  return prisma.auditMission.findMany({
    where: { organizationId: orgId },
    orderBy: [{ createdAt: 'desc' }],
    select: { id: true, intitule: true, responsable: true, statut: true, type: true, dateDebut: true, dateFin: true, archiveLe: true, constats: CONSTATS_RESUMES },
  })
}
