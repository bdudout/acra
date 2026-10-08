// ─── Programme d'audit et de contrôle : vue globale (lot P5) ──────────────────
// GET ?annee=AAAA : lignes de l'année de tous les plans visibles (frise commune), synthèse par plan, sollicitations
// multiples des entités, filiales et tiers, angles morts (risques critiques ou majeurs, processus critiques ou importants
// non audités ni contrôlés depuis le seuil configuré). Dernières couvertures réelles : fin des missions d'audit
// (processus couverts) et exécutions des contrôles (risque et processus rattachés). Calculs : lib/planification-vue.
import { NextRequest, NextResponse } from 'next/server'
import { contextePlan, calculerVueGlobale } from '@/lib/planification.server'
import { anneeOuCourante } from '@/lib/planification'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const c = await contextePlan()
  if ('error' in c) return c.error
  return NextResponse.json(await calculerVueGlobale(c, anneeOuCourante(req.nextUrl.searchParams.get('annee'))))
}
