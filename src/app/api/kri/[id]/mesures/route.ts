import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope, roleSurRessource } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { type UserRole } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import { validateMesureInput, cleanMesureInput } from '@/lib/kri'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// La SAISIE d'une mesure relève de la 1ʳᵉ ligne (le propriétaire relève la valeur).
// Ouverte à tous sauf le LECTEUR (consultation seule).
function peutMesurerKri(role: UserRole): boolean {
  return role !== 'LECTEUR'
}

// POST /api/kri/[id]/mesures — relever une valeur (1ʳᵉ ligne).
// org: 'none' — le KRI est cherché dans tout le périmètre visible (pas d'organisation active exigée).
export const POST = withAccess({ org: 'none', rateLimit: { bucket: 'kri-mesures' } }, async (req, { user, params: { id } }) => {
  const userId = user.id
  const scope = await getAnalyseScope(userId, user.role)
  const orgIds = scope.scope.visibleOrgIds
  const spansAll = scope.scope.isSuperAdmin && orgIds.length === 0
  const kri = await prisma.kri.findFirst({
    where: { id, ...(spansAll ? {} : { organizationId: { in: orgIds } }) },
    select: { id: true, organizationId: true },
  })
  if (!kri) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  // Rôle EFFECTIF dans l'organisation DE LA RESSOURCE, jamais celui de l'org active (CWE-863).
  const userRole = await roleSurRessource(userId, user.role, kri.organizationId)
  if (!peutMesurerKri(userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const cfg = await getOrgConfig(kri.organizationId)
  if (!cfg.kriActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const erreur = validateMesureInput(body)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanMesureInput(body)

  const mesure = await prisma.kriMesure.create({
    data: {
      kriId: id,
      organizationId: kri.organizationId,
      valeur: data.valeur,
      ...(data.dateMesure ? { dateMesure: data.dateMesure } : {}),
      commentaire: data.commentaire,
      saisiPar: userId,
    },
  })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: kri.organizationId, ip: getClientIp(req),
    details: { scope: 'kri-mesure', action: 'create', kriId: id, id: mesure.id },
  })
  return NextResponse.json(mesure, { status: 201 })
})
