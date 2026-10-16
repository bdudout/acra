import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { LOCALES } from '@/lib/i18n'
import { withAccess } from '@/lib/with-access.server'

// PUT /api/user/locale { locale } — mémorise la langue préférée de l'utilisateur
// connecté (pour localiser les e-mails hors session). Appelé par le sélecteur de
// langue. Silencieux et sans effet si la valeur est inconnue.
export const PUT = withAccess({ org: 'none', rateLimit: { bucket: 'user-locale' } }, async (req, { user }) => {
  const userId = user.id

  const body = await req.json().catch(() => ({}))
  const locale = typeof body.locale === 'string' ? body.locale : ''
  if (!(LOCALES as string[]).includes(locale)) {
    return NextResponse.json({ error: 'Locale invalide' }, { status: 400 })
  }
  await prisma.user.update({ where: { id: userId }, data: { locale } })
  return NextResponse.json({ ok: true, locale })
})
