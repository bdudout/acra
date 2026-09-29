// Export PDF de la vue RAS/RAD : même agrégat serveur que le tableau de bord.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { hasGlobalReadDispositif, type UserRole } from '@/lib/permissions'
import { getServerLocale, getServerT } from '@/lib/i18n'
import { loadRasRad } from '@/lib/ras-rad.server'
import { loadPdfRuntime } from '@/lib/pdf-runtime'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  if (!scope.activeOrgId || !hasGlobalReadDispositif(scope.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const [locale, t] = await Promise.all([getServerLocale(), getServerT()])
  const data = await loadRasRad(scope.activeOrgId, locale, t)
  if (!data.modules.registre && !data.modules.kri && !data.modules.maturite) return NextResponse.json({ error: 'Module non activé' }, { status: 404 })
  try {
    const org = await prisma.organization.findUnique({ where: { id: scope.activeOrgId }, select: { nom: true } })
    const stamp = new Date().toISOString().slice(0, 10)
    const { renderRasRadPDF } = loadPdfRuntime('ras-rad-pdf-template')
    const buffer = await renderRasRadPDF(data, org?.nom ?? '', stamp, locale)
    await auditLog('EXPORT', { userId, userRole: scope.role, organizationId: scope.activeOrgId, ip: getClientIp(req), targetType: 'appetence', details: { format: 'pdf', scope: 'ras-rad' } })
    return new NextResponse(buffer as unknown as ArrayBuffer, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="acra-ras-rad-${stamp}.pdf"`, 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[export ras-rad pdf]', error)
    return NextResponse.json({ error: 'Échec de la génération du PDF' }, { status: 500 })
  }
}
