/**
 * GET  /api/admin/siem-config  — Lire la configuration SIEM (en-tête d'auth en clair pour l'UI admin).
 * PUT  /api/admin/siem-config  — Mettre à jour la configuration SIEM.
 *
 * Réservé au SUPER_ADMIN (réglage d'INSTANCE). L'en-tête d'autorisation est
 * chiffré au repos (AES-256-GCM) et redacté dans l'audit trail.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { auditLog, getClientIp } from '@/lib/logger'
import { encryptSecret, decryptSecret } from '@/lib/secret-crypto'
import { cleanSiemCategories, isValidSiemEndpoint, SIEM_CATEGORIES } from '@/lib/siem'
import { invalidateSiemCache } from '@/lib/siem.server'

const SiemSchema = z.object({
  enabled: z.boolean().default(false),
  endpoint: z.string().max(2000).nullable().optional(),
  authHeader: z.string().max(1024).nullable().optional(),
  categories: z.array(z.string()).default([]),
  includeStdout: z.boolean().default(true),
})

const DEFAULTS = { id: 'global', enabled: false, endpoint: null, authHeader: null, categories: [], includeStdout: true }

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }), session: null }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((session.user as any).role !== 'SUPER_ADMIN') return { error: NextResponse.json({ error: 'Réservé au super-administrateur' }, { status: 403 }), session: null }
  return { error: null, session }
}

export async function GET() {
  const { error } = await requireSuperAdmin()
  if (error) return error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config = await (prisma as any).siemConfig.upsert({ where: { id: 'global' }, create: DEFAULTS, update: {} })
  return NextResponse.json({ ...config, authHeader: decryptSecret(config.authHeader) ?? '', categoriesDisponibles: SIEM_CATEGORIES })
}

export async function PUT(req: NextRequest) {
  const { error, session } = await requireSuperAdmin()
  if (error) return error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session!.user as any).id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userRole = (session!.user as any).role ?? 'SUPER_ADMIN'

  const parsed = SiemSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
  const d = parsed.data
  const endpoint = d.endpoint?.trim() || null
  // Si activé, l'endpoint doit être une URL http(s) valide.
  if (d.enabled && !isValidSiemEndpoint(endpoint ?? '')) return NextResponse.json({ error: 'endpoint_invalide' }, { status: 400 })

  const categories = cleanSiemCategories(d.categories)
  const toStore = {
    enabled: d.enabled, endpoint, authHeader: encryptSecret(d.authHeader?.trim() || null),
    categories, includeStdout: d.includeStdout,
    lastError: null,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config = await (prisma as any).siemConfig.upsert({
    where: { id: 'global' }, create: { id: 'global', ...toStore }, update: toStore,
  })
  invalidateSiemCache()

  await auditLog('SIEM_CONFIG_UPDATED', {
    userId, userRole, ip: getClientIp(req),
    details: { enabled: d.enabled, endpoint, categories, includeStdout: d.includeStdout, authHeader: d.authHeader ? '[REDACTED]' : null },
  })
  return NextResponse.json({ ...config, authHeader: decryptSecret(config.authHeader) ?? '', categoriesDisponibles: SIEM_CATEGORIES })
}
