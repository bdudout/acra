// ─── Verrous de ligne pour les documents JSON modifiés par fusion ────────────
// Audit 2026-09-30 (D2) : la conformité (Conformite.entries / maturites) et le socle
// d'une analyse (Cadrage.socleSecurite) sont des tableaux JSON modifiés par
// « lecture → fusion d'UN point → réécriture complète ». Sans verrou, deux éditions
// concurrentes de deux points différents s'écrasaient (la seconde perdait la
// première). À appeler DANS une transaction, AVANT de relire la valeur à fusionner.

import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type Tx = Prisma.TransactionClient

/** Verrouille une ligne Conformite jusqu'à la fin de la transaction. */
export async function lockConformite(tx: Tx, id: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "Conformite" WHERE id = ${id} FOR UPDATE`
}

/** Verrouille le cadrage d'une analyse jusqu'à la fin de la transaction. */
export async function lockCadrageOfAnalyse(tx: Tx, analyseId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "Cadrage" WHERE "analyseId" = ${analyseId} FOR UPDATE`
}

/**
 * Garantit l'existence du suivi Conformite (organisation × référentiel × entité) et
 * renvoie son id. `upsert` Prisma n'est pas atomique : deux PREMIÈRES éditions
 * simultanées créaient la ligne en même temps → violation d'unicité (P2002) et
 * erreur 500 (constaté par le test d'intégration, 2026-10-01). On relit la ligne
 * créée par la requête concurrente.
 */
export async function ensureConformiteRow(organizationId: string, referentiel: string, entite: string): Promise<{ id: string }> {
  const where = { organizationId_referentiel_entite: { organizationId, referentiel, entite } }
  try {
    return await prisma.conformite.upsert({
      where,
      // À la création d'un suivi d'entité, on mémorise son libellé (nom = entité).
      create: { organizationId, referentiel, entite, nom: entite || null, entries: [] },
      update: {},
      select: { id: true },
    })
  } catch (e) {
    if ((e as { code?: string }).code !== 'P2002') throw e
    return prisma.conformite.findUniqueOrThrow({ where, select: { id: true } })
  }
}
