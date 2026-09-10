import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { type UserRole } from '@/lib/permissions'
import { buildRegistreDefaut } from '@/lib/registre-catalogue'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// POST /api/risk-items/seed-defaut — pré-remplit le registre avec le socle de
// risques « bonnes pratiques » (taxonomie Bâle). N'insère QUE les risques dont
// l'intitulé n'existe pas déjà dans l'organisation → idempotent et cumulable
// (ne réécrit jamais l'existant). Renvoie le nombre inséré / ignoré.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  const orgId = scope.activeOrgId
  const userRole = scope.role
  if (userRole === 'LECTEUR') return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  if (!orgId) return NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 })
  const orgConfig = await getOrgConfig(orgId)
  if (!orgConfig.registreRisquesActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })

  const socle = buildRegistreDefaut()
  // Dédoublonnage par intitulé (insensible à la casse/espaces) vs. existant.
  const existants = await prisma.riskItem.findMany({ where: { organizationId: orgId }, select: { intitule: true } })
  const dejaLa = new Set(existants.map((r) => r.intitule.trim().toLowerCase()))
  const aInserer = socle.filter((r) => !dejaLa.has(r.intitule.trim().toLowerCase()))

  if (aInserer.length > 0) {
    await prisma.riskItem.createMany({
      data: aInserer.map((r) => ({
        organizationId: orgId,
        intitule: r.intitule,
        description: r.description,
        taxonomieCode: r.taxonomieCode,
        proprietaire: r.proprietaire,
        statut: 'IDENTIFIE',
        provenance: 'MANUEL',
      })),
    })
  }

  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'risk-item', action: 'seed-defaut', inserted: aInserer.length, skipped: socle.length - aInserer.length },
  })
  return NextResponse.json({ inserted: aInserer.length, skipped: socle.length - aInserer.length }, { status: 201 })
}
