// ─── Programme d'audit et de contrôle : cibles proposées pour les lignes ──────
// Bornées à l'organisation active : organisations de son sous-arbre (filiales, entités), tiers qui lui sont rattachés,
// risques du registre, processus (criticité), référentiels actifs, entités actives du référentiel ; `?referentiel=CODE` : exigences de ce référentiel.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { contextePlan } from '@/lib/planification.server'
import { listReferentiels, getExigencesFor } from '@/lib/referentiel.server'
import { getServerLocale } from '@/lib/i18n'
import { optionsEntites } from '@/lib/entites-filtre'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const c = await contextePlan()
  if ('error' in c) return c.error
  const locale = await getServerLocale()
  const code = req.nextUrl.searchParams.get('referentiel')
  if (code) {
    const exigences = await getExigencesFor(code.slice(0, 60), c.orgId, locale)
    return NextResponse.json({ exigences: exigences.slice(0, 2000).map(e => ({ ref: e.ref, nom: e.nom })) })
  }
  const org = await prisma.organization.findUnique({ where: { id: c.orgId }, select: { path: true } })
  const [organisations, tiers, risques, processus, referentiels, entites] = await Promise.all([
    prisma.organization.findMany({ where: { path: { startsWith: org?.path ?? `/${c.orgId}/` } }, select: { id: true, nom: true }, orderBy: { nom: 'asc' }, take: 2000 }),
    prisma.tierOrganization.findMany({ where: { organizationId: c.orgId }, select: { tier: { select: { id: true, nom: true } } }, take: 2000 }),
    prisma.riskItem.findMany({ where: { organizationId: c.orgId }, select: { id: true, intitule: true }, orderBy: { intitule: 'asc' }, take: 2000 }),
    prisma.processus.findMany({ where: { organizationId: c.orgId }, select: { id: true, nom: true, criticite: true, criticiteDora: true }, orderBy: { nom: 'asc' }, take: 2000 }),
    listReferentiels(c.orgId, locale),
    prisma.entite.findMany({ where: { organizationId: c.orgId }, select: { id: true, nom: true, type: true, alias: true, codeExterne: true, parentId: true, source: true, valideAu: true } }),
  ])
  return NextResponse.json({
    organisations,
    tiers: tiers.map(t => t.tier).sort((a, b) => a.nom.localeCompare(b.nom)),
    risques,
    processus,
    referentiels: referentiels.filter(r => r.actif).map(r => ({ code: r.code, nom: r.nom })),
    // Entités actives du référentiel, dans l'ordre de l'arbre (indentées).
    entites: optionsEntites(entites.map(e => ({ ...e, alias: [] }))).map(o => ({ id: o.id, nom: `${'\u00a0\u00a0'.repeat(o.niveau)}${o.nom}` })),
  })
}
