/**
 * GET /api/admin/version — version courante de l'application + dernière release
 * publiée sur GitHub (vérification « notify-only » : signale une mise à jour, ne
 * l'installe pas). Réservé au SUPER_ADMIN. Appel GitHub best-effort, mémoïsé.
 */
import { NextResponse } from 'next/server'
import { APP_VERSION, GITHUB_REPO } from '@/lib/app-version'
import { describeVersion } from '@/lib/version-check'
import { readUpdateAgent } from '@/lib/update-request.server'
import { snapshotImpacts, failedDbRetentionDays } from '@/lib/snapshot-impact.server'
import { requireInstanceAdmin } from '@/lib/route-guard.server'

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
  // Réglage d'INSTANCE → SUPER_ADMIN (garde commune, lib/route-guard.server.ts).
  const guard = await requireInstanceAdmin()
  if (guard.error) return guard.error

  const [{ latest, reachable }, agent] = await Promise.all([fetchLatestRelease(), readUpdateAgent()])
  const impacts = await snapshotImpacts(agent.snapshots)
  // Canal (stable / bêta) et version validée de base (#185) : une bêta en avance sur
  // la dernière stable n'est pas « en retard » ; une bêta rattrapée l'est.
  const state = describeVersion(APP_VERSION, latest.version)
  return NextResponse.json({
    current: APP_VERSION,
    channel: state.channel,
    base: state.base,
    agentAvailable: agent.agentAvailable,
    updateStatus: agent.status,
    snapshots: agent.snapshots,
    impacts,
    offsite: agent.offsite,
    backup: agent.backup,
    offsiteMaxAgeHours: Number.isInteger(Number(process.env.ACRA_OFFSITE_MAX_AGE_HOURS)) && Number(process.env.ACRA_OFFSITE_MAX_AGE_HOURS) > 0 ? Number(process.env.ACRA_OFFSITE_MAX_AGE_HOURS) : 48,
    failedDbRetentionDays: failedDbRetentionDays(process.env),
    run: agent.run,
    latest: latest.version,
    latestName: latest.name,
    releaseUrl: latest.url,
    publishedAt: latest.publishedAt,
    updateAvailable: state.updateAvailable,
    reachable,
    repo: GITHUB_REPO,
    deployConfigured: Boolean(process.env.GITHUB_DEPLOY_TOKEN),
  })
}
