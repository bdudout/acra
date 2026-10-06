// ─── Création d'un projet 360 depuis une proposition MCP acceptée ─────────────
// Mêmes briques que le formulaire « Lancer un projet 360 » (POST /api/analyses, méthode PROJET_360) : sous-secteurs
// cohérents avec le secteur, patterns, cadrage initial (périmètre + objectifs), qualification par défaut, puis
// peuplement (questionnaire pré-rempli, risques, mesures et plans présents par défaut). Le créateur est l'humain qui
// accepte la proposition.
import { prisma } from '@/lib/prisma'
import { cadrageInitial } from '@/lib/cadrage-initial'
import { resolveSousSecteursUpdate } from '@/lib/sous-secteurs'
import { sanitizeQualification } from '@/lib/qualification'
import { populateProjet360 } from '@/lib/projet360.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { getT, type Locale } from '@/lib/i18n'
import type { Projet360ProposalPayload } from '@/lib/mcp/projet360-proposal'

export async function creerProjet360(p: Projet360ProposalPayload, opts: { userId: string; organizationId: string; locale?: Locale }): Promise<{ id: string; population: { answers: number; risks: number } }> {
  const orgConfig = await getOrgConfig(opts.organizationId)
  const analyse = await prisma.analyse.create({
    data: {
      userId: opts.userId,
      organizationId: opts.organizationId,
      nom: p.nom,
      description: p.description ?? undefined,
      secteur: p.secteur,
      ...resolveSousSecteursUpdate({ secteur: p.secteur, input: { sousSecteurs: p.sousSecteurs } }),
      patternsArchi: p.patternsArchi,
      dateEcheance: p.miseEnService ? new Date(p.miseEnService) : undefined,
      methode: 'PROJET_360',
      qualification: sanitizeQualification(undefined, orgConfig.qualificationQuestionnaire),
      cadrage: { create: cadrageInitial({ methode: 'PROJET_360', description: p.description, objectifsEtude: p.objectifs }) as never },
    },
    select: { id: true },
  })
  const locale = opts.locale ?? 'fr'
  const population = await populateProjet360(analyse.id, opts.organizationId, getT(locale), locale)
  return { id: analyse.id, population }
}
