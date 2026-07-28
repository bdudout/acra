import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { type UserRole } from '@/lib/permissions'

// GET /api/modules — état EFFECTIF des modules GRC pour l'organisation active
// (politique d'instance déjà appliquée par getOrgConfig). Sert à la navigation.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ registreRisquesActive: false })
  const userId = (session.user as { id: string }).id
  const userRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, userRole)
  const cfg = await getOrgConfig(scope.activeOrgId)
  return NextResponse.json({ registreRisquesActive: cfg.registreRisquesActive })
}
