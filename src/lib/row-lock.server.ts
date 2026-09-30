// ─── Verrous de ligne pour les documents JSON modifiés par fusion ────────────
// Audit 2026-09-30 (D2) : la conformité (Conformite.entries / maturites) et le socle
// d'une analyse (Cadrage.socleSecurite) sont des tableaux JSON modifiés par
// « lecture → fusion d'UN point → réécriture complète ». Sans verrou, deux éditions
// concurrentes de deux points différents s'écrasaient (la seconde perdait la
// première). À appeler DANS une transaction, AVANT de relire la valeur à fusionner.

import type { Prisma } from '@prisma/client'

type Tx = Prisma.TransactionClient

/** Verrouille une ligne Conformite jusqu'à la fin de la transaction. */
export async function lockConformite(tx: Tx, id: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "Conformite" WHERE id = ${id} FOR UPDATE`
}

/** Verrouille le cadrage d'une analyse jusqu'à la fin de la transaction. */
export async function lockCadrageOfAnalyse(tx: Tx, analyseId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "Cadrage" WHERE "analyseId" = ${analyseId} FOR UPDATE`
}
