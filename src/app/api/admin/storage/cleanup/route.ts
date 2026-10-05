// ─── Nettoyage du cache sans impact (SUPER_ADMIN) — docs/specs/stockage-supervision-nettoyage.md, lot B ───
// GET : aperçu (comptes + octets estimés) et réglages · POST : exécution (catégories assainies) · PUT : réglages d'instance.
// L'audit ne contient que des comptes, jamais de contenu.

import { NextRequest, NextResponse } from 'next/server'
import { requireInstanceAdmin } from '@/lib/route-guard.server'
import { defaultAutoCategories, sanitizeCategories } from '@/lib/cache-cleanup'
import { executeInstanceCleanup, getCleanupSettings, previewInstanceCleanup, saveCleanupSettings } from '@/lib/cache-cleanup.instance.server'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await requireInstanceAdmin(req)
  if (g.error) return g.error
  const raw = req.nextUrl.searchParams.get('categories')
  const categories = raw ? sanitizeCategories(raw.split(',')) : defaultAutoCategories()
  const [preview, settings] = await Promise.all([previewInstanceCleanup(categories), getCleanupSettings()])
  return NextResponse.json({ preview, settings })
}

export async function POST(req: NextRequest) {
  const g = await requireInstanceAdmin(req)
  if (g.error) return g.error
  const body = await req.json().catch(() => ({})) as { categories?: unknown }
  const categories = Array.isArray(body.categories) ? sanitizeCategories(body.categories) : defaultAutoCategories()
  const r = await executeInstanceCleanup(categories)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 409 })
  await auditLog('INSTANCE_CACHE_CLEANED', { userId: g.user.id, userRole: g.user.role, targetType: 'instance', ip: getClientIp(req), details: { counts: r.counts, trigger: 'manual' } })
  return NextResponse.json({ counts: r.counts })
}

export async function PUT(req: NextRequest) {
  const g = await requireInstanceAdmin(req)
  if (g.error) return g.error
  const body = await req.json().catch(() => ({})) as { autoCleanup?: unknown; categories?: unknown }
  if (typeof body.autoCleanup !== 'boolean') return NextResponse.json({ error: 'invalid_settings' }, { status: 400 })
  await saveCleanupSettings({ autoCleanup: body.autoCleanup, categories: body.categories })
  return NextResponse.json({ settings: await getCleanupSettings() })
}
