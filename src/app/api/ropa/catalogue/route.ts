// ─── Traitements types du registre RGPD : aperçu et import ligne par ligne ─────
// GET  ?locale=fr : traitements types traduits, avec leur état pour l'organisation
//      (NEW, ALREADY_IMPORTED par clé de catalogue, SIMILAR si un traitement porte déjà ce nom).
// POST { keys, locale } : crée les traitements sélectionnés (provenance catalogueKey, idempotent,
//      jamais de fusion avec un traitement existant). Réservé à canManageRopa (DPO / ADMIN).
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { canManageRopa, type UserRole } from '@/lib/permissions'
import { listRopaTemplates, ROPA_CATALOGUE_VERSION, type RopaLocale } from '@/lib/ropa-catalogue'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const LOCALES: RopaLocale[] = ['fr', 'en', 'de', 'es', 'it']
const parseLocale = (v: unknown): RopaLocale => (LOCALES.includes(v as RopaLocale) ? v as RopaLocale : 'fr')
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

async function context() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const userId = (session.user as { id: string }).id
  const scope = await getAnalyseScope(userId, ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole)
  if (!scope.activeOrgId) return { error: NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 }) }
  if (!canManageRopa(scope.role)) return { error: NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 }) }
  return { userId, role: scope.role, orgId: scope.activeOrgId }
}

export async function GET(req: NextRequest) {
  const ctx = await context()
  if ('error' in ctx) return ctx.error
  const locale = parseLocale(new URL(req.url).searchParams.get('locale'))
  const existing = await prisma.traitement.findMany({ where: { organizationId: ctx.orgId }, select: { nom: true, catalogueKey: true } })
  const keys = new Set(existing.map(t => t.catalogueKey).filter(Boolean))
  const names = new Set(existing.map(t => norm(t.nom)))
  const items = listRopaTemplates(locale).map(t => ({ ...t, status: keys.has(t.key) ? 'ALREADY_IMPORTED' : names.has(norm(t.nom)) ? 'SIMILAR' : 'NEW' }))
  return NextResponse.json({ version: ROPA_CATALOGUE_VERSION, locale, items })
}

export async function POST(req: NextRequest) {
  const ctx = await context()
  if ('error' in ctx) return ctx.error
  const body = await req.json().catch(() => ({}))
  const locale = parseLocale(body.locale)
  const templates = new Map(listRopaTemplates(locale).map(t => [t.key, t]))
  const keys: unknown = body.keys
  if (!Array.isArray(keys) || keys.length === 0 || keys.length > templates.size || keys.some(k => typeof k !== 'string' || !templates.has(k))) {
    return NextResponse.json({ error: 'invalid_keys' }, { status: 400 })
  }
  const selected = [...new Set(keys as string[])]
  const result = await prisma.$transaction(async tx => {
    // Verrou par organisation : deux imports simultanés ne créent pas deux fois le même traitement.
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${ctx.orgId}), hashtext('ropa-catalogue'))::text`)
    const already = new Set((await tx.traitement.findMany({ where: { organizationId: ctx.orgId, catalogueKey: { in: selected } }, select: { catalogueKey: true } })).map(t => t.catalogueKey))
    const toCreate = selected.filter(k => !already.has(k))
    for (const key of toCreate) {
      const { key: _key, ...data } = templates.get(key)!
      await tx.traitement.create({ data: { ...data, organizationId: ctx.orgId, createdBy: ctx.userId, catalogueKey: key, catalogueVersion: ROPA_CATALOGUE_VERSION } })
    }
    return { created: toCreate, alreadyImported: [...already] }
  })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: ctx.userId, userRole: ctx.role ?? undefined, organizationId: ctx.orgId, ip: getClientIp(req),
    details: { scope: 'ropa', action: 'catalogue-import', created: result.created, alreadyImported: result.alreadyImported },
  })
  return NextResponse.json(result, { status: result.created.length ? 201 : 200 })
}
