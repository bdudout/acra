import { prisma } from '@/lib/prisma'
import { resolveBranding, type Branding } from '@/lib/branding'

/**
 * Identité effective de l'application (instance), lue depuis le singleton
 * Configuration et repliée sur les défauts fournis (libellés i18n). Best-effort :
 * en cas d'erreur DB, renvoie les défauts (jamais de crash de la mise en page).
 */
export async function getBranding(defaults: Branding): Promise<Branding> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfg = await (prisma as any).configuration.findUnique({
      where: { id: 'global' },
      select: { appName: true, appBaseline: true },
    })
    return resolveBranding(cfg, defaults)
  } catch {
    return defaults
  }
}
