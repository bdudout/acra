// Historique d'appétence (RAS / RAD) : instantanés mensuels, tendances, capture manuelle, export Excel.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { hasGlobalReadDispositif, type UserRole } from '@/lib/permissions'
import { peutEcrireRapports } from '@/lib/rapport-acces'
import { tendances, type ResumeAppetence } from '@/lib/appetit-historique'
import { buildHistoriqueXlsx } from '@/lib/appetit-historique-xlsx'
import { capturerInstantane } from '@/lib/appetit-historique.server'
import { auditLog, getClientIp } from '@/lib/logger'
import { rateLimit, rateLimitHeaders, LIMIT_EXPORT, LIMIT_API_WRITE } from '@/lib/rate-limit'
import { getOrgConfig } from '@/lib/org-config.server'

export const dynamic = 'force-dynamic'
const MAX = 60 // 5 ans

type Ctx = { userId: string; orgId: string; role: UserRole } | { error: NextResponse }
async function contexte(): Promise<Ctx> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const userId = (session.user as { id: string }).id
  const scope = await getAnalyseScope(userId, ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole)
  if (!scope.activeOrgId || !hasGlobalReadDispositif(scope.role)) return { error: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }) }
  // Module « Appétence » coupé (ou forcé à l'arrêt par l'instance) : historique fermé.
  if (!(await getOrgConfig(scope.activeOrgId)).appetenceActive) return { error: NextResponse.json({ error: 'module_inactif' }, { status: 404 }) }
  return { userId, orgId: scope.activeOrgId, role: scope.role as UserRole }
}

// GET — instantanés + tendances ; ?format=xlsx : export Excel (débit limité, journalisé).
export async function GET(req: NextRequest): Promise<NextResponse> {
  const c = await contexte()
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
}

// POST — fige (ou rafraîchit) l'instantané du mois courant ; administrateur, risk manager, RSSI.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const c = await contexte()
  if ('error' in c) return c.error
  if (!peutEcrireRapports(c.role)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const rl = await rateLimit(`appetence-snapshot:${c.userId}`, LIMIT_API_WRITE.limit, LIMIT_API_WRITE.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })
  const r = await capturerInstantane(c.orgId, { now: new Date(), userId: c.userId, ecraser: true })
  if (!r) return NextResponse.json({ error: 'module_inactif' }, { status: 404 })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: c.userId, userRole: c.role, organizationId: c.orgId, ip: getClientIp(req), details: { scope: 'appetence', action: 'snapshot', periode: r.periode } })
  return NextResponse.json({ periode: r.periode }, { status: 201 })
}
