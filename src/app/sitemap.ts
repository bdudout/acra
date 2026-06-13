import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://acra-ebios.app'

/**
 * sitemap.xml dynamique — Next.js App Router
 * Liste les pages publiques statiques pour l'indexation SEO.
 * Les pages authentifiées (dashboard, analyses…) sont exclues.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: `${BASE_URL}/auth/signin`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/auth/register`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/legal/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${BASE_URL}/legal/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.2,
    },
  ]
}
