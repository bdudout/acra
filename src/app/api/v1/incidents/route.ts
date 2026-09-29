import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateApiRequest } from '@/lib/api-auth.server'
import { perteNette as calcPerteNette, validateIncidentInput, cleanIncidentInput, type CleanIncident, type IncidentInput } from '@/lib/incident'
import { getOrgConfig } from '@/lib/org-config.server'
import { resolveIncidentsConfig } from '@/lib/incidents-config'
import { creerIncidentsEnMasse } from '@/lib/incident-import.server'
import { rateLimit, LIMIT_API_WRITE } from '@/lib/rate-limit'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// GET /api/v1/incidents — incidents & pertes (LDC) de l'organisation — scope read.
export async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req, 'read')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const rows = await prisma.incident.findMany({
    where: { organizationId: auth.organizationId },
    orderBy: [{ createdAt: 'desc' }],
    select: {
      id: true, intitule: true, description: true, statut: true, taxonomieCode: true,
      entite: true, dateSurvenance: true, dateDetection: true,
      montantBrut: true, recuperations: true, createdAt: true,
    },
  })
  const num = (v: unknown) => (v == null ? null : Number(v))
  const data = rows.map(r => {
    const brut = num(r.montantBrut), recup = num(r.recuperations)
    return {
      id: r.id, intitule: r.intitule, description: r.description, statut: r.statut,
      categorie: r.taxonomieCode, entite: r.entite,
      dateSurvenance: r.dateSurvenance, dateDetection: r.dateDetection,
      montantBrut: brut, recuperations: recup, perteNette: calcPerteNette(brut, recup),
      createdAt: r.createdAt,
    }
  })
  return NextResponse.json({ data, count: data.length })
}

const MAX_ITEMS = 500

// POST /api/v1/incidents — déclaration en masse depuis un SI tiers (ITSM, SIEM) — scope write.
// Corps { incidents: [...] } (500 max) ; chaque item est validé comme une déclaration ; les invalides
// sont remontés par index (l'import continue). Déclarant = créateur de la clé (clé sans créateur refusée).
export async function POST(req: NextRequest) {
  const auth = await authenticateApiRequest(req, 'write')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!auth.actorUserId) return NextResponse.json({ error: 'cle_sans_createur' }, { status: 400 })
  const rl = await rateLimit(`v1-incidents:${auth.keyId}`, LIMIT_API_WRITE.limit, LIMIT_API_WRITE.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 })
  const cfg = await getOrgConfig(auth.organizationId)
  if (!cfg.incidentsActive) return NextResponse.json({ error: 'module_inactif' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  if (!Array.isArray(body.incidents) || body.incidents.length > MAX_ITEMS) return NextResponse.json({ error: 'incidents_invalides' }, { status: 400 })
  const icfg = resolveIncidentsConfig(cfg.incidentsConfig)
  const valides: CleanIncident[] = []
  const erreurs: { index: number; error: string }[] = []
  body.incidents.forEach((it: IncidentInput, index: number) => {
    const e = validateIncidentInput(it ?? {}, icfg)
    if (e) erreurs.push({ index, error: e }); else valides.push(cleanIncidentInput(it, icfg))
  })
  const crees = await creerIncidentsEnMasse(auth.organizationId, auth.actorUserId, valides)
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: auth.actorUserId, organizationId: auth.organizationId, ip: getClientIp(req), details: { scope: 'incident', action: 'import-api', keyId: auth.keyId, crees, erreurs: erreurs.length } })
  return NextResponse.json({ crees, erreurs })
}
