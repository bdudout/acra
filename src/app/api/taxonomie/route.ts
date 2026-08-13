import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { resolveTaxonomie } from '@/lib/taxonomie'
import { type UserRole } from '@/lib/permissions'

// GET /api/taxonomie — taxonomie de risques EFFECTIVE de l'organisation active
// (override org ou défaut Bâle). Les libellés (labelKey) sont résolus par l'UI.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ taxonomie: [] })
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  // Rôle EFFECTIF dans l'organisation active (pas le rôle d'instance) → A01/CWE-863.
  const userRole = scope.role
  const cfg = await getOrgConfig(scope.activeOrgId)
  return NextResponse.json({ taxonomie: resolveTaxonomie(cfg.taxonomieRisques) })
}
