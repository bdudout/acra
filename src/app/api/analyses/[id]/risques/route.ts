// ─── Saisie DIRECTE des risques d'une analyse (méthodes type ISO 31000) ──────
// GET  — liste les risques de l'analyse (saisie directe).
// POST — crée un risque directement (intitulé + gravité + vraisemblance).
// Réservé aux analyses dont la méthode autorise la saisie directe (cf.
// lib/methodes.ts) ; en EBIOS RM les risques dérivent des scénarios.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { UserRole } from '@/lib/permissions'
import { auditLog, getClientIp } from '@/lib/logger'
import { guardDirectRisk } from '@/lib/analyse-direct-risk.server'
import { sanitizeDirectRisque, isDirectRisqueValid } from '@/lib/risque-direct'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

function auth(session: unknown): { userId: string; role: UserRole } | null {
  const u = (session as { user?: { id?: string; role?: string } } | null)?.user
  if (!u?.id) return null
  return { userId: u.id, role: (u.role ?? 'ANALYSTE') as UserRole }
}

// GET /api/analyses/:id/risques — liste des risques (saisie directe).
export async function GET(_req: NextRequest, { params }: Params) {
  const a = auth(await getServerSession(authOptions))
  if (!a) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const g = await guardDirectRisk(id, a.userId, a.role)
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })

  const risques = await prisma.risque.findMany({
    where: { analyseId: g.analyse.id },
    orderBy: [{ niveauRisque: 'desc' }, { createdAt: 'asc' }],
    select: { id: true, nom: true, description: true, gravite: true, vraisemblance: true, niveauRisque: true, strategie: true },
  })
  return NextResponse.json({ risques })
}

// POST /api/analyses/:id/risques — crée un risque directement.
export async function POST(req: NextRequest, { params }: Params) {
  const a = auth(await getServerSession(authOptions))
  if (!a) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const g = await guardDirectRisk(id, a.userId, a.role)
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })

  const payload = sanitizeDirectRisque(await req.json().catch(() => ({})))
  if (!isDirectRisqueValid(payload)) {
    return NextResponse.json({ error: 'intitule_requis' }, { status: 400 })
  }

  const risque = await prisma.risque.create({
    data: {
      analyseId: g.analyse.id,
      nom: payload.nom,
      description: payload.description,
      gravite: payload.gravite,
      vraisemblance: payload.vraisemblance,
      niveauRisque: payload.niveauRisque,
      strategie: payload.strategie,
    },
    select: { id: true, nom: true, description: true, gravite: true, vraisemblance: true, niveauRisque: true, strategie: true },
  })
  await auditLog('WORKSHOP_SAVED', {
    userId: a.userId, userRole: a.role, organizationId: g.analyse.organizationId,
    targetId: g.analyse.id, targetType: 'analyse', ip: getClientIp(req),
    details: { scope: 'risque-direct', action: 'create', riskId: risque.id },
  })
  return NextResponse.json({ risque }, { status: 201 })
}
