import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiRequest } from '@/lib/api-auth.server'
import { auditLog, getClientIp } from '@/lib/logger'
import { scimUserToAcra, applyScimPatch, scimError, type ScimPatchOp } from '@/lib/scim'
import { scimGetById, scimUpdate, scimDeprovision } from '@/lib/scim.server'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }
const SCIM_CT = { 'Content-Type': 'application/scim+json' }
const scimJson = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: SCIM_CT })

// GET /api/scim/v2/Users/[id]
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await authenticateApiRequest(req, 'provision')
  if (!auth.ok) return scimJson(scimError(auth.status, auth.error), auth.status)
  const { id } = await params
  const resource = await scimGetById(auth.organizationId, id)
  return resource ? scimJson(resource) : scimJson(scimError(404, 'introuvable'), 404)
}

// PUT /api/scim/v2/Users/[id] — remplacement complet (nom, active).
export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await authenticateApiRequest(req, 'provision')
  if (!auth.ok) return scimJson(scimError(auth.status, auth.error), auth.status)
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const fields = scimUserToAcra(body)
  if (!fields) return scimJson(scimError(400, 'ressource invalide'), 400)
  const resource = await scimUpdate(auth.organizationId, id, { active: fields.active, name: fields.name })
  if (!resource) return scimJson(scimError(404, 'introuvable'), 404)
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: `apikey:${auth.keyId}`, userRole: 'API', organizationId: auth.organizationId, ip: getClientIp(req), details: { scope: 'scim', action: 'replace', id, active: fields.active } })
  return scimJson(resource)
}

// PATCH /api/scim/v2/Users/[id] — surtout active=false (déprovisioning Azure AD).
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await authenticateApiRequest(req, 'provision')
  if (!auth.ok) return scimJson(scimError(auth.status, auth.error), auth.status)
  const { id } = await params
  const current = await scimGetById(auth.organizationId, id)
  if (!current) return scimJson(scimError(404, 'introuvable'), 404)
  const body = await req.json().catch(() => ({}))
  const ops: ScimPatchOp[] = Array.isArray(body?.Operations) ? body.Operations : []
  const next = applyScimPatch({ active: current.active, name: current.name?.formatted ?? null }, ops)
  const resource = await scimUpdate(auth.organizationId, id, next)
  if (!resource) return scimJson(scimError(404, 'introuvable'), 404)
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: `apikey:${auth.keyId}`, userRole: 'API', organizationId: auth.organizationId, ip: getClientIp(req), details: { scope: 'scim', action: 'patch', id, active: next.active } })
  return scimJson(resource)
}

// DELETE /api/scim/v2/Users/[id] — déprovisionne (retire l'appartenance à l'org).
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await authenticateApiRequest(req, 'provision')
  if (!auth.ok) return scimJson(scimError(auth.status, auth.error), auth.status)
  const { id } = await params
  const ok = await scimDeprovision(auth.organizationId, id)
  if (!ok) return scimJson(scimError(404, 'introuvable'), 404)
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: `apikey:${auth.keyId}`, userRole: 'API', organizationId: auth.organizationId, ip: getClientIp(req), details: { scope: 'scim', action: 'deprovision', id } })
  return new NextResponse(null, { status: 204 })
}
