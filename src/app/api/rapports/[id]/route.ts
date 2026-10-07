import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import type { UserRole } from '@/lib/permissions'
import { peutLireRapports, peutEcrireRapports } from '@/lib/rapport-acces'
import { transitionRapport, peutRegenerer, RAPPORT_STATUTS, type RapportCode, type RapportStatut } from '@/lib/rapport-model'
import { genererContenuRapport } from '@/lib/rapports.server'
import { diffuserRapport } from '@/lib/rapport-diffusion.server'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

async function charger(id: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const userId = (session.user as { id: string }).id
  const scope = await getAnalyseScope(userId, ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole)
  if (!scope.activeOrgId) return { error: NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 }) }
  const role = scope.role as UserRole
  if (!peutLireRapports(role)) return { error: NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 }) }
  // Module « Rapports GRC » coupé (ou interdit par l'instance) : éditions inaccessibles.
  if (!(await getOrgConfig(scope.activeOrgId)).rapportsGrcActive) return { error: NextResponse.json({ error: 'module_inactif' }, { status: 404 }) }
  // 404 hors organisation active : aucune divulgation d'une édition d'une autre organisation.
  const edition = await prisma.rapportEdition.findFirst({ where: { id, organizationId: scope.activeOrgId } })
  if (!edition) return { error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) }
  return { userId, role, orgId: scope.activeOrgId, edition }
}

// GET /api/rapports/[id] — édition complète (contenu figé).
export async function GET(_req: Request, { params }: Params): Promise<NextResponse> {
  const c = await charger((await params).id)
  if ('error' in c) return c.error as NextResponse
  return NextResponse.json({ ...c.edition, canWrite: peutEcrireRapports(c.role) })
}

// PATCH /api/rapports/[id] — { action: RELU | BROUILLON | VALIDE | DIFFUSE | REGENERER, destinataires? }.
export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const id = (await params).id
  const c = await charger(id)
  if ('error' in c) return c.error as NextResponse
  if (!peutEcrireRapports(c.role)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const action = String(body.action ?? '')
  const cfg = await getOrgConfig(c.orgId)
  const now = new Date()
  const statut = c.edition.statut as RapportStatut

  let data: Prisma.RapportEditionUpdateManyMutationInput
  let destinataires: string[] = []
  let envoyes = 0
  if (action === 'REGENERER') {
    if (!peutRegenerer(statut)) return NextResponse.json({ error: 'non_regenerable' }, { status: 400 })
    const periode = { debut: c.edition.periodeDebut.toISOString().slice(0, 10), fin: c.edition.periodeFin.toISOString().slice(0, 10) }
    const contenu = await genererContenuRapport(c.edition.code as RapportCode, c.orgId, cfg, periode, c.edition.langue, now)
    data = { contenu: contenu as unknown as Prisma.InputJsonValue }
  } else if ((RAPPORT_STATUTS as readonly string[]).includes(action) && action !== c.edition.statut) {
    const vers = action as RapportStatut
    const t = transitionRapport(statut, vers, { acteur: c.userId, createur: c.edition.createdById, secondeLigneActive: cfg.secondeLigneActive })
    if (!t.ok) return NextResponse.json({ error: t.error }, { status: 400 })
    data = { statut: vers }
    if (vers === 'RELU') { data.releuPar = c.userId; data.releuLe = now }
    if (vers === 'VALIDE') { data.validePar = c.userId; data.valideLe = now; if (!c.edition.releuPar) { data.releuPar = c.userId; data.releuLe = now } }
    if (vers === 'DIFFUSE') {
      data.diffuseLe = now
      destinataires = Array.isArray(body.destinataires) ? body.destinataires.filter((x: unknown): x is string => typeof x === 'string') : []
    }
  } else return NextResponse.json({ error: 'action_invalide' }, { status: 400 })

  // La lecture de `charger` peut devenir obsolète entre deux requêtes. La
  // transition est atomique : un seul acteur gagne, avant tout envoi d'e-mail.
  const changed = await prisma.rapportEdition.updateMany({
    where: { id, organizationId: c.orgId, statut }, data,
  })
  if (changed.count !== 1) return NextResponse.json({ error: 'edition_modifiee' }, { status: 409 })
  if (action === 'DIFFUSE') {
    const d = await diffuserRapport(c.orgId, destinataires, { id, code: c.edition.code, langue: c.edition.langue, periode: `${c.edition.periodeDebut.toISOString().slice(0, 10)} → ${c.edition.periodeFin.toISOString().slice(0, 10)}` })
    await prisma.rapportEdition.update({ where: { id }, data: { destinataires: d.destinataires as unknown as Prisma.InputJsonValue } })
    envoyes = d.envoyes
  }
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: c.userId, userRole: c.role, organizationId: c.orgId, ip: getClientIp(req),
    details: { scope: 'rapport', action: `edition:${action}`, id, code: c.edition.code, ...(action === 'DIFFUSE' ? { emailsEnvoyes: envoyes } : {}), ...(cfg.secondeLigneActive === false && action === 'VALIDE' && c.userId === c.edition.createdById ? { autoValidation: true } : {}) },
  })
  return NextResponse.json({ id, statut: action === 'REGENERER' ? statut : action, ...(action === 'DIFFUSE' ? { envoyes } : {}) })
}

// DELETE /api/rapports/[id] — supprime un brouillon uniquement.
export async function DELETE(req: Request, { params }: Params): Promise<NextResponse> {
  const id = (await params).id
  const c = await charger(id)
  if ('error' in c) return c.error as NextResponse
  if (!peutEcrireRapports(c.role)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  if (!peutRegenerer(c.edition.statut as RapportStatut)) return NextResponse.json({ error: 'non_supprimable' }, { status: 400 })
  const deleted = await prisma.rapportEdition.deleteMany({ where: { id, organizationId: c.orgId, statut: 'BROUILLON' } })
  if (deleted.count !== 1) return NextResponse.json({ error: 'edition_modifiee' }, { status: 409 })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: c.userId, userRole: c.role, organizationId: c.orgId, ip: getClientIp(req as NextRequest),
    details: { scope: 'rapport', action: 'delete', id, code: c.edition.code },
  })
  return NextResponse.json({ ok: true })
}
