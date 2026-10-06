// ─── Systèmes d'IA types : aperçu et import ligne par ligne ───────────────────
// GET  ?locale=fr : systèmes types traduits avec leur état pour l'organisation (NEW, ALREADY_IMPORTED par clé de
//      catalogue, SIMILAR si un système porte déjà ce nom) et leur classe indicative.
// POST { keys, locale } : crée les systèmes choisis (provenance catalogueKey, idempotent sous verrou, jamais de fusion).
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auditLog, getClientIp } from '@/lib/logger'
import { iaContext } from '@/lib/registre-ia.server'
import { classeIndicative } from '@/lib/registre-ia'
import { IA_CATALOGUE_VERSION, listSystemesIaTypes, type IaLocale } from '@/lib/registre-ia-catalogue'

export const dynamic = 'force-dynamic'
const LOCALES: IaLocale[] = ['fr', 'en', 'de', 'es', 'it']
const parseLocale = (v: unknown): IaLocale => (LOCALES.includes(v as IaLocale) ? v as IaLocale : 'fr')
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

export async function GET(req: NextRequest) {
  const got = await iaContext(); if ('error' in got) return got.error
  const { ctx } = got
  const locale = parseLocale(new URL(req.url).searchParams.get('locale'))
  const existing = await prisma.systemeIA.findMany({ where: { organizationId: ctx.orgId }, select: { nom: true, catalogueKey: true } })
  const keys = new Set(existing.map(s => s.catalogueKey).filter(Boolean))
  const names = new Set(existing.map(s => norm(s.nom)))
  const items = listSystemesIaTypes(locale).map(s => ({
    ...s, classe: classeIndicative(s.usage, s.typeDecision),
    status: keys.has(s.key) ? 'ALREADY_IMPORTED' : names.has(norm(s.nom)) ? 'SIMILAR' : 'NEW',
  }))
  return NextResponse.json({ version: IA_CATALOGUE_VERSION, locale, items })
}

export async function POST(req: NextRequest) {
  const got = await iaContext(); if ('error' in got) return got.error
  const { ctx } = got
  const body = await req.json().catch(() => ({}))
  const locale = parseLocale(body.locale)
  const templates = new Map(listSystemesIaTypes(locale).map(s => [s.key, s]))
  const keys: unknown = body.keys
  if (!Array.isArray(keys) || keys.length === 0 || keys.length > templates.size || keys.some(k => typeof k !== 'string' || !templates.has(k))) {
    return NextResponse.json({ error: 'invalid_keys' }, { status: 400 })
  }
  const selected = [...new Set(keys as string[])]
  const result = await prisma.$transaction(async tx => {
    // Verrou par organisation : deux imports simultanés ne créent pas deux fois le même système.
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${ctx.orgId}), hashtext('registre-ia-catalogue'))::text`)
    const already = new Set((await tx.systemeIA.findMany({ where: { organizationId: ctx.orgId, catalogueKey: { in: selected } }, select: { catalogueKey: true } })).map(s => s.catalogueKey))
    const toCreate = selected.filter(k => !already.has(k))
    for (const key of toCreate) {
      const { key: _key, ...data } = templates.get(key)!
      void _key
      await tx.systemeIA.create({ data: { ...data, organizationId: ctx.orgId, createdBy: ctx.userId, catalogueKey: key, catalogueVersion: IA_CATALOGUE_VERSION } })
    }
    return { created: toCreate, alreadyImported: [...already] }
  })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: ctx.userId, userRole: ctx.role, organizationId: ctx.orgId, ip: getClientIp(req), details: { scope: 'registre-ia', action: 'catalogue-import', created: result.created, alreadyImported: result.alreadyImported } })
  return NextResponse.json(result, { status: result.created.length ? 201 : 200 })
}
