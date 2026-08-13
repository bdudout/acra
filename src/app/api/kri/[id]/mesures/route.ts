import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { type UserRole } from '@/lib/permissions'
import { validateMesureInput, cleanMesureInput } from '@/lib/kri'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// La SAISIE d'une mesure relève de la 1ʳᵉ ligne (le propriétaire relève la valeur).
// Ouverte à tous sauf le LECTEUR (consultation seule).
function peutMesurerKri(role: UserRole): boolean {
  return role !== 'LECTEUR'
}

// POST /api/kri/[id]/mesures — relever une valeur (1ʳᵉ ligne).
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole

  const { id } = await params
  const scope = await getAnalyseScope(userId, instanceRole)
  // Rôle EFFECTIF dans l'organisation active (pas le rôle d'instance) → A01/CWE-863.
  const userRole = scope.role
  if (!peutMesurerKri(userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const orgIds = scope.scope.visibleOrgIds
  const spansAll = scope.scope.isSuperAdmin && orgIds.length === 0
  const kri = await prisma.kri.findFirst({
    where: { id, ...(spansAll ? {} : { organizationId: { in: orgIds } }) },
    select: { id: true, organizationId: true },
  })
  if (!kri) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
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
}
