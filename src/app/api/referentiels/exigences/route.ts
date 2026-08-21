import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { getServerLocale } from '@/lib/i18n'
import { type UserRole } from '@/lib/permissions'
import { getExigencesFor } from '@/lib/referentiel.server'

export const dynamic = 'force-dynamic'

// GET /api/referentiels/exigences?code=ISO27001 — exigences d'un référentiel
// (pour la sélection lors du rattachement d'un contrôle / constat).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  const orgId = scope.activeOrgId
  if (!orgId) return NextResponse.json({ exigences: [] })
  const cfg = await getOrgConfig(orgId)
  if (!cfg.conformiteActive) return NextResponse.json({ exigences: [] })

  const code = new URL(req.url).searchParams.get('code')
  if (!code) return NextResponse.json({ exigences: [] })
  const locale = await getServerLocale()
  const exigences = await getExigencesFor(code, orgId, locale)
  return NextResponse.json({ exigences: exigences.map(e => ({ ref: e.ref, nom: e.nom, categorie: e.categorie })) })
}
