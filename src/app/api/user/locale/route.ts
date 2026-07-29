import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { LOCALES } from '@/lib/i18n'

// PUT /api/user/locale { locale } — mémorise la langue préférée de l'utilisateur
// connecté (pour localiser les e-mails hors session). Appelé par le sélecteur de
// langue. Silencieux et sans effet si la valeur est inconnue.
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id

  const body = await req.json().catch(() => ({}))
  const locale = typeof body.locale === 'string' ? body.locale : ''
  if (!(LOCALES as string[]).includes(locale)) {
    return NextResponse.json({ error: 'Locale invalide' }, { status: 400 })
  }
  await prisma.user.update({ where: { id: userId }, data: { locale } })
  return NextResponse.json({ ok: true, locale })
}
