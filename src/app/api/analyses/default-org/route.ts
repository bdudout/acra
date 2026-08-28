import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAnalyseScope } from '@/lib/org-context.server'
import { orgNameForPrefill } from '@/lib/org-active'
import { type UserRole } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

// GET /api/analyses/default-org — nom de l'org active, pour pré-remplir le champ
// « organisation » d'une nouvelle analyse (défaut intelligent). Utilise le même
// résolveur de périmètre que le reste de l'app (getAnalyseScope).
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ name: null })
  const userId = (session.user as { id: string }).id
  const role = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, role)
  return NextResponse.json({ name: orgNameForPrefill(scope.activeOrgId, scope.memberships) })
}
