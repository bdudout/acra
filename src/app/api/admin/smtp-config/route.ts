/**
 * GET  /api/admin/smtp-config  — Lire la configuration SMTP (mot de passe en clair pour l'UI admin)
 * PUT  /api/admin/smtp-config  — Mettre à jour la configuration SMTP
 *
 * Accessible aux ADMIN uniquement. Le mot de passe est chiffré au repos
 * (AES-256-GCM, cf. secret-crypto.ts) et redacté dans l'audit trail.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { auditLog, getClientIp } from '@/lib/logger'
import { maskSecret, resolveSubmittedSecret, SECRET_PLACEHOLDER } from '@/lib/secret-crypto'
import { requireInstanceAdmin } from '@/lib/route-guard.server'

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


// GET /api/admin/smtp-config — lit la configuration SMTP d'envoi d'e-mails de l'instance (SUPER_ADMIN).
export async function GET() {
  const { error } = await requireInstanceAdmin()
  if (error) return error
  const config = await prisma.sMTPConfig.upsert({ where: { id: 'global' }, create: SMTP_DEFAULTS, update: {} })
  return NextResponse.json({ ...config, password: maskSecret(config.password) })
}

// PUT /api/admin/smtp-config — met à jour la configuration SMTP (hôte, port, identifiants) — SUPER_ADMIN.
export async function PUT(req: NextRequest) {
  const { error, session } = await requireInstanceAdmin()
  if (error) return error

  const userId   = (session!.user as any).id
  const userRole = (session!.user as any).role ?? 'ADMIN'

  const body = await req.json()
  const parsed = SMTPSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
  }
  const data = { ...parsed.data, fromAddress: parsed.data.fromAddress || null }

  const auditData = { ...data, password: data.password && data.password !== SECRET_PLACEHOLDER ? '[REDACTED]' : undefined }
  // Toute modification de config invalide le dernier test (re-test requis avant usage).
  const current = await prisma.sMTPConfig.findUnique({ where: { id: 'global' }, select: { password: true } })
  const toStore = { ...data, password: resolveSubmittedSecret(data.password, current?.password), lastTestOk: false, lastTestAt: null }

  const config = await prisma.sMTPConfig.upsert({
    where: { id: 'global' }, create: { id: 'global', ...toStore }, update: toStore,
  })

  await auditLog('SMTP_CONFIG_UPDATED', { userId, userRole, ip: getClientIp(req), details: auditData })
  return NextResponse.json({ ...config, password: maskSecret(config.password) })
}
