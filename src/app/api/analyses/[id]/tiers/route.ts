import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { analyseAccessWhere, getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { canEditAnalyse, resolveAnalyseRole, type UserRole } from '@/lib/permissions'
import { cleanPartiePrenante } from '@/lib/workshop-sanitize'

type Params = { params: Promise<{ id: string }> }

/** Tiers d'une analyse directe (Projet 360 inclus), isolés du scénario EBIOS A3. */
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const userId = (session.user as { id: string }).id
  const role = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const analyse = await prisma.analyse.findFirst({ where: await analyseAccessWhere(userId, role, id), include: { accesUtilisateurs: true } })
  if (!analyse || analyse.deletedAt) return NextResponse.json({ error: 'Analyse introuvable' }, { status: 404 })
  const effectiveRole = resolveAnalyseRole(role, analyse.organizationId, analyse.organizationId ? await getEffectiveRoleForOrg(userId, role, analyse.organizationId) : null)
  if (!canEditAnalyse({ id: userId, role: effectiveRole }, { userId: analyse.userId, accesUtilisateurs: analyse.accesUtilisateurs })) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const body = await req.json().catch(() => null)
  if (!Array.isArray(body?.partiesPrenantes) || body.partiesPrenantes.length > 200) return NextResponse.json({ error: 'Liste de tiers invalide' }, { status: 400 })
  await prisma.$transaction([
    prisma.partiePrenante.deleteMany({ where: { analyseId: id } }),
    ...(body.partiesPrenantes.length ? [prisma.partiePrenante.createMany({ data: body.partiesPrenantes.map((p: Record<string, unknown>) => cleanPartiePrenante(p, id)) })] : []),
  ])
  return NextResponse.json({ ok: true })
}
