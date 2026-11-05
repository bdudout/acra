// ─── Outils MCP de LECTURE de la stratégie cyber / IT / résilience (lot S5b) ─────
// `read_strategies` (liste) et `read_strategie` (cadre complet). Lecture seule, bornée à l'organisation de la clé
// (aucun organizationId en argument ; stratégie d'une autre org = introuvable). Mêmes gardes que les écrans : module
// `strategieActive` (politique d'instance comprise) et `peutVoirStrategie` sur le rôle porté par la clé (acteur.server).
// Titres des sources de rattachement : via `gatherActionItems` (visibilité 1re ligne) ; une source invisible est renvoyée
// sans titre. Aucun nom d'auteur ni e-mail : le MCP n'expose pas de noms d'utilisateurs.
import { prisma } from '@/lib/prisma'
import { gatherActionItems } from '@/lib/action-items.server'
import { peutVoirStrategie } from '@/lib/permissions'
import { STRATEGIE_STATUTS, ecartCadre, lireIdentifiantsExternes, lireInstantane } from '@/lib/strategie'
import { chargerCadre } from '@/lib/strategie.server'
import { toolText, type McpTool, type McpToolResult } from './protocol'
import type { McpContext } from './tools.server'
import { outil } from './tools-domaines.server'

const LIMITE_STRATEGIES = 50
const LIMITE_EVOLUTIONS = 20
const jour = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : null)
const erreur = (texte: string): McpToolResult => ({ content: [{ type: 'text', text: texte }], isError: true })
const garde = { modules: ['strategieActive' as const], lecture: peutVoirStrategie }

// ─── read_strategies ──────────────────────────────────────────────────────────
export const readStrategiesTool = outil({
  name: 'read_strategies',
  description:
    "Stratégies cyber / IT / résilience de l'organisation : type, période, statut (brouillon, validée, archivée), version, " +
    "référence interne et identifiants externes (lien budgétaire), date de validation et nombre d'axes. Les stratégies " +
    "archivées sont exclues par défaut (option inclureArchivees). 50 au plus (tronque = true si la limite est atteinte). " +
    "Module Stratégie requis, mêmes droits que l'écran. Lecture seule.",
  inputSchema: {
    type: 'object',
    properties: {
      statut: { type: 'string', enum: [...STRATEGIE_STATUTS], description: 'Filtre sur le statut.' },
      inclureArchivees: { type: 'boolean', description: 'Inclure les stratégies archivées (exclues par défaut).' },
    },
    additionalProperties: false,
  },
  garde,
  async lire(args, ctx) {
    const statut = (STRATEGIE_STATUTS as readonly string[]).includes(String(args.statut)) ? (args.statut as string) : null
    const rows = await prisma.strategie.findMany({
      where: { organizationId: ctx.organizationId, ...(statut ? { statut } : args.inclureArchivees === true ? {} : { statut: { not: 'ARCHIVEE' } }) },
      orderBy: [{ periodeDebut: 'desc' }, { createdAt: 'desc' }],
      take: LIMITE_STRATEGIES + 1,
      select: {
        id: true, titre: true, type: true, periodeDebut: true, periodeFin: true, statut: true, version: true, valideeLe: true,
        referenceInterne: true, identifiantsExternes: true, _count: { select: { axes: true } },
      },
    })
    const tronque = rows.length > LIMITE_STRATEGIES
    return toolText({
      tronque,
      strategies: rows.slice(0, LIMITE_STRATEGIES).map(s => ({
        id: s.id, titre: s.titre, type: s.type, periodeDebut: jour(s.periodeDebut), periodeFin: jour(s.periodeFin), statut: s.statut, version: s.version,
        referenceInterne: s.referenceInterne ?? null, identifiantsExternes: lireIdentifiantsExternes(s.identifiantsExternes),
        valideeLe: jour(s.valideeLe), nbAxes: s._count.axes,
      })),
    })
  },
})

// ─── read_strategie ───────────────────────────────────────────────────────────
export const readStrategieTool = outil({
  name: 'read_strategie',
  description:
    "Cadre complet d'une stratégie de l'organisation : axes ordonnés, objectifs (indicateur, cible, échéance, KRI de " +
    "l'organisation), rattachements (type et identifiant de la source, titre si elle est visible pour le rôle de la clé, " +
    "provenance), identifiants internes, écart entre le cadre validé et le cadre courant, et les 20 dernières évolutions " +
    "après validation (type, date, justification). Identifiant obtenu avec read_strategies. Lecture seule.",
  inputSchema: {
    type: 'object',
    properties: { strategieId: { type: 'string', description: 'Identifiant de la stratégie (read_strategies).' } },
    required: ['strategieId'],
    additionalProperties: false,
  },
  garde,
  async lire(args, ctx, { cfg, acteur }) {
    const id = typeof args.strategieId === 'string' ? args.strategieId.trim().slice(0, 64) : ''
    if (!id) return erreur('strategieId requis')
    const s = await prisma.strategie.findFirst({ where: { organizationId: ctx.organizationId, id } })
    if (!s) return erreur('strategie_introuvable')

    const axes = await chargerCadre(s.id)
    const kriIds = [...new Set(axes.flatMap(a => a.objectifs.map(o => o.kriId)).filter((v): v is string => !!v))]
    const aDesSources = axes.some(a => a.rattachements.length > 0)
    const [kris, evolutions, items] = await Promise.all([
      kriIds.length ? prisma.kri.findMany({ where: { organizationId: ctx.organizationId, id: { in: kriIds } }, select: { id: true, intitule: true } }) : Promise.resolve([]),
      prisma.strategieEvolution.findMany({
        where: { organizationId: ctx.organizationId, strategieId: s.id }, orderBy: { createdAt: 'desc' }, take: LIMITE_EVOLUTIONS,
        select: { type: true, createdAt: true, justification: true, cibleId: true },
      }),
      aDesSources
        ? gatherActionItems(ctx.organizationId, {
            incidentsActive: !!cfg.incidentsActive, controlePermanentActive: !!cfg.controlePermanentActive, auditInterneActive: !!cfg.auditInterneActive,
            registreRisquesActive: !!cfg.registreRisquesActive, conformiteActive: !!cfg.conformiteActive,
          }, { userId: acteur.userId, role: acteur.role, scope: { visibleOrgIds: [ctx.organizationId] } })
        : Promise.resolve([]),
    ])
    const nomKri = new Map(kris.map(k => [k.id, k.intitule]))
    const titres = new Map(items.map(i => [`${i.source}:${i.sourceId}`, i.titre]))
    const ids = (x: { referenceInterne: string | null; identifiantsExternes: unknown }) => ({ referenceInterne: x.referenceInterne ?? null, identifiantsExternes: lireIdentifiantsExternes(x.identifiantsExternes) })

    return toolText({
      strategie: {
        id: s.id, titre: s.titre, description: s.description, type: s.type, periodeDebut: jour(s.periodeDebut), periodeFin: jour(s.periodeFin),
        statut: s.statut, version: s.version, valideeLe: jour(s.valideeLe), ...ids(s),
      },
      axes: axes.map(a => ({
        id: a.id, ordre: a.ordre, titre: a.titre, description: a.description, referenceRef: a.referenceRef, ...ids(a),
        objectifs: a.objectifs.map(o => ({
          id: o.id, titre: o.titre, indicateur: o.indicateur, cible: o.cible, echeance: jour(o.echeance), ...ids(o),
          kri: o.kriId && nomKri.has(o.kriId) ? { id: o.kriId, nom: nomKri.get(o.kriId) } : null,
        })),
        rattachements: a.rattachements.map(r => ({
          sourceType: r.sourceType, sourceId: r.sourceId, titre: titres.get(`${r.sourceType}:${r.sourceId}`) ?? null, provenance: r.provenance,
        })),
      })),
      ecartCadreValide: ecartCadre(lireInstantane(s.cadreValide), axes),
      evolutions: evolutions.map(e => ({ type: e.type, date: jour(e.createdAt), justification: e.justification, cibleId: e.cibleId })),
    })
  },
})

export function buildStrategieTools(): McpTool<McpContext>[] {
  return [readStrategiesTool, readStrategieTool]
}
