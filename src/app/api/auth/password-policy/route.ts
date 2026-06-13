/**
 * GET /api/auth/password-policy
 *
 * Public endpoint — returns the active password policy so that the
 * registration and password-change forms can display validation rules
 * without requiring an authenticated session.
 *
 * Only exposes the shape fields needed by the frontend (no sensitive data).
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DEFAULT_POLICY } from '@/lib/password-policy'

export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stored = await (prisma as any).passwordPolicy.findUnique({ where: { id: 'global' } })
    if (stored) {
      return NextResponse.json({
        minLength:        stored.minLength,
        requireUppercase: stored.requireUppercase,
        requireLowercase: stored.requireLowercase,
        requireNumbers:   stored.requireNumbers,
        requireSpecial:   stored.requireSpecial,
        maxAgeDays:       stored.maxAgeDays,
      })
    }
  } catch { /* table not yet migrated */ }

  return NextResponse.json(DEFAULT_POLICY)
}
