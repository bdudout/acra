import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { type UserRole } from '@/lib/permissions'
import { niveauRisque } from '@/lib/risk-item'
import { resolveTaxonomie, taxonomieLabel } from '@/lib/taxonomie'
import { getT } from '@/lib/i18n'
import { cleanAppetitConfig } from '@/lib/appetit'
import { buildRasExport, type RasRiskLite } from '@/lib/ras-export'
import { auditLog, getClientIp } from '@/lib/logger'
import { createRequire } from 'node:module'

export const dynamic = 'force-dynamic'

// GET /api/appetit/ras — Risk Appetite Statement (RAS) au format PDF.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole

  const scope = await getAnalyseScope(userId, instanceRole)
  const role = scope.role
  const orgId = scope.activeOrgId
  if (!orgId) return NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 })
  // Le RAS relève de la gouvernance : 1ʳᵉ ligne « pure » exclue.
  if (role === 'LECTEUR' || role === 'METIER') return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const orgConfig = await getOrgConfig(orgId)
  if (!orgConfig.registreRisquesActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })

  const rows = await prisma.riskItem.findMany({
    where: { organizationId: orgId },
    select: { intitule: true, taxonomieCode: true, graviteResiduelle: true, vraisemblanceResiduelle: true },
  })
  const risks: RasRiskLite[] = rows.map(r => ({
    intitule: r.intitule,
    taxonomieCode: r.taxonomieCode ?? null,
    niveauResiduel: niveauRisque(r.graviteResiduelle, r.vraisemblanceResiduelle),
  }))

  const langParam = new URL(req.url).searchParams.get('lang')
  const locale = ['fr', 'en', 'de', 'es', 'it'].includes(langParam ?? '') ? (langParam as string) : 'fr'
  const tCat = getT(locale)
  const trCat = (key: string) => key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], tCat) as string ?? ''
  const taxonomie = resolveTaxonomie(orgConfig.taxonomieRisques)
  const labelOf = (code: string): string => {
    const node = taxonomie.find(n => n.code === code)
    return (node ? taxonomieLabel(node, trCat) : null) ?? code
  }

  const cfg = cleanAppetitConfig(orgConfig.appetitRisque)
  const data = buildRasExport(risks, cfg, labelOf)

  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole: role, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'appetit-ras', action: 'export', format: 'pdf' },
  })

  const stamp = new Date().toISOString().slice(0, 10)
  try {
    const nodeRequire = createRequire(process.cwd() + '/package.json')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { renderRasPDF } = nodeRequire(process.cwd() + '/.pdf-runtime/ras-pdf-template.cjs')
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { nom: true } })
    const buffer = await renderRasPDF(data, locale, org?.nom ?? '', stamp)
    return new NextResponse(buffer as unknown as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="acra-ras-${stamp}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[export ras pdf] génération échouée', err)
    return NextResponse.json({ error: 'Échec de la génération du PDF' }, { status: 500 })
  }
}
