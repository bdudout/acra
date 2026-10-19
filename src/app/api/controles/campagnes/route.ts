import { NextResponse } from 'next/server'
import { accesResultats } from '@/lib/acces-resultats.server'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { type UserRole, optionsDefinition } from '@/lib/permissions'
import { peutDefinir } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import { validateCampagneControleInput, cleanCampagneControleInput, avancementCampagne, campagneEnRetard, type ExecutionControleLite } from '@/lib/campagne-controle'
import { estArchivable, cleanArchivageDuree } from '@/lib/archivage'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// GET /api/controles/campagnes — campagnes + avancement + contrôles disponibles.
// org: 'none' : sans organisation active, réponse « inactive » (et non 400).
export const GET = withAccess({ org: 'none' }, async (_req, { user }) => {
  const userId = user.id
  // Rôle EFFECTIF dans l'organisation active (A01/CWE-863).
  const { role: userRole, activeOrgId: orgId } = await getAnalyseScope(userId, user.role)
  if (!orgId) return NextResponse.json({ active: false, campagnes: [], controles: [] })
  const cfg = await getOrgConfig(orgId)
  if (!cfg.controlePermanentActive) return NextResponse.json({ active: false, campagnes: [], controles: [] })

  const [toutesCampagnes, tousControles, execs] = await Promise.all([
    prisma.campagneControle.findMany({ where: { organizationId: orgId }, orderBy: [{ createdAt: 'desc' }] }),
    prisma.controle.findMany({ where: { organizationId: orgId }, select: { id: true, intitule: true, niveau: true, actif: true, responsable: true }, orderBy: [{ intitule: 'asc' }] }),
    prisma.controleExecution.findMany({ where: { organizationId: orgId }, select: { controleId: true, dateRealisation: true, resultat: true } }),
  ])
  // Résultats réservés aux interlocuteurs concernés : campagnes qui portent au moins un de leurs contrôles, et ces seuls contrôles.
  const acces = await accesResultats(userId, userRole as UserRole)
  const controles = (acces.tout ? tousControles : tousControles.filter(c => acces.concerne(c.responsable))).map(({ responsable: _r, ...c }) => { void _r; return c })
  const miens = new Set(controles.map(c => c.id))
  const ids = (v: unknown) => (Array.isArray(v) ? (v as string[]) : [])
  const rows = acces.tout ? toutesCampagnes : toutesCampagnes.filter(c => ids(c.controleIds).some(id => miens.has(id))).map(c => ({ ...c, controleIds: ids(c.controleIds).filter(id => miens.has(id)), rapports: [] }))
  const executions: ExecutionControleLite[] = execs.filter(e => acces.tout || miens.has(e.controleId)).map(e => ({ controleId: e.controleId, dateRealisation: e.dateRealisation, resultat: e.resultat }))
  const now = new Date()

  const dureeAnnees = cleanArchivageDuree(cfg.archivageMissionsAnnees)
  const campagnes = rows.map(c => {
    const controleIds = Array.isArray(c.controleIds) ? (c.controleIds as string[]) : []
    const av = avancementCampagne({ controleIds, dateDebut: c.dateDebut, dateFin: c.dateFin }, executions)
    return {
      ...c, controleIds, avancement: av, enRetard: campagneEnRetard({ dateFin: c.dateFin }, av, now),
      archivable: estArchivable({ statut: c.statut, dateFin: c.dateFin, archiveLe: c.archiveLe }, now, dureeAnnees),
      nbRapports: Array.isArray(c.rapports) ? (c.rapports as unknown[]).length : 0,
    }
  })

  return NextResponse.json({ active: true, campagnes, controles, canDefine: peutDefinir(userRole, optionsDefinition(cfg)), archivageDureeAnnees: dureeAnnees })
})

// POST /api/controles/campagnes — crée une campagne (2ᵉ ligne).
export const POST = withAccess({ org: 'active', rateLimit: { bucket: 'campagnes-controle' } }, async (req, { user, role: userRole, orgId }) => {
  const userId = user.id
  const cfg = await getOrgConfig(orgId)
  if (!cfg.controlePermanentActive) return NextResponse.json({ error: 'module_inactif' }, { status: 403 })
  if (!peutDefinir(userRole, optionsDefinition(cfg))) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const erreur = validateCampagneControleInput(body)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanCampagneControleInput(body)

  const created = await prisma.campagneControle.create({
    data: {
      organizationId: orgId, createdBy: userId,
      intitule: data.intitule, description: data.description,
      niveau: data.niveau, statut: data.statut, recurrence: data.recurrence,
      dateDebut: data.dateDebut, dateFin: data.dateFin, controleIds: data.controleIds,
    },
  })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'campagne-controle', action: 'create', id: created.id },
  })
  return NextResponse.json(created, { status: 201 })
})
