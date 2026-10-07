// ─── Catalogue de risques types d'une analyse (serveur) ───────────────────────
// Rassemble le contexte (secteur, sous-secteurs, patterns, risques déjà saisis), le registre de l'organisation s'il est
// actif et le socle transverse traduit, puis délègue le calcul à catalogueRisquesTypes (lib/risque-exemples, pur).
// Utilisé par GET/POST /api/analyses/[id]/risques-types : la création ne s'appuie que sur ce catalogue recalculé.
import { prisma } from '@/lib/prisma'
import { getOrgConfig } from '@/lib/org-config.server'
import { sousSecteursOf } from '@/lib/sous-secteurs'
import { patternsOf } from '@/lib/patterns-archi'
import { domaineFromTaxonomie } from '@/lib/projet360'
import { catalogueRisquesTypes, type RisqueType } from '@/lib/risque-exemples'
import type { Locale } from '@/lib/i18n'

type Base = readonly { intitule: string; gravite: number; vraisemblance: number }[]

export async function catalogueRisquesTypesAnalyse(analyseId: string, organizationId: string | null, base: Base, locale: Locale): Promise<RisqueType[]> {
  const [analyse, cfg] = await Promise.all([
    prisma.analyse.findUnique({ where: { id: analyseId }, select: { secteur: true, sousSecteur: true, sousSecteurs: true, patternsArchi: true, risques: { select: { nom: true } } } }),
    getOrgConfig(organizationId),
  ])
  if (!analyse) return []
  const registre = organizationId && cfg.registreRisquesActive
    ? await prisma.riskItem.findMany({ where: { organizationId }, select: { intitule: true, taxonomieCode: true, graviteInherente: true, vraisemblanceInherente: true }, take: 200 })
    : []
  return catalogueRisquesTypes({
    secteur: analyse.secteur, sousSecteur: sousSecteursOf(analyse), patterns: patternsOf(analyse), locale, base,
    registre: registre.map(ri => {
      const domaine = domaineFromTaxonomie(ri.taxonomieCode)
      return { intitule: ri.intitule, gravite: ri.graviteInherente ?? 2, vraisemblance: ri.vraisemblanceInherente ?? 2, ...(domaine ? { domaine } : {}) }
    }),
    existants: analyse.risques.map(r => r.nom),
  })
}
