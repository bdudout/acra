import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import type { SessionUser } from '@/lib/route-guard.server'
import { withAccess } from '@/lib/with-access.server'
import { validateKriInput, cleanKriInput, evaluerKri, tendanceKri, type KriSens } from '@/lib/kri'
import { peutDefinirKri } from '@/lib/permissions'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// org: 'none' — le KRI est cherché dans tout le périmètre visible (pas d'organisation active exigée).
async function loadInScope(user: SessionUser, id: string) {
  const userId = user.id
  const scope = await getAnalyseScope(userId, user.role)
  // Rôle EFFECTIF dans l'organisation active (pas le rôle d'instance) → A01/CWE-863.
  const userRole = scope.role
  const orgIds = scope.scope.visibleOrgIds
  const spansAll = scope.scope.isSuperAdmin && orgIds.length === 0
  const kri = await prisma.kri.findFirst({
    where: { id, ...(spansAll ? {} : { organizationId: { in: orgIds } }) },
    select: { id: true, organizationId: true },
  })
  if (!kri) return { error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) }
  const cfg = await getOrgConfig(kri.organizationId)
  if (!cfg.kriActive) return { error: NextResponse.json({ error: 'Module non activé' }, { status: 403 }) }
  return { error: null, userId, userRole, kri, secondeLigneActive: cfg.secondeLigneActive }
}

// GET /api/kri/[id] — détail + historique des mesures + statut/tendance.
export const GET = withAccess({ org: 'none' }, async (_req, { user, params: { id } }) => {
  const c = await loadInScope(user, id)
  if (c.error) return c.error

  const kri = await prisma.kri.findUnique({
    where: { id },
    include: {
      mesures: { orderBy: { dateMesure: 'desc' }, select: { id: true, valeur: true, dateMesure: true, commentaire: true } },
      riskItem: { select: { intitule: true } },
    },
  })
  if (!kri) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const { mesures, riskItem, ...entete } = kri
  const derniere = mesures[0]?.valeur ?? null
  const precedente = mesures[1]?.valeur ?? null
  return NextResponse.json({
    kri: { ...entete, riskIntitule: riskItem?.intitule ?? null },
    mesures,
    statut: evaluerKri(derniere, { sens: kri.sens as KriSens, seuilAlerte: kri.seuilAlerte, seuilCritique: kri.seuilCritique }),
    tendance: tendanceKri(derniere, precedente, kri.sens as KriSens),
  })
})

// PATCH /api/kri/[id] — modifier la définition (gouvernance).
export const PATCH = withAccess({ org: 'none', rateLimit: { bucket: 'kri' } }, async (req, { user, params: { id } }) => {
  const c = await loadInScope(user, id)
  if (c.error) return c.error
  if (!peutDefinirKri(c.userRole, { secondeLigneActive: c.secondeLigneActive })) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const erreur = validateKriInput(body, { partial: true })
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanKriInput(body)

  if ('riskItemId' in body && data.riskItemId) {
    const r = await prisma.riskItem.findFirst({ where: { id: data.riskItemId, organizationId: c.kri.organizationId }, select: { id: true } })
    if (!r) return NextResponse.json({ error: 'risque_invalide' }, { status: 400 })
  }

  // Mise à jour PARTIELLE : on n'écrit que les champs présents dans le corps.
  const partiel = Object.fromEntries(
    (Object.keys(data) as (keyof typeof data)[]).filter(k => k in body).map(k => [k, data[k]]),
  ) as Partial<typeof data>

  const updated = await prisma.kri.update({ where: { id }, data: partiel })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: c.userId, userRole: c.userRole, organizationId: c.kri.organizationId, ip: getClientIp(req),
    details: { scope: 'kri', action: 'update', id },
  })
  return NextResponse.json(updated)
})

// DELETE /api/kri/[id] — supprimer un KRI et ses mesures (gouvernance).
export const DELETE = withAccess({ org: 'none', rateLimit: { bucket: 'kri' } }, async (req, { user, params: { id } }) => {
  const c = await loadInScope(user, id)
  if (c.error) return c.error
  if (!peutDefinirKri(c.userRole, { secondeLigneActive: c.secondeLigneActive })) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  await prisma.kri.delete({ where: { id } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: c.userId, userRole: c.userRole, organizationId: c.kri.organizationId, ip: getClientIp(req),
    details: { scope: 'kri', action: 'delete', id },
  })
  return NextResponse.json({ ok: true })
})
