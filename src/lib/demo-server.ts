/**
 * demo-server.ts — Helpers serveur du mode démo (accès Prisma).
 *
 * En mode démo (ACRA_DEMO_MODE=true), chaque nouvel inscrit obtient SA propre
 * organisation dont il est ADMIN (jamais SUPER_ADMIN). Cf. [[demo.ts]] pour la
 * logique pure (fenêtres de purge, config).
 */
import { prisma } from '@/lib/prisma'
import { rootPath } from '@/lib/org-context'
import { DEMO_DEFAULTS } from '@/lib/demo'

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
