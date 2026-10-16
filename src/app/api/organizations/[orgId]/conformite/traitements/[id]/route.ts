/**
 * Un traitement de conformité : mise à jour (dont rattachement/retrait d'une
 * exigence via addRef/removeRef) et suppression. Réservé à la gouvernance.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { peutGererConformite } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import { sanitizeRefs, TRAITEMENT_STATUTS } from '@/lib/conformite-traitement'

export const dynamic = 'force-dynamic'
/** Gestion de la conformité : gouvernance, dont CONFORMITE et DPO (lib/permissions). */
const access = { org: { param: 'orgId' }, allow: peutGererConformite, rateLimit: { bucket: 'conf-traitements' } } as const

/** Traitement de l'organisation (404 sinon, aucune divulgation). */
const charger = (orgId: string, id: string) => prisma.conformiteTraitement.findFirst({ where: { id, organizationId: orgId }, select: { id: true, refs: true } })
const introuvable = () => NextResponse.json({ error: 'Traitement introuvable' }, { status: 404 })

// PATCH /api/organizations/[orgId]/conformite/traitements/[id] — met à jour un traitement d'écart de conformité (plan d'action / dérogation / acceptation).
export const PATCH = withAccess(access, async (req, { orgId, params: { id } }) => {
  const row = await charger(orgId, id)
  if (!row) return introuvable()
  const body = await req.json().catch(() => ({}))

  const data: Prisma.ConformiteTraitementUpdateInput = {}
  if (typeof body?.intitule === 'string' && body.intitule.trim()) data.intitule = body.intitule.trim().slice(0, 200)
  if (typeof body?.description === 'string') data.description = body.description.trim().slice(0, 4000) || null
  if (typeof body?.responsable === 'string') data.responsable = body.responsable.trim().slice(0, 120) || null
  if (typeof body?.echeance === 'string') { const d = new Date(body.echeance); data.echeance = body.echeance && !isNaN(d.getTime()) ? d : null }
  if (typeof body?.statut === 'string' && (TRAITEMENT_STATUTS as string[]).includes(body.statut)) data.statut = body.statut
  if (typeof body?.niveauRisqueMaintenu === 'boolean') data.niveauRisqueMaintenu = body.niveauRisqueMaintenu
  if (typeof body?.niveauRisque === 'string') data.niveauRisque = body.niveauRisque.trim().slice(0, 60) || null

  // Rattachement / retrait d'exigences (refs) — cœur du multi-contrôles.
  const current = sanitizeRefs(row.refs)
  if (typeof body?.addRef === 'string' && body.addRef.trim()) {
    data.refs = sanitizeRefs([...current, body.addRef]) as unknown as Prisma.InputJsonValue
  } else if (typeof body?.removeRef === 'string' && body.removeRef.trim()) {
    data.refs = current.filter(r => r !== body.removeRef.trim()) as unknown as Prisma.InputJsonValue
  } else if (Array.isArray(body?.refs)) {
    data.refs = sanitizeRefs(body.refs) as unknown as Prisma.InputJsonValue
  }

  const updated = await prisma.conformiteTraitement.update({
    where: { id }, data,
    select: { id: true, type: true, intitule: true, refs: true, statut: true },
  })
  return NextResponse.json({ traitement: updated })
})

// DELETE /api/organizations/[orgId]/conformite/traitements/[id] — supprime un traitement d'écart de conformité.
export const DELETE = withAccess(access, async (_req, { orgId, params: { id } }) => {
  if (!(await charger(orgId, id))) return introuvable()
  await prisma.conformiteTraitement.delete({ where: { id } })
  return NextResponse.json({ ok: true })
})
