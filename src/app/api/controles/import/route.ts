import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { peutDefinir2eLigne, type UserRole } from '@/lib/permissions'
import { cleanControleInput } from '@/lib/controle'
import { getCatalogueControle } from '@/lib/controles-catalogue'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

async function ctx(session: { user: { id: string; role?: string } }) {
  const userId = session.user.id
  const instanceRole = (session.user.role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  return { userId, userRole: scope.role, orgId: scope.activeOrgId }
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLocaleLowerCase()

// POST /api/controles/import — importe un socle de contrôles-types (2ᵉ ligne).
// Body : { catalogue: 'ISO27001' | 'DORA' }. Idempotent : saute les contrôles dont
// l'intitulé existe déjà dans l'organisation (comparaison insensible casse/accents).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { userId, userRole, orgId } = await ctx(session as unknown as { user: { id: string; role?: string } })
  if (!peutDefinir2eLigne(userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  if (!orgId) return NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 })
  const cfg = await getOrgConfig(orgId)
  if (!cfg.controlePermanentActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const cat = getCatalogueControle(typeof body.catalogue === 'string' ? body.catalogue : '')
  if (!cat) return NextResponse.json({ error: 'catalogue_invalide' }, { status: 400 })

  // Intitulés déjà présents → évite les doublons à l'import répété.
  const existants = await prisma.controle.findMany({ where: { organizationId: orgId }, select: { intitule: true } })
  const dejaLa = new Set(existants.map(c => norm(c.intitule)))

  const aCreer = cat.controles.filter(t => !dejaLa.has(norm(t.intitule)))
  if (aCreer.length > 0) {
    await prisma.controle.createMany({
      data: aCreer.map(t => ({ ...cleanControleInput(t), organizationId: orgId })),
    })
  }

  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'controle', action: 'import', catalogue: cat.id, created: aCreer.length, skipped: cat.controles.length - aCreer.length },
  })
  return NextResponse.json({ created: aCreer.length, skipped: cat.controles.length - aCreer.length }, { status: 201 })
}
