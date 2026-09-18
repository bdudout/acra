import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { type UserRole } from '@/lib/permissions'
import { gatherGrcConsolide } from '@/lib/grc-consolide.server'
import { buildComitePack, COMITE_TYPES, type ComiteType } from '@/lib/comite-pack'
import { auditLog, getClientIp } from '@/lib/logger'
import { loadPdfRuntime } from '@/lib/pdf-runtime'

export const dynamic = 'force-dynamic'

// GET /api/comites/pack?type=RISQUES&lang=fr — dossier de comité (PDF).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole

  const scope = await getAnalyseScope(userId, instanceRole)
  const role = scope.role
  const orgId = scope.activeOrgId
  if (!orgId) return NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 })
  // Dossier de gouvernance : 1ʳᵉ ligne « pure » exclue.
  if (role === 'LECTEUR' || role === 'METIER') return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const cfg = await getOrgConfig(orgId)
  if (!cfg.registreRisquesActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const typeParam = (searchParams.get('type') ?? 'RISQUES').toUpperCase()
  const type: ComiteType = (COMITE_TYPES as readonly string[]).includes(typeParam) ? (typeParam as ComiteType) : 'RISQUES'
  const langParam = searchParams.get('lang')
  const locale = ['fr', 'en', 'de', 'es', 'it'].includes(langParam ?? '') ? (langParam as string) : 'fr'

  const now = new Date()
  const { consolide, modules } = await gatherGrcConsolide(orgId, cfg, now)
  const pack = buildComitePack(type, consolide, modules)

  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole: role, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'comite-pack', action: 'export', type, format: 'pdf' },
  })

  const stamp = now.toISOString().slice(0, 10)
  try {

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { renderComitePackPDF } = loadPdfRuntime('comite-pack-pdf-template')
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { nom: true } })
    const buffer = await renderComitePackPDF(pack, locale, org?.nom ?? '', stamp)
    return new NextResponse(buffer as unknown as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="acra-comite-${type.toLowerCase()}-${stamp}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[export comite pack pdf] génération échouée', err)
    return NextResponse.json({ error: 'Échec de la génération du PDF' }, { status: 500 })
  }
}
