/**
 * Reprendre la conformité d'une ANALYSE dans le socle de l'organisation.
 *  GET  ?referentiel=X — analyses de l'org ayant une conformité pour ce référentiel.
 *  POST { referentiel, analyseId } — copie les entrées de l'analyse dans le suivi org.
 * Réservé ADMIN / RSSI / Risk Manager, quand la conformité est portée au niveau org.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { usesConformiteEntity } from '@/lib/conformite-config'
import { sanitizeConformite } from '@/lib/conformite'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ orgId: string }> }

function canManage(role: UserRole): boolean {
  return isAdminRole(role) || role === 'RSSI' || role === 'RISK_MANAGER'
}

async function guard(orgId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const role = await getEffectiveRoleForOrg(userId, instanceRole, orgId)
  if (!role) return { error: NextResponse.json({ error: 'Organisation hors périmètre' }, { status: 403 }) }
  if (!canManage(role)) return { error: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }) }
  const cfg = await getOrgConfig(orgId)
  if (!cfg.conformiteActive) return { error: NextResponse.json({ error: 'Conformité désactivée' }, { status: 403 }) }
  if (!usesConformiteEntity(cfg.conformiteNiveau)) return { error: NextResponse.json({ error: 'Conformité non portée au niveau organisation' }, { status: 409 }) }
  return { userId, role }
}

export async function GET(req: NextRequest, { params }: Params) {
  const { orgId } = await params
  const g = await guard(orgId)
  if ('error' in g) return g.error
  const referentiel = new URL(req.url).searchParams.get('referentiel') ?? ''
  if (!referentiel) return NextResponse.json({ analyses: [] })

  const rows = await prisma.analyse.findMany({
    where: { organizationId: orgId, deletedAt: null, referentielMesures: referentiel },
    select: { id: true, nom: true, updatedAt: true, cadrage: { select: { socleSecurite: true } } },
    orderBy: { updatedAt: 'desc' },
  })
  const analyses = rows
    .map(a => ({ id: a.id, nom: a.nom, count: sanitizeConformite(a.cadrage?.socleSecurite).length }))
    .filter(a => a.count > 0)
  return NextResponse.json({ analyses })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { orgId } = await params
  const g = await guard(orgId)
  if ('error' in g) return g.error

  const body = await req.json().catch(() => ({}))
  const referentiel = typeof body?.referentiel === 'string' ? body.referentiel.trim() : ''
  const analyseId = typeof body?.analyseId === 'string' ? body.analyseId : ''
  const entite = typeof body?.entite === 'string' ? body.entite.trim().slice(0, 80) : ''
  if (!referentiel || referentiel === 'CUSTOM' || !analyseId) return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })

  const analyse = await prisma.analyse.findFirst({
    where: { id: analyseId, organizationId: orgId, deletedAt: null },
    select: { referentielMesures: true, cadrage: { select: { socleSecurite: true } } },
  })
  if (!analyse) return NextResponse.json({ error: 'Analyse introuvable' }, { status: 404 })

  const entries = sanitizeConformite(analyse.cadrage?.socleSecurite)
  if (entries.length === 0) return NextResponse.json({ error: 'Aucune conformité à reprendre' }, { status: 400 })

  await prisma.conformite.upsert({
    where: { organizationId_referentiel_entite: { organizationId: orgId, referentiel, entite } },
    create: { organizationId: orgId, referentiel, entite, nom: entite || null, entries: entries as unknown as Prisma.InputJsonValue },
    update: { entries: entries as unknown as Prisma.InputJsonValue },
  })
  return NextResponse.json({ ok: true, imported: entries.length })
}
