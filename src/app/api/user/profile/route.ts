import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { auditLog, getClientIp } from '@/lib/logger'

const Schema = z.object({
  name: z.string().min(1).max(100),
  // Téléphone optionnel (format E.164 souple, ex. +33612345678) — pour le MFA par SMS
  phone: z.string().trim().max(32).regex(/^\+?[0-9 .()-]*$/, 'Téléphone invalide').optional(),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as any).id
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, phone: true },
  })
  return NextResponse.json({ user })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const userId = (session.user as any).id
  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides (nom 1–100 caractères, téléphone optionnel)' }, { status: 400 })
  }

  const { name, phone } = parsed.data
  const user = await prisma.user.update({
    where: { id: userId },
    data: { name, ...(phone !== undefined ? { phone: phone.trim() || null } : {}) },
    select: { id: true, name: true, email: true, phone: true },
  })

  await auditLog('PROFILE_UPDATED', {
    userId, userEmail: user.email,
    ip: getClientIp(req),
    details: { action: 'profile updated' },
  })

  return NextResponse.json({ ok: true, user })
}
