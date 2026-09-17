/**
 * GET /api/admin/version — version courante de l'application + dernière release
 * publiée sur GitHub (vérification « notify-only » : signale une mise à jour, ne
 * l'installe pas). Réservé au SUPER_ADMIN. Appel GitHub best-effort, mémoïsé.
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { APP_VERSION, GITHUB_REPO } from '@/lib/app-version'
import { updateAvailable } from '@/lib/version-check'

export const dynamic = 'force-dynamic'

interface Latest { version: string | null; name: string | null; url: string | null; publishedAt: string | null }
const CACHE_TTL_MS = 10 * 60 * 1000
let cache: { at: number; latest: Latest; reachable: boolean } | null = null

async function fetchLatestRelease(): Promise<{ latest: Latest; reachable: boolean }> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return { latest: cache.latest, reachable: cache.reachable }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 4000)
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'ACRA-UpdateCheck' },
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const j = await res.json() as { tag_name?: string; name?: string; html_url?: string; published_at?: string }
    const latest: Latest = { version: j.tag_name ?? null, name: j.name ?? null, url: j.html_url ?? null, publishedAt: j.published_at ?? null }
    cache = { at: Date.now(), latest, reachable: true }
    return { latest, reachable: true }
  } catch {
    const latest: Latest = { version: null, name: null, url: null, publishedAt: null }
    cache = { at: Date.now(), latest, reachable: false }
    return { latest, reachable: false }
  } finally {
    clearTimeout(timer)
  }
}

// GET /api/admin/version — version courante de l'application et disponibilité d'une mise à jour (notify-only).
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((session.user as any).role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Réservé au super-administrateur' }, { status: 403 })

  const { latest, reachable } = await fetchLatestRelease()
  return NextResponse.json({
    current: APP_VERSION,
    latest: latest.version,
    latestName: latest.name,
    releaseUrl: latest.url,
    publishedAt: latest.publishedAt,
    updateAvailable: updateAvailable(APP_VERSION, latest.version),
    reachable,
    repo: GITHUB_REPO,
  })
}
