// ─── Ancres de propositions MCP — vérification d'existence org-scopée ─────────
// Une proposition « ne tombe pas du ciel » : son ancre (targetType + targetId)
// doit désigner un objet CONCRET, EXISTANT et dans l'ORGANISATION de la clé. Ce
// module centralise cette vérification pour tous les types d'ancre (mêmes origines
// que le plan d'action unifié / PlanActionLien). Aucune divulgation : renvoie un
// simple booléen.

import { prisma } from '@/lib/prisma'

/**
 * Vrai si l'objet d'ancrage existe ET appartient à l'organisation. Chaque type
 * interroge le modèle correspondant, borné à `organizationId` (analyse : hors
 * corbeille). Un type inconnu → false.
 */
export async function anchorExistsInOrg(targetType: string, targetId: string, organizationId: string): Promise<boolean> {
  if (!targetId) return false
  const where = { id: targetId, organizationId }
  switch (targetType) {
    case 'ANALYSE':    return (await prisma.analyse.count({ where: { ...where, deletedAt: null } })) > 0
    case 'RISQUE':     return (await prisma.riskItem.count({ where })) > 0
    case 'CONTROLE':   return (await prisma.controle.count({ where })) > 0
    case 'INCIDENT':   return (await prisma.incident.count({ where })) > 0
    case 'AUDIT':      return (await prisma.auditConstat.count({ where })) > 0
    case 'CONFORMITE': return (await prisma.conformite.count({ where })) > 0
    default:           return false
  }
}
