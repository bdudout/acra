import { NextResponse } from 'next/server'
import { getOrgConfig } from '@/lib/org-config.server'
import { withAccess } from '@/lib/with-access.server'
import { peutQualifier } from '@/lib/incident-access.server'
import { resolveIncidentsConfig } from '@/lib/incidents-config'
import { preparerImportIncidents } from '@/lib/incident-import'
import { creerIncidentsEnMasse } from '@/lib/incident-import.server'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'
const MAX_CSV = 1_000_000

// POST /api/incidents/import — { csv } : import en masse (historique, export SIEM/ITSM), 2ᵉ ligne.
// Taille bornée, 500 lignes max, lignes invalides remontées par numéro (l'import continue).
export const POST = withAccess({ org: 'active', rateLimit: { bucket: 'incidents-import' } }, async (req, { user, role, orgId }) => {
  const userId = user.id
  const cfg = await getOrgConfig(orgId)
  if (!cfg.incidentsActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })
  if (!peutQualifier(role, cfg.secondeLigneActive)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  if (typeof body.csv !== 'string' || !body.csv.trim()) return NextResponse.json({ error: 'fichier_vide' }, { status: 400 })
  if (body.csv.length > MAX_CSV) return NextResponse.json({ error: 'fichier_trop_gros' }, { status: 413 })

  const r = preparerImportIncidents(body.csv, resolveIncidentsConfig(cfg.incidentsConfig))
  if (r.erreurGlobale) return NextResponse.json({ error: r.erreurGlobale }, { status: 400 })
  const crees = await creerIncidentsEnMasse(orgId, userId, r.valides)
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole: role, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'incident', action: 'import-csv', crees, erreurs: r.erreurs.length },
  })
  return NextResponse.json({ crees, erreurs: r.erreurs, tronque: r.tronque })
})
