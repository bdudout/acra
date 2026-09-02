import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { type UserRole } from '@/lib/permissions'
import { peutGererReferentiels } from '../route'
import { validateReferentielInput, cleanReferentielInput } from '@/lib/referentiel'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

async function guard(session: { user: { id: string; role?: string } }, id: string) {
  const userId = session.user.id
  const instanceRole = (session.user.role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  const orgId = scope.activeOrgId
  if (!orgId) return { error: NextResponse.json({ error: 'org_absente' }, { status: 400 }) }
  const cfg = await getOrgConfig(orgId)
  if (!cfg.conformiteActive) return { error: NextResponse.json({ error: 'module_inactif' }, { status: 403 }) }
  if (!peutGererReferentiels(scope.role)) return { error: NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 }) }
  const row = await prisma.referentiel.findFirst({ where: { id, organizationId: orgId }, select: { id: true } })
  if (!row) return { error: NextResponse.json({ error: 'introuvable' }, { status: 404 }) }
  return { userId, userRole: scope.role, orgId }
}

// GET /api/referentiels/[id] — détail d'un référentiel custom (avec exigences).
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  const orgId = scope.activeOrgId
  if (!orgId) return NextResponse.json({ error: 'org_absente' }, { status: 400 })
  const row = await prisma.referentiel.findFirst({ where: { id, organizationId: orgId } })
  if (!row) return NextResponse.json({ error: 'introuvable' }, { status: 404 })
  return NextResponse.json(row)
}

// PATCH /api/referentiels/[id] — met à jour un référentiel custom.
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const g = await guard(session as unknown as { user: { id: string; role?: string } }, id)
  if ('error' in g) return g.error

  const body = await req.json().catch(() => ({}))
  const erreur = validateReferentielInput(body)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanReferentielInput(body)

  // Code unique par organisation (hors la ligne courante).
  const clash = await prisma.referentiel.findFirst({ where: { organizationId: g.orgId, code: data.code, id: { not: id } }, select: { id: true } })
  if (clash) return NextResponse.json({ error: 'code_existant' }, { status: 409 })

  const updated = await prisma.referentiel.update({
    where: { id },
    data: {
      code: data.code, nom: data.nom, type: data.type, domaine: data.domaine, version: data.version, description: data.description,
      exigences: data.exigences as unknown as Prisma.InputJsonValue,
      missions: data.missions as unknown as Prisma.InputJsonValue,
    },
  })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: g.userId, userRole: g.userRole, organizationId: g.orgId, ip: getClientIp(req),
    details: { scope: 'referentiel', action: 'update', id },
  })
  return NextResponse.json(updated)
}

// DELETE /api/referentiels/[id]
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const g = await guard(session as unknown as { user: { id: string; role?: string } }, id)
  if ('error' in g) return g.error
  await prisma.referentiel.delete({ where: { id } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: g.userId, userRole: g.userRole, organizationId: g.orgId, ip: getClientIp(req),
    details: { scope: 'referentiel', action: 'delete', id },
  })
  return NextResponse.json({ ok: true })
}
