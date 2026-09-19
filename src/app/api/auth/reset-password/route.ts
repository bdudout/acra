import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { auditLog, getClientIp } from '@/lib/logger'
import { DEFAULT_POLICY, validatePassword, type PasswordPolicyShape } from '@/lib/password-policy'
import { hashResetToken, isResetTokenUsable } from '@/lib/password-reset'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'

const schema = z.object({ token: z.string().min(32).max(256), password: z.string().min(1).max(100) })

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_RESET_LINK' }, { status: 400 })
  const tokenHash = hashResetToken(parsed.data.token)
  const limit = rateLimit(`password-reset-consume:${tokenHash}`, 5, 15 * 60 * 1000)
  if (!limit.allowed) return NextResponse.json({ error: 'TOO_MANY_ATTEMPTS' }, { status: 429, headers: rateLimitHeaders(limit.remaining, limit.resetAt) })

  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash }, include: { user: { select: { id: true, email: true } } } })
  if (!record || !isResetTokenUsable(record)) return NextResponse.json({ error: 'INVALID_RESET_LINK' }, { status: 400 })
  const stored = await prisma.passwordPolicy.findUnique({ where: { id: 'global' } })
  const policy: PasswordPolicyShape = stored ? {
    minLength: stored.minLength, requireUppercase: stored.requireUppercase, requireLowercase: stored.requireLowercase,
    requireNumbers: stored.requireNumbers, requireSpecial: stored.requireSpecial, maxAgeDays: stored.maxAgeDays,
  } : DEFAULT_POLICY
  if (validatePassword(parsed.data.password, policy).length) return NextResponse.json({ error: 'PASSWORD_POLICY' }, { status: 400 })

  const passwordHash = await bcrypt.hash(parsed.data.password, 12)
  const usedAt = new Date()
  const consumed = await prisma.$transaction(async tx => {
    const changed = await tx.passwordResetToken.updateMany({ where: { id: record.id, usedAt: null, expiresAt: { gt: usedAt } }, data: { usedAt } })
    if (changed.count !== 1) return false
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash, passwordChangedAt: usedAt, mustChangePassword: false } })
    await tx.passwordResetToken.updateMany({ where: { userId: record.userId, usedAt: null }, data: { usedAt } })
    return true
  })
  if (!consumed) return NextResponse.json({ error: 'INVALID_RESET_LINK' }, { status: 400 })
  await auditLog('PASSWORD_RESET_COMPLETED', { userId: record.user.id, userEmail: record.user.email, ip: getClientIp(req) })
  return NextResponse.json({ ok: true })
}
