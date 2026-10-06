import { NextRequest, NextResponse } from 'next/server'
import { accesResultats } from '@/lib/acces-resultats.server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import type { UserRole } from '@/lib/permissions'
import { planAnnuel } from '@/lib/controle-l3'

export const dynamic = 'force-dynamic'

// GET /api/controles/plan?annee=2026 — plan annuel d'exécution des contrôles de l'org active
// (une occurrence par période, retards, charge par responsable).
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const scope = await getAnalyseScope(userId, ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole)
  if (!scope.activeOrgId) return NextResponse.json({ active: false })
  const cfg = await getOrgConfig(scope.activeOrgId)
  if (!cfg.controlePermanentActive) return NextResponse.json({ active: false })

  const now = new Date()
  const param = new URL(req.url).searchParams.get('annee') ?? ''
  const annee = /^\d{4}$/.test(param) ? Number(param) : now.getUTCFullYear()
  const debut = new Date(Date.UTC(annee, 0, 1)); const fin = new Date(Date.UTC(annee + 1, 0, 1))
  const [controles, executions] = await Promise.all([
    prisma.controle.findMany({ where: { organizationId: scope.activeOrgId }, orderBy: { createdAt: 'asc' }, select: { id: true, intitule: true, periodicite: true, responsable: true, niveau: true, actif: true, cle: true, modeControle: true, createdAt: true } }),
    prisma.controleExecution.findMany({ where: { organizationId: scope.activeOrgId, dateRealisation: { gte: debut, lt: fin } }, select: { controleId: true, dateRealisation: true, resultat: true } }),
  ])
  // Résultats réservés aux interlocuteurs concernés (lib/acces-resultats).
  const acces = await accesResultats(userId, scope.role as UserRole)
  const miens = acces.tout ? controles : controles.filter(c => acces.concerne(c.responsable))
  const plan = planAnnuel(miens.map(c => ({ ...c, creeLe: c.createdAt })), executions, annee, now)
  return NextResponse.json({
    active: true, annee, plan,
    controles: miens.filter(c => c.actif).map(c => ({ id: c.id, intitule: c.intitule, periodicite: c.periodicite, responsable: c.responsable, niveau: c.niveau, cle: c.cle, modeControle: c.modeControle })),
  })
}
