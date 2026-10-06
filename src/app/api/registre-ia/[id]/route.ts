// ─── Un système d'IA du registre : modifier, supprimer ────────────────────────
// Toujours borné à l'organisation active (404 sinon) ; analyse liée vérifiée ; gouvernance seulement, module actif.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditLog, getClientIp } from '@/lib/logger'
import { analysesLiables, iaContext } from '@/lib/registre-ia.server'
import { sanitizeSystemeIa } from '@/lib/registre-ia'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const got = await iaContext({ ecriture: true }); if ('error' in got) return got.error
  const { ctx } = got
  const { id } = await params
  const existing = await prisma.systemeIA.findFirst({ where: { id, organizationId: ctx.orgId } })
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const s = sanitizeSystemeIa({ ...existing, ...(await req.json().catch(() => ({}))) })
  if (!s.nom) return NextResponse.json({ error: 'nom_requis' }, { status: 400 })
  if (s.analyseId && s.analyseId !== existing.analyseId && !(await analysesLiables(ctx)).some(a => a.id === s.analyseId)) return NextResponse.json({ error: 'analyse_inconnue' }, { status: 400 })
  const updated = await prisma.systemeIA.update({ where: { id }, data: s })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: ctx.userId, userRole: ctx.role, organizationId: ctx.orgId, ip: getClientIp(req), details: { scope: 'registre-ia', action: 'update', id } })
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const got = await iaContext({ ecriture: true }); if ('error' in got) return got.error
  const { ctx } = got
  const { id } = await params
  const existing = await prisma.systemeIA.findFirst({ where: { id, organizationId: ctx.orgId }, select: { id: true, nom: true } })
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  await prisma.systemeIA.delete({ where: { id } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: ctx.userId, userRole: ctx.role, organizationId: ctx.orgId, ip: getClientIp(req), details: { scope: 'registre-ia', action: 'delete', id, nom: existing.nom } })
  return NextResponse.json({ ok: true })
}
