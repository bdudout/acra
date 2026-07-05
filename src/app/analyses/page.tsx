import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { prisma } from '@/lib/prisma'
import Navbar from '@/components/Navbar'
import { analyseWhereClause, type UserRole } from '@/lib/permissions'
import { getAnalyseScope } from '@/lib/org-context.server'
import AnalysesClient from '@/components/AnalysesClient'

// Toujours des données fraîches (l'auth force déjà le rendu dynamique).
export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Liste des analyses — rendue côté SERVEUR (issue #104) : les données sont chargées
 * ici (comme le dashboard) puis passées à la partie cliente interactive. Premier
 * rendu instantané, sans spinner/FOUC réseau (bénéfique sur réseaux lents).
 */
export default async function AnalysesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')

  const userId = (session.user as any).id
  const userRole: UserRole = (session.user as any).role ?? 'ANALYSTE'
  const scope = await getAnalyseScope(userId, userRole)

  const analyses = await (prisma.analyse as any).findMany({
    where: analyseWhereClause(userId, scope.role, scope.scope),
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true, nom: true, description: true, organisation: true,
      secteur: true, statut: true, atelierCourant: true,
      isSocle: true, socleId: true,
      socle: { select: { id: true, nom: true } },
      createdAt: true, updatedAt: true,
      _count: { select: { sourcesRisque: true, scenariosStrategiques: true, risques: true, mesures: true } },
      risques: { select: { niveauRisque: true, strategie: true } },
      mesures: { select: { statut: true, priorite: true } },
    },
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">…</div>}>
        <AnalysesClient initialAnalyses={analyses} />
      </Suspense>
    </div>
  )
}
