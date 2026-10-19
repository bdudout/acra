import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope, roleSurRessource } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { peutDefinir2eLigne, type UserRole, optionsDefinition, type OptionsDefinition } from '@/lib/permissions'
import { validateControleInput, cleanControleInput } from '@/lib/controle'
import { champsL3Modification } from '@/lib/controle-l3'
import { sanitizeChampsConfig, fusionnerChamps, avecChampsVisibles } from '@/lib/champs-perso'
import { Prisma } from '@prisma/client'
import { verifierRattachements } from '@/lib/controle-rattachements.server'
import { auditLog, getClientIp } from '@/lib/logger'
import { withAccess } from '@/lib/with-access.server'
import type { SessionUser } from '@/lib/route-guard.server'

export const dynamic = 'force-dynamic'

// org: 'none' : le contrôle est cherché dans tout le périmètre visible (sans org active requise).
const access = { org: 'none', rateLimit: { bucket: 'controles' } } as const

function peutDefinir(role: UserRole, opts: OptionsDefinition): boolean {
  return peutDefinir2eLigne(role, opts)
}

async function loadInScope(user: SessionUser, id: string) {
  const userId = user.id
  const scope = await getAnalyseScope(userId, user.role)
  const orgIds = scope.scope.isSuperAdmin ? null : scope.scope.visibleOrgIds
  const controle = await prisma.controle.findFirst({
    where: { id, ...(orgIds ? { organizationId: { in: orgIds } } : {}) },
    select: { id: true, organizationId: true, champs: true },
  })
  if (!controle) return { error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) }
  // Rôle EFFECTIF dans l'organisation DE LA RESSOURCE, jamais celui de l'org active (CWE-863).
  const userRole = await roleSurRessource(userId, user.role, controle.organizationId)
  const cfg = await getOrgConfig(controle.organizationId)
  if (!cfg.controlePermanentActive) return { error: NextResponse.json({ error: 'Module non activé' }, { status: 403 }) }
  return { error: null, userId, userRole, orgId: controle.organizationId, secondeLigneActive: cfg.secondeLigneActive, definition: optionsDefinition(cfg), champsPersonnalises: cfg.champsPersonnalises, champsExistants: controle.champs }
}

// PATCH /api/controles/[id] — modifier un contrôle (2ᵉ ligne). Mise à jour PARTIELLE.
export const PATCH = withAccess(access, async (req, { user, params: { id } }) => {
  const c = await loadInScope(user, id)
  if (c.error) return c.error
  if (!peutDefinir(c.userRole, c.definition)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const erreur = validateControleInput(body)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanControleInput(body)

  if (data.processusId) {
    const p = await prisma.processus.findFirst({ where: { id: data.processusId, organizationId: c.orgId }, select: { id: true } })
    if (!p) return NextResponse.json({ error: 'processus_invalide' }, { status: 400 })
  }
  if (data.riskItemId) {
    const r = await prisma.riskItem.findFirst({ where: { id: data.riskItemId, organizationId: c.orgId }, select: { id: true } })
    if (!r) return NextResponse.json({ error: 'risque_invalide' }, { status: 400 })
  }

  const ratt = await verifierRattachements(body, c.orgId)
  if (!ratt.ok) return NextResponse.json({ error: ratt.error }, { status: 400 })

  // N'écrire que les champs présents (un PATCH ne doit rien effacer par omission).
  const partiel = Object.fromEntries(
    (Object.keys(data) as (keyof typeof data)[]).filter(k => k in body).map(k => [k, data[k]]),
  ) as Partial<typeof data>

  const l3 = champsL3Modification(body, { evaluateurId: c.userId, now: new Date() })
  const defsChamps = sanitizeChampsConfig(c.champsPersonnalises).controle ?? []
  const champsMaj = 'champs' in body ? { champs: fusionnerChamps(defsChamps, c.champsExistants, body.champs, c.userRole) as unknown as Prisma.InputJsonValue } : {}
  const updated = await prisma.controle.update({ where: { id }, data: { ...partiel, ...ratt.data, ...(l3 as Prisma.ControleUncheckedUpdateInput), ...champsMaj } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: c.userId, userRole: c.userRole, organizationId: c.orgId, ip: getClientIp(req),
    details: { scope: 'controle', action: 'update', id },
  })
  return NextResponse.json(avecChampsVisibles(updated, defsChamps, c.userRole))
})

// DELETE /api/controles/[id] — supprimer un contrôle et son historique (2ᵉ ligne).
export const DELETE = withAccess(access, async (req, { user, params: { id } }) => {
  const c = await loadInScope(user, id)
  if (c.error) return c.error
  if (!peutDefinir(c.userRole, c.definition)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  await prisma.controle.delete({ where: { id } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: c.userId, userRole: c.userRole, organizationId: c.orgId, ip: getClientIp(req),
    details: { scope: 'controle', action: 'delete', id },
  })
  return NextResponse.json({ ok: true })
})
