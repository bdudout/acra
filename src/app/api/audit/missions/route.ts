import { NextResponse } from 'next/server'
import { accesResultats } from '@/lib/acces-resultats.server'
import { visibiliteMission } from '@/lib/acces-resultats'
import { withAccess } from '@/lib/with-access.server'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import type { UserRole } from '@/lib/permissions'
import { validateMissionInput, cleanMissionInput, synthetiserConstats, constatTermine, type ConstatStatut } from '@/lib/audit'
import { estArchivable, cleanArchivageDuree } from '@/lib/archivage'
import { sanitizeChampsConfig, valeursVisibles, fusionnerChamps, champsRequisManquants } from '@/lib/champs-perso'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * Cloisonnement 3ᵉ ligne : SEUL l'auditeur écrit les objets d'audit (l'admin
 * aussi, pour l'administration). Tous les autres rôles consultent uniquement.
 */
import { peutEcrireAudit } from '@/lib/permissions'

// GET /api/audit/missions — plan d'audit de l'organisation active + synthèse des constats.
// Sans organisation active : { missions: [], active: false } (pas de 400) — d'où `org: 'none'`.
export const GET = withAccess({ org: 'none' }, async (_req, { user }) => {
  const userId = user.id
  const scope = await getAnalyseScope(userId, user.role)
  // Rôle EFFECTIF dans l'organisation active (pas le rôle d'instance) → A01/CWE-863.
  const roleLecture = scope.role
  const orgId = scope.activeOrgId
  if (!orgId) return NextResponse.json({ missions: [], active: false })
  const cfg = await getOrgConfig(orgId)
  if (!cfg.auditInterneActive) return NextResponse.json({ missions: [], active: false })

  const rows = await prisma.auditMission.findMany({
    where: { organizationId: orgId },
    orderBy: [{ createdAt: 'desc' }],
    include: { constats: { select: { criticite: true, statut: true, echeance: true, responsableAction: true } } },
  })
  // Résultats réservés aux interlocuteurs concernés : 1re ligne et lecture seule ne voient que leurs missions / constats.
  const acces = await accesResultats(userId, roleLecture as UserRole)
  const now = new Date()
  const dureeAnnees = cleanArchivageDuree(cfg.archivageMissionsAnnees)
  const constatOuvert = (s: string) => !constatTermine(s as ConstatStatut)
  const defsChamps = sanitizeChampsConfig(cfg.champsPersonnalises).mission ?? []
  const missions = rows.flatMap(({ constats: tous, ...m }) => {
    const vue = visibiliteMission(m, tous, acces)
    if (!vue.visible) return []
    const constats = vue.constats
    const constatsOuverts = constats.filter(x => constatOuvert(x.statut)).length
    return {
      ...m,
      champs: valeursVisibles(defsChamps, m.champs, roleLecture),
      synthese: synthetiserConstats(constats, now),
      constatsOuverts,
      archivable: estArchivable({ statut: m.statut, dateFin: m.dateFin, archiveLe: m.archiveLe, constatsOuverts }, now, dureeAnnees),
      nbRapports: vue.complete && Array.isArray(m.rapports) ? (m.rapports as unknown[]).length : 0,
      ...(vue.complete ? {} : { rapports: [] }),
    }
  })
  return NextResponse.json({ missions, active: true, archivageDureeAnnees: dureeAnnees })
})

// POST /api/audit/missions — planifier une mission (auditeur / admin).
// Rôle EFFECTIF dans l'organisation active (pas le rôle d'instance) → A01/CWE-863.
export const POST = withAccess({ org: 'active', allow: peutEcrireAudit, rateLimit: { bucket: 'audit-missions' } }, async (req, { user, role: userRole, orgId }) => {
  const userId = user.id
  const cfg = await getOrgConfig(orgId)
  if (!cfg.auditInterneActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const erreur = validateMissionInput(body)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanMissionInput(body)

  const defsChamps = sanitizeChampsConfig(cfg.champsPersonnalises).mission ?? []
  const champs = fusionnerChamps(defsChamps, {}, body.champs, userRole)
  const manquants = champsRequisManquants(defsChamps, champs, userRole)
  if (manquants.length) return NextResponse.json({ error: 'champs_requis', champs: manquants }, { status: 400 })
  const mission = await prisma.auditMission.create({ data: { ...data, champs: champs as unknown as object, programmeResultats: data.programmeResultats as unknown as object, organizationId: orgId, statut: 'PLANIFIEE' } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'audit-mission', action: 'create', id: mission.id },
  })
  return NextResponse.json(mission, { status: 201 })
})
