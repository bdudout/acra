import NextAuth from 'next-auth'
import type { NextRequest } from 'next/server'
import { authOptions } from '@/lib/auth'
import { loadSsoOidcConfig, buildSsoProvider } from '@/lib/sso.server'

// Handler dynamique : on ajoute le provider OIDC UNIQUEMENT si un SSO est
// configuré et actif (config d'instance SSOConfig). Sinon, options inchangées →
// comportement identique au login Credentials seul. `authOptions` (base) reste
// la source de vérité pour getServerSession partout ailleurs.
async function buildOptions() {
  const cfg = await loadSsoOidcConfig()
  if (!cfg) return authOptions
  return { ...authOptions, debug: process.env.SSO_DEBUG === '1', providers: [...authOptions.providers, buildSsoProvider(cfg)] }
}

async function handler(req: NextRequest, ctx: { params: Promise<{ nextauth: string[] }> }) {
  const options = await buildOptions()
  const params = await ctx.params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return NextAuth(req as any, { params } as any, options)
}

export { handler as GET, handler as POST }
