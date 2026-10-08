// ─── Référentiel des entités de l'organisation active (consolidation, lot E1) ──
// GET : entités (tout membre : le sélecteur d'entité en a besoin), avec le nombre d'objets rattachés.
// POST : crée une entité (ADMIN) ; un doublon probable (nom ou alias identique) demande confirmation.
// Spec : docs/specs/entites-consolidation-besoin.md.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { contexteEntites, verifierLiens, COMPTE_REFERENCES } from '@/lib/entites.server'
import { correspondances, nettoyerEntite, type EntiteRef } from '@/lib/entites'
import { auditLog, getClientIp } from '@/lib/logger'
import { rateLimit, LIMIT_API_WRITE } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  const c = await contexteEntites()
  if ('error' in c) return c.error
  const [entites, organisations] = await Promise.all([
    prisma.entite.findMany({ where: { organizationId: c.orgId }, orderBy: { nom: 'asc' }, include: { _count: { select: COMPTE_REFERENCES } } }),
    // Organisations du sous-arbre auxquelles une filiale peut être liée (administration seulement).
    c.admin ? prisma.organization.findMany({ where: { path: { startsWith: c.orgPath }, id: { not: c.orgId } }, select: { id: true, nom: true }, orderBy: { nom: 'asc' }, take: 500 }) : Promise.resolve([]),
  ])
  return NextResponse.json({ entites, organisations, peutModifier: c.admin, sourceVerite: c.sourceVerite, connecteur: c.admin && c.connecteur })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const c = await contexteEntites()
  if ('error' in c) return c.error
  if (!c.admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const rl = await rateLimit(`entites:${c.userId}`, LIMIT_API_WRITE.limit, LIMIT_API_WRITE.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 })
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const r = nettoyerEntite(body)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
  const erreur = await verifierLiens(c, r.entite)
  if (erreur) return NextResponse.json({ error: erreur }, { status: erreur === 'code_existant' ? 409 : 400 })
  if (body.confirmer !== true) {
    const existantes = await prisma.entite.findMany({ where: { organizationId: c.orgId }, select: { id: true, nom: true, type: true, alias: true, codeExterne: true, parentId: true, source: true, valideAu: true } })
    const refs = existantes.map(e => ({ ...e, alias: Array.isArray(e.alias) ? (e.alias as string[]) : [] })) as EntiteRef[]
    const identiques = [r.entite.nom!, ...(r.entite.alias ?? [])].flatMap(t => correspondances(t, refs, 1))
    if (identiques.length) return NextResponse.json({ error: 'doublon', correspondances: identiques }, { status: 409 })
  }
  const entite = await prisma.entite.create({ data: { ...r.entite, nom: r.entite.nom!, type: r.entite.type!, organizationId: c.orgId, source: 'MANUEL' } })
  await auditLog('ENTITE_REFERENTIEL_UPDATED', { userId: c.userId, userRole: c.role, organizationId: c.orgId, ip: getClientIp(req), targetType: 'entite', targetId: entite.id, details: { action: 'create', type: entite.type } })
  return NextResponse.json(entite, { status: 201 })
}
