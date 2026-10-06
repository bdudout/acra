// ─── Accès aux résultats d'audit et de contrôle (PUR) ─────────────────────────
// Les résultats (missions et constats d'audit, contrôles et leurs exécutions, plans, campagnes, rapports) sont réservés
// aux interlocuteurs concernés : les rôles à lecture globale du dispositif (gouvernance, contrôle, audit, direction
// métier) voient tout ; la 1re ligne et la lecture seule ne voient que ce dont elles sont responsables (nom ou e-mail
// saisi comme responsable). Testé : acces-resultats.test.ts.
import { hasGlobalReadDispositif, type UserRole } from '@/lib/permissions'

export function voitTousLesResultats(role: UserRole): boolean {
  return hasGlobalReadDispositif(role)
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()

/** Le responsable saisi (texte libre, éventuellement plusieurs séparés par , ou ;) désigne-t-il cet utilisateur ? */
export function estConcerne(responsable: string | null | undefined, user: { name?: string | null; email?: string | null }): boolean {
  if (!responsable) return false
  const moi = [user.name, user.email].filter((x): x is string => !!x && !!x.trim()).map(norm)
  if (!moi.length) return false
  return responsable.split(/[;,]/).map(norm).filter(Boolean).some(r => moi.includes(r))
}

export interface AccesResultats { tout: boolean; concerne: (responsable: string | null | undefined) => boolean }

/** Mission d'audit vue par un interlocuteur : complète s'il voit tout ou en est responsable ; sinon ses seuls constats. */
export function visibiliteMission<C extends { responsableAction?: string | null }>(
  mission: { responsable?: string | null }, constats: readonly C[], acces: AccesResultats,
): { visible: boolean; complete: boolean; constats: C[] } {
  if (acces.tout || acces.concerne(mission.responsable)) return { visible: true, complete: true, constats: [...constats] }
  const miens = constats.filter(c => acces.concerne(c.responsableAction))
  return { visible: miens.length > 0, complete: false, constats: miens }
}
