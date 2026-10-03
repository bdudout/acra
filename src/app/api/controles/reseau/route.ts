import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { type UserRole } from '@/lib/permissions'
import { chargerReseau } from '@/lib/controle-reseau.server'

export const dynamic = 'force-dynamic'

// GET /api/controles/reseau — consolidation des contrôles de référence de l'organisation active sur ses entités
// descendantes visibles (une cellule par entité), et contrôles candidats à la déclinaison. Spec P3.
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const data = await chargerReseau((session.user as { id: string }).id, ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole)
  return NextResponse.json(data ? { active: true, ...data } : { active: false })
}
