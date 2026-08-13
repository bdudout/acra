import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import {
  validateEvaluationInput, cleanEvaluationInput, evaluationComplete,
  transitionEvaluationAutorisee, peutValider, type EvaluationStatut,
} from '@/lib/campagne'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string; evalId: string }> }

function peutPiloter(role: UserRole): boolean {
  return isAdminRole(role) || role === 'RISK_MANAGER' || role === 'RSSI'
}

/**
 * PATCH /api/campagnes/[id]/evaluations/[evalId]
 *
 * • COTER (statut COTEE) : la 1ʳᵉ ligne (tout rôle sauf LECTEUR) saisit inhérent,
 *   efficacité des contrôles et résiduel. La cotation doit être complète.
 * • VALIDER / REJETER : réservé à la 2ᵉ ligne, avec QUATRE-YEUX — le valideur ne
 *   peut pas être celui qui a coté (même règle que l'approbation d'analyse).
 * Seule une campagne OUVERTE accepte des modifications.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole

  const { id, evalId } = await params
  const scope = await getAnalyseScope(userId, instanceRole)
  // Rôle EFFECTIF dans l'organisation active (pas le rôle d'instance) → A01/CWE-863.
  const userRole = scope.role
  if (userRole === 'LECTEUR') return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const orgIds = scope.scope.isSuperAdmin ? null : scope.scope.visibleOrgIds
  const evaluation = await prisma.campagneEvaluation.findFirst({
    where: { id: evalId, campagneId: id, ...(orgIds ? { organizationId: { in: orgIds } } : {}) },
    select: {
      id: true, organizationId: true, statut: true, evaluateurId: true,
      campagne: { select: { statut: true } },
    },
  })
  if (!evaluation) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  const cfg = await getOrgConfig(evaluation.organizationId)
  if (!cfg.registreRisquesActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })
  // Hors campagne ouverte, rien ne bouge (brouillon pas encore lancé, clôturée figée).
  if (evaluation.campagne.statut !== 'OUVERTE') return NextResponse.json({ error: 'campagne_non_ouverte' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const depuis = evaluation.statut as EvaluationStatut
  const vers = (typeof body.statut === 'string' ? body.statut : depuis) as EvaluationStatut
  if (!transitionEvaluationAutorisee(depuis, vers)) {
    return NextResponse.json({ error: 'transition_interdite' }, { status: 400 })
  }

  const now = new Date()

  // ── Validation / rejet (2ᵉ ligne, quatre-yeux) ─────────────────────────────
  if (vers === 'VALIDEE' || vers === 'REJETEE') {
    if (!peutPiloter(userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
    if (!peutValider(evaluation.evaluateurId, userId)) {
      return NextResponse.json({ error: 'quatre_yeux' }, { status: 403 })
    }
    const motif = typeof body.motifRejet === 'string' ? body.motifRejet.trim() : ''
    if (vers === 'REJETEE' && !motif) return NextResponse.json({ error: 'motif_requis' }, { status: 400 })

    const updated = await prisma.campagneEvaluation.update({
      where: { id: evalId },
      data: {
        statut: vers,
        valideurId: userId, valideeLe: now,
        motifRejet: vers === 'REJETEE' ? motif : null,
      },
    })
    await auditLog('ORGANIZATION_CONFIG_UPDATED', {
      userId, userRole, organizationId: evaluation.organizationId, ip: getClientIp(req),
      details: { scope: 'campagne-evaluation', action: vers === 'VALIDEE' ? 'valider' : 'rejeter', campagneId: id, id: evalId },
    })
    return NextResponse.json(updated)
  }

  // ── Cotation (1ʳᵉ ligne) ───────────────────────────────────────────────────
  const erreur = validateEvaluationInput(body)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanEvaluationInput(body)
  // Passer en COTEE exige une cotation complète (inhérent ET résiduel).
  if (vers === 'COTEE' && !evaluationComplete(data)) {
    return NextResponse.json({ error: 'cotation_incomplete' }, { status: 400 })
  }

  const updated = await prisma.campagneEvaluation.update({
    where: { id: evalId },
    data: {
      ...data,
      statut: vers,
      ...(vers === 'COTEE' ? { evaluateurId: userId, coteeLe: now, motifRejet: null } : {}),
    },
  })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: evaluation.organizationId, ip: getClientIp(req),
    details: { scope: 'campagne-evaluation', action: 'coter', campagneId: id, id: evalId },
  })
  return NextResponse.json(updated)
}
