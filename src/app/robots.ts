import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://acra-ebios.app'

/**
 * robots.txt dynamique — Next.js App Router
 * Autorise l'indexation des pages publiques, bloque les routes API et admin.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/auth/signin', '/auth/register'],
        disallow: ['/api/', '/admin/', '/dashboard', '/analyses', '/configuration'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
