// ─── Registre des risques : requête LÉGÈRE partagée (lot V1) ─────────────────
// Une seule lecture du registre d'une organisation pour la liste paginée (GET /api/risk-items) et l'outil MCP
// read_risk_register : champs de filtre/tri et niveaux calculés, sans relation lourde. Toujours bornée à `orgId`.
import { prisma } from '@/lib/prisma'
import { niveauRisque } from '@/lib/risk-item'
import type { RisqueLeger } from '@/lib/risk-items-liste'

export async function chargerRisquesLegers(orgId: string): Promise<RisqueLeger[]> {
  const rows = await prisma.riskItem.findMany({
    where: { organizationId: orgId },
    orderBy: [{ createdAt: 'desc' }],
    select: { id: true, intitule: true, taxonomieCode: true, entite: true, proprietaire: true, statut: true, familleRisqueTic: true, provenance: true, graviteInherente: true, vraisemblanceInherente: true, graviteResiduelle: true, vraisemblanceResiduelle: true, processus: { select: { nom: true } } },
  })
  return rows.map(r => ({
    id: r.id, intitule: r.intitule, taxonomieCode: r.taxonomieCode, entite: r.entite, proprietaire: r.proprietaire, statut: r.statut, familleRisqueTic: r.familleRisqueTic, provenance: r.provenance,
    processusNom: r.processus?.nom ?? null,
    niveauInherent: niveauRisque(r.graviteInherente, r.vraisemblanceInherente),
    niveauResiduel: niveauRisque(r.graviteResiduelle, r.vraisemblanceResiduelle),
  }))
}
