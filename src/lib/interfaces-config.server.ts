// ─── État des interfaces programmatiques (API v1, MCP) — accès serveur ────────
// Toggles d'INSTANCE réglés par le SUPER_ADMIN dans /admin/instance, DÉSACTIVÉS
// par défaut. Point de lecture unique : l'API v1 (lib/api-auth.server) et la
// future surface MCP délèguent ici. Défaut sécurisé : en cas d'erreur DB ou de
// singleton absent, l'interface est réputée DÉSACTIVÉE (fail-closed).
import { prisma } from '@/lib/prisma'
import { cleanActiveMethodes, type RiskMethod } from '@/lib/methodes'

/** L'API publique v1 est-elle activée au niveau instance ? (défaut : non). */
export async function isApiEnabled(): Promise<boolean> {
  try {
    const cfg = await prisma.configuration.findUnique({ where: { id: 'global' }, select: { apiEnabled: true } })
    return cfg?.apiEnabled === true
  } catch {
    return false
  }
}

/** La surface MCP est-elle activée au niveau instance ? (défaut : non). */
export async function isMcpEnabled(): Promise<boolean> {
  try {
    const cfg = await prisma.configuration.findUnique({ where: { id: 'global' }, select: { mcpEnabled: true } })
    return cfg?.mcpEnabled === true
  } catch {
    return false
  }
}

/**
 * Méthodes d'analyse activées au niveau instance (assainies ; EBIOS RM toujours
 * présent). Défaut sécurisé : EBIOS RM seul en cas d'erreur/singleton absent.
 */
export async function getActiveMethodes(): Promise<RiskMethod[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfg = await (prisma.configuration as any).findUnique({ where: { id: 'global' }, select: { methodesActives: true } })
    return cleanActiveMethodes(cfg?.methodesActives)
  } catch {
    return cleanActiveMethodes(null)
  }
}
