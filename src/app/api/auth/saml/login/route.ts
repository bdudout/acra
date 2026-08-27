import { NextResponse } from 'next/server'
import { samlActive, isSamlMaintenanceMode } from '@/lib/saml.server'

export const dynamic = 'force-dynamic'

// GET /api/auth/saml/login — initiation de la connexion SAML (AuthnRequest).
// MODE MAINTENANCE : inerte. TODO (IdP dispo) : construire l'AuthnRequest signée
// et rediriger vers samlSsoUrl de l'IdP.
export async function GET() {
  if (isSamlMaintenanceMode() || !(await samlActive())) {
    return NextResponse.json({ error: 'saml_en_maintenance' }, { status: 503 })
  }
  return NextResponse.json({ error: 'saml_non_implemente' }, { status: 501 })
}
