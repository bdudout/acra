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
import { isOrgLevelConformite } from '@/lib/conformite-config'

export interface ConformiteContext {
  entries: ConformiteEntry[]
  referentiel: string
  level: 'ORGANISATION' | 'ANALYSE' | 'SOCLE'
  /** Id de la source (organisation si ORGANISATION, analyse socle si SOCLE). */
  sourceId: string | null
  sourceNom: string | null
  /** Id de l'entité Conformite (présent seulement en niveau ORGANISATION). */
  orgConformiteId: string | null
}

export async function getConformiteContext(params: {
  organizationId: string | null | undefined
  referentielMesures: string | null | undefined
  ownEntries: ConformiteEntry[]
  socle?: { id: string; nom: string; referentielMesures?: string | null; entries: ConformiteEntry[] } | null
  conformiteNiveau: string
}): Promise<ConformiteContext> {
  if (isOrgLevelConformite(params.conformiteNiveau) && params.organizationId) {
    const referentiel = params.referentielMesures || 'ISO27001'
    const row = await prisma.conformite.findUnique({
      where: { organizationId_referentiel: { organizationId: params.organizationId, referentiel } },
      select: { id: true, entries: true, organization: { select: { nom: true } } },
    })
    return {
      entries: sanitizeConformite(row?.entries),
      referentiel,
      level: 'ORGANISATION',
      sourceId: params.organizationId,
      sourceNom: row?.organization?.nom ?? null,
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
