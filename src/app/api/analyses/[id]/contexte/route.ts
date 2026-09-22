// ─── Contexte d'appréciation d'une analyse à saisie directe ──────────────────
// PATCH — met à jour périmètre + objectifs/critères (upsert Cadrage). Réservé aux
// analyses dont la méthode autorise la saisie directe (ISO 31000 / ISO 27005 /
// NIST) ; même garde que `/risques` (accès, méthode, édition F01, gel).

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { UserRole } from '@/lib/permissions'
import { auditLog, getClientIp } from '@/lib/logger'
import { guardDirectRisk } from '@/lib/analyse-direct-risk.server'
import { sanitizeContexte } from '@/lib/analyse-contexte'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

function auth(session: unknown): { userId: string; role: UserRole } | null {
  const u = (session as { user?: { id?: string; role?: string } } | null)?.user
  if (!u?.id) return null
  return { userId: u.id, role: (u.role ?? 'ANALYSTE') as UserRole }
}

// PATCH /api/analyses/:id/contexte — met à jour le contexte (périmètre + objectifs).
export async function PATCH(req: NextRequest, { params }: Params) {
  const a = auth(await getServerSession(authOptions))
  if (!a) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const g = await guardDirectRisk(id, a.userId, a.role)
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })

  const contexte = sanitizeContexte(await req.json().catch(() => ({})))

  await prisma.cadrage.upsert({
    where: { analyseId: g.analyse.id },
    create: { analyseId: g.analyse.id, perimetre: contexte.perimetre, objectifsEtude: contexte.objectifsEtude },
    update: { perimetre: contexte.perimetre, objectifsEtude: contexte.objectifsEtude },
  })
  await prisma.analyse.update({ where: { id: g.analyse.id }, data: { updatedAt: new Date() } })

  await auditLog('WORKSHOP_SAVED', {
    userId: a.userId, userRole: a.role, organizationId: g.analyse.organizationId,
    targetId: g.analyse.id, targetType: 'analyse', ip: getClientIp(req),
    details: { scope: 'contexte-direct', action: 'update' },
  })

  return NextResponse.json({ contexte })
}
