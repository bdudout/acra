import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { type UserRole } from '@/lib/permissions'
import { sanitizeConformite, conformiteStats } from '@/lib/conformite'
import { getFrameworkControles, FRAMEWORK_META, type FrameworkId } from '@/lib/frameworks-data'
import { getServerT, getServerLocale } from '@/lib/i18n'
import { toCsvCell } from '@/lib/spreadsheet-safe'

/**
 * GET /api/organizations/[orgId]/conformite/soa?referentiel=ISO27001
 * Exporte la déclaration d'applicabilité (SoA) : TOUS les contrôles du référentiel
 * avec leur statut de conformité et commentaire. CSV durci (anti-injection).
 * Lecture : utilisateur authentifié dont le périmètre couvre l'organisation.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as any).id
  const userRole: UserRole = (session.user as any).role ?? 'ANALYSTE'

  const scope = await getAnalyseScope(userId, userRole)
  const visibles = scope.scope.visibleOrgIds ?? []
  if (!(orgId === 'global' || visibles.length === 0 || visibles.includes(orgId))) {
    return NextResponse.json({ error: 'Organisation hors périmètre' }, { status: 403 })
  }

  const referentiel = new URL(req.url).searchParams.get('referentiel') ?? ''
  if (!referentiel || !(referentiel in FRAMEWORK_META) || referentiel === 'CUSTOM') {
    return NextResponse.json({ error: 'Référentiel invalide' }, { status: 400 })
  }

  const t = await getServerT()
  const locale = await getServerLocale()
  const soa = t.soa
  const statutLabels = t.conformite.statuts as Record<string, string>

  const conf = await prisma.conformite.findUnique({
    where: { organizationId_referentiel: { organizationId: orgId, referentiel } },
    select: { entries: true, updatedAt: true, organization: { select: { nom: true } } },
  })
  const entries = sanitizeConformite(conf?.entries)
  const byRef = new Map(entries.map(e => [e.ref, e]))
  const controles = getFrameworkControles(referentiel as FrameworkId, undefined, locale)
  const stats = conformiteStats(entries, controles.length)

  const orgNom = conf?.organization?.nom ?? orgId
  const frameworkNom = FRAMEWORK_META[referentiel as FrameworkId]?.nom ?? referentiel

  const lines: string[] = []
  // En-tête de contexte
  lines.push([soa.header, toCsvCell(orgNom)].join(','))
  lines.push([soa.framework, toCsvCell(frameworkNom)].join(','))
  lines.push([soa.rate, toCsvCell(`${stats.tauxConformite}%`)].join(','))
  lines.push([soa.evaluated, toCsvCell(`${stats.evalues}/${stats.total}`)].join(','))
  lines.push('')
  // Colonnes
  lines.push([soa.colRef, soa.colControl, soa.colCategory, soa.colType, soa.colStatus, soa.colComment].map(toCsvCell).join(','))
  for (const c of controles) {
    const e = byRef.get(c.ref)
    lines.push([
      toCsvCell(c.ref),
      toCsvCell(c.nom),
      toCsvCell((c as any).categorie ?? ''),
      toCsvCell((c as any).type ?? ''),
      toCsvCell(e ? (statutLabels[e.statut] ?? e.statut) : soa.notEvaluated),
      toCsvCell(e?.commentaire ?? ''),
    ].join(','))
  }

  const csv = '﻿' + lines.join('\r\n') // BOM UTF-8 pour Excel
  const safeName = `soa-${orgNom}-${referentiel}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'soa'
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeName}.csv"`,
    },
  })
}
