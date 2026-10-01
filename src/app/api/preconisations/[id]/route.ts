// GET : une préconisation (2ᵉ ligne, ou son responsable). PATCH / DELETE : 2ᵉ ligne.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditLog, getClientIp } from '@/lib/logger'
import { chargerPreconisation, refuse } from '@/lib/questionnaire.server'
import { cleanConstatInput, validateConstatInput } from '@/lib/audit'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  const c = await chargerPreconisation(id)
  if (!c.ctx) return c.response!
  return NextResponse.json({ preconisation: c.preconisation })
}

export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  const c = await chargerPreconisation(id)
  if (!c.ctx) return c.response!
  if (!c.ctx.canDefine) return refuse(403, 'forbidden')
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const err = validateConstatInput(body, { partial: true })
  if (err) return refuse(400, err)
  const clean = cleanConstatInput({ intitule: c.preconisation.intitule, ...body })
  const data: Record<string, unknown> = {}
  for (const k of ['intitule', 'description', 'recommandation', 'criticite', 'responsableAction', 'referentielCode', 'exigenceRef'] as const) if (k in body) data[k] = clean[k]
  // L'échéance se modifie ici avant tout report ; ensuite, seul le circuit de report la change.
  if ('echeance' in body && !(Array.isArray(c.preconisation.reports) && c.preconisation.reports.length)) { data.echeance = clean.echeance; data.echeanceInitiale = clean.echeance }
  const preconisation = await prisma.preconisation.update({ where: { id }, data })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: c.ctx.userId, userRole: c.ctx.role, organizationId: c.ctx.orgId, ip: getClientIp(req), details: { scope: 'preconisation', action: 'update', id, fields: Object.keys(data) } })
  return NextResponse.json({ preconisation })
}

export async function DELETE(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  const c = await chargerPreconisation(id)
  if (!c.ctx) return c.response!
  if (!c.ctx.canDefine) return refuse(403, 'forbidden')
  await prisma.preconisation.delete({ where: { id } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: c.ctx.userId, userRole: c.ctx.role, organizationId: c.ctx.orgId, ip: getClientIp(req), details: { scope: 'preconisation', action: 'delete', id } })
  return NextResponse.json({ ok: true })
}
