import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAnalyseScope } from '@/lib/org-context.server'
import { orgSectors } from '@/lib/sector-context.server'
import type { UserRole } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

/** Secteurs effectifs de l'organisation active (lecture seule, tout utilisateur connecté) : filtrent les listes sectorielles (incidents types…). */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const scope = await getAnalyseScope(userId, ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole)
  if (!scope.activeOrgId) return NextResponse.json({ error: 'organization_required' }, { status: 400 })
  const { effective } = await orgSectors(scope.activeOrgId)
  return NextResponse.json({ effective })
}
