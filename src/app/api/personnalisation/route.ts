import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig, upsertOrgConfig } from '@/lib/org-config.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { requireSession, type SessionUser } from '@/lib/route-guard.server'
import { withAccess } from '@/lib/with-access.server'
import { sanitizeVocabulaire } from '@/lib/vocabulaire'
import { sanitizeChampsConfig, defsAccessibles, type ChampsConfig } from '@/lib/champs-perso'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// Sans organisation active : réponse vide 200 (GET comme PUT, comportement historique) → pas de `org: 'active'`.
async function contexte(user: SessionUser): Promise<{ error: NextResponse } | { userId: string; role: UserRole; orgId: string }> {
  const scope = await getAnalyseScope(user.id, user.role)
  if (!scope.activeOrgId) return { error: NextResponse.json({ vocabulaire: {}, champs: {}, canEdit: false }) }
  return { userId: user.id, role: scope.role, orgId: scope.activeOrgId }
}

// GET /api/personnalisation — vocabulaire et champs personnalisés EFFECTIFS de l'organisation active.
// Les champs restreints à certains rôles ne sont renvoyés qu'aux rôles autorisés (l'ADMIN voit tout).
export async function GET(): Promise<NextResponse> {
  const g = await requireSession()
  if (g.error) return g.error
  const c = await contexte(g.user)
  if ('error' in c) return c.error as NextResponse
  const cfg = await getOrgConfig(c.orgId)
  const admin = isAdminRole(c.role)
  const complet = sanitizeChampsConfig(cfg.champsPersonnalises)
  const champs: ChampsConfig = admin ? complet : Object.fromEntries(Object.entries(complet).map(([k, defs]) => [k, defsAccessibles(defs, c.role)]).filter(([, defs]) => (defs as unknown[]).length)) as ChampsConfig
  return NextResponse.json({ vocabulaire: sanitizeVocabulaire(cfg.vocabulaire), champs, canEdit: admin })
}

// PUT /api/personnalisation — { vocabulaire?, champsPersonnalises? } (ADMIN de l'organisation).
export const PUT = withAccess({ org: 'none', rateLimit: { bucket: 'personnalisation' } }, async (req, { user }) => {
  const c = await contexte(user)
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
})
