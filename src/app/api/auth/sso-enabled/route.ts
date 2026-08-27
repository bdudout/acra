import { NextResponse } from 'next/server'
import { ssoEnabled } from '@/lib/sso.server'

export const dynamic = 'force-dynamic'

// GET /api/auth/sso-enabled — indique si un SSO OIDC est actif (public, sans secret).
// Sert à afficher le bouton « Se connecter via SSO » sur la page de connexion.
export async function GET() {
  return NextResponse.json({ enabled: await ssoEnabled() })
}
