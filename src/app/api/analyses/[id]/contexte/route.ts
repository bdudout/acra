// ─── Contexte d'appréciation d'une analyse à saisie directe ──────────────────
// PATCH — met à jour périmètre + objectifs/critères (upsert Cadrage). Réservé aux
// analyses dont la méthode autorise la saisie directe (ISO 31000 / ISO 27005 /
// NIST) ; même garde que `/risques` (accès, méthode, édition F01, gel).
// Session et rate limit : withAccess (org 'none') ; garde métier : guardDirectRisk, inchangée.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAccess } from '@/lib/with-access.server'
import { auditLog, getClientIp } from '@/lib/logger'
import { guardDirectRisk } from '@/lib/analyse-direct-risk.server'
import { sanitizeContexte } from '@/lib/analyse-contexte'

export const dynamic = 'force-dynamic'

// PATCH /api/analyses/:id/contexte — met à jour le contexte (périmètre + objectifs).
export const PATCH = withAccess({ org: 'none', rateLimit: { bucket: 'analyse-contexte' } }, async (req, { user, params }) => {
  const g = await guardDirectRisk(params.id, user.id, user.role)
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })

  const contexte = sanitizeContexte(await req.json().catch(() => ({})))

  await prisma.cadrage.upsert({
    where: { analyseId: g.analyse.id },
    create: { analyseId: g.analyse.id, perimetre: contexte.perimetre, objectifsEtude: contexte.objectifsEtude },
    update: { perimetre: contexte.perimetre, objectifsEtude: contexte.objectifsEtude },
  })
  await prisma.analyse.update({ where: { id: g.analyse.id }, data: { updatedAt: new Date() } })

  await auditLog('WORKSHOP_SAVED', {
    userId: user.id, userRole: user.role, organizationId: g.analyse.organizationId,
    targetId: g.analyse.id, targetType: 'analyse', ip: getClientIp(req),
    details: { scope: 'contexte-direct', action: 'update' },
  })

  return NextResponse.json({ contexte })
})
