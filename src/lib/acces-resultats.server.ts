// ─── Accès aux résultats d'audit et de contrôle : contexte serveur ────────────
// Résout, pour l'utilisateur et son rôle effectif, s'il voit tout ou seulement ce qui le concerne (lib/acces-resultats).
import { prisma } from '@/lib/prisma'
import type { UserRole } from '@/lib/permissions'
import { estConcerne, voitTousLesResultats, type AccesResultats } from '@/lib/acces-resultats'

export async function accesResultats(userId: string, role: UserRole): Promise<AccesResultats> {
  if (voitTousLesResultats(role)) return { tout: true, concerne: () => true }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } })
  return { tout: false, concerne: r => estConcerne(r, user ?? {}) }
}
