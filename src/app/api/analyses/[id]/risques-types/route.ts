// ─── Risques types d'une analyse à saisie directe (import en phase d'identification) ─
// GET  — catalogue groupé par origine (registre, sous-secteurs, architecture, secteur, transverse), déjà présents signalés.
// POST — { intitules: string[] } : crée les risques retenus, uniquement s'ils figurent au catalogue recalculé ici et ne
//        sont pas déjà dans l'analyse (contenu jamais repris du client). Même garde que la saisie directe (édition, gel).
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { UserRole } from '@/lib/permissions'
import { auditLog, getClientIp } from '@/lib/logger'
import { guardDirectRisk } from '@/lib/analyse-direct-risk.server'
import { getEffectiveScaleConfig } from '@/lib/configuration-server'
import { sanitizeDirectRisque } from '@/lib/risque-direct'
import { selectionRisquesTypes } from '@/lib/risque-exemples'
import { catalogueRisquesTypesAnalyse } from '@/lib/risques-types.server'
import { getServerLocale, getServerT } from '@/lib/i18n'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }
const MAX_IMPORT = 200

function auth(session: unknown): { userId: string; role: UserRole } | null {
  const u = (session as { user?: { id?: string; role?: string } } | null)?.user
  return u?.id ? { userId: u.id, role: (u.role ?? 'ANALYSTE') as UserRole } : null
}

async function catalogue(analyseId: string, organizationId: string | null) {
  const t = await getServerT()
  return catalogueRisquesTypesAnalyse(analyseId, organizationId, t.risquesDirects.risquesTransverses, await getServerLocale())
}

export async function GET(_req: NextRequest, { params }: Params) {
  const a = auth(await getServerSession(authOptions))
  if (!a) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const g = await guardDirectRisk(id, a.userId, a.role)
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  return NextResponse.json({ risques: await catalogue(g.analyse.id, g.analyse.organizationId) })
}

export async function POST(req: NextRequest, { params }: Params) {
  const a = auth(await getServerSession(authOptions))
  if (!a) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const g = await guardDirectRisk(id, a.userId, a.role)
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const body = await req.json().catch(() => ({}))
  const demandes: unknown[] = Array.isArray(body?.intitules) ? body.intitules.slice(0, MAX_IMPORT) : []
  const retenus = selectionRisquesTypes(await catalogue(g.analyse.id, g.analyse.organizationId), demandes)
  if (!retenus.length) return NextResponse.json({ created: 0 })

  const { nbNiveaux } = await getEffectiveScaleConfig(g.analyse.organizationId)
  const { count } = await prisma.risque.createMany({
    data: retenus.map(r => {
      const p = sanitizeDirectRisque({ nom: r.intitule, description: r.description, gravite: r.gravite, vraisemblance: r.vraisemblance, strategie: 'REDUIRE', ...(r.domaine ? { domaine: r.domaine } : {}) }, nbNiveaux)
      const { vulnerabilites: _v, ...row } = p
      void _v
      return { ...row, description: p.description ?? null, analyseId: g.analyse.id }
    }),
  })
  await auditLog('WORKSHOP_SAVED', {
    userId: a.userId, userRole: a.role, organizationId: g.analyse.organizationId,
    targetId: g.analyse.id, targetType: 'analyse', ip: getClientIp(req),
    details: { scope: 'risque-direct', action: 'import-risques-types', count },
  })
  return NextResponse.json({ created: count }, { status: 201 })
}
