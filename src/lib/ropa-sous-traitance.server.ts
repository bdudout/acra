// ─── Registre du sous-traitant (RGPD art. 30 §2) — contexte serveur ───────────
// DPO / ADMIN de l'organisation active, module `ropaSousTraitantActive` actif (sinon 404 : rien n'est divulgué).
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { getAnalyseScope } from './org-context.server'
import { getOrgConfig } from './org-config.server'
import { canManageRopa, type UserRole } from './permissions'

export async function contexteSousTraitance(): Promise<{ userId: string; role: UserRole; orgId: string } | { error: NextResponse }> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const user = session.user as { id: string; role?: string }
  const scope = await getAnalyseScope(user.id, (user.role ?? 'ANALYSTE') as UserRole)
  if (!scope.activeOrgId) return { error: NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 }) }
  if (!(await getOrgConfig(scope.activeOrgId)).ropaSousTraitantActive) return { error: NextResponse.json({ error: 'module_inactif' }, { status: 404 }) }
  if (!canManageRopa(scope.role as UserRole)) return { error: NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 }) }
  return { userId: user.id, role: scope.role as UserRole, orgId: scope.activeOrgId }
}
