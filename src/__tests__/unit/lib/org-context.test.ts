import { describe, it, expect } from 'vitest'
import {
  rootPath,
  childPath,
  planOrganizationReparenting,
  organizationDeletionBlocker,
  isOrganizationClosureConfirmed,
  isInSubtree,
  isStrictDescendant,
  subtreeIds,
  visibleOrgIds,
  resolveActiveMembership,
  resolvePageOrganizationIds,
  type OrgNode,
  type Membership,
} from '@/lib/org-context'

// Arbre d'exemple :
//   groupe (/g/)
//   ├── entiteA (/g/a/)
//   │   └── filialeA1 (/g/a/a1/)
//   └── entiteB (/g/b/)
//   autreClient (/c/)  ← racine isolée (cas consultant)
const orgs: OrgNode[] = [
  { id: 'g',  path: '/g/',     parentId: null },
  { id: 'a',  path: '/g/a/',   parentId: 'g' },
  { id: 'a1', path: '/g/a/a1/', parentId: 'a' },
  { id: 'b',  path: '/g/b/',   parentId: 'g' },
  { id: 'c',  path: '/c/',     parentId: null },
]

describe('chemins matérialisés', () => {
  it('rootPath englobe l\'id de la racine', () => {
    expect(rootPath('g')).toBe('/g/')
  })
  it('childPath préfixe le chemin du parent', () => {
    expect(childPath('/g/', 'a')).toBe('/g/a/')
    expect(childPath('/g/a/', 'a1')).toBe('/g/a/a1/')
  })
  it('isInSubtree inclut le nœud lui-même et ses descendants', () => {
    expect(isInSubtree('/g/', '/g/')).toBe(true)        // soi-même
    expect(isInSubtree('/g/a/a1/', '/g/')).toBe(true)   // descendant profond
    expect(isInSubtree('/c/', '/g/')).toBe(false)       // autre racine
  })
  it('isStrictDescendant exclut le nœud lui-même', () => {
    expect(isStrictDescendant('/g/', '/g/')).toBe(false)
    expect(isStrictDescendant('/g/a/', '/g/')).toBe(true)
  })
  it('ne confond pas deux racines au préfixe commun', () => {
    // "/g10/" ne doit pas être vu comme descendant de "/g1/"
    expect(isInSubtree('/g10/', '/g1/')).toBe(false)
  })
})

describe('subtreeIds — sous-arbre d\'une organisation', () => {
  it('retourne le nœud et tous ses descendants', () => {
    expect(subtreeIds(orgs, '/g/').sort()).toEqual(['a', 'a1', 'b', 'g'])
  })
  it('un nœud feuille ne contient que lui-même', () => {
    expect(subtreeIds(orgs, '/g/a/a1/')).toEqual(['a1'])
  })
  it('une racine isolée est indépendante', () => {
    expect(subtreeIds(orgs, '/c/')).toEqual(['c'])
  })
})

describe('planOrganizationReparenting — déplacement atomique d’un sous-arbre', () => {
  it('déplace un sous-arbre et recalcule les chemins de tous ses descendants', () => {
    expect(planOrganizationReparenting(orgs, 'a', 'b')).toEqual({
      ok: true,
      pathUpdates: [
        { id: 'a', path: '/g/b/a/' },
        { id: 'a1', path: '/g/b/a/a1/' },
      ],
    })
  })

  it('peut déplacer une organisation à la racine', () => {
    expect(planOrganizationReparenting(orgs, 'a', null)).toEqual({
      ok: true,
      pathUpdates: [
        { id: 'a', path: '/a/' },
        { id: 'a1', path: '/a/a1/' },
      ],
    })
  })

  it('refuse un parent inexistant ou un cycle', () => {
    expect(planOrganizationReparenting(orgs, 'a', 'absente')).toEqual({ ok: false, reason: 'PARENT_NOT_FOUND' })
    expect(planOrganizationReparenting(orgs, 'a', 'a1')).toEqual({ ok: false, reason: 'CYCLE' })
  })
})

describe('organizationDeletionBlocker — suppression sûre', () => {
  it('autorise la suppression d’une organisation sans enfant, membre ni donnée métier', () => {
    expect(organizationDeletionBlocker({ children: 0, memberships: 0, data: 0 })).toBeNull()
  })

  it('privilégie le blocage de la hiérarchie, puis des membres, puis des données', () => {
    expect(organizationDeletionBlocker({ children: 1, memberships: 2, data: 3 })).toBe('HAS_CHILDREN')
    expect(organizationDeletionBlocker({ children: 0, memberships: 2, data: 3 })).toBe('HAS_MEMBERS')
    expect(organizationDeletionBlocker({ children: 0, memberships: 0, data: 3 })).toBe('HAS_DATA')
  })
})

describe('isOrganizationClosureConfirmed — fermeture irréversible', () => {
  it('exige le nom exact de l’organisation avant suppression des données', () => {
    expect(isOrganizationClosureConfirmed('Acme France', 'Acme France')).toBe(true)
    expect(isOrganizationClosureConfirmed('Acme France', 'acme france')).toBe(false)
    expect(isOrganizationClosureConfirmed('Acme France', '')).toBe(false)
  })
})

describe('visibleOrgIds — portée d\'une appartenance', () => {
  it('NODE : uniquement l\'organisation du membre', () => {
    const m: Membership = { organizationId: 'a', role: 'RSSI', scope: 'NODE' }
    expect(visibleOrgIds(m, orgs)).toEqual(['a'])
  })
  it('SUBTREE : l\'organisation et tout son sous-arbre (vision groupe)', () => {
    const m: Membership = { organizationId: 'g', role: 'RSSI', scope: 'SUBTREE' }
    expect(visibleOrgIds(m, orgs).sort()).toEqual(['a', 'a1', 'b', 'g'])
  })
  it('SUBTREE sur une entité intermédiaire ne remonte pas au parent', () => {
    const m: Membership = { organizationId: 'a', role: 'ADMIN', scope: 'SUBTREE' }
    expect(visibleOrgIds(m, orgs).sort()).toEqual(['a', 'a1'])
  })
  it('org inconnue → liste vide (sécurité : ne montre rien)', () => {
    const m: Membership = { organizationId: 'zzz', role: 'ADMIN', scope: 'SUBTREE' }
    expect(visibleOrgIds(m, orgs)).toEqual([])
  })
})

describe('resolveActiveMembership — organisation active', () => {
  const memberships: Membership[] = [
    { organizationId: 'c', role: 'ADMIN', scope: 'NODE' },
    { organizationId: 'g', role: 'RSSI', scope: 'SUBTREE' },
  ]
  it('choisit l\'appartenance demandée si elle existe', () => {
    expect(resolveActiveMembership(memberships, 'g')?.organizationId).toBe('g')
  })
  it('repli sur la première appartenance si aucune demande', () => {
    expect(resolveActiveMembership(memberships)?.organizationId).toBe('c')
  })
  it('repli sur la première si la demande n\'est pas une appartenance (sécurité)', () => {
    expect(resolveActiveMembership(memberships, 'a')?.organizationId).toBe('c')
  })
  it('aucune appartenance → null', () => {
    expect(resolveActiveMembership([], 'g')).toBeNull()
  })
})

describe('resolvePageOrganizationIds — vues consolidées du super-administrateur', () => {
  it('conserve l’organisation sélectionnée pour une vue focalisée', () => {
    expect(resolvePageOrganizationIds('a', { visibleOrgIds: ['a', 'a1'], isSuperAdmin: true })).toEqual(['a'])
  })

  it('consolide les organisations visibles du super-administrateur sans sélection', () => {
    expect(resolvePageOrganizationIds(null, { visibleOrgIds: ['g', 'a', 'a1'], isSuperAdmin: true })).toEqual(['g', 'a', 'a1'])
  })

  it('ne donne jamais un périmètre consolidé à un utilisateur sans organisation active', () => {
    expect(resolvePageOrganizationIds(null, { visibleOrgIds: ['a'], isSuperAdmin: false })).toEqual([])
  })
})
