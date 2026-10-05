// ─── Plans d'action d'un projet 360, par priorité ─────────────────────────────
// GET — plans (PlanAction) rattachés aux risques du projet (lien RISQUE_ANALYSE, ref = projet), avec leurs risques et
// le niveau actuel de chacun ; ordre : lib/plans-priorite. Lecture seule (accès à l'analyse suffit).
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { UserRole } from '@/lib/permissions'
import { guardLectureProjet360 } from '@/lib/analyse-direct-risk.server'
import { trierPlansParPriorite } from '@/lib/plans-priorite'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const u = (await getServerSession(authOptions))?.user as { id?: string; role?: string } | undefined
  if (!u?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const g = await guardLectureProjet360(id, u.id, (u.role ?? 'ANALYSTE') as UserRole)
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  if (!g.analyse.organizationId) return NextResponse.json({ plans: [] })

  const [plans, risques] = await Promise.all([
    prisma.planAction.findMany({
      where: { organizationId: g.analyse.organizationId, liens: { some: { type: 'RISQUE_ANALYSE', ref: g.analyse.id } } },
      select: { id: true, titre: true, statut: true, priorite: true, echeance: true, porteur: true, liens: { where: { type: 'RISQUE_ANALYSE', ref: g.analyse.id }, select: { targetId: true } } },
      take: 500,
    }),
    prisma.risque.findMany({ where: { analyseId: g.analyse.id }, select: { id: true, nom: true, niveauRisque: true, niveauActuel: true } }),
  ])
  const parId = new Map(risques.map(r => [r.id, { id: r.id, nom: r.nom, niveau: r.niveauActuel ?? r.niveauRisque }]))
  const lignes = plans.map(({ liens, echeance, ...p }) => ({
    ...p, echeance: echeance ? echeance.toISOString() : null,
    risques: liens.map(l => parId.get(l.targetId)).filter((r): r is { id: string; nom: string; niveau: number } => !!r),
  }))
  return NextResponse.json({ plans: trierPlansParPriorite(lignes, new Date()) })
}
