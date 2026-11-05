// ─── Sauvegarde manuelle immédiate (SUPER_ADMIN) ───
// Dépose une demande `backup-now` pour l'agent hôte, qui crée un point `manual` (l'application n'exécute aucune commande).
// Profil ha : l'agent sauvegarde la base EXTERNE (sauvegarde logique, scripts/acra-snapshot.sh).

import { NextRequest, NextResponse } from 'next/server'
import { requireInstanceAdmin } from '@/lib/route-guard.server'
import { deposerSauvegardeImmediate } from '@/lib/update-request.server'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const g = await requireInstanceAdmin(req)
  if (g.error) return g.error
  const d = await deposerSauvegardeImmediate(g.user.id)
  if (!d.ok) return NextResponse.json({ error: d.error }, { status: 409 })
  await auditLog('INSTANCE_BACKUP_REQUESTED', { userId: g.user.id, userRole: g.user.role, targetType: 'instance', targetId: d.id, ip: getClientIp(req) })
  return NextResponse.json({ requested: true, id: d.id }, { status: 202 })
}
