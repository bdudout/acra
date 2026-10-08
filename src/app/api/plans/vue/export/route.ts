// ─── Programme d'audit et de contrôle : export Excel de la vue globale (lot P6) ─
// Synthèse des plans, lignes de l'année, sollicitations multiples, angles morts. Débit limité, export journalisé.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { contextePlan, calculerVueGlobale } from '@/lib/planification.server'
import { anneeOuCourante } from '@/lib/planification'
import { buildVueXlsx } from '@/lib/planification-xlsx'
import { getT } from '@/lib/i18n'
import { auditLog, getClientIp } from '@/lib/logger'
import { rateLimit, rateLimitHeaders, LIMIT_EXPORT } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const c = await contextePlan()
  if ('error' in c) return c.error
  const rl = await rateLimit(`plans-export:${c.userId}`, LIMIT_EXPORT.limit, LIMIT_EXPORT.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })
  const vue = await calculerVueGlobale(c, anneeOuCourante(req.nextUrl.searchParams.get('annee')))
  const org = await prisma.organization.findUnique({ where: { id: c.orgId }, select: { nom: true } })
  const buf = await buildVueXlsx({ t: getT(req.nextUrl.searchParams.get('lang') ?? 'fr'), now: new Date(), organisation: org?.nom ?? '', annee: vue.annee, seuil: vue.seuilAnglesMortsAns, plans: vue.plans, lignes: vue.lignes, sollicitations: vue.sollicitations, anglesMorts: vue.anglesMorts })
  await auditLog('EXPORT', { userId: c.userId, userRole: c.role, organizationId: c.orgId, ip: getClientIp(req), targetType: 'plans-vue', details: { format: 'xlsx', annee: vue.annee } })
  return new NextResponse(buf as unknown as BodyInit, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="programme-audit-controle-${vue.annee}.xlsx"`, 'Cache-Control': 'no-store' } })
}
