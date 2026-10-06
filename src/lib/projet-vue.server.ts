// ─── Vue d'un projet 360 (serveur) : page de présentation et export PowerPoint ─
// Un seul chargement pour /projets/[id] et /api/projets/[id]/export : description, synthèse et matrice des risques,
// plans d'action (par priorité) et indicateurs (date de mise en service comprise), analyses cyber liées accessibles et
// leurs risques à traiter non importés, droits de validation (mêmes règles que la page de l'analyse : rôle effectif
// dans l'organisation, petite structure, auto-validation mono-utilisateur).
import { prisma } from '@/lib/prisma'
import { analyseAccessWhere, countOrgMembers, getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { getOrgConfig, optionsStructure } from '@/lib/org-config.server'
import { getEffectiveScaleConfig } from '@/lib/configuration-server'
import {
  canAcceptResidualRisks, canApproveAnalyse, canAutoValidateAnalyse, canCreateAnalyse, canEditAnalyse, canManageAccess,
  canSubmitAnalyse, resolveAnalyseRole, type UserRole,
} from '@/lib/permissions'
import { syntheseProjet } from '@/lib/projet-synthese'
import { indicateursProjet } from '@/lib/projet-indicateurs'
import { cyberLiesNonImportes } from '@/lib/projet-cyber-lies'
import { trierPlansParPriorite } from '@/lib/plans-priorite'
import { cotations } from '@/lib/cotation-risque'
import { sanitizeApprobations } from '@/lib/projet360'
import { analysesCyberDuProjet } from '@/lib/projet360-sources.server'
import { normalizePatterns, PATTERNS_MAX_MAX } from '@/lib/patterns-archi'

const RISQUE_SELECT = {
  id: true, nom: true, gravite: true, vraisemblance: true, niveauRisque: true, graviteActuelle: true, vraisemblanceActuelle: true,
  niveauActuel: true, graviteResiduelle: true, vraisemblanceResiduelle: true, taxonomieCode: true, domaine: true,
} as const

export async function chargerVueProjet(id: string, userId: string, instanceRole: UserRole, locale: string) {
  const analyse = await prisma.analyse.findFirst({
    where: await analyseAccessWhere(userId, instanceRole, id),
    select: {
      id: true, nom: true, statut: true, secteur: true, patternsArchi: true, methode: true, deletedAt: true, userId: true, organizationId: true,
      dateEcheance: true, accesUtilisateurs: true, approbations: true, commentaireApprobation: true, approuveLe: true, approbateurId: true,
      risquesResiduelsStatut: true, risquesResiduelsLe: true, risquesResiduelsCommentaire: true,
      user: { select: { name: true, email: true } },
      cadrage: { select: { perimetre: true, objectifsEtude: true } },
      risques: { select: { ...RISQUE_SELECT, sourceRisqueId: true } },
    },
  })
  if (!analyse || analyse.deletedAt || analyse.methode !== 'PROJET_360') return null
  const orgConfig = await getOrgConfig(analyse.organizationId)
  if (!orgConfig.projets360Active) return null

  const scale = await getEffectiveScaleConfig(analyse.organizationId)
  const ctx = { scale, appetit: orgConfig.appetitRisque }
  const now = new Date()
  const synthese = syntheseProjet(analyse.risques, ctx)

  // Plans rattachés aux risques du projet (terminés compris : avancement), ordonnés par priorité.
  const plansBruts = analyse.organizationId ? await prisma.planAction.findMany({
    where: { organizationId: analyse.organizationId, liens: { some: { type: 'RISQUE_ANALYSE', ref: analyse.id } } },
    select: { id: true, titre: true, statut: true, priorite: true, echeance: true, porteur: true, liens: { where: { type: 'RISQUE_ANALYSE', ref: analyse.id }, select: { targetId: true } } },
    take: 500,
  }) : []
  const risqueParId = new Map(analyse.risques.map(r => [r.id, r]))
  const plans = trierPlansParPriorite(plansBruts.map(pl => ({
    id: pl.id, titre: pl.titre, statut: pl.statut, priorite: pl.priorite, porteur: pl.porteur, echeance: pl.echeance ? pl.echeance.toISOString() : null,
    risques: pl.liens.flatMap(l => { const r = risqueParId.get(l.targetId); return r ? [{ id: r.id, nom: r.nom, niveau: r.niveauActuel ?? r.niveauRisque }] : [] }),
  })), now)
  const indicateurs = indicateursProjet({
    risques: analyse.risques, ctx, now, miseEnService: analyse.dateEcheance,
    plans: plansBruts.map(pl => ({ statut: pl.statut, echeance: pl.echeance, porteur: pl.porteur, risqueIds: pl.liens.map(x => x.targetId) })),
  })

  // Analyses cyber liées que l'utilisateur peut ouvrir, et leurs risques à traiter pas encore importés.
  const analyses = await analysesCyberDuProjet(userId, instanceRole, analyse)
  const risquesLies = analyses.length ? await prisma.risque.findMany({ where: { analyseId: { in: analyses.map(a => a.id) } }, select: { ...RISQUE_SELECT, analyseId: true }, take: 2000 }) : []
  const cyberLies = cyberLiesNonImportes(
    analyses.map(a => ({ ...a, risques: risquesLies.filter(r => r.analyseId === a.id) })),
    analyse.risques.flatMap(r => (r.sourceRisqueId ? [r.sourceRisqueId] : [])), ctx,
  )

  // Droits : édition, création d'analyse cyber, workflow de validation, acceptation des résiduels.
  const ownership = { userId: analyse.userId, accesUtilisateurs: analyse.accesUtilisateurs }
  const sessionUser = { id: userId, role: instanceRole }
  const role = resolveAnalyseRole(instanceRole, analyse.organizationId, analyse.organizationId ? await getEffectiveRoleForOrg(userId, instanceRole, analyse.organizationId) : null)
  const userWorkflow = { id: userId, role }
  const structure = await optionsStructure(analyse.organizationId)
  const canEdit = canEditAnalyse(userWorkflow, ownership)
  const canCreateCyber = !!analyse.organizationId && canCreateAnalyse(userWorkflow, structure)
  const validation = {
    access: {
      analyseId: analyse.id, statut: analyse.statut, ownerId: analyse.userId, ownerName: analyse.user?.name, ownerEmail: analyse.user?.email,
      currentUserId: userId, currentUserRole: instanceRole,
      canManage: canManageAccess(sessionUser, ownership),
      canSubmit: canSubmitAnalyse(userWorkflow, ownership, structure),
      canApprove: canApproveAnalyse(userWorkflow, ownership, structure),
      canAutoValidate: canAutoValidateAnalyse(userWorkflow, ownership, await countOrgMembers(analyse.organizationId), structure),
      commentaireApprobation: analyse.commentaireApprobation ?? null,
      approuveLe: analyse.approuveLe ? analyse.approuveLe.toISOString() : null,
      approbateurId: analyse.approbateurId ?? null,
      approbations: sanitizeApprobations(analyse.approbations),
    },
    residuels: orgConfig.acceptationRisquesActive ? {
      analyseId: analyse.id, statut: analyse.risquesResiduelsStatut ?? 'EN_ATTENTE',
      le: analyse.risquesResiduelsLe ? analyse.risquesResiduelsLe.toISOString() : null,
      commentaire: analyse.risquesResiduelsCommentaire ?? null,
      canAct: canAcceptResidualRisks(sessionUser, orgConfig.acceptationRisquesActive),
      gelActive: orgConfig.gelApresAcceptationActive, canReopen: canEdit, locale,
    } : undefined,
  }

  const parDomaine = new Map<string, number>()
  for (const r of analyse.risques) parDomaine.set(r.domaine ?? '', (parDomaine.get(r.domaine ?? '') ?? 0) + 1)

  return {
    canEdit, canCreateCyber, validation, plans, scale,
    vue: {
      id: analyse.id, nom: analyse.nom, statut: analyse.statut, secteur: analyse.secteur,
      patterns: normalizePatterns(analyse.patternsArchi, { max: PATTERNS_MAX_MAX }),
      perimetre: analyse.cadrage?.perimetre ?? null, objectifs: analyse.cadrage?.objectifsEtude ?? null,
      analyses,
      synthese: { ...synthese, principaux: synthese.principaux.map(r => ({ ...r, palier: { label: r.palier.label, couleur: r.palier.couleur } })) },
      matrice: analyse.risques.map(r => ({ id: r.id, nom: r.nom, domaine: r.domaine, ...cotations(r) })),
      scale, indicateurs,
      miseEnService: analyse.dateEcheance ? analyse.dateEcheance.toISOString().slice(0, 10) : null,
      cyberLies,
    },
    parDomaine: [...parDomaine.entries()].map(([domaine, total]) => ({ domaine: domaine || null, total })).sort((a, b) => b.total - a.total),
  }
}
