// ─── Référentiel des entités : une entité (consolidation, lot E1) ─────────────
// PATCH : modifie ou clôt (valideAu) ; quand l'annuaire fait foi, nom, code et rattachement des entités venues de
// l'annuaire sont verrouillés. DELETE : seulement si rien n'y est rattaché (sinon la clore, l'historique est gardé).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { contexteEntites, verifierLiens, COMPTE_REFERENCES, totalReferences } from '@/lib/entites.server'
import { champsVerrouilles, nettoyerEntite } from '@/lib/entites'
import { auditLog, getClientIp } from '@/lib/logger'
import { rateLimit, LIMIT_API_WRITE } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

async function preparer(id: string) {
  const c = await contexteEntites()
  if ('error' in c) return { error: c.error }
  if (!c.admin) return { error: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }) }
  const rl = await rateLimit(`entites:${c.userId}`, LIMIT_API_WRITE.limit, LIMIT_API_WRITE.windowMs)
  if (!rl.allowed) return { error: NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 }) }
  const entite = await prisma.entite.findFirst({ where: { id, organizationId: c.orgId }, include: { _count: { select: COMPTE_REFERENCES } } })
  if (!entite) return { error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) }
  return { c, entite }
}

export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  const p = await preparer(id)
  if ('error' in p) return p.error!
  const { c, entite } = p
  const r = nettoyerEntite(await req.json().catch(() => ({})), { partiel: true })
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
  const verrou = champsVerrouilles(entite, c.sourceVerite).filter(k => k in r.entite && r.entite[k] !== entite[k])
  if (verrou.length) return NextResponse.json({ error: 'champ_verrouille', champs: verrou }, { status: 409 })
  const erreur = await verifierLiens(c, r.entite, id)
  if (erreur) return NextResponse.json({ error: erreur }, { status: erreur === 'code_existant' ? 409 : 400 })
  const maj = await prisma.entite.update({ where: { id }, data: r.entite })
  await auditLog('ENTITE_REFERENTIEL_UPDATED', { userId: c.userId, userRole: c.role, organizationId: c.orgId, ip: getClientIp(req), targetType: 'entite', targetId: id, details: { action: 'valideAu' in r.entite && r.entite.valideAu ? 'close' : 'update', champs: Object.keys(r.entite) } })
  return NextResponse.json(maj)
}

export async function DELETE(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  const p = await preparer(id)
  if ('error' in p) return p.error!
  const { c, entite } = p
  if (totalReferences(entite._count)) return NextResponse.json({ error: 'entite_referencee', references: entite._count }, { status: 409 })
  await prisma.entite.delete({ where: { id } })
  await auditLog('ENTITE_REFERENTIEL_UPDATED', { userId: c.userId, userRole: c.role, organizationId: c.orgId, ip: getClientIp(req), targetType: 'entite', targetId: id, details: { action: 'delete', nom: entite.nom } })
  return NextResponse.json({ ok: true })
}
