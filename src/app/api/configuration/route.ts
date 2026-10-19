import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildDefaultConfig } from '@/lib/configuration-defaults'
import { canEditConfig } from '@/lib/permissions'
import { getAnalyseScope } from '@/lib/org-context.server'
import { resolveScaleConfigTargetId } from '@/lib/configuration-server'
import { withAccess } from '@/lib/with-access.server'
import type { SessionUser } from '@/lib/route-guard.server'

// Id de la Configuration à manipuler selon le mode (SHARED → racine ; PER_ORG → org active).
async function scaleTarget(user: SessionUser): Promise<string> {
  const { activeOrgId } = await getAnalyseScope(user.id, user.role)
  return resolveScaleConfigTargetId(activeOrgId)
}

// Toutes les méthodes fonctionnent sans organisation active (échelle racine) : org: 'none',
// rôle EFFECTIF résolu dans le handler.

// GET /api/configuration — récupérer l'échelle de l'organisation active (selon le
// mode de portée). Accessible à tout utilisateur authentifié ; renvoie les valeurs
// par défaut tant qu'aucune configuration n'a été enregistrée pour la cible.
export const GET = withAccess({ org: 'none' }, async (_req, { user }) => {
  const targetId = await scaleTarget(user)
  const config = await prisma.configuration.findUnique({ where: { id: targetId } })
  if (!config) {
    return NextResponse.json({ ...buildDefaultConfig(4), isDefault: true })
  }
  return NextResponse.json(config)
})

// PUT /api/configuration — créer ou mettre à jour l'échelle commune (ADMIN uniquement)
export const PUT = withAccess({ org: 'none', rateLimit: { bucket: 'configuration' } }, async (req, { user }) => {
  // Rôle EFFECTIF dans l'org active (pas le rôle d'instance) → A01/CWE-863.
  const { role: userRole } = await getAnalyseScope(user.id, user.role)
  if (!canEditConfig({ id: user.id, role: userRole })) {
    return NextResponse.json({ error: 'Seul un administrateur peut modifier les échelles' }, { status: 403 })
  }

  const body = await req.json()
  const { nbNiveaux, echelleGravite, echelleVraisemblance, seuilsMatrice, matriceMode, matriceQualitative } = body

  if (!echelleGravite || !echelleVraisemblance) {
    return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
  }

  const mode = matriceMode === 'QUALITATIVE' ? 'QUALITATIVE' : 'QUANTITATIVE'
  const data = {
    nbNiveaux: nbNiveaux ?? 4,
    echelleGravite,
    echelleVraisemblance,
    seuilsMatrice,
    matriceMode: mode,
    matriceQualitative: mode === 'QUALITATIVE' ? (matriceQualitative ?? null) : null,
  }

  const targetId = await scaleTarget(user)
  const config = await prisma.configuration.upsert({
    where: { id: targetId },
    create: { id: targetId, ...data },
    update: data,
  })

  return NextResponse.json(config)
})

// DELETE /api/configuration — remettre l'échelle commune aux valeurs par défaut (ADMIN uniquement)
export const DELETE = withAccess({ org: 'none', rateLimit: { bucket: 'configuration' } }, async (_req, { user }) => {
  const { role: userRole } = await getAnalyseScope(user.id, user.role)
  if (!canEditConfig({ id: user.id, role: userRole })) {
    return NextResponse.json({ error: 'Seul un administrateur peut réinitialiser les échelles' }, { status: 403 })
  }

  const targetId = await scaleTarget(user)
  await prisma.configuration.deleteMany({ where: { id: targetId } })
  return NextResponse.json({ ok: true })
})
