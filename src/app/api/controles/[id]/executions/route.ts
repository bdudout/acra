import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { type UserRole } from '@/lib/permissions'
import { validateExecutionInput, cleanExecutionInput, libelleActionAnomalie } from '@/lib/controle'
import { sanitizePreuves } from '@/lib/preuves'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

/**
 * POST /api/controles/[id]/executions — ENREGISTRER une exécution de contrôle.
 *
 * L'exécution relève de la 1ʳᵉ ligne : ouvert à tous les rôles SAUF LECTEUR
 * (celui-ci consulte, il n'exécute pas de contrôle). En cas d'ANOMALIE et si le
 * contrôle est rattaché à un risque du registre, une action de traitement est
 * créée automatiquement — la boucle « anomalie → plan d'action » de la spec.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole

  const { id } = await params
  const scope = await getAnalyseScope(userId, instanceRole)
  // Rôle EFFECTIF dans l'organisation active (pas le rôle d'instance) → A01/CWE-863.
  const userRole = scope.role
  if (userRole === 'LECTEUR') return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const orgIds = scope.scope.isSuperAdmin ? null : scope.scope.visibleOrgIds
  const controle = await prisma.controle.findFirst({
    where: { id, ...(orgIds ? { organizationId: { in: orgIds } } : {}) },
    select: { id: true, organizationId: true, intitule: true, actif: true, riskItemId: true, responsable: true },
  })
  if (!controle) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  const cfg = await getOrgConfig(controle.organizationId)
  if (!cfg.controlePermanentActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })
  // Un contrôle retiré du plan ne s'exécute plus.
  if (!controle.actif) return NextResponse.json({ error: 'controle_inactif' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const erreur = validateExecutionInput(body)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanExecutionInput(body)
  const preuves = sanitizePreuves(body.preuves)

  // L'exécution et l'action générée doivent apparaître ensemble : une anomalie
  // sans son action de traitement laisserait un trou dans la piste d'audit.
  const { execution, actionCreee } = await prisma.$transaction(async tx => {
    const execution = await tx.controleExecution.create({
      data: {
        ...data, controleId: id, organizationId: controle.organizationId,
        executantId: userId, preuves: preuves as unknown as object,
      },
    })
    // Nouvelle exécution ⇒ nouvelle période : l'alerte d'échéance peut repartir.
    await tx.controle.update({ where: { id }, data: { alerteeLe: null } })
    let actionCreee: string | null = null
    if (data.resultat === 'ANOMALIE' && controle.riskItemId && cfg.registreRisquesActive) {
      const action = await tx.riskAction.create({
        data: {
          riskItemId: controle.riskItemId,
          organizationId: controle.organizationId,
          intitule: libelleActionAnomalie(controle.intitule),
          description: data.constat,
          responsable: controle.responsable,
          statut: 'A_FAIRE',
        },
      })
      actionCreee = action.id
    }
    return { execution, actionCreee }
  })

  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: controle.organizationId, ip: getClientIp(req),
    details: { scope: 'controle', action: 'execute', controleId: id, resultat: data.resultat, actionCreee, preuves: preuves.length },
  })
  return NextResponse.json({ execution, actionCreee }, { status: 201 })
}
