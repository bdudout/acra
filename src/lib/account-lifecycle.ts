/**
 * account-lifecycle.ts — Désactivation automatique des comptes inactifs (#12).
 *
 * Un compte non-ADMIN qui ne s'est pas connecté depuis plus de
 * `inactivityDaysLimit` jours est désactivé (isActive=false). Les ADMIN sont
 * exemptés. La référence d'inactivité est `lastLoginAt`, ou à défaut `createdAt`
 * (compte jamais utilisé).
 *
 * La logique de décision est pure et testable ; la désactivation effective
 * (Prisma) est isolée dans `deactivateInactiveAccounts`, appelée paresseusement
 * lorsqu'un admin consulte la liste des utilisateurs (pas de cron requis).
 */

export interface InactivityCandidate {
  id: string
  role: string
  isActive: boolean
  lastLoginAt: Date | null
  createdAt: Date
}

/**
 * Détermine si un compte doit être désactivé pour inactivité.
 * - inactivityDays <= 0 : fonctionnalité désactivée → jamais.
 * - ADMIN : jamais.
 * - compte déjà inactif : non (rien à faire).
 */
export function shouldDeactivateForInactivity(
  user: InactivityCandidate,
  inactivityDays: number,
  now: Date = new Date()
): boolean {
  if (!inactivityDays || inactivityDays <= 0) return false
  if (user.role === 'ADMIN') return false
  if (!user.isActive) return false

  const reference = user.lastLoginAt ?? user.createdAt
  const limitMs = inactivityDays * 24 * 60 * 60 * 1000
  return now.getTime() - new Date(reference).getTime() > limitMs
}

/**
 * Désactive en base tous les comptes inactifs éligibles. Best-effort :
 * n'échoue jamais l'appelant. Retourne le nombre de comptes désactivés.
 */
export async function deactivateInactiveAccounts(): Promise<number> {
  try {
    const { prisma } = await import('@/lib/prisma')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const policy = await (prisma as any).passwordPolicy.findUnique({ where: { id: 'global' } })
    const inactivityDays: number = policy?.inactivityDaysLimit ?? 0
    if (!inactivityDays || inactivityDays <= 0) return 0

    const cutoff = new Date(Date.now() - inactivityDays * 24 * 60 * 60 * 1000)

    // Comptes actifs, non-ADMIN, dont la référence d'activité est antérieure au seuil.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (prisma.user as any).updateMany({
      where: {
        isActive: true,
        role: { not: 'ADMIN' },
        OR: [
          { lastLoginAt: { lt: cutoff } },
          { lastLoginAt: null, createdAt: { lt: cutoff } },
        ],
      },
      data: { isActive: false },
    })
    return result.count ?? 0
  } catch {
    return 0
  }
}
