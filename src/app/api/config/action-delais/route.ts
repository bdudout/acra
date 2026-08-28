import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { DEFAULT_ACTION_DELAIS_MOIS } from '@/lib/risk-action'
import { type UserRole } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

// GET /api/config/action-delais — délais (mois) d'échéance par défaut d'une action
// selon sa priorité, pour l'org active. Sert au calcul de l'échéance côté UI.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ delais: DEFAULT_ACTION_DELAIS_MOIS })
  const userId = (session.user as { id: string }).id
  const role = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, role)
  if (!scope.activeOrgId) return NextResponse.json({ delais: DEFAULT_ACTION_DELAIS_MOIS })
  const cfg = await getOrgConfig(scope.activeOrgId)
  return NextResponse.json({ delais: cfg.actionDelaisMois })
}
