// ─── Registre du sous-traitant (RGPD art. 30 §2) ──────────────────────────────
// GET : lignes de l'organisation active avec la complétude du §2. POST : nouvelle ligne (un responsable du traitement
// client). Module activable ; DPO / ADMIN ; écritures journalisées. Logique pure : lib/ropa-sous-traitance.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { contexteSousTraitance } from '@/lib/ropa-sous-traitance.server'
import { champsManquantsArt30_2, sanitizeSousTraitance } from '@/lib/ropa-sous-traitance'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  const c = await contexteSousTraitance()
  if ('error' in c) return c.error
  const rows = await prisma.traitementSousTraitance.findMany({ where: { organizationId: c.orgId }, orderBy: [{ clientNom: 'asc' }] })
  return NextResponse.json({ lignes: rows.map(r => ({ ...r, manquants: champsManquantsArt30_2(sanitizeSousTraitance(r)) })) })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const c = await contexteSousTraitance()
  if ('error' in c) return c.error
  const s = sanitizeSousTraitance(await req.json().catch(() => ({})))
  if (!s.clientNom) return NextResponse.json({ error: 'client_requis' }, { status: 400 })
  const cree = await prisma.traitementSousTraitance.create({ data: { ...s, organizationId: c.orgId, createdBy: c.userId } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: c.userId, userRole: c.role, organizationId: c.orgId, ip: getClientIp(req), details: { scope: 'ropa-sous-traitance', action: 'create', id: cree.id } })
  return NextResponse.json(cree, { status: 201 })
}
