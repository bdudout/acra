// ─── Saisie directe — mise à jour / suppression d'un risque ──────────────────
// PATCH  — met à jour un risque (recalcule le niveau si G ou V change).
// DELETE — supprime un risque.
// Mêmes gardes que la collection (accès, méthode à saisie directe, édition, gel)
// + le risque doit appartenir à l'analyse ciblée (sinon 404, sans divulgation).

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { UserRole } from '@/lib/permissions'
import { auditLog, getClientIp } from '@/lib/logger'
import { guardDirectRisk } from '@/lib/analyse-direct-risk.server'
import { sanitizeDirectRisquePatch, recomputeDirectNiveaux, DIRECT_RISK_SELECT } from '@/lib/risque-direct'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string; riskId: string }> }

function auth(session: unknown): { userId: string; role: UserRole } | null {
  const u = (session as { user?: { id?: string; role?: string } } | null)?.user
  if (!u?.id) return null
  return { userId: u.id, role: (u.role ?? 'ANALYSTE') as UserRole }
}

/** Charge un risque en s'assurant qu'il appartient bien à l'analyse ciblée. */
async function riskOfAnalyse(riskId: string, analyseId: string) {
  return prisma.risque.findFirst({
    where: { id: riskId, analyseId },
    select: {
      id: true, gravite: true, vraisemblance: true,
      graviteActuelle: true, vraisemblanceActuelle: true,
      graviteResiduelle: true, vraisemblanceResiduelle: true,
    },
  })
}

// PATCH /api/analyses/:id/risques/:riskId
export async function PATCH(req: NextRequest, { params }: Params) {
  const a = auth(await getServerSession(authOptions))
  if (!a) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id, riskId } = await params
  const g = await guardDirectRisk(id, a.userId, a.role)
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })

  const existing = await riskOfAnalyse(riskId, g.analyse.id)
  if (!existing) return NextResponse.json({ error: 'Risque introuvable' }, { status: 404 })

  const patch = sanitizeDirectRisquePatch(await req.json().catch(() => ({})))
  if (patch.nom !== undefined && patch.nom.trim() === '') {
    return NextResponse.json({ error: 'intitule_requis' }, { status: 400 })
  }
  // Recalcule les niveaux (brut/actuel/résiduel) touchés, valeurs FUSIONNÉES (existant ⊕ patch).
  const data: Record<string, unknown> = { ...patch, ...recomputeDirectNiveaux(patch, existing) }

  const risque = await prisma.risque.update({
    where: { id: riskId },
    data,
    select: DIRECT_RISK_SELECT,
  })
  await auditLog('WORKSHOP_SAVED', {
    userId: a.userId, userRole: a.role, organizationId: g.analyse.organizationId,
    targetId: g.analyse.id, targetType: 'analyse', ip: getClientIp(req),
    details: { scope: 'risque-direct', action: 'update', riskId },
  })
  return NextResponse.json({ risque })
}

// DELETE /api/analyses/:id/risques/:riskId
export async function DELETE(req: NextRequest, { params }: Params) {
  const a = auth(await getServerSession(authOptions))
  if (!a) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id, riskId } = await params
  const g = await guardDirectRisk(id, a.userId, a.role)
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })

  const existing = await riskOfAnalyse(riskId, g.analyse.id)
  if (!existing) return NextResponse.json({ error: 'Risque introuvable' }, { status: 404 })

  await prisma.risque.delete({ where: { id: riskId } })
  await auditLog('WORKSHOP_SAVED', {
    userId: a.userId, userRole: a.role, organizationId: g.analyse.organizationId,
    targetId: g.analyse.id, targetType: 'analyse', ip: getClientIp(req),
    details: { scope: 'risque-direct', action: 'delete', riskId },
  })
  return NextResponse.json({ ok: true })
}
