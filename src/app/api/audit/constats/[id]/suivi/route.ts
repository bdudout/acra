import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { withAccess } from '@/lib/with-access.server'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope, roleSurRessource } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { peutEcrireAudit, type UserRole } from '@/lib/permissions'
import { appliquerSuivi, type SuiviCommande } from '@/lib/audit-l4'
import { sanitizeChampsConfig, avecChampsVisibles } from '@/lib/champs-perso'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const ACTIONS = ['DECLARER_REALISE', 'VERIFIER', 'REOUVRIR', 'DEMANDER_REPORT', 'DECIDER_REPORT']

// POST /api/audit/constats/[id]/suivi — suivi d'une recommandation. L'AUDITÉ (tout rôle sauf lecteur)
// déclare la réalisation et demande un report ; l'AUDIT (auditeur, admin) vérifie, rouvre et décide
// des reports. Le lecteur consulte seulement.
// Périmètre visible multi-organisation, sans organisation active exigée : `org: 'none'`.
export const POST = withAccess({ org: 'none', rateLimit: { bucket: 'audit-suivi' } }, async (req, { user, params: { id } }) => {
  const userId = user.id
  const scope = await getAnalyseScope(userId, user.role)
  const orgIds = scope.scope.isSuperAdmin ? null : scope.scope.visibleOrgIds
  const constat = await prisma.auditConstat.findFirst({
    where: { id, ...(orgIds ? { organizationId: { in: orgIds } } : {}) },
    select: { id: true, organizationId: true, statut: true, echeance: true, echeanceInitiale: true, reports: true, realiseePar: true },
  })
  if (!constat) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  // Rôle EFFECTIF dans l'organisation DE LA RESSOURCE, jamais celui de l'org active (CWE-863).
  const role = await roleSurRessource(userId, user.role, constat.organizationId)
  const cfg = await getOrgConfig(constat.organizationId)
  if (!cfg.auditInterneActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })
  if (role === 'LECTEUR') return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  if (!ACTIONS.includes(body.action)) return NextResponse.json({ error: 'action_invalide' }, { status: 400 })
  const auditeur = peutEcrireAudit(role)
  const r = appliquerSuivi(constat, body as SuiviCommande, { acteur: userId, auditeur, now: new Date() })
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })

  const patch = r.patch as Prisma.AuditConstatUncheckedUpdateInput
  if (patch.reports !== undefined) patch.reports = patch.reports as unknown as Prisma.InputJsonValue
  const updated = await prisma.auditConstat.update({ where: { id }, data: patch })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole: role, organizationId: constat.organizationId, ip: getClientIp(req),
    details: { scope: 'audit', action: `recommandation:${body.action}`, id },
  })
  return NextResponse.json(avecChampsVisibles(updated, sanitizeChampsConfig(cfg.champsPersonnalises).constat ?? [], role))
})
