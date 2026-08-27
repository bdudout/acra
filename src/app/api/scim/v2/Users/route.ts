import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiRequest } from '@/lib/api-auth.server'
import { auditLog, getClientIp } from '@/lib/logger'
import { scimUserToAcra, parseScimUserNameFilter, scimListResponse, scimError } from '@/lib/scim'
import { scimFindByEmail, scimProvision } from '@/lib/scim.server'

export const dynamic = 'force-dynamic'

const SCIM_CT = { 'Content-Type': 'application/scim+json' }
const scimJson = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: SCIM_CT })

// GET /api/scim/v2/Users?filter=userName eq "x" — liste (0 ou 1) dans l'org de la clé.
export async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req, 'provision')
  if (!auth.ok) return scimJson(scimError(auth.status, auth.error), auth.status)

  const filter = req.nextUrl.searchParams.get('filter')
  const email = parseScimUserNameFilter(filter)
  if (filter && !email) return scimJson(scimListResponse([], 0)) // filtre non supporté → vide
  const resources = email ? [await scimFindByEmail(auth.organizationId, email)].filter(Boolean) : []
  return scimJson(scimListResponse(resources, resources.length))
}

// POST /api/scim/v2/Users — provisionne un compte dans l'org de la clé.
export async function POST(req: NextRequest) {
  const auth = await authenticateApiRequest(req, 'provision')
  if (!auth.ok) return scimJson(scimError(auth.status, auth.error), auth.status)

  const body = await req.json().catch(() => ({}))
  const fields = scimUserToAcra(body)
  if (!fields) return scimJson(scimError(400, 'userName (e-mail) requis'), 400)

  const { conflict, resource } = await scimProvision(auth.organizationId, fields)
  if (conflict) return scimJson(scimError(409, 'utilisateur déjà présent dans l’organisation'), 409)
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: `apikey:${auth.keyId}`, userRole: 'API', organizationId: auth.organizationId, ip: getClientIp(req),
    details: { scope: 'scim', action: 'provision', email: fields.email },
  })
  return scimJson(resource, 201)
}
