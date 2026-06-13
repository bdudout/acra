import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { auditLog, getClientIp } from '@/lib/logger'

const Schema = z.object({
  name: z.string().min(1).max(100),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as any).id
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true },
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
    return NextResponse.json({ error: 'Nom invalide (1–100 caractères requis)' }, { status: 400 })
  }

  const { name } = parsed.data
  const user = await prisma.user.update({
    where: { id: userId },
    data: { name },
    select: { id: true, name: true, email: true },
  })

  await auditLog('PROFILE_UPDATED', {
    userId, userEmail: user.email,
    ip: getClientIp(req),
    details: { action: 'name updated' },
  })

  return NextResponse.json({ ok: true, user })
}
