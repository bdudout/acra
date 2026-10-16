import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getOrgConfig, upsertOrgConfig } from '@/lib/org-config.server'
import { isAdminRole } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import { planGabarit, MODULE_KEYS, type ModuleKey } from '@/lib/gabarits'
import { sanitizeVocabulaire } from '@/lib/vocabulaire'
import { sanitizeIncidentsConfig } from '@/lib/incidents-config'
import { CATALOGUE_REGIMES, resolveRegimes } from '@/lib/notification-regimes'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// POST /api/personnalisation/gabarit — { id, dryRun? } : applique un gabarit sectoriel (ADMIN). Avec
// dryRun, renvoie seulement l'aperçu des changements. Rien n'est verrouillé : tout reste modifiable.
export const POST = withAccess({ org: 'active', allow: isAdminRole, rateLimit: { bucket: 'personnalisation-gabarit' } }, async (req, { user, role, orgId }) => {
  const userId = user.id

  const body = await req.json().catch(() => ({}))
  const cfg = await getOrgConfig(orgId)
  const modules = Object.fromEntries(MODULE_KEYS.map(k => [k, Boolean((cfg as unknown as Record<string, unknown>)[k])])) as Record<ModuleKey, boolean>
  const raw = sanitizeIncidentsConfig(cfg.incidentsConfig)
  const regimesActifs = resolveRegimes(raw.regimes).filter(r => r.actif && !r.custom).map(r => r.code)
  const vocabulaire = sanitizeVocabulaire(cfg.vocabulaire)
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { secteursActivite: true } })
  const secteurs = Array.isArray(org?.secteursActivite) ? org.secteursActivite.filter((x): x is string => typeof x === 'string') : []
  const plan = planGabarit(String(body.id ?? ''), { modules, regimesActifs, vocabulaire, secteurs })
  if (!plan) return NextResponse.json({ error: 'gabarit_inconnu' }, { status: 400 })
  if (body.dryRun === true) return NextResponse.json({ changements: plan.changements })

  // Régimes de catalogue : activation exacte du gabarit, délais surchargés conservés ; régimes personnalisés intacts.
  const existants = new Map(raw.regimes.map(r => [r.code, r]))
  const regimes = [
    ...CATALOGUE_REGIMES.map(r => ({ ...(existants.get(r.code) ?? { code: r.code }), actif: plan.patch.regimesActifs.includes(r.code) })),
    ...raw.regimes.filter(r => !CATALOGUE_REGIMES.some(c => c.code === r.code)),
  ]
  const update = { ...plan.patch.modules, incidentsConfig: { ...raw, regimes } as unknown as Prisma.InputJsonValue, vocabulaire: plan.patch.vocabulaire as Prisma.InputJsonValue }
  await upsertOrgConfig(orgId, update)
  if (plan.patch.secteurs) await prisma.organization.update({ where: { id: orgId }, data: { secteursActivite: plan.patch.secteurs } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole: role, organizationId: orgId, targetId: orgId, targetType: 'organization', ip: getClientIp(req),
    details: { scope: 'gabarit', id: body.id, changements: plan.changements.length },
  })
  return NextResponse.json({ changements: plan.changements })
})
