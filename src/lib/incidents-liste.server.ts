// ─── Registre des incidents : requête LÉGÈRE partagée (lot V1) ───────────────
// Une seule lecture des incidents d'une organisation pour la liste paginée (GET /api/incidents) et l'outil MCP
// read_incidents : champs de filtre/tri/doublons, perte nette calculée, intitulés des risques associés. Bornée à `orgId`.
import { prisma } from '@/lib/prisma'
import { perteNette } from '@/lib/incident'
import { texteRisques, type IncidentLeger } from '@/lib/incidents-liste'

// Decimal Prisma → number (les montants restent des nombres côté API).
const num = (v: unknown): number | null => (v == null ? null : Number(v as unknown as string))

export async function chargerIncidentsLegers(orgId: string): Promise<IncidentLeger[]> {
  const rows = await prisma.incident.findMany({
    where: { organizationId: orgId },
    orderBy: [{ createdAt: 'desc' }],
    select: {
      id: true, intitule: true, statut: true, taxonomieCode: true, processusId: true, entite: true, entiteId: true,
      dateSurvenance: true, dateDetection: true, montantBrut: true, recuperations: true, riskItemId: true,
      processus: { select: { nom: true } }, riskItem: { select: { intitule: true } },
      risquesLies: { select: { riskItem: { select: { intitule: true } } }, orderBy: { createdAt: 'asc' } },
    },
  })
  return rows.map(({ processus, riskItem, risquesLies, montantBrut, recuperations, riskItemId, ...i }) => ({
    ...i,
    processusNom: processus?.nom ?? null,
    perteNette: perteNette(num(montantBrut), num(recuperations)),
    risquesTexte: texteRisques(risquesLies.length ? risquesLies.map(l => l.riskItem) : (riskItemId && riskItem ? [riskItem] : [])),
  }))
}
