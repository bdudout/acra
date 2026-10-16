import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { requireSession } from '@/lib/route-guard.server'
import { withAccess } from '@/lib/with-access.server'
import {
  cleanArrangementInput, validateArrangementInput, validerArrangement,
  evaluerCompletude, synthetiserRegistre, arrangementToCsvRow, REGISTRE_CSV_HEADER, type ArrangementTic,
} from '@/lib/registre-tic'
import { evaluerQuestionnaire } from '@/lib/tic-questionnaire'
import { joinArrangementsToEcosysteme } from '@/lib/tiers-tic-link'
import { consolidatedTiersForOrg } from '@/lib/tiers.server'
import { toCsvCell } from '@/lib/spreadsheet-safe'
import { auditLog, getClientIp } from '@/lib/logger'
import { resolveTierIdInput } from '@/lib/tier-registry.server'

export const dynamic = 'force-dynamic'

// La tenue du registre d'information relève de la 2ᵉ ligne (conformité / risques).
import { peutGererRegistreTic } from '@/lib/permissions'

// GET /api/reglementaire/registre-tic — registre + complétude + synthèse de pilotage.
// ?format=csv exporte le registre (durci CWE-1236 via toCsvCell).
// Sans organisation active : registre vide (pas d'erreur) → session seule, scope résolu ici.
export async function GET(req: NextRequest) {
  const g = await requireSession()
  if (g.error) return g.error
  // Rôle EFFECTIF dans l'organisation active (pas le rôle d'instance) → A01/CWE-863.
  const { role: userRole, activeOrgId: orgId } = await getAnalyseScope(g.user.id, g.user.role)
  if (!orgId) return NextResponse.json({ active: false, arrangements: [] })
  const cfg = await getOrgConfig(orgId)
  if (!cfg.reglementaireActive) return NextResponse.json({ active: false, arrangements: [] })

  const rows = await prisma.arrangementTic.findMany({ where: { organizationId: orgId }, orderBy: [{ createdAt: 'desc' }] })
  const asLib = rows as unknown as ArrangementTic[]

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

  // Jonction avec l'écosystème EBIOS (par nom de prestataire) : profil de menace du
  // tiers + verdict du questionnaire de qualification, pour chaque arrangement.
  const tiers = await consolidatedTiersForOrg(orgId)
  const enrichis = joinArrangementsToEcosysteme(asLib, tiers)
  // Identités de tiers autorisées pour l'organisation : liste de choix à la saisie (aucune donnée d'une autre filiale).
  const granted = await prisma.tierOrganization.findMany({ where: { organizationId: orgId }, select: { tier: { select: { id: true, nom: true, lei: true, pays: true } } } })
  const tiersOptions = granted.map(g => g.tier).sort((a, b) => a.nom.localeCompare(b.nom))
  const arrangements = rows.map((r, i) => ({
    ...r,
    champsManquants: validerArrangement(r as unknown as ArrangementTic),
    ecosysteme: enrichis[i]?.ecosysteme ?? null,
    qualification: evaluerQuestionnaire((r as { questionnaire?: unknown }).questionnaire),
  }))

  return NextResponse.json({
    active: true,
    arrangements,
    completude: evaluerCompletude(asLib),
    synthese: synthetiserRegistre(asLib),
    canManage: peutGererRegistreTic(userRole),
    tiersOptions,
  })
}

// POST /api/reglementaire/registre-tic — enregistre un accord contractuel.
export const POST = withAccess({ org: 'active', allow: peutGererRegistreTic, rateLimit: { bucket: 'registre-tic' } }, async (req, { user, role: userRole, orgId }) => {
  const userId = user.id
  const cfg = await getOrgConfig(orgId)
  if (!cfg.reglementaireActive) return NextResponse.json({ error: 'module_inactif' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const erreur = validateArrangementInput(body)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanArrangementInput(body)
  const tierInput = await resolveTierIdInput(body, orgId)
  if (!tierInput.ok) return NextResponse.json({ error: 'tier_invalide' }, { status: 400 })

  const created = await prisma.arrangementTic.create({
    data: { organizationId: orgId, ...data, ...(tierInput.provided ? { tierId: tierInput.tierId } : {}), questionnaire: (data.questionnaire ?? []) as unknown as Prisma.InputJsonValue },
  })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'registre-tic', action: 'create', id: created.id },
  })
  return NextResponse.json(created, { status: 201 })
})
