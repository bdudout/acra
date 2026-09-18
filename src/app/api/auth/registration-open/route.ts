import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isSignupOpen } from '@/lib/demo-server'
import { resolveSignupDecision } from '@/lib/demo'

export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/registration-open — l'inscription publique est-elle ouverte ?
 * Public (aucune donnée sensible). `open` vaut vrai si l'inscription self-service
 * est ouverte (démo OU toggle SUPER_ADMIN). Toute instance vide reste fermée :
 * son premier administrateur est provisionné localement, jamais via cette route.
 */
export async function GET() {
  try {
    const [signupOpen, userCount] = await Promise.all([isSignupOpen(), prisma.user.count()])
    const isFirstUser = userCount === 0
    const decision = resolveSignupDecision({ isFirstUser, signupOpen })
    return NextResponse.json({ open: decision.allowed, isFirstUser: false })
  } catch {
    return NextResponse.json({ open: false, isFirstUser: false })
  }
}
