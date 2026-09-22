// ─── Garde d'accès à la saisie directe de risques (serveur) ──────────────────
// Point unique de contrôle pour les routes `/api/analyses/[id]/risques**` :
//  1. l'analyse est accessible dans le périmètre de l'utilisateur (isolation) ;
//  2. sa méthode autorise la **saisie directe** (ISO 31000… ; pas EBIOS RM, où les
//     risques dérivent des scénarios) ;
//  3. l'utilisateur peut ÉDITER l'analyse (rôle EFFECTIF d'organisation, F01) ;
//  4. l'analyse n'est pas gelée (acceptation des risques résiduels).

import { prisma } from '@/lib/prisma'
import { canEditAnalyse, resolveAnalyseRole, type UserRole } from '@/lib/permissions'
import { analyseAccessWhere, getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { analyseGelee } from '@/lib/gel-analyse'
import { usesDirectRiskEntry } from '@/lib/methodes'

type Guarded = {
  ok: true
  analyse: { id: string; organizationId: string | null; methode: string }
} | { ok: false; status: number; error: string }

/** Vérifie les 4 conditions (accès, méthode, édition, gel) ; renvoie l'analyse ou un refus. */
export async function guardDirectRisk(analyseId: string, userId: string, instanceRole: UserRole): Promise<Guarded> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const analyse = await (prisma.analyse as any).findFirst({
    where: await analyseAccessWhere(userId, instanceRole, analyseId),
    include: { accesUtilisateurs: true },
  })
  if (!analyse || analyse.deletedAt) return { ok: false, status: 404, error: 'Analyse introuvable' }

  // La méthode doit autoriser la saisie directe (sinon les risques dérivent des scénarios).
  if (!usesDirectRiskEntry(analyse.methode)) {
    return { ok: false, status: 400, error: 'methode_sans_saisie_directe' }
  }

  const effRole = resolveAnalyseRole(
    instanceRole, analyse.organizationId,
    analyse.organizationId ? await getEffectiveRoleForOrg(userId, instanceRole, analyse.organizationId) : null,
  )
  if (!canEditAnalyse({ id: userId, role: effRole }, { userId: analyse.userId, accesUtilisateurs: analyse.accesUtilisateurs })) {
    return { ok: false, status: 403, error: 'Édition non autorisée' }
  }

  const orgConfig = await getOrgConfig(analyse.organizationId)
  if (analyseGelee(analyse.risquesResiduelsStatut, orgConfig.gelApresAcceptationActive)) {
    return { ok: false, status: 403, error: 'ANALYSE_GELEE' }
  }

  return { ok: true, analyse: { id: analyse.id, organizationId: analyse.organizationId, methode: analyse.methode } }
}
