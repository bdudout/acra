import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import type { UserRole } from '@/lib/permissions'
import { peutQualifier } from '@/lib/incident-access.server'
import { resolveIncidentsConfig } from '@/lib/incidents-config'
import { preparerImportIncidents } from '@/lib/incident-import'
import { creerIncidentsEnMasse } from '@/lib/incident-import.server'
import { rateLimit, LIMIT_API_WRITE } from '@/lib/rate-limit'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'
const MAX_CSV = 1_000_000

// POST /api/incidents/import — { csv } : import en masse (historique, export SIEM/ITSM), 2ᵉ ligne.
// Taille bornée, 500 lignes max, lignes invalides remontées par numéro (l'import continue).
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const scope = await getAnalyseScope(userId, ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole)
  if (!scope.activeOrgId) return NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 })
  const cfg = await getOrgConfig(scope.activeOrgId)
  if (!cfg.incidentsActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })
  if (!peutQualifier(scope.role as UserRole, cfg.secondeLigneActive)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const rl = await rateLimit(`incidents-import:${userId}`, LIMIT_API_WRITE.limit, LIMIT_API_WRITE.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 })

  const body = await req.json().catch(() => ({}))
  if (typeof body.csv !== 'string' || !body.csv.trim()) return NextResponse.json({ error: 'fichier_vide' }, { status: 400 })
  if (body.csv.length > MAX_CSV) return NextResponse.json({ error: 'fichier_trop_gros' }, { status: 413 })

  const r = preparerImportIncidents(body.csv, resolveIncidentsConfig(cfg.incidentsConfig))
  if (r.erreurGlobale) return NextResponse.json({ error: r.erreurGlobale }, { status: 400 })
  const crees = await creerIncidentsEnMasse(scope.activeOrgId, userId, r.valides)
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole: scope.role as string, organizationId: scope.activeOrgId, ip: getClientIp(req),
    details: { scope: 'incident', action: 'import-csv', crees, erreurs: r.erreurs.length },
  })
  return NextResponse.json({ crees, erreurs: r.erreurs, tronque: r.tronque })
}
