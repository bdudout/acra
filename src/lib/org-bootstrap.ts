/**
 * org-bootstrap.ts — Amorçage multi-organisation au démarrage du serveur.
 *
 * Idempotent et sûr au déploiement : si AUCUN super-administrateur n'existe
 * (instance migrée depuis le mono-tenant), promeut le plus ancien ADMIN actif en
 * SUPER_ADMIN, afin qu'un administrateur d'instance puisse piloter les organisations.
 * Sur une nouvelle installation, le 1ᵉʳ compte est déjà créé SUPER_ADMIN (register).
 */

import { prisma } from '@/lib/prisma'

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

    await prisma.user.update({ where: { id: oldestAdmin.id }, data: { role: 'SUPER_ADMIN' } })
    console.info(`\x1b[32m✓ [ACRA-STARTUP]\x1b[0m Bootstrap multi-organisation : ${oldestAdmin.email} promu SUPER_ADMIN`)
  } catch {
    // Base potentiellement indisponible au démarrage : réessayé au prochain boot.
  }
}
