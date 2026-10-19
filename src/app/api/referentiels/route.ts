import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig, upsertOrgConfig } from '@/lib/org-config.server'
import { getServerLocale } from '@/lib/i18n'
import { requireSession } from '@/lib/route-guard.server'
import { withAccess } from '@/lib/with-access.server'
import { validateReferentielInput, cleanReferentielInput } from '@/lib/referentiel'
import { listReferentiels } from '@/lib/referentiel.server'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// Le socle de référentiels & exigences n'est modifiable que par un ADMIN de
// l'organisation (création, édition, activation/désactivation). Les autres rôles
// le consultent en lecture.
import { peutGererReferentiels } from '@/lib/permissions'

// Écriture : organisation active, rôle effectif `peutGererReferentiels`, rate limit.
const ECRITURE = { org: 'active', allow: peutGererReferentiels, rateLimit: { bucket: 'referentiels' } } as const

// GET /api/referentiels — cadres livrés + référentiels custom de l'organisation.
// Sans organisation active : { active: false } (pas de 400) → requireSession.
export async function GET() {
  const g = await requireSession()
  if (g.error) return g.error
  const { role: userRole, activeOrgId: orgId } = await getAnalyseScope(g.user.id, g.user.role)
  if (!orgId) return NextResponse.json({ active: false, referentiels: [] })
  const cfg = await getOrgConfig(orgId)
  if (!cfg.conformiteActive) return NextResponse.json({ active: false, referentiels: [] })

  const locale = await getServerLocale()
  const referentiels = await listReferentiels(orgId, locale)
  return NextResponse.json({ active: true, referentiels, canManage: peutGererReferentiels(userRole) })
}

// POST /api/referentiels — crée un référentiel custom (PSSI, politique…).
export const POST = withAccess(ECRITURE, async (req, { user, role: userRole, orgId }) => {
  const userId = user.id
  const cfg = await getOrgConfig(orgId)
  if (!cfg.conformiteActive) return NextResponse.json({ error: 'module_inactif' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const erreur = validateReferentielInput(body)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanReferentielInput(body)

  const exists = await prisma.referentiel.findFirst({ where: { organizationId: orgId, code: data.code }, select: { id: true } })
  if (exists) return NextResponse.json({ error: 'code_existant' }, { status: 409 })

  const created = await prisma.referentiel.create({
    data: {
      organizationId: orgId, createdBy: userId,
      code: data.code, nom: data.nom, type: data.type, domaine: data.domaine, version: data.version, description: data.description,
      exigences: data.exigences as unknown as Prisma.InputJsonValue,
      missions: data.missions as unknown as Prisma.InputJsonValue,
    },
  })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'referentiel', action: 'create', code: data.code },
  })
  return NextResponse.json(created, { status: 201 })
})

// PATCH /api/referentiels — active/désactive un référentiel (BUILTIN ou CUSTOM)
// pour l'organisation, par code. Stocké dans OrganizationConfig.referentielsDesactives.
// { code: string, actif: boolean }
export const PATCH = withAccess(ECRITURE, async (req, { user, role: userRole, orgId }) => {
  const userId = user.id
  const cfg = await getOrgConfig(orgId)
  if (!cfg.conformiteActive) return NextResponse.json({ error: 'module_inactif' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  if (!code || code.length > 100) return NextResponse.json({ error: 'code_invalide' }, { status: 400 })
  const actif = body.actif !== false // défaut = activer

  // On modifie la liste des DÉSACTIVÉS du row PROPRE de l'org (pas la valeur héritée).
  // OrganizationConfig.id == organizationId (cf. schema).
  const row = await prisma.organizationConfig.findUnique({ where: { id: orgId }, select: { referentielsDesactives: true } })
  const current = Array.isArray(row?.referentielsDesactives)
    ? (row!.referentielsDesactives as unknown[]).filter((c): c is string => typeof c === 'string')
    : []
  const set = new Set(current)
  if (actif) set.delete(code); else set.add(code)
  const next = [...set]

  await upsertOrgConfig(orgId, { referentielsDesactives: next as unknown as Prisma.InputJsonValue })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'referentiel', action: actif ? 'activer' : 'desactiver', code },
  })
  return NextResponse.json({ ok: true, code, actif })
})
