// ─── Consolidation des tiers (écosystème) pour une organisation — accès serveur ─
// Rassemble les parties prenantes de TOUTES les analyses de l'organisation active
// et les consolide par nom (ConsolidatedTier). Utilisé pour la jonction avec le
// registre TIC (cf. lib/tiers-tic-link.ts) sans dupliquer la logique de la page Tiers.

import { prisma } from './prisma'
import { consolidateTiers, type ConsolidatedTier, type TierInput } from './tiers'
import { menace, zoneOf } from './ecosystem-radar'

/** Tiers consolidés de l'organisation (parties prenantes de ses analyses). */
export async function consolidatedTiersForOrg(orgId: string): Promise<ConsolidatedTier[]> {
  const analyses = await prisma.analyse.findMany({
    where: { organizationId: orgId },
    select: {
      id: true, nom: true,
      partiesPrenantes: {
        select: {
          nom: true, type: true, exposition: true, fiabilite: true,
          dependance: true, penetration: true, maturite: true, confiance: true, critique: true,
        },
      },
    },
  })

  const rows: TierInput[] = analyses.flatMap((a) =>
    a.partiesPrenantes.map((pp) => {
      const m = menace(pp.exposition, pp.fiabilite)
      return {
        nom: pp.nom, type: pp.type, analyseId: a.id, analyseNom: a.nom,
        exposition: pp.exposition, fiabilite: pp.fiabilite,
        dependance: pp.dependance, penetration: pp.penetration, maturite: pp.maturite, confiance: pp.confiance,
        menace: m, zone: zoneOf(m), critique: pp.critique,
      }
    }),
  )
  return consolidateTiers(rows)
}
