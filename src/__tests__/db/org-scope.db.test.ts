/**
 * Portée d'organisation sur vraie base (audit 2026-09-30, T12) : les fonctions
 * d'accès ne chargent plus toutes les organisations de l'instance, seulement
 * celles des appartenances et leurs sous-arbres. Ce test fige le comportement
 * (NODE / SUBTREE / rôle effectif / isolation) au milieu d'organisations étrangères.
 */
import { describe, it, expect, vi, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { makeUser } from './helpers'

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }))

import { getAccessibleOrgIds, getEffectiveRoleForOrg, resolveOrgContext } from '@/lib/org-context.server'

afterAll(async () => { await prisma.$disconnect() })

let treeSeq = 0
async function tree() {
  const tag = `s${Date.now().toString(36)}${treeSeq++}`
  // groupe ─┬─ filiale1 ── usine
  //         └─ filiale2
  const mk = (id: string, path: string, parentId: string | null) =>
    prisma.organization.create({ data: { id: `${tag}-${id}`, nom: id, slug: `${tag}-${id}`, path, parentId: parentId && `${tag}-${parentId}` } })
  const g = `/${tag}-groupe/`
  await mk('groupe', g, null)
  await mk('filiale1', `${g}${tag}-filiale1/`, 'groupe')
  await mk('usine', `${g}${tag}-filiale1/${tag}-usine/`, 'filiale1')
  await mk('filiale2', `${g}${tag}-filiale2/`, 'groupe')
  // Bruit : 300 organisations étrangères (dont une au préfixe trompeur).
  await prisma.organization.createMany({ data: Array.from({ length: 300 }, (_, i) => ({ id: `${tag}-x${i}`, nom: `x${i}`, slug: `${tag}-x${i}`, path: `/${tag}-x${i}/` })) })
  await prisma.organization.create({ data: { id: `${tag}-groupe2`, nom: 'piège', slug: `${tag}-groupe2`, path: `/${tag}-groupe2/` } })
  return (id: string) => `${tag}-${id}`
}

describe('portée d\'organisation (T12)', () => {
  it('SUBTREE sur filiale1 : filiale1 + usine, rien d\'autre ; rôle hérité dans usine', async () => {
    const id = await tree()
    const u = await makeUser('ANALYSTE')
    await prisma.orgMembership.create({ data: { userId: u.id, organizationId: id('filiale1'), role: 'RSSI', scope: 'SUBTREE' } })
    const acc = await getAccessibleOrgIds(u.id, 'ANALYSTE')
    expect(acc.all).toBe(false)
    expect(acc.ids.sort()).toEqual([id('filiale1'), id('usine')].sort())
    expect(await getEffectiveRoleForOrg(u.id, 'ANALYSTE', id('usine'))).toBe('RSSI')
    expect(await getEffectiveRoleForOrg(u.id, 'ANALYSTE', id('filiale2'))).toBeNull()
    expect(await getEffectiveRoleForOrg(u.id, 'ANALYSTE', id('groupe'))).toBeNull()
    const ctx = await resolveOrgContext(u.id, 'ANALYSTE')
    expect(ctx.activeOrgId).toBe(id('filiale1'))
    expect(ctx.visibleOrgIds.sort()).toEqual([id('filiale1'), id('usine')].sort())
  })

  it('SUBTREE sur le groupe : tout l\'arbre, mais pas l\'organisation au préfixe trompeur', async () => {
    const tag2 = await tree()
    const u = await makeUser('ANALYSTE')
    await prisma.orgMembership.create({ data: { userId: u.id, organizationId: tag2('groupe'), role: 'ADMIN', scope: 'SUBTREE' } })
    const acc = await getAccessibleOrgIds(u.id, 'ANALYSTE')
    expect(acc.ids.sort()).toEqual(['groupe', 'filiale1', 'usine', 'filiale2'].map(tag2).sort())
    expect(acc.ids).not.toContain(tag2('groupe2'))
  })

  it('NODE : uniquement le nœud ; appartenance directe prioritaire sur l\'héritée', async () => {
    const id = await tree()
    const u = await makeUser('ANALYSTE')
    await prisma.orgMembership.createMany({ data: [
      { userId: u.id, organizationId: id('groupe'), role: 'LECTEUR', scope: 'SUBTREE' },
      { userId: u.id, organizationId: id('usine'), role: 'RSSI', scope: 'NODE' },
    ] })
    expect(await getEffectiveRoleForOrg(u.id, 'ANALYSTE', id('usine'))).toBe('RSSI')
    expect(await getEffectiveRoleForOrg(u.id, 'ANALYSTE', id('filiale2'))).toBe('LECTEUR')
  })

  it('sans appartenance : rien', async () => {
    await tree()
    const u = await makeUser('ANALYSTE')
    expect((await getAccessibleOrgIds(u.id, 'ANALYSTE')).ids).toEqual([])
    expect((await resolveOrgContext(u.id, 'ANALYSTE')).visibleOrgIds).toEqual([])
  })
})
