import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isSignupOpen } from '@/lib/demo-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/registration-open — l'inscription publique est-elle ouverte ?
 * Public (aucune donnée sensible). `open` vaut vrai si l'inscription self-service
 * est ouverte (démo OU toggle SUPER_ADMIN) OU si aucun compte n'existe encore
 * (amorçage du 1er compte = exploitant, toujours autorisé).
 */
export async function GET() {
  try {
    const [open, userCount] = await Promise.all([isSignupOpen(), prisma.user.count()])
    const isFirstUser = userCount === 0
    return NextResponse.json({ open: open || isFirstUser, isFirstUser })
  } catch {
    return NextResponse.json({ open: false, isFirstUser: false })
  }
}
