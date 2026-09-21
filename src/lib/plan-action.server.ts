// ─── Plan d'action unifié — accès serveur pour le rattachement RISQUE ─────────
// Le registre de risques (M2) ne stocke plus ses actions dans une table dédiée :
// une action de traitement d'un risque EST un PlanAction porteur d'un lien
// RISQUE (targetId = riskItemId). Ces helpers concentrent le join de lien pour
// tous les consommateurs (API risk-items, exécutions de contrôle, roll-ups GRC)
// afin de ne pas disperser la logique polymorphe.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { type RiskActionStatut, type ActionPriorite } from './risk-action'

// Accepte le client Prisma global OU un client transactionnel ($transaction).
type Db = PrismaClient | Prisma.TransactionClient

const RISQUE = 'RISQUE'

/** Arguments de création d'un plan d'action rattaché à un risque (org + risque + champs de l'action). */
export interface CreateRiskActionArgs {
  organizationId: string
  riskItemId: string
  titre: string
  description?: string | null
  porteur?: string | null
  echeance?: Date | null
  statut?: RiskActionStatut
  priorite?: ActionPriorite
  createdById?: string | null
  riskLabel?: string | null
}

/** Crée un PlanAction rattaché à un risque (lien RISQUE). Utilisable en transaction. */
export function createRiskLinkedPlanAction(db: Db, a: CreateRiskActionArgs) {
  return db.planAction.create({
    data: {
      organizationId: a.organizationId,
      titre: a.titre,
      description: a.description ?? null,
      porteur: a.porteur ?? null,
      echeance: a.echeance ?? null,
      statut: a.statut ?? 'A_FAIRE',
      priorite: a.priorite ?? 'MAJEUR',
      createdById: a.createdById ?? null,
      liens: { create: [{ type: RISQUE, targetId: a.riskItemId, label: a.riskLabel ?? null }] },
    },
    include: { liens: true },
  })
}

/** Where Prisma ciblant les PlanAction rattachés à un risque donné d'une org. */
export function riskActionWhere(organizationId: string, riskItemId: string): Prisma.PlanActionWhereInput {
  return { organizationId, liens: { some: { type: RISQUE, targetId: riskItemId } } }
}

/** Charge les PlanAction rattachés à un risque, triés (échéance puis création). */
export function findRiskLinkedPlanActions(db: Db, organizationId: string, riskItemId: string) {
  return db.planAction.findMany({
    where: riskActionWhere(organizationId, riskItemId),
    orderBy: [{ echeance: 'asc' }, { createdAt: 'asc' }],
  })
}

/**
 * Regroupe, pour une org, les actions (statut/échéance) par riskItemId (lien
 * RISQUE). Sert à calculer la synthèse d'avancement par risque du registre en
 * une seule requête, sans relation directe RiskItem → action.
 */
export async function riskActionsByRiskItem(
  db: Db,
  organizationId: string,
): Promise<Map<string, { statut: string; echeance: Date | null }[]>> {
  const rows = await db.planAction.findMany({
    where: { organizationId, liens: { some: { type: RISQUE } } },
    select: { statut: true, echeance: true, liens: { where: { type: RISQUE }, select: { targetId: true }, take: 1 } },
  })
  const map = new Map<string, { statut: string; echeance: Date | null }[]>()
  for (const r of rows) {
    const riskItemId = r.liens[0]?.targetId
    if (!riskItemId) continue
    const arr = map.get(riskItemId) ?? []
    arr.push({ statut: r.statut, echeance: r.echeance })
    map.set(riskItemId, arr)
  }
  return map
}
