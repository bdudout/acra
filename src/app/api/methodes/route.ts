// ─── Méthodes d'analyse proposables (pour l'écran de création) ───────────────
// Renvoie l'ensemble EFFECTIF (câblées ∩ activées à l'instance) + le défaut, pour
// alimenter le sélecteur de méthode à la création. Authentifié (tout utilisateur
// pouvant créer une analyse). Le choix final est revalidé côté /api/analyses.

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { resolveMethodes } from '@/lib/methodes'
import { getActiveMethodes } from '@/lib/interfaces-config.server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { available, default: def } = resolveMethodes({ instanceEnabled: await getActiveMethodes() })
  return NextResponse.json({ available, default: def })
}
