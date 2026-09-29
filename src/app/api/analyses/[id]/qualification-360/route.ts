// ─── Questionnaire de qualification 360 (analyse PROJET_360) ─────────────────
// PUT { answers } : fusionne les réponses `p360.*` dans Analyse.qualification sans
// toucher aux réponses du questionnaire général. Gardes : accès (404), méthode
// PROJET_360 (400), édition (403), gel (403) — `guardDirectRisk`.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import type { UserRole } from '@/lib/permissions'
import { guardDirectRisk } from '@/lib/analyse-direct-risk.server'
import { sanitizeAnswers360, progression360 } from '@/lib/projet360'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  const user = session?.user as { id?: string; role?: string } | undefined
  if (!user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const role = (user.role ?? 'ANALYSTE') as UserRole
  const { id } = await params
  const g = await guardDirectRisk(id, user.id, role)
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  if (g.analyse.methode !== 'PROJET_360') return NextResponse.json({ error: 'methode_non_360' }, { status: 400 })

  const body = await req.json().catch(() => ({})) as { answers?: unknown }
  const answers = sanitizeAnswers360(body.answers)
  const current = await prisma.analyse.findUnique({ where: { id }, select: { qualification: true } })
  const base = current?.qualification && typeof current.qualification === 'object' && !Array.isArray(current.qualification)
    ? Object.fromEntries(Object.entries(current.qualification as Record<string, unknown>).filter(([k]) => !k.startsWith('p360.')))
    : {}
  const qualification = { ...base, ...answers } as Prisma.InputJsonValue
  await prisma.analyse.update({ where: { id }, data: { qualification } })
  await auditLog('WORKSHOP_SAVED', {
    userId: user.id, userRole: role, organizationId: g.analyse.organizationId, targetId: id, targetType: 'analyse',
    ip: getClientIp(req), details: { scope: 'qualification-360', answered: Object.keys(answers).length },
  })
  return NextResponse.json({ answers, progression: progression360(answers) })
}
