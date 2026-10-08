import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig, upsertOrgConfig } from '@/lib/org-config.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { sanitizeVocabulaire } from '@/lib/vocabulaire'
import { sanitizeChampsConfig, defsAccessibles, type ChampsConfig } from '@/lib/champs-perso'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

async function contexte(): Promise<{ error: NextResponse } | { userId: string; role: UserRole; orgId: string }> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const userId = (session.user as { id: string }).id
  const scope = await getAnalyseScope(userId, ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole)
  if (!scope.activeOrgId) return { error: NextResponse.json({ vocabulaire: {}, champs: {}, canEdit: false }) }
  return { userId, role: scope.role as UserRole, orgId: scope.activeOrgId }
}

// GET /api/personnalisation — vocabulaire et champs personnalisés EFFECTIFS de l'organisation active.
// Les champs restreints à certains rôles ne sont renvoyés qu'aux rôles autorisés (l'ADMIN voit tout).
export async function GET(): Promise<NextResponse> {
  const c = await contexte()
  if ('error' in c) return c.error as NextResponse
  const cfg = await getOrgConfig(c.orgId)
  const admin = isAdminRole(c.role)
  const complet = sanitizeChampsConfig(cfg.champsPersonnalises)
  const champs: ChampsConfig = admin ? complet : Object.fromEntries(Object.entries(complet).map(([k, defs]) => [k, defsAccessibles(defs, c.role)]).filter(([, defs]) => (defs as unknown[]).length)) as ChampsConfig
  return NextResponse.json({ vocabulaire: sanitizeVocabulaire(cfg.vocabulaire), champs, canEdit: admin })
}

// PUT /api/personnalisation — { vocabulaire?, champsPersonnalises? } (ADMIN de l'organisation).
export async function PUT(req: NextRequest): Promise<NextResponse> {
  const c = await contexte()
  if ('error' in c) return c.error as NextResponse
  if (!isAdminRole(c.role)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const update: Record<string, Prisma.InputJsonValue> = {}
  if ('vocabulaire' in body) update.vocabulaire = sanitizeVocabulaire(body.vocabulaire) as Prisma.InputJsonValue
  if ('champsPersonnalises' in body) update.champsPersonnalises = sanitizeChampsConfig(body.champsPersonnalises) as unknown as Prisma.InputJsonValue
  await upsertOrgConfig(c.orgId, update)
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: c.userId, userRole: c.role, organizationId: c.orgId, targetId: c.orgId, targetType: 'organization', ip: getClientIp(req),
    details: { scope: 'personnalisation', blocs: Object.keys(update) },
  })
  return NextResponse.json({ vocabulaire: update.vocabulaire ?? undefined, champs: update.champsPersonnalises ?? undefined })
}
