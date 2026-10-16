import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getOrgConfig } from '@/lib/org-config.server'
import { peutGererReferentiels } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import { cleanReferentielInput } from '@/lib/referentiel'
import { buildPolitiqueDefaut } from '@/lib/politique-defaut'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// POST /api/referentiels/politique-defaut — initialise la politique de sécurité par
// défaut (socle DORA + ISO 27001/27002) SI l'organisation n'a encore aucune
// politique (référentiel de type PSSI/POLITIQUE). Idempotent.
export const POST = withAccess({ org: 'active', allow: peutGererReferentiels, rateLimit: { bucket: 'referentiels-politique-defaut' } }, async (req, { user, role, orgId }) => {
  const userId = user.id
  const cfg = await getOrgConfig(orgId)
  if (!cfg.conformiteActive) return NextResponse.json({ error: 'module_inactif' }, { status: 403 })

  // Ne rien faire s'il existe déjà une politique/stratégie propre à l'organisation.
  const existante = await prisma.referentiel.findFirst({
    where: { organizationId: orgId, type: { in: ['PSSI', 'POLITIQUE'] } },
    select: { id: true, code: true },
  })
  if (existante) return NextResponse.json({ error: 'politique_existante', existante }, { status: 409 })

  const data = cleanReferentielInput(buildPolitiqueDefaut())
  const created = await prisma.referentiel.create({
    data: {
      organizationId: orgId, createdBy: userId,
      code: data.code, nom: data.nom, type: data.type, version: data.version, description: data.description,
      exigences: data.exigences as unknown as Prisma.InputJsonValue,
      missions: data.missions as unknown as Prisma.InputJsonValue,
    },
  })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole: role, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'referentiel', action: 'seed-politique-defaut', code: data.code },
  })
  return NextResponse.json(created, { status: 201 })
})
