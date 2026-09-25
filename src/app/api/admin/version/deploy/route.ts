import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { APP_VERSION, GITHUB_REPO } from '@/lib/app-version'
import { canDispatchReleaseDeployment } from '@/lib/version-check'
import { auditLog, getClientIp } from '@/lib/logger'

const bodySchema = z.object({ version: z.string().regex(/^v?\d+\.\d+\.\d+$/) })

/** Déclenche le workflow GitHub qualifié ; les secrets SSH restent exclusivement dans GitHub. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if ((session.user as { role?: string }).role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Réservé au super-administrateur' }, { status: 403 })
  const token = process.env.GITHUB_DEPLOY_TOKEN
  if (!token) return NextResponse.json({ error: 'Le déploiement en un clic n’est pas configuré. Utilisez la procédure manuelle.' }, { status: 503 })
  let body: z.infer<typeof bodySchema>
  try { body = bodySchema.parse(await req.json()) } catch { return NextResponse.json({ error: 'Requête invalide' }, { status: 400 }) }

  const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' }
  const release = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, { headers })
  if (!release.ok) return NextResponse.json({ error: 'Impossible de vérifier la release GitHub.' }, { status: 502 })
  const latest = (await release.json() as { tag_name?: string }).tag_name ?? null
  if (!canDispatchReleaseDeployment(APP_VERSION, latest, body.version) || !latest) return NextResponse.json({ error: 'Cette release n’est pas la dernière mise à jour disponible.' }, { status: 400 })

  const dispatched = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/deploy-release.yml/dispatches`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: 'main', inputs: { version: latest } }),
  })
  if (!dispatched.ok) return NextResponse.json({ error: 'GitHub a refusé le lancement du déploiement.' }, { status: 502 })
  await auditLog('ADMIN_ACTION', { userId: (session.user as { id: string }).id, targetType: 'release', targetId: latest, ip: getClientIp(req), details: { scope: 'release-deploy', version: latest } })
  return NextResponse.json({ started: true, workflowUrl: `https://github.com/${GITHUB_REPO}/actions/workflows/deploy-release.yml` })
}
