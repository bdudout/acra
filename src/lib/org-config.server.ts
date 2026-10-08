/**
 * org-config.server.ts — Résolution SERVEUR de la configuration d'une organisation
 * (multi-organisation, L2). Récupère le row de l'organisation et de ses ancêtres
 * (via le chemin matérialisé), puis applique l'héritage (`resolveOrgConfig`).
 *
 * Rétrocompatible : sans organisation (ou organisation racine « global »), renvoie
 * la config de la racine fusionnée aux défauts — identique au comportement singleton.
 */

import { prisma } from '@/lib/prisma'
import { resolveOrgConfig, valeursACopierALaCreation, type RawOrgConfig, type OrgConfigResolved } from '@/lib/org-config'
import { resolveModuleActivation, sanitizeModulesPolicy } from '@/lib/module-policy'

export const CONFIG_SELECT = {
  entitesMesures: true,
  typesImpacts: true,
  referentielsActifs: true,
  referentielsDesactives: true,
  qualificationQuestionnaire: true,
  strategiesTraitement: true,
  exemplesAteliers: true,
  echellesEcosysteme: true,
  qualificationActive: true,
  qualificationObligatoire: true,
  conformiteActive: true,
  conformiteNiveau: true,
  conformiteSnapshotMode: true,
  conformiteSnapshotPeriode: true,
  conseilsAteliersActive: true,
  acceptationRisquesActive: true,
  gelApresAcceptationActive: true,
  interdireAutoApprobation: true,
  petiteStructure: true,
  derogationsActive: true,
  derogationDureeDefautJours: true,
  derogationAlerteJours: true,
  derogationDureeMaxJours: true,
  archivageMissionsAnnees: true,
  patternsArchiMax: true,
  patternsArchiMasques: true,
  secteursMasques: true,
  risquesProjetDefaut: true,
  derogationWorkflow: true,
  derogationDoubleRegard: true,
  derogationSortCatalogue: true,
  taxonomieRisques: true,
  registreRisquesActive: true,
  incidentsActive: true,
  controlePermanentActive: true,
  auditInterneActive: true,
  kriActive: true,
  reglementaireActive: true,
  secondeLigneActive: true,
  profilsOperationnelsActive: true,
  projets360Active: true,
  homologationsActive: true,
  projetSuppressionValidation: true,
  recertificationActive: true,
  registreIaActive: true,
  campagnesRcsaActive: true,
  appetenceActive: true,
  rapportsGrcActive: true,
  ropaSousTraitantActive: true,
  mcpActive: true,
  echelleMaturite: true,
  processusCartographie: true,
  incidentsConfig: true,
  vocabulaire: true,
  champsPersonnalises: true,
  auditConfig: true,
  rapportsConfig: true,
  planificationConfig: true,
  relancesConfig: true,
  appetitRisque: true,
} as const

/**
 * Configuration effective d'une organisation (héritage des ancêtres appliqué).
 * `orgId` absent/inconnu ⇒ valeurs par défaut.
 */
export async function getOrgConfig(orgId: string | null | undefined): Promise<OrgConfigResolved> {
  if (!orgId) return applyInstancePolicy(resolveOrgConfig([]))

  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { path: true } })
  // Chaîne d'ids racine→nœud déduite du chemin "/racine/…/nœud/".
  // Chemin absent ou dégénéré (« / ») : l'organisation seule, plutôt qu'une chaîne vide (= défauts).
  const fromPath = org?.path ? org.path.split('/').filter(Boolean) : []
  const idsRootToSelf = fromPath.length ? fromPath : [orgId]

  const rows = await prisma.organizationConfig.findMany({
    where: { id: { in: idsRootToSelf } },
    select: { id: true, ...CONFIG_SELECT },
  })
  const byId = new Map(rows.map(r => [r.id, r as unknown as RawOrgConfig]))

  // Chaîne SELF-first (nœud → racine) pour resolveOrgConfig.
  const chainSelfFirst = idsRootToSelf.slice().reverse().map(id => byId.get(id) ?? null)
  return applyInstancePolicy(resolveOrgConfig(chainSelfFirst))
}

/** Configuration héritée par l'organisation (arbre), SANS la politique d'instance : les choix réels de l'organisation et de ses ancêtres. */
async function getOrgConfigSansPolitique(orgId: string): Promise<OrgConfigResolved> {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { path: true } })
  const fromPath = org?.path ? org.path.split('/').filter(Boolean) : []
  const idsRootToSelf = fromPath.length ? fromPath : [orgId]
  const rows = await prisma.organizationConfig.findMany({ where: { id: { in: idsRootToSelf } }, select: { id: true, ...CONFIG_SELECT } })
  const byId = new Map(rows.map(r => [r.id, r as unknown as RawOrgConfig]))
  return resolveOrgConfig(idsRootToSelf.slice().reverse().map(id => byId.get(id) ?? null))
}

/**
 * Écrit des champs de configuration d'une organisation. Si sa ligne n'existe pas encore, elle est créée avec les valeurs
 * HÉRITÉES pour les colonnes non nullables (lib/org-config.valeursACopierALaCreation) : sans cela, créer la ligne pour
 * enregistrer un seul réglage figerait tous les autres aux valeurs par défaut et la filiale perdrait ceux de son groupe.
 */
export async function upsertOrgConfig(orgId: string, data: Record<string, unknown>) {
  const existe = await prisma.organizationConfig.findUnique({ where: { id: orgId }, select: { id: true } })
  if (existe) return prisma.organizationConfig.update({ where: { id: orgId }, data })
  const herite = valeursACopierALaCreation(await getOrgConfigSansPolitique(orgId))
  // upsert : une création concurrente n'échoue pas (la ligne créée entre-temps est simplement mise à jour).
  return prisma.organizationConfig.upsert({ where: { id: orgId }, create: { id: orgId, ...herite, ...data } as never, update: data })
}

/**
 * Applique la POLITIQUE D'INSTANCE (Configuration.modulesPolicy) au-dessus de la
 * config d'organisation : point UNIQUE où l'activation effective d'un module est
 * résolue (FORCE_ON/FORCE_OFF surplombent le toggle de l'org). Best-effort.
 */
async function applyInstancePolicy(cfg: OrgConfigResolved): Promise<OrgConfigResolved> {
  try {
    const inst = await prisma.configuration.findUnique({
      where: { id: 'global' }, select: { modulesPolicy: true },
    })
    const policy = sanitizeModulesPolicy(inst?.modulesPolicy)
    return {
      ...cfg,
      registreRisquesActive: resolveModuleActivation(policy.registreRisques, cfg.registreRisquesActive),
      incidentsActive: resolveModuleActivation(policy.incidents, cfg.incidentsActive),
      controlePermanentActive: resolveModuleActivation(policy.controlePermanent, cfg.controlePermanentActive),
      auditInterneActive: resolveModuleActivation(policy.auditInterne, cfg.auditInterneActive),
      kriActive: resolveModuleActivation(policy.kri, cfg.kriActive),
      reglementaireActive: resolveModuleActivation(policy.reglementaire, cfg.reglementaireActive),
      secondeLigneActive: resolveModuleActivation(policy.secondeLigne, cfg.secondeLigneActive),
      profilsOperationnelsActive: resolveModuleActivation(policy.profilsOperationnels, cfg.profilsOperationnelsActive),
      projets360Active: resolveModuleActivation(policy.projets360, cfg.projets360Active),
      homologationsActive: resolveModuleActivation(policy.homologations, cfg.homologationsActive),
      recertificationActive: resolveModuleActivation(policy.recertification, cfg.recertificationActive),
      registreIaActive: resolveModuleActivation(policy.registreIa, cfg.registreIaActive),
      campagnesRcsaActive: resolveModuleActivation(policy.campagnesRcsa, cfg.campagnesRcsaActive),
      appetenceActive: resolveModuleActivation(policy.appetence, cfg.appetenceActive),
      rapportsGrcActive: resolveModuleActivation(policy.rapportsGrc, cfg.rapportsGrcActive),
      ropaSousTraitantActive: resolveModuleActivation(policy.ropaSousTraitant, cfg.ropaSousTraitantActive),
    }
  } catch {
    return cfg
  }
}

/** Options de structure d'une organisation pour les règles de droits (cumul des rôles en petite structure). */
export async function optionsStructure(orgId: string | null | undefined): Promise<{ petiteStructure: boolean }> {
  return { petiteStructure: orgId ? (await getOrgConfig(orgId)).petiteStructure : false }
}
