// ─── Registre du sous-traitant (RGPD art. 30 §2) : une ligne ──────────────────
// PATCH : mise à jour fusionnée et nettoyée ; DELETE : suppression. Ligne d'une autre organisation → 404.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { contexteSousTraitance } from '@/lib/ropa-sous-traitance.server'
import { sanitizeSousTraitance } from '@/lib/ropa-sous-traitance'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  const c = await contexteSousTraitance()
  if ('error' in c) return c.error
  const existante = await prisma.traitementSousTraitance.findFirst({ where: { id, organizationId: c.orgId } })
  if (!existante) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const s = sanitizeSousTraitance({ ...existante, ...(await req.json().catch(() => ({}))) })
  if (!s.clientNom) return NextResponse.json({ error: 'client_requis' }, { status: 400 })
  const maj = await prisma.traitementSousTraitance.update({ where: { id }, data: s })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: c.userId, userRole: c.role, organizationId: c.orgId, ip: getClientIp(req), details: { scope: 'ropa-sous-traitance', action: 'update', id } })
  return NextResponse.json(maj)
}

export async function DELETE(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  const c = await contexteSousTraitance()
  if ('error' in c) return c.error
  const existante = await prisma.traitementSousTraitance.findFirst({ where: { id, organizationId: c.orgId } })
  if (!existante) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  await prisma.traitementSousTraitance.delete({ where: { id } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: c.userId, userRole: c.role, organizationId: c.orgId, ip: getClientIp(req), details: { scope: 'ropa-sous-traitance', action: 'delete', id } })
  return NextResponse.json({ ok: true })
}
