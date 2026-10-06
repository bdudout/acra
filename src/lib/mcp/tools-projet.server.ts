// ─── Outils MCP de lecture : analyses et projets 360 de l'organisation ────────
// `read_analyses` : retrouver une analyse ou un projet (identifiant à passer aux outils propose_*).
// `read_projet` : contexte d'un projet 360 (secteur, sous-secteurs, patterns, mise en service, échelle), risques avec
// leur référence R1, R2… et cotations, plans d'action rattachés — pour proposer seulement ce qui manque.
// Lecture seule, STRICTEMENT bornée à l'organisation de la clé (hors périmètre = introuvable, sans divulgation).
import { prisma } from '@/lib/prisma'
import { toolText, type McpTool, type McpToolResult } from './protocol'
import type { McpContext } from './tools.server'
import { sousSecteursOf } from '@/lib/sous-secteurs'
import { patternsOf } from '@/lib/patterns-archi'
import { cotations } from '@/lib/cotation-risque'
import { refsRisquesCotes } from '@/lib/risque-refs'
import { getEffectiveScaleConfig } from '@/lib/configuration-server'

const METHODES = ['EBIOS_RM', 'ISO_27005', 'NIST_800_30', 'ISO_31000', 'PROJET_360'] as const
const jour = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null)

export const readAnalysesTool: McpTool<McpContext> = {
  name: 'read_analyses',
  description:
    "Liste les analyses de risques et les projets 360 de l'organisation (identifiant, nom, méthode, statut, secteur, " +
    "sous-secteurs, mise en service), les plus récents d'abord. Sert à retrouver l'`analyseId` à passer aux outils " +
    "read_projet, recommend_risks_scenarios et propose_*. Filtres facultatifs : méthode, recherche dans le nom.",
  inputSchema: {
    type: 'object',
    properties: {
      methode: { type: 'string', enum: [...METHODES], description: 'Méthode (PROJET_360 pour les projets).' },
      recherche: { type: 'string', description: 'Texte recherché dans le nom.' },
      limite: { type: 'integer', minimum: 1, maximum: 100, description: 'Nombre maximum (défaut 30).' },
    },
    additionalProperties: false,
  },
  async handler(args, ctx): Promise<McpToolResult> {
    const methode = (METHODES as readonly string[]).includes(String(args.methode)) ? String(args.methode) : null
    const recherche = typeof args.recherche === 'string' ? args.recherche.trim().slice(0, 100) : ''
    const limite = typeof args.limite === 'number' && Number.isInteger(args.limite) ? Math.min(100, Math.max(1, args.limite)) : 30
    const rows = await prisma.analyse.findMany({
      where: {
        organizationId: ctx.organizationId, deletedAt: null,
        ...(methode ? { methode: methode as never } : {}),
        ...(recherche ? { nom: { contains: recherche, mode: 'insensitive' as const } } : {}),
      },
      select: { id: true, nom: true, methode: true, statut: true, secteur: true, sousSecteur: true, sousSecteurs: true, dateEcheance: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: limite,
    })
    return toolText({
      analyses: rows.map(a => ({
        id: a.id, nom: a.nom, methode: a.methode, statut: a.statut, secteur: a.secteur,
        sousSecteurs: sousSecteursOf(a), miseEnService: jour(a.dateEcheance), misAJour: jour(a.updatedAt),
      })),
    })
  },
}

export const readProjetTool: McpTool<McpContext> = {
  name: 'read_projet',
  description:
    "Contexte complet d'un projet 360 de l'organisation : description, objectifs, secteur, sous-secteurs, patterns " +
    "d'architecture, mise en service, météo, échelle de cotation (4 ou 5 niveaux), risques avec leur référence R1, R2…, " +
    "domaine et cotations brut / actuel / résiduel, plans d'action et risques visés. À lire avant de proposer : ne " +
    "proposez que ce qui manque.",
  inputSchema: {
    type: 'object',
    properties: { analyseId: { type: 'string', description: 'Identifiant du projet 360 (voir read_analyses).' } },
    required: ['analyseId'],
    additionalProperties: false,
  },
  async handler(args, ctx): Promise<McpToolResult> {
    const analyseId = typeof args.analyseId === 'string' ? args.analyseId : ''
    const a = analyseId ? await prisma.analyse.findFirst({
      where: { id: analyseId, organizationId: ctx.organizationId, deletedAt: null },
      select: {
        id: true, nom: true, methode: true, statut: true, description: true, secteur: true, sousSecteur: true, sousSecteurs: true, patternsArchi: true,
        dateEcheance: true, meteoProjet: true,
        cadrage: { select: { perimetre: true, objectifsEtude: true } },
        risques: {
          select: { id: true, nom: true, domaine: true, strategie: true, gravite: true, vraisemblance: true, graviteActuelle: true, vraisemblanceActuelle: true, graviteResiduelle: true, vraisemblanceResiduelle: true },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
      },
    }) : null
    if (!a) return { content: [{ type: 'text', text: 'analyse_introuvable' }], isError: true }
    if (a.methode !== 'PROJET_360') return { content: [{ type: 'text', text: 'pas_un_projet_360 — utilisez read_analyses avec methode PROJET_360' }], isError: true }
    const [{ nbNiveaux }, plans] = await Promise.all([
      getEffectiveScaleConfig(ctx.organizationId),
      prisma.planAction.findMany({
        where: { organizationId: ctx.organizationId, liens: { some: { type: 'RISQUE_ANALYSE', ref: a.id } } },
        select: { titre: true, statut: true, priorite: true, echeance: true, porteur: true, liens: { where: { type: 'RISQUE_ANALYSE', ref: a.id }, select: { targetId: true } } },
        take: 500,
      }),
    ])
    const refs = refsRisquesCotes(a.risques)
    const niveau = (gv: { g: number; v: number }) => ({ gravite: gv.g, vraisemblance: gv.v, niveau: gv.g * gv.v })
    return toolText({
      projet: {
        id: a.id, nom: a.nom, statut: a.statut, description: a.cadrage?.perimetre ?? a.description ?? null, objectifs: a.cadrage?.objectifsEtude ?? null,
        secteur: a.secteur, sousSecteurs: sousSecteursOf(a), patternsArchi: patternsOf(a), miseEnService: jour(a.dateEcheance), meteo: a.meteoProjet ?? null,
      },
      echelle: { niveaux: nbNiveaux },
      risques: a.risques.map(r => {
        const c = cotations(r)
        return { ref: refs.get(r.id), nom: r.nom, domaine: r.domaine, strategie: r.strategie, brut: niveau(c.brut), actuel: niveau(c.actuel), residuel: niveau(c.residuel) }
      }).sort((x, y) => Number(x.ref?.slice(1)) - Number(y.ref?.slice(1))),
      plans: plans.map(p => ({ titre: p.titre, statut: p.statut, priorite: p.priorite, echeance: jour(p.echeance), porteur: p.porteur, risques: p.liens.map(l => refs.get(l.targetId)).filter(Boolean) })),
    })
  },
}

export function buildProjetTools(): McpTool<McpContext>[] {
  return [readAnalysesTool, readProjetTool]
}
