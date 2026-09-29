// ─── Processus de cartographie des risques — personnalisation ────────────────
// PUT : enregistre le texte du processus (étapes, périodicité de revue) dans la
// configuration de l'organisation ACTIVE. Gouvernance uniquement (ADMIN, RSSI,
// RISK_MANAGER) ; registre des risques inactif → 404. {} = retour au défaut.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { sanitizeProcessusCarto } from '@/lib/processus-carto'
import { auditLog, getClientIp } from '@/lib/logger'
import { rateLimit, rateLimitHeaders, LIMIT_API_WRITE } from '@/lib/rate-limit'

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  if (!scope.activeOrgId || !(await getOrgConfig(scope.activeOrgId)).registreRisquesActive) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  if (!(isAdminRole(scope.role) || scope.role === 'RSSI' || scope.role === 'RISK_MANAGER')) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const rl = await rateLimit(`processus-carto:${userId}`, LIMIT_API_WRITE.limit, LIMIT_API_WRITE.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })

  const body = await req.json().catch(() => ({}))
  const reset = body && typeof body === 'object' && Object.keys(body).length === 0
  const value = reset ? {} : sanitizeProcessusCarto(body)
  await prisma.organizationConfig.upsert({
    where: { id: scope.activeOrgId },
    create: { id: scope.activeOrgId, entitesMesures: [], processusCartographie: value as object },
    update: { processusCartographie: value as object },
  })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId, userRole: scope.role, organizationId: scope.activeOrgId, ip: getClientIp(req), details: { fields: ['processusCartographie'], reset } })
  return NextResponse.json({ processus: value })
}
