import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateApiRequest } from '@/lib/api-auth.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { validateExecutionInput, cleanExecutionInput, libelleActionAnomalie } from '@/lib/controle'
import { createRiskLinkedPlanAction } from '@/lib/plan-action.server'
import { rateLimit, LIMIT_API_WRITE } from '@/lib/rate-limit'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// POST /api/v1/controls/[id]/results — résultat d'un contrôle AUTOMATIQUE poussé par un
// SI tiers (script, outil de configuration, SIEM) — scope write. Le contrôle doit être
// actif, de mode AUTOMATIQUE et appartenir à l'organisation de la clé. Une anomalie crée,
// comme une saisie manuelle, l'action liée au risque du contrôle.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const auth = await authenticateApiRequest(req, 'write')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const rl = await rateLimit(`v1-control-results:${auth.keyId}`, LIMIT_API_WRITE.limit, LIMIT_API_WRITE.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 })

  const { id } = await params
  const controle = await prisma.controle.findFirst({
    where: { id, organizationId: auth.organizationId },
    select: { id: true, organizationId: true, intitule: true, actif: true, modeControle: true, riskItemId: true, responsable: true },
  })
  if (!controle) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const cfg = await getOrgConfig(controle.organizationId)
  if (!cfg.controlePermanentActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })
  if (!controle.actif) return NextResponse.json({ error: 'controle_inactif' }, { status: 400 })
  if (controle.modeControle !== 'AUTOMATIQUE') return NextResponse.json({ error: 'controle_non_automatique' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const erreur = validateExecutionInput(body)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanExecutionInput(body)

  const { execution, actionCreee } = await prisma.$transaction(async tx => {
    const execution = await tx.controleExecution.create({
      data: { ...data, controleId: id, organizationId: controle.organizationId, executantId: `api:${auth.keyId}`, source: 'API' },
    })
    await tx.controle.update({ where: { id }, data: { alerteeLe: null } })
    let actionCreee: string | null = null
    if (data.resultat === 'ANOMALIE' && controle.riskItemId && cfg.registreRisquesActive) {
      const action = await createRiskLinkedPlanAction(tx, {
        organizationId: controle.organizationId, riskItemId: controle.riskItemId, titre: libelleActionAnomalie(controle.intitule),
        description: data.constat, porteur: controle.responsable, statut: 'A_FAIRE',
      })
      actionCreee = action.id
    }
    return { execution, actionCreee }
  })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: auth.actorUserId ?? undefined, organizationId: controle.organizationId, ip: getClientIp(req),
    details: { scope: 'controle', action: 'execute-api', controleId: id, resultat: data.resultat, keyId: auth.keyId, actionCreee },
  })
  return NextResponse.json({ id: execution.id, actionCreee }, { status: 201 })
}
