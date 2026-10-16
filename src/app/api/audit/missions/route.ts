import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { accesResultats } from '@/lib/acces-resultats.server'
import { visibiliteMission } from '@/lib/acces-resultats'
import { withAccess } from '@/lib/with-access.server'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import type { UserRole } from '@/lib/permissions'
import { validateMissionInput, cleanMissionInput, synthetiserConstats, constatTermine, filtrerMissions, type ConstatStatut } from '@/lib/audit'
import { estArchivable, cleanArchivageDuree } from '@/lib/archivage'
import { sanitizeChampsConfig, valeursVisibles, fusionnerChamps, champsRequisManquants } from '@/lib/champs-perso'
import { auditLog, getClientIp } from '@/lib/logger'
import { lirePagination, paginer, trier } from '@/lib/pagination'

export const dynamic = 'force-dynamic'

/**
 * Cloisonnement 3ᵉ ligne : SEUL l'auditeur écrit les objets d'audit (l'admin
 * aussi, pour l'administration). Tous les autres rôles consultent uniquement.
 */
import { peutEcrireAudit } from '@/lib/permissions'

// GET /api/audit/missions — plan d'audit de l'organisation active + synthèse des constats.
// Sans organisation active : { missions: [], active: false } (pas de 400) — d'où `org: 'none'`.
// Lot V1 : `?page=N&taille=&tri=&ordre=&q=&statut=&type=&archives=1` → page seule + `pagination` + `synthese`
// (compteurs de tête d'écran sur TOUTES les missions visibles). Sans `page` : liste complète historique.
const TRIS = ['defaut', 'intitule', 'responsable', 'statut', 'dateDebut', 'dateFin'] as const
const CONSTATS_LITE = { select: { criticite: true, statut: true, echeance: true, responsableAction: true } } as const

export const GET = withAccess({ org: 'none' }, async (req, { user }) => {
  const userId = user.id
  const scope = await getAnalyseScope(userId, user.role)
  // Rôle EFFECTIF dans l'organisation active (pas le rôle d'instance) → A01/CWE-863.
  const roleLecture = scope.role
  const orgId = scope.activeOrgId
  if (!orgId) return NextResponse.json({ missions: [], active: false })
  const cfg = await getOrgConfig(orgId)
  if (!cfg.auditInterneActive) return NextResponse.json({ missions: [], active: false })

  // Résultats réservés aux interlocuteurs concernés : 1re ligne et lecture seule ne voient que leurs missions / constats.
  const acces = await accesResultats(userId, roleLecture as UserRole)
  const now = new Date()
  const dureeAnnees = cleanArchivageDuree(cfg.archivageMissionsAnnees)
  const constatOuvert = (s: string) => !constatTermine(s as ConstatStatut)
  const defsChamps = sanitizeChampsConfig(cfg.champsPersonnalises).mission ?? []
  type Rang = { id: string; responsable: string | null; constats: { criticite: number | null; statut: string; echeance: Date | null; responsableAction: string | null }[] }
  // Constats visibles + synthèse d'une mission (null si la mission n'est pas visible).
  const vueConstats = <M extends Rang>({ constats: tous, ...m }: M) => {
    const vue = visibiliteMission(m, tous, acces)
    if (!vue.visible) return null
    return { m, vue, synthese: synthetiserConstats(vue.constats, now), constatsOuverts: vue.constats.filter(x => constatOuvert(x.statut)).length }
  }
  const versMissions = (rows: Prisma.AuditMissionGetPayload<{ include: { constats: typeof CONSTATS_LITE } }>[]) => rows.flatMap(r => {
    const v = vueConstats(r)
    if (!v) return []
    const { m, vue, synthese, constatsOuverts } = v
    return {
      ...m,
      champs: valeursVisibles(defsChamps, m.champs, roleLecture),
      synthese,
      constatsOuverts,
      archivable: estArchivable({ statut: m.statut, dateFin: m.dateFin, archiveLe: m.archiveLe, constatsOuverts }, now, dureeAnnees),
      nbRapports: vue.complete && Array.isArray(m.rapports) ? (m.rapports as unknown[]).length : 0,
      ...(vue.complete ? {} : { rapports: [] }),
    }
  })

  const sp = req.nextUrl.searchParams
  const pg = lirePagination(sp, { tris: TRIS, triDefaut: 'defaut' })
  if (!pg) {
    const rows = await prisma.auditMission.findMany({
      where: { organizationId: orgId },
      orderBy: [{ createdAt: 'desc' }],
      include: { constats: CONSTATS_LITE },
    })
    return NextResponse.json({ missions: versMissions(rows), active: true, archivageDureeAnnees: dureeAnnees })
  }

  // Requête LÉGÈRE sur tout le plan (visibilité, filtres, compteurs, tri), détail de la seule page.
  const legers = (await prisma.auditMission.findMany({
    where: { organizationId: orgId },
    orderBy: [{ createdAt: 'desc' }],
    select: { id: true, intitule: true, responsable: true, statut: true, type: true, dateDebut: true, dateFin: true, archiveLe: true, constats: CONSTATS_LITE },
  })).flatMap(r => { const v = vueConstats(r); return v ? [{ ...v.m, synthese: v.synthese }] : [] })
  const synthese = {
    total: legers.length,
    enCours: legers.filter(m => m.statut === 'EN_COURS').length,
    critiques: legers.reduce((s, m) => s + m.synthese.critiques, 0),
    enRetard: legers.reduce((s, m) => s + m.synthese.enRetard, 0),
    archivees: legers.filter(m => m.archiveLe).length,
  }
  const filtres = filtrerMissions(legers, { q: pg.q, statut: sp.get('statut') ?? '', type: sp.get('type') ?? '' })
    .filter(m => sp.get('archives') === '1' || !m.archiveLe)
  const cleTri: Record<(typeof TRIS)[number], ((m: (typeof legers)[number]) => unknown) | null> = {
    defaut: null, intitule: m => m.intitule, responsable: m => m.responsable, statut: m => m.statut, dateDebut: m => m.dateDebut, dateFin: m => m.dateFin,
  }
  const k = cleTri[pg.tri]
  const page = paginer(k ? trier(filtres, k, pg.ordre) : filtres, pg)
  const ordre = new Map(page.items.map((m, i) => [m.id, i]))
  const detail = page.items.length
    ? await prisma.auditMission.findMany({ where: { organizationId: orgId, id: { in: page.items.map(m => m.id) } }, include: { constats: CONSTATS_LITE } })
    : []
  const missions = versMissions(detail.sort((a, b) => (ordre.get(a.id) ?? 0) - (ordre.get(b.id) ?? 0)))
  return NextResponse.json({ missions, active: true, archivageDureeAnnees: dureeAnnees, pagination: page.pagination, synthese })
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
