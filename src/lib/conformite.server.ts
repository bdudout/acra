/**
 * conformite.server.ts — Résolution SERVEUR de la conformité effective (Palier 2).
 *
 * Selon OrganizationConfig.conformiteNiveau :
 *  - ORGANISATION : lit l'entité Conformite (organisation × référentiel) ;
 *  - ANALYSE (défaut) : conformité propre de l'analyse, sinon héritée du socle
 *    (résolveur pur `resolveEffectiveConformite`).
 *
 * Le core reste pur (lib/conformite.ts) ; ce module ajoute l'accès Prisma.
 */
import { prisma } from '@/lib/prisma'
import { sanitizeConformite, resolveEffectiveConformite, type ConformiteEntry } from '@/lib/conformite'
import { usesConformiteEntity, isEntiteLevelConformite } from '@/lib/conformite-config'

export interface ConformiteContext {
  entries: ConformiteEntry[]
  referentiel: string
  level: 'ORGANISATION' | 'ENTITE' | 'ANALYSE' | 'SOCLE'
  /** Id de la source (organisation si ORGANISATION, analyse socle si SOCLE). */
  sourceId: string | null
  sourceNom: string | null
  /** Id de l'entité Conformite (présent pour les portées ORGANISATION / ENTITE). */
  orgConformiteId: string | null
}

/** Résout le contexte de conformité d'une entité (entrées propres + héritage éventuel du socle) pour l'affichage/statistiques. */
export async function getConformiteContext(params: {
  organizationId: string | null | undefined
  referentielMesures: string | null | undefined
  ownEntries: ConformiteEntry[]
  socle?: { id: string; nom: string; referentielMesures?: string | null; entries: ConformiteEntry[] } | null
  conformiteNiveau: string
  /** Suivi de conformité lié à l'analyse (portée ENTITE) — sélectionne le suivi par id. */
  suiviConformiteId?: string | null
}): Promise<ConformiteContext> {
  // Portées ORGANISATION et ENTITE : la référence vit dans l'entité Conformite.
  if (usesConformiteEntity(params.conformiteNiveau) && params.organizationId) {
    const referentiel = params.referentielMesures || 'ISO27001'
    const entite = isEntiteLevelConformite(params.conformiteNiveau)
    // ENTITE + suivi lié → sélection par id (scopée à l'org) ; sinon suivi org-wide (entite "").
    const row = entite && params.suiviConformiteId
      ? await prisma.conformite.findFirst({
          where: { id: params.suiviConformiteId, organizationId: params.organizationId },
          select: { id: true, entries: true, nom: true, entite: true, organization: { select: { nom: true } } },
        })
      : await prisma.conformite.findUnique({
          where: { organizationId_referentiel_entite: { organizationId: params.organizationId, referentiel, entite: '' } },
          select: { id: true, entries: true, nom: true, entite: true, organization: { select: { nom: true } } },
        })
    return {
      entries: sanitizeConformite(row?.entries),
      referentiel,
      level: entite ? 'ENTITE' : 'ORGANISATION',
      sourceId: params.organizationId,
      sourceNom: row?.nom || row?.organization?.nom || null,
      orgConformiteId: row?.id ?? null,
    }
  }
  // Niveau ANALYSE : propre ou héritée du socle.
  const eff = resolveEffectiveConformite({
    ownEntries: params.ownEntries,
    socle: params.socle ? { id: params.socle.id, nom: params.socle.nom, entries: params.socle.entries } : null,
  })
  const referentiel = (eff.inherited ? params.socle?.referentielMesures : params.referentielMesures) || 'ISO27001'
  return {
    entries: eff.entries,
    referentiel,
    level: eff.inherited ? 'SOCLE' : 'ANALYSE',
    sourceId: eff.sourceAnalyseId,
    sourceNom: eff.sourceAnalyseNom,
    orgConformiteId: null,
  }
}
