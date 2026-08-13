import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { validateAppetitConfig, cleanAppetitConfig, SEUIL_MIN, SEUIL_MAX } from '@/lib/appetit'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// L'appétit est une décision de GOUVERNANCE : administrateur d'org, risk manager
// ou RSSI. Les autres rôles le consultent seulement.
function peutGouvernerAppetit(role: UserRole): boolean {
  return isAdminRole(role) || role === 'RISK_MANAGER' || role === 'RSSI'
}

// GET /api/appetit — configuration effective (héritée) + droit d'édition.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const userId = (session.user as { id: string }).id

  const scope = await getAnalyseScope(userId, instanceRole)
  const userRole = scope.role
  if (!scope.activeOrgId) return NextResponse.json({ active: false })
  const cfg = await getOrgConfig(scope.activeOrgId)
  if (!cfg.registreRisquesActive) return NextResponse.json({ active: false })

  return NextResponse.json({
    active: true,
    appetit: cfg.appetitRisque,
    canEdit: peutGouvernerAppetit(userRole),
    seuilMin: SEUIL_MIN,
    seuilMax: SEUIL_MAX,
  })
}

// PUT /api/appetit — définit l'appétit de l'organisation ACTIVE (gouvernance).
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const userId = (session.user as { id: string }).id

  const scope = await getAnalyseScope(userId, instanceRole)
  const userRole = scope.role
  if (!scope.activeOrgId) return NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 })
  const cfg = await getOrgConfig(scope.activeOrgId)
  if (!cfg.registreRisquesActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })
  if (!peutGouvernerAppetit(userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const erreur = validateAppetitConfig(body)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const appetitRisque = cleanAppetitConfig(body)

  const orgId = scope.activeOrgId
  await prisma.organizationConfig.upsert({
    where: { id: orgId },
    create: { id: orgId, appetitRisque: appetitRisque as unknown as Prisma.InputJsonValue },
    update: { appetitRisque: appetitRisque as unknown as Prisma.InputJsonValue },
  })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: orgId, targetId: orgId, targetType: 'organization', ip: getClientIp(req),
    details: { scope: 'appetit-risque' },
  })
  return NextResponse.json({ appetit: appetitRisque })
}
