/**
 * org-config.server.ts — Résolution SERVEUR de la configuration d'une organisation
 * (multi-organisation, L2). Récupère le row de l'organisation et de ses ancêtres
 * (via le chemin matérialisé), puis applique l'héritage (`resolveOrgConfig`).
 *
 * Rétrocompatible : sans organisation (ou organisation racine « global »), renvoie
 * la config de la racine fusionnée aux défauts — identique au comportement singleton.
 */

import { prisma } from '@/lib/prisma'
import { resolveOrgConfig, type RawOrgConfig, type OrgConfigResolved } from '@/lib/org-config'
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
  recertificationActive: true,
  registreIaActive: true,
  mcpActive: true,
  echelleMaturite: true,
  processusCartographie: true,
  incidentsConfig: true,
  vocabulaire: true,
  champsPersonnalises: true,
  auditConfig: true,
  rapportsConfig: true,
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
    }
  } catch {
    return cfg
  }
}

/** Options de structure d'une organisation pour les règles de droits (cumul des rôles en petite structure). */
export async function optionsStructure(orgId: string | null | undefined): Promise<{ petiteStructure: boolean }> {
  return { petiteStructure: orgId ? (await getOrgConfig(orgId)).petiteStructure : false }
}
