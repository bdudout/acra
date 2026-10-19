import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canEditAnalyse } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import { cleanPartiePrenante } from '@/lib/workshop-sanitize'
import { sanitizeTierLinks } from '@/lib/tier-registry.server'

/**
 * Tiers d'une analyse directe (Projet 360 inclus), isolés du scénario EBIOS A3.
 * Accès à l'analyse (404 sinon) puis droit d'édition sur le rôle effectif (403). Pas de contrôle de gel (inchangé).
 */
export const PUT = withAccess({ org: { analyse: 'id' }, rateLimit: { bucket: 'analyse-tiers' } }, async (req, { user, role, analyse, params: { id } }) => {
  if (!canEditAnalyse({ id: user.id, role }, { userId: analyse.userId, accesUtilisateurs: analyse.accesUtilisateurs })) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const body = await req.json().catch(() => null)
  if (!Array.isArray(body?.partiesPrenantes) || body.partiesPrenantes.length > 200) return NextResponse.json({ error: 'Liste de tiers invalide' }, { status: 400 })
  const parties = await sanitizeTierLinks<ReturnType<typeof cleanPartiePrenante>>(body.partiesPrenantes.map((p: Record<string, unknown>) => cleanPartiePrenante(p, id)), analyse.organizationId)
  await prisma.$transaction([
    prisma.partiePrenante.deleteMany({ where: { analyseId: id } }),
    ...(parties.rows.length ? [prisma.partiePrenante.createMany({ data: parties.rows })] : []),
  ])
  return NextResponse.json({ ok: true, ...(parties.dropped ? { tierLinksDropped: parties.dropped } : {}) })
})
