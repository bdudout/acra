import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/scim/v2/ServiceProviderConfig — capacités SCIM annoncées à l'IdP.
export async function GET() {
  const body = {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
    documentationUri: '/api/scim/v2/ServiceProviderConfig',
    patch: { supported: true },
    bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
    filter: { supported: true, maxResults: 200 },
    changePassword: { supported: false },
    sort: { supported: false },
    etag: { supported: false },
    authenticationSchemes: [
      { type: 'oauthbearertoken', name: 'Bearer', description: "Clé d'API ACRA à scope provision" },
    ],
  }
  return NextResponse.json(body, { headers: { 'Content-Type': 'application/scim+json' } })
}
