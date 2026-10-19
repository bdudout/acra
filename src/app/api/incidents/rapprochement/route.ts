import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrgConfig } from '@/lib/org-config.server'
import { withAccess } from '@/lib/with-access.server'
import { peutQualifier } from '@/lib/incident-access.server'
import { resolveIncidentsConfig } from '@/lib/incidents-config'
import { rapprocherCompta } from '@/lib/rapprochement-compta'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'
const MAX_CSV = 1_000_000

// POST /api/incidents/rapprochement — { csv } : contrôle LDC ↔ grand livre (B-PER-6). Lecture seule :
// rien n'est écrit, le CSV comptable est fourni par l'organisation (pas de lecture directe de l'ERP).
export const POST = withAccess({ org: 'active', rateLimit: { bucket: 'incidents-rapprochement' } }, async (req, { user, role, orgId }) => {
  const userId = user.id
  const cfg = await getOrgConfig(orgId)
  if (!cfg.incidentsActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })
  if (!peutQualifier(role, cfg.secondeLigneActive)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  if (typeof body.csv !== 'string' || !body.csv.trim()) return NextResponse.json({ error: 'fichier_vide' }, { status: 400 })
  if (body.csv.length > MAX_CSV) return NextResponse.json({ error: 'fichier_trop_gros' }, { status: 413 })

  const ic = resolveIncidentsConfig(cfg.incidentsConfig)
  const incidents = await prisma.incident.findMany({ where: { organizationId: orgId, quasiIncident: false }, select: { id: true, intitule: true, pertes: true }, take: 5000 })
  const r = rapprocherCompta(body.csv, incidents, { deviseReference: ic.deviseReference, taux: ic.taux })
  if (r.erreurGlobale) return NextResponse.json({ error: r.erreurGlobale }, { status: 400 })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole: role, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'incident', action: 'rapprochement-compta', ...r.synthese },
  })
  return NextResponse.json(r)
})
