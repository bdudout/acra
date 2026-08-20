import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { type UserRole } from '@/lib/permissions'
import { gatherGrcConsolide } from '@/lib/grc-consolide.server'
import { buildRapportControleInterne } from '@/lib/rapport-controle-interne'
import { auditLog, getClientIp } from '@/lib/logger'
import { createRequire } from 'node:module'

export const dynamic = 'force-dynamic'

// GET /api/reglementaire/rapport-controle-interne?lang=fr&annee=2026 — PDF du
// rapport annuel de contrôle interne (3 lignes de défense + résilience TIC).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole

  const scope = await getAnalyseScope(userId, instanceRole)
  const role = scope.role
  const orgId = scope.activeOrgId
  if (!orgId) return NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 })
  if (role === 'LECTEUR' || role === 'METIER') return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const cfg = await getOrgConfig(orgId)
  if (!cfg.registreRisquesActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const langParam = searchParams.get('lang')
  const locale = ['fr', 'en', 'de', 'es', 'it'].includes(langParam ?? '') ? (langParam as string) : 'fr'
  const now = new Date()
  const annee = (searchParams.get('annee') ?? '').match(/^\d{4}$/) ? (searchParams.get('annee') as string) : String(now.getFullYear())

  const format = (searchParams.get('format') ?? 'pdf').toLowerCase() === 'pptx' ? 'pptx' : 'pdf'
  const { consolide, modules } = await gatherGrcConsolide(orgId, cfg, now)
  const rapport = buildRapportControleInterne(consolide, modules)

  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole: role, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'rapport-controle-interne', action: 'export', format, annee },
  })

  const stamp = now.toISOString().slice(0, 10)
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { nom: true } })

  // ── PPTX : format présentation pour les comités ────────────────────────────
  if (format === 'pptx') {
    try {
      const { renderRapportControleInternePptx } = await import('@/lib/rapport-controle-interne-pptx')
      const buffer = await renderRapportControleInternePptx(rapport, locale, org?.nom ?? '', annee, stamp)
      return new NextResponse(buffer as unknown as ArrayBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'Content-Disposition': `attachment; filename="acra-rapport-controle-interne-${annee}.pptx"`,
          'Cache-Control': 'no-store',
        },
      })
    } catch (err) {
      console.error('[export rapport controle interne pptx] génération échouée', err)
      return NextResponse.json({ error: 'Échec de la génération du PPTX' }, { status: 500 })
    }
  }
  try {
    const nodeRequire = createRequire(process.cwd() + '/package.json')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { renderRapportControleInternePDF } = nodeRequire(process.cwd() + '/.pdf-runtime/rapport-controle-interne-pdf-template.cjs')
    const buffer = await renderRapportControleInternePDF(rapport, locale, org?.nom ?? '', annee, stamp)
    return new NextResponse(buffer as unknown as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="acra-rapport-controle-interne-${annee}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[export rapport controle interne pdf] génération échouée', err)
    return NextResponse.json({ error: 'Échec de la génération du PDF' }, { status: 500 })
  }
}
