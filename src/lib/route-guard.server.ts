// ─── Gardes d'accès des routes API (point unique) ────────────────────────────
// Audit 2026-09-30 (T3). Chaque route d'administration recopiait sa propre garde
// (`requireAdmin`, `requireSuperAdmin`…) ; les failles F01, F02, S1, S4 et T1 venaient
// toutes d'une variante recopiée incorrecte. Les routes utilisent désormais ces gardes,
// qui s'appuient sur `lib/permissions` (aucune comparaison de rôle ad hoc).

import { NextResponse } from 'next/server'
import { getServerSession, type Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { canAdminInstance, type UserRole } from '@/lib/permissions'

/** Utilisateur de la session, typé (évite les `session.user as any`). */
export interface SessionUser { id: string; role: UserRole; email: string | null; name: string | null }

export type GuardResult =
  | { error: NextResponse; session: null; user: null }
  | { error: null; session: Session; user: SessionUser }

const deny = (status: 401 | 403, message: string): GuardResult =>
  ({ error: NextResponse.json({ error: message }, { status }), session: null, user: null })

/** Utilisateur de la session courante, ou null (non authentifié). */
export function sessionUser(session: Session | null): SessionUser | null {
  const u = session?.user as { id?: string; role?: string; email?: string | null; name?: string | null } | undefined
  if (!u?.id) return null
  return { id: u.id, role: (u.role ?? 'ANALYSTE') as UserRole, email: u.email ?? null, name: u.name ?? null }
}

/** Session obligatoire (401 sinon). */
export async function requireSession(): Promise<GuardResult> {
  const session = await getServerSession(authOptions)
  const user = sessionUser(session)
  if (!session || !user) return deny(401, 'Non autorisé')
  return { error: null, session, user }
}

/**
 * Réglage ou vue d'INSTANCE (SMTP, SSO, SIEM, politique de mot de passe, organisations,
 * démo…) : réservé au SUPER_ADMIN (`canAdminInstance`). 401 sans session, 403 sinon.
 * Le paramètre est ignoré (compatibilité avec les anciennes gardes locales `requireAdmin(req)`).
 */
export async function requireInstanceAdmin(_req?: unknown): Promise<GuardResult> {
  const g = await requireSession()
  if (g.error) return g
  if (!canAdminInstance({ id: g.user.id, role: g.user.role })) return deny(403, 'Réservé au super-administrateur')
  return g
}
