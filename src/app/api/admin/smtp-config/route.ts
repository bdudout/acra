/**
 * GET  /api/admin/smtp-config  — Lire la configuration SMTP (mot de passe en clair pour l'UI admin)
 * PUT  /api/admin/smtp-config  — Mettre à jour la configuration SMTP
 *
 * Accessible aux ADMIN uniquement. Le mot de passe est chiffré au repos
 * (AES-256-GCM, cf. secret-crypto.ts) et redacté dans l'audit trail.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { auditLog, getClientIp } from '@/lib/logger'
import { encryptSecret, decryptSecret } from '@/lib/secret-crypto'

const SMTPSchema = z.object({
  enabled:     z.boolean().default(false),
  host:        z.string().max(255).nullable().optional(),
  port:        z.coerce.number().int().min(1).max(65535).default(587),
  secure:      z.boolean().default(false),
  username:    z.string().max(255).nullable().optional(),
  password:    z.string().max(512).nullable().optional(),
  fromAddress: z.string().email().max(255).nullable().optional().or(z.literal('')),
  fromName:    z.string().max(120).nullable().optional(),
})

const SMTP_DEFAULTS = {
  id: 'global', enabled: false, host: null, port: 587, secure: false,
  username: null, password: null, fromAddress: null, fromName: 'ACRA',
}

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }), session: null }
  if ((session.user as any).role !== 'ADMIN') return { error: NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 }), session: null }
  return { error: null, session }
}

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config = await (prisma as any).sMTPConfig.upsert({ where: { id: 'global' }, create: SMTP_DEFAULTS, update: {} })
  return NextResponse.json({ ...config, password: decryptSecret(config.password) })
}

export async function PUT(req: NextRequest) {
  const { error, session } = await requireAdmin()
  if (error) return error

  const userId   = (session!.user as any).id
  const userRole = (session!.user as any).role ?? 'ADMIN'

  const body = await req.json()
  const parsed = SMTPSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
  }
  const data = { ...parsed.data, fromAddress: parsed.data.fromAddress || null }

  const auditData = { ...data, password: data.password ? '[REDACTED]' : null }
  // Toute modification de config invalide le dernier test (re-test requis avant usage).
  const toStore = { ...data, password: encryptSecret(data.password), lastTestOk: false, lastTestAt: null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config = await (prisma as any).sMTPConfig.upsert({
    where: { id: 'global' }, create: { id: 'global', ...toStore }, update: toStore,
  })

  await auditLog('SMTP_CONFIG_UPDATED', { userId, userRole, ip: getClientIp(req), details: auditData })
  return NextResponse.json({ ...config, password: decryptSecret(config.password) })
}
