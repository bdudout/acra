// Historique d'appétence (RAS / RAD) : instantanés mensuels, tendances, capture manuelle, export Excel.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { hasGlobalReadDispositif, type UserRole } from '@/lib/permissions'
import { peutEcrireRapports } from '@/lib/rapport-acces'
import { tendances, type ResumeAppetence } from '@/lib/appetit-historique'
import { buildHistoriqueXlsx } from '@/lib/appetit-historique-xlsx'
import { capturerInstantane } from '@/lib/appetit-historique.server'
import { auditLog, getClientIp } from '@/lib/logger'
import { rateLimit, rateLimitHeaders, LIMIT_EXPORT } from '@/lib/rate-limit'
import { getOrgConfig } from '@/lib/org-config.server'
import { withAccess } from '@/lib/with-access.server'
import type { SessionUser } from '@/lib/route-guard.server'

export const dynamic = 'force-dynamic'
const MAX = 60 // 5 ans

// Sans organisation active : 403 (et non 400) — d'où `org: 'none'` et la résolution ici.
type Ctx = { userId: string; orgId: string; role: UserRole } | { error: NextResponse }
async function contexte(user: SessionUser): Promise<Ctx> {
  const userId = user.id
  const scope = await getAnalyseScope(userId, user.role)
  if (!scope.activeOrgId || !hasGlobalReadDispositif(scope.role)) return { error: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }) }
  // Module « Appétence » coupé (ou forcé à l'arrêt par l'instance) : historique fermé.
  if (!(await getOrgConfig(scope.activeOrgId)).appetenceActive) return { error: NextResponse.json({ error: 'module_inactif' }, { status: 404 }) }
  return { userId, orgId: scope.activeOrgId, role: scope.role as UserRole }
}

// GET — instantanés + tendances ; ?format=xlsx : export Excel (débit limité, journalisé).
export const GET = withAccess({ org: 'none' }, async (req, { user }) => {
  const c = await contexte(user)
  if ('error' in c) return c.error
  const xlsx = req.nextUrl.searchParams.get('format') === 'xlsx'
  if (xlsx) {
    const rl = await rateLimit(`appetence-historique:${c.userId}`, LIMIT_EXPORT.limit, LIMIT_EXPORT.windowMs)
    if (!rl.allowed) return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })
  }
  const rows = await prisma.appetenceSnapshot.findMany({ where: { organizationId: c.orgId }, orderBy: { periode: 'desc' }, take: MAX, select: { periode: true, resume: true } })
  const t = tendances(rows.map(r => ({ periode: r.periode, resume: r.resume as unknown as ResumeAppetence })))
  if (!xlsx) return NextResponse.json({ canWrite: peutEcrireRapports(c.role), tendances: t })
  const lang = (['fr', 'en', 'de', 'es', 'it'].includes(req.nextUrl.searchParams.get('lang') ?? '') ? req.nextUrl.searchParams.get('lang') : 'fr') as 'fr'
  const org = await prisma.organization.findUnique({ where: { id: c.orgId }, select: { nom: true } })
  const buf = await buildHistoriqueXlsx(t, { lang, now: new Date(), organisation: org?.nom ?? '' })
  await auditLog('EXPORT', { userId: c.userId, userRole: c.role, organizationId: c.orgId, ip: getClientIp(req), targetType: 'appetence-historique', details: { format: 'xlsx', instantanes: t.length } })
  return new NextResponse(buf as unknown as BodyInit, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="historique-appetence.xlsx"', 'Cache-Control': 'no-store' } })
})

// POST — fige (ou rafraîchit) l'instantané du mois courant ; administrateur, risk manager, RSSI.
export const POST = withAccess({ org: 'none', rateLimit: { bucket: 'appetence-snapshot' } }, async (req, { user }) => {
  const c = await contexte(user)
  if ('error' in c) return c.error
  if (!peutEcrireRapports(c.role)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const r = await capturerInstantane(c.orgId, { now: new Date(), userId: c.userId, ecraser: true })
  if (!r) return NextResponse.json({ error: 'module_inactif' }, { status: 404 })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: c.userId, userRole: c.role, organizationId: c.orgId, ip: getClientIp(req), details: { scope: 'appetence', action: 'snapshot', periode: r.periode } })
  return NextResponse.json({ periode: r.periode }, { status: 201 })
})
