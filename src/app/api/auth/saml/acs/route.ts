import { NextResponse } from 'next/server'
import { samlActive, isSamlMaintenanceMode } from '@/lib/saml.server'

export const dynamic = 'force-dynamic'

// POST /api/auth/saml/acs — Assertion Consumer Service (SAML).
// MODE MAINTENANCE : inerte tant que le SSO SAML n'est pas activé ET câblé.
// TODO (quand IdP disponible) : ajouter @node-saml, vérifier la signature de
// l'assertion, extraire les attributs (extractSamlClaims), appliquer le même
// provisioning JIT + mapping de rôles que OIDC, puis émettre la session NextAuth.
export async function POST() {
  if (isSamlMaintenanceMode() || !(await samlActive())) {
    return NextResponse.json({ error: 'saml_en_maintenance' }, { status: 503 })
  }
  // Non atteint tant que le câblage @node-saml n'est pas en place.
  return NextResponse.json({ error: 'saml_non_implemente' }, { status: 501 })
}
