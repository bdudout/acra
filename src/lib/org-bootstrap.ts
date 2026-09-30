/**
 * org-bootstrap.ts — Amorçage multi-organisation au démarrage du serveur.
 *
 * Idempotent et sûr au déploiement : si AUCUN super-administrateur n'existe ET
 * qu'il n'en a JAMAIS existé (instance migrée depuis le mono-tenant), promeut le
 * plus ancien ADMIN actif en SUPER_ADMIN, afin qu'un administrateur d'instance
 * puisse piloter les organisations.
 *
 * Audit 2026-09-30 (S4) : sans la condition « jamais existé », supprimer le
 * dernier SUPER_ADMIN puis attendre un redémarrage suffisait à promouvoir le plus
 * ancien ADMIN (escalade). Une instance qui a PERDU son SUPER_ADMIN n'est plus
 * réparée automatiquement : alerte au démarrage, reprise par create-admin.mjs.
 * Sur une nouvelle installation, le SUPER_ADMIN est créé localement via
 * `scripts/create-admin.mjs` (aucun amorçage anonyme via l'inscription publique).
 */

import { prisma } from '@/lib/prisma'
import { auditLog } from '@/lib/logger'

/** Amorçage : garantit qu'au moins un compte SUPER_ADMIN existe (no-op si déjà présent). */
export async function ensureSuperAdmin(): Promise<void> {
  try {
    const existing = await prisma.user.count({ where: { role: 'SUPER_ADMIN' } })
    if (existing > 0) return

    const oldestAdmin = await prisma.user.findFirst({
      where: { role: 'ADMIN', isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true },
    })
    if (!oldestAdmin) return // aucune base à amorcer (ex. install vierge)

    // Un SUPER_ADMIN a-t-il déjà existé ? (il a agi, ou un compte SUPER_ADMIN a été supprimé)
    const trace = await prisma.auditLog.count({
      where: { OR: [{ userRole: 'SUPER_ADMIN' }, { action: 'USER_DELETED', details: { contains: '"targetRole":"SUPER_ADMIN"' } }] },
    })
    if (trace > 0) {
      console.error('\x1b[31m✗ [ACRA-STARTUP]\x1b[0m Aucun SUPER_ADMIN actif alors qu\'il en a existé : pas de promotion automatique. Recréez-en un : node scripts/create-admin.mjs <email> SUPER_ADMIN')
      return
    }

    await prisma.user.update({ where: { id: oldestAdmin.id }, data: { role: 'SUPER_ADMIN' } })
    await auditLog('ROLE_CHANGED', {
      targetId: oldestAdmin.id, targetType: 'user', userEmail: oldestAdmin.email,
      details: { from: 'ADMIN', to: 'SUPER_ADMIN', reason: 'bootstrap-multi-organisation' },
    })
    console.info(`\x1b[32m✓ [ACRA-STARTUP]\x1b[0m Bootstrap multi-organisation : ${oldestAdmin.email} promu SUPER_ADMIN`)
  } catch {
    // Base potentiellement indisponible au démarrage : réessayé au prochain boot.
  }
}
