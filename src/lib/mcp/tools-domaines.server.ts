// ─── Outils MCP de LECTURE des domaines GRC (lot S5a) ─────────────────────────
// Plans d'action unifiés, registre des risques, conformité, contrôles, audits, incidents, registre d'informations TIC
// (DORA) et résilience. Lecture seule, STRICTEMENT bornée à l'organisation de la clé (aucun organizationId en
// argument), avec les mêmes gardes que les écrans : module actif (getOrgConfig, politique d'instance comprise) et RBAC
// du rôle porté par la clé (rôle effectif de son créateur, cf. acteur.server). Réutilise les lectures serveur des pages
// (gatherActionItems, chargerRisquesLegers, chargerIncidentsLegers, chargerControlesLegers, chargerMissionsLegeres,
// chargerFonctionsCritiques, propositionsOuvertesOrg) et leurs fonctions pures. Pagination bornée (100 par page) ;
// ni secret, ni point d'accès (hôtes), ni texte libre superflu (descriptions d'incident, commentaires).

import { prisma } from '@/lib/prisma'
import { getOrgConfig } from '@/lib/org-config.server'
import { getT } from '@/lib/i18n'
import { hasGlobalReadDispositif, peutGererRegistreTic, peutLireConformite, peutVoirPropositionsRisquesTic, type UserRole } from '@/lib/permissions'
import { paginer } from '@/lib/pagination'
import { gatherActionItems } from '@/lib/action-items.server'
import { ACTION_ORIGINES, filterActionItems, sortActionItems, summarizeActionItems, type ActionOrigine } from '@/lib/action-items'
import { ACTION_PRIORITES, RISK_ACTION_STATUTS, effectiveStatut, type ActionPriorite, type RiskActionStatut } from '@/lib/risk-action'
import { FAMILLES_RISQUE_TIC } from '@/lib/famille-risque-tic'
import { RISK_STATUTS, RISK_PROVENANCES } from '@/lib/risk-item'
import { NIVEAUX_FILTRE, baseRisques, filtrerRisques, syntheseRisques } from '@/lib/risk-items-liste'
import { chargerRisquesLegers } from '@/lib/risk-items-liste.server'
import { listReferentiels, getExigencesFor } from '@/lib/referentiel.server'
import { conformiteStats, sanitizeConformite } from '@/lib/conformite'
import { accesResultats } from '@/lib/acces-resultats.server'
import { visibiliteMission } from '@/lib/acces-resultats'
import { filtrerControles } from '@/lib/controle'
import { chargerControlesLegers } from '@/lib/controles-liste.server'
import { constatTermine, filtrerMissions, synthetiserConstats, type ConstatStatut } from '@/lib/audit'
import { chargerMissionsLegeres } from '@/lib/audit-missions.server'
import { INCIDENT_STATUTS } from '@/lib/incident'
import { baseIncidents, filtrerIncidents, syntheseIncidents } from '@/lib/incidents-liste'
import { chargerIncidentsLegers } from '@/lib/incidents-liste.server'
import { evaluerReportingIncident } from '@/lib/dora-reporting'
import type { DoraCriteres } from '@/lib/dora'
import { NIVEAUX_CRITICITE, evaluerCompletude, synthetiserRegistre, validerArrangement, type ArrangementTic } from '@/lib/registre-tic'
import { chargerFonctionsCritiques } from '@/lib/dependances-critiques.server'
import { analyserDependances } from '@/lib/dependances-critiques'
import { programmeStats, sanitizeConstats } from '@/lib/tests-resilience'
import { propositionsOuvertesOrg } from '@/lib/propositions-risques-tic.server'
import { libellerProposition } from '@/lib/propositions-risques-tic'
import { toolText, type McpTool, type McpToolResult } from './protocol'
import { acteurMcp, type ActeurMcp } from './acteur.server'
import { guardArgs } from './tools-knowledge.server'
import type { McpContext } from './tools.server'

type OrgCfg = Awaited<ReturnType<typeof getOrgConfig>>
type Module = 'registreRisquesActive' | 'incidentsActive' | 'controlePermanentActive' | 'auditInterneActive' | 'conformiteActive' | 'reglementaireActive'

const TAILLE_MAX = 100
const erreur = (texte: string): McpToolResult => ({ content: [{ type: 'text', text: texte }], isError: true })
const jour = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : null)
const court = (s: string | null | undefined, n = 300) => (s ? (s.length > n ? `${s.slice(0, n)}…` : s) : null)
const entier = (v: unknown, def: number, min: number, max: number) => {
  const n = typeof v === 'number' ? Math.floor(v) : NaN
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def
}
const choix = <T extends string>(v: unknown, valeurs: readonly T[]): T | null => ((valeurs as readonly string[]).includes(String(v)) ? (v as T) : null)
const texte = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 100) : '')
const pagination = (args: Record<string, unknown>) => ({ page: entier(args.page, 1, 1, 10_000), taille: entier(args.taille, 25, 1, TAILLE_MAX) })

/** Propriétés de pagination communes (bornées). */
const PAGINATION = {
  page: { type: 'integer', minimum: 1, description: 'Page demandée (défaut 1).' },
  taille: { type: 'integer', minimum: 1, maximum: TAILLE_MAX, description: `Éléments par page (défaut 25, au plus ${TAILLE_MAX}).` },
} as const

/** Lecture du dispositif TIC / résilience : gouvernance du registre TIC ou lecture globale du dispositif (comme les écrans). */
const lectureTic = (role: UserRole) => peutGererRegistreTic(role) || hasGlobalReadDispositif(role)

/**
 * Gardes communes : acteur (rôle porté par la clé), modules actifs de l'organisation, rôle autorisé. Aucune donnée du
 * domaine n'est lue avant que toutes ne passent.
 */
async function preparer(ctx: McpContext, g: { modules?: Module[]; lecture?: (role: UserRole) => boolean }): Promise<{ ok: true; cfg: OrgCfg; acteur: ActeurMcp } | { ok: false; res: McpToolResult }> {
  const acteur = await acteurMcp(ctx)
  if (!acteur) return { ok: false, res: erreur('cle_sans_membre_organisation : le créateur de la clé n’est plus membre actif de l’organisation') }
  const cfg = await getOrgConfig(ctx.organizationId)
  const inactifs = (g.modules ?? []).filter(m => !cfg[m])
  if (inactifs.length) return { ok: false, res: erreur(`module_inactif : ${inactifs.join(', ')} (à activer par l’administrateur de l’organisation)`) }
  if (g.lecture && !g.lecture(acteur.role)) return { ok: false, res: erreur(`role_non_autorise : le rôle ${acteur.role} ne consulte pas ce domaine`) }
  return { ok: true, cfg, acteur }
}

/** Outil de lecture : arguments inconnus refusés (guardArgs), gardes appliquées avant le corps. */
function outil(def: Omit<McpTool<McpContext>, 'handler'> & {
  garde: { modules?: Module[]; lecture?: (role: UserRole) => boolean }
  lire: (args: Record<string, unknown>, ctx: McpContext, p: { cfg: OrgCfg; acteur: ActeurMcp }) => Promise<McpToolResult>
}): McpTool<McpContext> {
  const { garde, lire, ...meta } = def
  return guardArgs({
    ...meta,
    async handler(args, ctx) {
      const p = await preparer(ctx, garde)
      if (!p.ok) return p.res
      return lire(args, ctx, p)
    },
  })
}

// ─── read_plans_actions ───────────────────────────────────────────────────────
export const readPlansActionsTool = outil({
  name: 'read_plans_actions',
  description:
    "Plans d'action unifiés de l'organisation (mesures d'analyse, actions du registre, conformité, contrôles, audits, " +
    "incidents, résilience, préconisations), avec les mêmes droits que la page Plans d'action. Filtres : origine, statut, " +
    "priorité, en retard, famille de risque TIC (actions rattachées à un risque du registre de cette famille), recherche. " +
    "Retards d'abord, puis priorité et échéance ; synthèse (taux d'avancement, retards) sur la sélection. Lecture seule.",
  inputSchema: {
    type: 'object',
    properties: {
      origine: { type: 'string', enum: [...ACTION_ORIGINES], description: 'Origine métier de l’action.' },
      statut: { type: 'string', enum: [...RISK_ACTION_STATUTS, 'EN_RETARD'], description: 'Statut effectif (le retard se déduit de l’échéance).' },
      priorite: { type: 'string', enum: [...ACTION_PRIORITES] },
      enRetard: { type: 'boolean', description: 'Seulement les actions en retard.' },
      familleTic: { type: 'string', enum: [...FAMILLES_RISQUE_TIC], description: 'Famille de risque TIC du risque rattaché.' },
      recherche: { type: 'string', description: 'Texte recherché dans le titre ou la description.' },
      ...PAGINATION,
    },
    additionalProperties: false,
  },
  garde: {},
  async lire(args, ctx, { cfg, acteur }) {
    const now = new Date()
    const items = await gatherActionItems(ctx.organizationId, {
      incidentsActive: !!cfg.incidentsActive, controlePermanentActive: !!cfg.controlePermanentActive, auditInterneActive: !!cfg.auditInterneActive,
      registreRisquesActive: !!cfg.registreRisquesActive, conformiteActive: !!cfg.conformiteActive,
    }, { userId: acteur.userId, role: acteur.role, scope: { visibleOrgIds: [ctx.organizationId] } })
      // Même refus que read_conformite : un rôle qui ne lit pas la conformité n'en voit pas les actions.
      .then(l => (peutLireConformite(acteur.role) ? l : l.filter(i => i.origine !== 'conformite')))
    const statut = args.enRetard === true ? 'EN_RETARD' : choix<RiskActionStatut | 'EN_RETARD'>(args.statut, [...RISK_ACTION_STATUTS, 'EN_RETARD'])
    let filtres = filterActionItems(items, {
      origine: choix<ActionOrigine>(args.origine, ACTION_ORIGINES) ?? undefined,
      priorite: choix<ActionPriorite>(args.priorite, ACTION_PRIORITES) ?? undefined,
      statut: statut ?? undefined, q: texte(args.recherche) || undefined,
    }, now)
    const famille = choix(args.familleTic, FAMILLES_RISQUE_TIC)
    if (famille) {
      const ids = new Set((await prisma.riskItem.findMany({ where: { organizationId: ctx.organizationId, familleRisqueTic: famille }, select: { id: true } })).map(r => r.id))
      filtres = filtres.filter(i => !!i.riskItemId && ids.has(i.riskItemId))
    }
    const page = paginer(sortActionItems(filtres, now), pagination(args))
    return toolText({
      synthese: summarizeActionItems(filtres, now),
      pagination: page.pagination,
      actions: page.items.map(i => ({
        // Comme read_incidents : jamais la description libre d'un incident (données de déclarant, victimes…).
        id: i.id, origine: i.origine, titre: i.titre, description: i.origine === 'incident' ? null : court(i.description), porteur: i.porteur, entite: i.entite,
        echeance: jour(i.echeance), statut: effectiveStatut(i, now), priorite: i.priorite, riskItemId: i.riskItemId,
      })),
    })
  },
})

// ─── read_risk_register ───────────────────────────────────────────────────────
export const readRiskRegisterTool = outil({
  name: 'read_risk_register',
  description:
    "Registre des risques de l'organisation (risques canoniques, hors analyses) : intitulé, catégorie de taxonomie, " +
    "famille de risque TIC, provenance, processus, entité, propriétaire, statut, niveaux inhérent et résiduel (gravité × " +
    "vraisemblance). Filtres : famille TIC, statut, palier du niveau résiduel (eleve, moyen, faible), provenance, " +
    "recherche. Synthèse sur tout le registre. Module registre des risques requis. Lecture seule.",
  inputSchema: {
    type: 'object',
    properties: {
      familleTic: { type: 'string', enum: [...FAMILLES_RISQUE_TIC], description: 'Famille de risque TIC.' },
      statut: { type: 'string', enum: [...RISK_STATUTS] },
      niveau: { type: 'string', enum: [...NIVEAUX_FILTRE], description: 'Palier du niveau résiduel.' },
      provenance: { type: 'string', enum: [...RISK_PROVENANCES], description: 'Origine du risque (saisie, analyse ACRA, incident, contrôle, audit).' },
      recherche: { type: 'string', description: 'Texte recherché (intitulé, entité, propriétaire, processus).' },
      ...PAGINATION,
    },
    additionalProperties: false,
  },
  garde: { modules: ['registreRisquesActive'] },
  async lire(args, ctx) {
    const legers = await chargerRisquesLegers(ctx.organizationId)
    const base = baseRisques(legers, choix(args.niveau, NIVEAUX_FILTRE) ?? '')
    const famille = choix(args.familleTic, FAMILLES_RISQUE_TIC)
    const statut = choix(args.statut, RISK_STATUTS)
    const provenance = choix(args.provenance, RISK_PROVENANCES)
    const filtres = filtrerRisques(base, { q: texte(args.recherche), colonnes: {} })
      .filter(r => (!famille || r.familleRisqueTic === famille) && (!statut || r.statut === statut) && (!provenance || r.provenance === provenance))
    const page = paginer(filtres, pagination(args))
    return toolText({
      synthese: syntheseRisques(legers, base),
      pagination: page.pagination,
      risques: page.items.map(r => ({
        id: r.id, intitule: r.intitule, categorie: r.taxonomieCode, familleRisqueTic: r.familleRisqueTic ?? null, provenance: r.provenance ?? null,
        processus: r.processusNom, entite: r.entite, proprietaire: r.proprietaire, statut: r.statut, niveauInherent: r.niveauInherent, niveauResiduel: r.niveauResiduel,
      })),
    })
  },
})

// ─── read_conformite ──────────────────────────────────────────────────────────
const MAX_SUIVIS = 50
export const readConformiteTool = outil({
  name: 'read_conformite',
  description:
    "Conformité de l'organisation : référentiels activés (code, nom, version, nombre d'exigences), puis pour chaque suivi " +
    "de conformité (référentiel × entité) le taux de conformité, la répartition des statuts, la couverture des écarts " +
    "(plan d'action, dérogation, acceptation) et la liste des écarts (exigences partielles ou non conformes, avec leur " +
    "libellé et leur traitement). Filtre : référentiel. Module conformité et rôle lecteur de la conformité requis. Lecture seule.",
  inputSchema: {
    type: 'object',
    properties: {
      referentiel: { type: 'string', description: 'Code du référentiel (ex. ISO27001) ; tous si absent.' },
      ecartsMax: { type: 'integer', minimum: 1, maximum: 200, description: 'Écarts listés au plus par suivi (défaut 50).' },
    },
    additionalProperties: false,
  },
  garde: { modules: ['conformiteActive'], lecture: peutLireConformite },
  async lire(args, ctx, { cfg }) {
    const orgId = ctx.organizationId
    const code = texte(args.referentiel)
    const ecartsMax = entier(args.ecartsMax, 50, 1, 200)
    const whereSuivis = { organizationId: orgId, ...(code ? { referentiel: code } : {}) }
    const [referentiels, suivis] = await Promise.all([
      listReferentiels(orgId, 'fr'),
      prisma.conformite.findMany({
        where: whereSuivis,
        orderBy: [{ referentiel: 'asc' }, { entite: 'asc' }], take: MAX_SUIVIS,
        select: { referentiel: true, entite: true, nom: true, entries: true, updatedAt: true },
      }),
    ])
    // Liste bornée à MAX_SUIVIS : le total réel n'est compté que si la limite est atteinte.
    const suivisTotal = suivis.length < MAX_SUIVIS ? suivis.length : await prisma.conformite.count({ where: whereSuivis })
    const exigencesPar = new Map<string, Map<string, string>>()
    for (const s of suivis) if (!exigencesPar.has(s.referentiel)) {
      exigencesPar.set(s.referentiel, new Map((await getExigencesFor(s.referentiel, orgId, 'fr')).map(e => [e.ref, e.nom])))
    }
    return toolText({
      niveau: cfg.conformiteNiveau,
      suivisTotal,
      suivisTronques: suivisTotal > suivis.length,
      referentielsActives: referentiels.filter(r => r.actif && (!code || r.code === code)).map(r => ({ code: r.code, nom: r.nom, version: r.version, nbExigences: r.nbExigences })),
      suivis: suivis.map(s => {
        const exigences = exigencesPar.get(s.referentiel) ?? new Map<string, string>()
        const entries = sanitizeConformite(s.entries)
        const ecarts = entries.filter(e => e.statut === 'partiel' || e.statut === 'non_conforme')
        return {
          referentiel: s.referentiel, entite: s.entite || null, nom: s.nom ?? null, misAJour: jour(s.updatedAt),
          stats: conformiteStats(entries, exigences.size),
          ecarts: ecarts.slice(0, ecartsMax).map(e => ({ ref: e.ref, libelle: exigences.get(e.ref) ?? null, statut: e.statut, traitement: e.traitement ?? null })),
          ecartsTotal: ecarts.length,
        }
      }),
    })
  },
})

// ─── read_controles ───────────────────────────────────────────────────────────
const MAX_LISTE = 50
export const readControlesTool = outil({
  name: 'read_controles',
  description:
    "Contrôle permanent de l'organisation : bibliothèque de contrôles (niveau, responsable, périodicité, dernière " +
    "réalisation, prochaine échéance et état EN_RETARD / DU / A_VENIR, nombre d'anomalies), campagnes de contrôle non " +
    "archivées et dernières anomalies relevées. La 1re ligne et la lecture seule ne voient que les contrôles dont elles " +
    "sont responsables (comme l'écran). Filtres : état d'échéance, niveau, anomalies seules, recherche. Module contrôle " +
    "permanent requis. Lecture seule.",
  inputSchema: {
    type: 'object',
    properties: {
      etat: { type: 'string', enum: ['EN_RETARD', 'DU', 'A_VENIR'], description: 'État de l’échéance.' },
      niveau: { type: 'string', description: 'Niveau du contrôle (ex. N1, N2).' },
      anomaliesSeules: { type: 'boolean', description: 'Seulement les contrôles ayant au moins une anomalie.' },
      recherche: { type: 'string', description: 'Texte recherché (intitulé, responsable).' },
      ...PAGINATION,
    },
    additionalProperties: false,
  },
  garde: { modules: ['controlePermanentActive'] },
  async lire(args, ctx, { acteur }) {
    const orgId = ctx.organizationId
    const now = new Date()
    const acces = await accesResultats(acteur.userId, acteur.role)
    const visible = <T extends { responsable: string | null }>(l: T[]) => (acces.tout ? l : l.filter(c => acces.concerne(c.responsable)))
    const legers = await chargerControlesLegers(orgId, now, visible)
    const [campagnes, anomalies] = await Promise.all([
      // Les campagnes sont des résultats réservés aux rôles qui voient tout (acces-resultats).
      acces.tout ? prisma.campagneControle.findMany({
        where: { organizationId: orgId, archiveLe: null }, orderBy: [{ createdAt: 'desc' }], take: MAX_LISTE,
        select: { id: true, intitule: true, niveau: true, statut: true, recurrence: true, dateDebut: true, dateFin: true, controleIds: true },
      }) : Promise.resolve([]),
      prisma.controleExecution.findMany({
        // 1re ligne : filtrage en base sur les contrôles visibles AVANT la limite (sinon des anomalies d'autres
        // contrôles, plus récentes, évinceraient les siennes).
        where: { organizationId: orgId, resultat: 'ANOMALIE', ...(acces.tout ? {} : { controleId: { in: legers.map(c => c.id) } }) },
        orderBy: [{ dateRealisation: 'desc' }], take: MAX_LISTE,
        select: { id: true, dateRealisation: true, constat: true, controleId: true, controle: { select: { intitule: true, responsable: true } } },
      }),
    ])
    let filtres = filtrerControles(legers, { q: texte(args.recherche), niveau: texte(args.niveau), etat: choix(args.etat, ['EN_RETARD', 'DU', 'A_VENIR'] as const) ?? '', referentielCode: '', actif: '' })
    if (args.anomaliesSeules === true) filtres = filtres.filter(c => c.anomalies > 0)
    const page = paginer(filtres, pagination(args))
    return toolText({
      synthese: {
        total: legers.length, actifs: legers.filter(c => c.actif).length, enRetard: legers.filter(c => c.etatEcheance === 'EN_RETARD').length,
        dus: legers.filter(c => c.etatEcheance === 'DU').length, avecAnomalies: legers.filter(c => c.anomalies > 0).length,
      },
      pagination: page.pagination,
      controles: page.items.map(c => ({
        id: c.id, intitule: c.intitule, niveau: c.niveau, responsable: c.responsable, referentielCode: c.referentielCode, actif: c.actif, periodicite: c.periodicite,
        derniereRealisation: jour(c.derniere), prochaineEcheance: jour(c.echeance), etatEcheance: c.etatEcheance, anomalies: c.anomalies,
      })),
      campagnes: campagnes.map(k => ({
        id: k.id, intitule: k.intitule, niveau: k.niveau, statut: k.statut, recurrence: k.recurrence, dateDebut: jour(k.dateDebut), dateFin: jour(k.dateFin),
        nbControles: Array.isArray(k.controleIds) ? k.controleIds.length : 0,
      })),
      anomalies: anomalies.map(a => ({
        controleId: a.controleId, controle: a.controle?.intitule ?? null, date: jour(a.dateRealisation), constat: court(a.constat),
      })),
    })
  },
})

// ─── read_audits ──────────────────────────────────────────────────────────────
export const readAuditsTool = outil({
  name: 'read_audits',
  description:
    "Audit interne de l'organisation : missions (type, statut, dates, responsable, synthèse des constats : ouverts, en " +
    "retard, critiques, taux de résolution) et constats encore ouverts (criticité, source audit interne ou régulateur, " +
    "échéance, responsable de l'action), les plus critiques d'abord. Visibilité comme l'écran (la 1re ligne ne voit que " +
    "ce qui la concerne). Filtres : statut, type, archives. Module audit interne requis. Lecture seule.",
  inputSchema: {
    type: 'object',
    properties: {
      statut: { type: 'string', description: 'Statut de mission (ex. PLANIFIEE, EN_COURS, TERMINEE).' },
      type: { type: 'string', description: 'Type de mission.' },
      inclureArchives: { type: 'boolean', description: 'Inclure les missions archivées (défaut non).' },
      constatsMax: { type: 'integer', minimum: 1, maximum: 200, description: 'Constats ouverts listés au plus (défaut 50).' },
      ...PAGINATION,
    },
    additionalProperties: false,
  },
  garde: { modules: ['auditInterneActive'] },
  async lire(args, ctx, { acteur }) {
    const now = new Date()
    const acces = await accesResultats(acteur.userId, acteur.role)
    const visibles = (await chargerMissionsLegeres(ctx.organizationId)).flatMap(({ constats, ...m }) => {
      const vue = visibiliteMission(m, constats, acces)
      return vue.visible ? [{ m, constats: vue.constats, synthese: synthetiserConstats(vue.constats, now) }] : []
    })
    const filtres = filtrerMissions(visibles.map(v => ({ ...v.m, v })), { q: '', statut: texte(args.statut), type: texte(args.type) })
      .filter(x => args.inclureArchives === true || !x.archiveLe)
    const page = paginer(filtres, pagination(args))
    const ouverts = filtres.flatMap(({ v }) => v.constats.filter(c => !constatTermine(c.statut as ConstatStatut)).map(c => ({ c, mission: v.m })))
      .sort((a, b) => (b.c.criticite ?? 0) - (a.c.criticite ?? 0))
    return toolText({
      pagination: page.pagination,
      missions: page.items.map(({ v }) => ({
        id: v.m.id, intitule: v.m.intitule, type: v.m.type, statut: v.m.statut, responsable: v.m.responsable,
        dateDebut: jour(v.m.dateDebut), dateFin: jour(v.m.dateFin), archivee: !!v.m.archiveLe, synthese: v.synthese,
      })),
      constatsOuverts: ouverts.slice(0, entier(args.constatsMax, 50, 1, 200)).map(({ c, mission }) => ({
        id: c.id, intitule: c.intitule, criticite: c.criticite, statut: c.statut, source: c.source, echeance: jour(c.echeance),
        responsableAction: c.responsableAction, missionId: mission.id, mission: mission.intitule,
      })),
      constatsOuvertsTotal: ouverts.length,
    })
  },
})

// ─── read_incidents ───────────────────────────────────────────────────────────
export const readIncidentsTool = outil({
  name: 'read_incidents',
  description:
    "Registre des incidents de l'organisation : intitulé, statut, catégorie, processus, entité, dates de survenance et de " +
    "détection, perte nette, risques du registre associés et, pour DORA, la classe de l'incident (majeur ou non) avec la " +
    "prochaine échéance de déclaration et les retards. Sans description libre ni données de déclarant. Filtres : statut, " +
    "recherche. Synthèse sur tous les incidents. Module incidents requis. Lecture seule.",
  inputSchema: {
    type: 'object',
    properties: {
      statut: { type: 'string', enum: [...INCIDENT_STATUTS] },
      recherche: { type: 'string', description: 'Texte recherché (intitulé, processus, risques).' },
      ...PAGINATION,
    },
    additionalProperties: false,
  },
  garde: { modules: ['incidentsActive'] },
  async lire(args, ctx) {
    const orgId = ctx.organizationId
    const legers = await chargerIncidentsLegers(orgId)
    const base = baseIncidents(legers, { statut: choix(args.statut, INCIDENT_STATUTS) ?? '', entite: '', sousEntites: true, entites: [] })
    const page = paginer(filtrerIncidents(base, { q: texte(args.recherche), colonnes: {} }), pagination(args))
    const ids = page.items.map(i => i.id)
    const dora = new Map((ids.length ? await prisma.incident.findMany({
      where: { organizationId: orgId, id: { in: ids } },
      select: { id: true, doraCriteres: true, dateDetection: true, doraClasseMajeurLe: true, doraInitialeSoumiseLe: true, doraIntermediaireSoumiseLe: true, doraFinaleSoumiseLe: true, quasiIncident: true },
    }) : []).map(r => [r.id, r]))
    const now = new Date()
    return toolText({
      synthese: syntheseIncidents(legers, base),
      pagination: page.pagination,
      incidents: page.items.map(i => {
        const d = dora.get(i.id)
        const rep = d ? evaluerReportingIncident({ ...d, doraCriteres: d.doraCriteres as DoraCriteres }, now) : null
        return {
          id: i.id, intitule: i.intitule, statut: i.statut, categorie: i.taxonomieCode, processus: i.processusNom, entite: i.entite,
          dateSurvenance: jour(i.dateSurvenance), dateDetection: jour(i.dateDetection), perteNette: i.perteNette, risques: i.risquesTexte || null,
          quasiIncident: d?.quasiIncident ?? false,
          dora: rep ? { classe: rep.classe, declarationApplicable: rep.synthese.applicable, prochaineEcheance: jour(rep.synthese.prochaineEcheance), enRetard: rep.synthese.enRetard, soumises: rep.synthese.soumises } : null,
        }
      }),
    })
  },
})

// ─── read_tic_register ────────────────────────────────────────────────────────
export const readTicRegisterTool = outil({
  name: 'read_tic_register',
  description:
    "Registre d'informations DORA (art. 28) de l'organisation : accords contractuels TIC (référence, prestataire, LEI, " +
    "pays, type de service, fonction soutenue, criticité, dates, pays des données, sous-traitance, présence d'une " +
    "stratégie de sortie, champs manquants), complétude et synthèse (concentration, expirations), puis les fonctions " +
    "critiques ou importantes et leurs usages de services TIC (prestataire, offre, couverture contractuelle, évaluation). " +
    "Aucun point d'accès (hôte) n'est exposé. Filtre : criticité. Module réglementaire et rôle de gouvernance ou de " +
    "lecture du dispositif requis. Lecture seule.",
  inputSchema: {
    type: 'object',
    properties: {
      criticite: { type: 'string', enum: [...NIVEAUX_CRITICITE], description: 'Criticité de la fonction soutenue.' },
      ...PAGINATION,
    },
    additionalProperties: false,
  },
  garde: { modules: ['reglementaireActive'], lecture: lectureTic },
  async lire(args, ctx) {
    const orgId = ctx.organizationId
    const [rows, { fonctions }] = await Promise.all([
      prisma.arrangementTic.findMany({
        where: { organizationId: orgId }, orderBy: [{ createdAt: 'desc' }],
        select: { id: true, reference: true, prestataireNom: true, identifiant: true, pays: true, typeService: true, fonctionSupportee: true, criticite: true, dateDebut: true, dateFin: true, paysDonnees: true, sousTraitance: true, strategieSortie: true, prestataireAlternatif: true, strategieSortieTesteeLe: true },
      }),
      chargerFonctionsCritiques(orgId),
    ])
    const asLib = rows as unknown as ArrangementTic[]
    const criticite = choix(args.criticite, NIVEAUX_CRITICITE)
    const page = paginer(criticite ? rows.filter(r => r.criticite === criticite) : rows, pagination(args))
    return toolText({
      completude: evaluerCompletude(asLib),
      synthese: synthetiserRegistre(asLib),
      pagination: page.pagination,
      arrangements: page.items.map(a => ({
        id: a.id, reference: a.reference, prestataire: a.prestataireNom, lei: a.identifiant, pays: a.pays, typeService: a.typeService,
        fonctionSupportee: a.fonctionSupportee, criticite: a.criticite, dateDebut: jour(a.dateDebut), dateFin: jour(a.dateFin), paysDonnees: a.paysDonnees,
        sousTraitance: a.sousTraitance, strategieSortie: !!a.strategieSortie?.trim(), strategieSortieTestee: jour(a.strategieSortieTesteeLe),
        champsManquants: validerArrangement(a as unknown as ArrangementTic),
      })),
      fonctionsCritiques: fonctions.map(f => ({
        id: f.id, nom: f.nom, criticiteDora: f.criticiteDora,
        usages: f.usages.map(u => ({
          tiers: u.tiersNom, offre: u.offre, useCase: u.useCase, criticite: u.criticite, couvertParContrat: u.couvert, evalue: u.evalue,
          statutEvaluation: u.evaluation?.statut ?? null, contratSansStrategieSortie: u.contratSansSortie, exposeInternet: u.exposeInternet, interconnexion: u.interconnexion,
        })),
      })),
    })
  },
})

// ─── read_resilience ──────────────────────────────────────────────────────────
export const readResilienceTool = outil({
  name: 'read_resilience',
  description:
    "Résilience opérationnelle (DORA) de l'organisation : fonctions critiques ou importantes avec RTO, RPO et tolérance " +
    "d'impact (minutes), dernier test réalisé, scénarios sévères mais plausibles et écarts détectés (scénario hors " +
    "tolérance, test manquant, contrat sans sortie…), concentration sur un même prestataire ; programme de tests de " +
    "l'année (indicateurs et tests, constats non corrigés) ; risques TIC proposés encore à traiter (si le registre des " +
    "risques est actif). Module réglementaire et rôle de gouvernance ou de lecture du dispositif requis. Lecture seule.",
  inputSchema: {
    type: 'object',
    properties: { annee: { type: 'integer', minimum: 2000, maximum: 2100, description: 'Année du programme de tests (défaut : année en cours).' } },
    additionalProperties: false,
  },
  garde: { modules: ['reglementaireActive'], lecture: lectureTic },
  async lire(args, ctx, { cfg, acteur }) {
    const orgId = ctx.organizationId
    const now = new Date()
    const annee = entier(args.annee, now.getUTCFullYear(), 2000, 2100)
    const avecPropositions = !!cfg.registreRisquesActive && peutVoirPropositionsRisquesTic(acteur.role)
    const [{ fonctions }, tests, propositions] = await Promise.all([
      chargerFonctionsCritiques(orgId),
      prisma.testResilience.findMany({
        where: { organizationId: orgId }, orderBy: [{ annee: 'desc' }, { datePrevue: 'asc' }],
        select: { id: true, annee: true, intitule: true, type: true, statut: true, fonctionCritique: true, independant: true, testeur: true, processusId: true, datePrevue: true, dateRealisation: true, constats: true, riskItemIds: true },
      }),
      avecPropositions ? propositionsOuvertesOrg(orgId) : Promise.resolve(null),
    ])
    const dep = analyserDependances(fonctions)
    const lites = tests.map(t => ({ ...t, constats: sanitizeConstats(t.constats), riskItemIds: Array.isArray(t.riskItemIds) ? (t.riskItemIds as unknown[]).filter((x): x is string => typeof x === 'string') : [] }))
    const t = getT('fr')
    return toolText({
      fonctions: dep.fonctions.map(f => ({
        id: f.id, nom: f.nom, criticiteDora: f.criticiteDora, rtoMinutes: f.rtoMinutes, rpoMinutes: f.rpoMinutes, toleranceImpactMinutes: f.toleranceImpactMinutes,
        dernierTest: f.dernierTest, nbControles: f.nbControles, nbRisques: f.nbRisques, nbIncidents12m: f.nbIncidents12m,
        scenarios: f.scenarios.map(s => ({ intitule: s.intitule, dureeInterruptionMinutes: s.dureeInterruptionMinutes })),
        ecarts: f.ecarts.map(e => ({ code: e.code, gravite: e.gravite })),
      })),
      concentrationTiers: dep.concentration.tiers.map(c => ({ tiers: c.tiersNom, fonctions: c.fonctions })),
      syntheseDependances: dep.synthese,
      programmeTests: programmeStats(lites, annee, now),
      tests: lites.filter(x => x.annee === annee).slice(0, MAX_LISTE).map(x => ({
        id: x.id, intitule: x.intitule, type: x.type, statut: x.statut, fonctionCritique: x.fonctionCritique, testeur: x.testeur, independant: x.independant,
        datePrevue: jour(x.datePrevue), dateRealisation: jour(x.dateRealisation), constats: x.constats.length, constatsOuverts: x.constats.filter(c => !c.corrige).length,
      })),
      propositionsRisques: propositions === null ? null : propositions.slice(0, MAX_LISTE).map(p => ({
        cle: p.cle, type: p.type, famille: p.famille, origine: { type: p.origine.type, libelle: p.origine.libelle }, gravite: p.gravite, vraisemblance: p.vraisemblance,
        ...libellerProposition(p, t),
      })),
    })
  },
})

/** Outils de lecture des domaines GRC (lot S5a). */
export function buildDomaineTools(): McpTool<McpContext>[] {
  return [readPlansActionsTool, readRiskRegisterTool, readConformiteTool, readControlesTool, readAuditsTool, readIncidentsTool, readTicRegisterTool, readResilienceTool]
}
