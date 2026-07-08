/**
 * demo-server.ts — Helpers serveur du mode démo (accès Prisma).
 *
 * En mode démo (ACRA_DEMO_MODE=true), chaque nouvel inscrit obtient SA propre
 * organisation dont il est ADMIN (jamais SUPER_ADMIN). Cf. [[demo.ts]] pour la
 * logique pure (fenêtres de purge, config).
 */
import { prisma } from '@/lib/prisma'
import { rootPath } from '@/lib/org-context'
import { DEMO_DEFAULTS, isDemoMode, isOrgExpired } from '@/lib/demo'

function slugify(s: string): string {
  const base = s
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'org'
  return base
}

/** Nombre d'organisations démo actives (hors organisation racine « global »). */
export function activeDemoOrgCount(): Promise<number> {
  return prisma.organization.count({ where: { actif: true, id: { not: 'global' } } })
}

/** Vrai si l'instance de démo a atteint son plafond d'organisations actives. */
export async function demoOrgCapReached(): Promise<boolean> {
  return (await activeDemoOrgCount()) >= DEMO_DEFAULTS.maxActiveOrgs
}

/**
 * Crée une organisation démo dédiée à l'utilisateur et l'y rattache comme ADMIN
 * (scope SUBTREE, pour qu'il puisse tester toute la gouvernance de SON périmètre).
 * Slug unique dérivé du nom. Renvoie l'organisation créée.
 */
export async function createDemoOrgForUser(userId: string, displayName: string): Promise<{ id: string; nom: string }> {
  const nom = `Espace de démonstration — ${displayName}`.slice(0, 100)
  // Slug unique (suffixe incrémental si collision).
  const base = slugify(displayName)
  let slug = base
  for (let i = 2; ; i++) {
    const exists = await prisma.organization.findUnique({ where: { slug }, select: { id: true } })
    if (!exists) break
    slug = `${base}-${i}`.slice(0, 40)
    if (i > 200) { slug = `${base}-${Date.now().toString(36)}`.slice(0, 40); break }
  }

  const created = await prisma.organization.create({
    data: { nom, slug, parentId: null, path: '/' },
    select: { id: true, nom: true },
  })
  // Un nœud racine porte le chemin /<id>/ (aligné sur la création d'org standard).
  await prisma.organization.update({ where: { id: created.id }, data: { path: rootPath(created.id) } })

  await prisma.orgMembership.create({
    data: { userId, organizationId: created.id, role: 'ADMIN', scope: 'SUBTREE' },
  })
  return created
}

/**
 * Met à jour `lastActivityAt` d'une organisation (mode démo uniquement) — no-op
 * hors démo pour ne rien changer au comportement de prod. Ne lève jamais.
 */
export async function touchOrgActivity(orgId: string | null | undefined): Promise<void> {
  if (!orgId || orgId === 'global' || !isDemoMode()) return
  await prisma.organization.updateMany({ where: { id: orgId }, data: { lastActivityAt: new Date() } }).catch(() => {})
}

/** Rafraîchit l'activité des organisations d'un utilisateur (à la connexion). */
export async function touchOrgActivityForUser(userId: string): Promise<void> {
  if (!isDemoMode()) return
  const memberships = await prisma.orgMembership.findMany({ where: { userId }, select: { organizationId: true } })
  const ids = memberships.map(m => m.organizationId).filter(id => id !== 'global')
  if (ids.length) {
    await prisma.organization.updateMany({ where: { id: { in: ids } }, data: { lastActivityAt: new Date() } }).catch(() => {})
  }
}

/**
 * Purge les organisations démo expirées (inactivité ou cap dur — cf. isOrgExpired).
 * Ordre : analyses (cascade leurs enfants) → organisation (cascade memberships/
 * config/conformités) → comptes de démo devenus orphelins. Ne touche jamais `global`.
 */
export async function purgeExpiredDemoOrgs(now: Date = new Date()): Promise<{ purged: number; orgIds: string[] }> {
  const orgs = await prisma.organization.findMany({
    where: { actif: true, id: { not: 'global' } },
    select: { id: true, createdAt: true, lastActivityAt: true },
  })
  const expired = orgs.filter(o => isOrgExpired(o, DEMO_DEFAULTS, now))
  const orgIds: string[] = []
  for (const org of expired) {
    const members = await prisma.orgMembership.findMany({ where: { organizationId: org.id }, select: { userId: true } })
    const memberIds = members.map(m => m.userId)
    await prisma.$transaction([
      // Analyse.organizationId est optionnel SANS cascade → suppression explicite
      // (leurs enfants cadrage/sources/scénarios/risques/mesures/révisions cascadent).
      prisma.analyse.deleteMany({ where: { organizationId: org.id } }),
      prisma.organization.delete({ where: { id: org.id } }),
    ])
    // Comptes de démo jetables : supprimer ceux qui n'ont plus aucune organisation.
    for (const uid of memberIds) {
      const remaining = await prisma.orgMembership.count({ where: { userId: uid } })
      if (remaining === 0) await prisma.user.delete({ where: { id: uid } }).catch(() => {})
    }
    orgIds.push(org.id)
  }
  return { purged: orgIds.length, orgIds }
}
