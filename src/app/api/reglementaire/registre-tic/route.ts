import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import {
  cleanArrangementInput, validateArrangementInput, validerArrangement,
  evaluerCompletude, synthetiserRegistre, arrangementToCsvRow, REGISTRE_CSV_HEADER, type ArrangementTic,
} from '@/lib/registre-tic'
import { toCsvCell } from '@/lib/spreadsheet-safe'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// La tenue du registre d'information relève de la 2ᵉ ligne (conformité / risques).
export function peutGererRegistreTic(role: UserRole): boolean {
  return isAdminRole(role) || role === 'RSSI' || role === 'RISK_MANAGER' || role === 'CONFORMITE' || role === 'DPO'
}

async function ctx(session: { user: { id: string; role?: string } }) {
  const userId = session.user.id
  const instanceRole = (session.user.role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  // Rôle EFFECTIF dans l'organisation active (pas le rôle d'instance) → A01/CWE-863.
  return { userId, userRole: scope.role, orgId: scope.activeOrgId }
}

// GET /api/reglementaire/registre-tic — registre + complétude + synthèse de pilotage.
// ?format=csv exporte le registre (durci CWE-1236 via toCsvCell).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { userRole, orgId } = await ctx(session as unknown as { user: { id: string; role?: string } })
  if (!orgId) return NextResponse.json({ active: false, arrangements: [] })
  const cfg = await getOrgConfig(orgId)
  if (!cfg.reglementaireActive) return NextResponse.json({ active: false, arrangements: [] })

  const rows = await prisma.arrangementTic.findMany({ where: { organizationId: orgId }, orderBy: [{ createdAt: 'desc' }] })
  const asLib = rows as unknown as ArrangementTic[]
  const arrangements = rows.map(r => ({ ...r, champsManquants: validerArrangement(r as unknown as ArrangementTic) }))

  if (new URL(req.url).searchParams.get('format') === 'csv') {
    const lignes = asLib.map(a => arrangementToCsvRow(a).map(toCsvCell).join(','))
    const csv = '﻿' + [REGISTRE_CSV_HEADER.join(','), ...lignes].join('\r\n')
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="registre-tic.csv"',
      },
    })
  }

  return NextResponse.json({
    active: true,
    arrangements,
    completude: evaluerCompletude(asLib),
    synthese: synthetiserRegistre(asLib),
    canManage: peutGererRegistreTic(userRole),
  })
}

// POST /api/reglementaire/registre-tic — enregistre un accord contractuel.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { userId, userRole, orgId } = await ctx(session as unknown as { user: { id: string; role?: string } })
  if (!orgId) return NextResponse.json({ error: 'org_absente' }, { status: 400 })
  const cfg = await getOrgConfig(orgId)
  if (!cfg.reglementaireActive) return NextResponse.json({ error: 'module_inactif' }, { status: 403 })
  if (!peutGererRegistreTic(userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const erreur = validateArrangementInput(body)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanArrangementInput(body)

  const created = await prisma.arrangementTic.create({ data: { organizationId: orgId, ...data } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'registre-tic', action: 'create', id: created.id },
  })
  return NextResponse.json(created, { status: 201 })
}
