import { describe, it, expect } from 'vitest'
import { rollupConformiteTree, type RollupOrg, type RollupConfInput } from '../../../lib/conformite-rollup'

// Arbre : groupe (/g/) → direction (/g/d/) → entité (/g/d/e/)
const orgs: RollupOrg[] = [
  { id: 'g', path: '/g/' },
  { id: 'd', path: '/g/d/' },
  { id: 'e', path: '/g/d/e/' },
]

describe('rollupConformiteTree', () => {
  it('agrège (pool) le sous-arbre par référentiel', () => {
    const cells: RollupConfInput[] = [
      { organizationId: 'e', referentiel: 'ISO27001', conforme: 8, partiel: 1, nonConforme: 1, na: 0, total: 93 },
      { organizationId: 'd', referentiel: 'ISO27001', conforme: 2, partiel: 0, nonConforme: 2, na: 1, total: 93 },
    ]
    const r = rollupConformiteTree(orgs, cells)
    // Entité e : seulement ses propres données (8/(8+1+1)=80%)
    expect(r.e.ISO27001.taux).toBe(80)
    expect(r.e.ISO27001.orgCount).toBe(1)
    // Direction d : pool d + e → conforme 10, pertinents 14 → 71%
    expect(r.d.ISO27001).toMatchObject({ conforme: 10, partiel: 1, nonConforme: 3, na: 1, taux: 71, orgCount: 2 })
    // Groupe g : idem d (tout le sous-arbre)
    expect(r.g.ISO27001.conforme).toBe(10)
    expect(r.g.ISO27001.orgCount).toBe(2)
  })

  it('sépare les référentiels et gère un org sans données', () => {
    const cells: RollupConfInput[] = [
      { organizationId: 'e', referentiel: 'NIST_CSF', conforme: 5, partiel: 0, nonConforme: 5, na: 0, total: 106 },
    ]
    const r = rollupConformiteTree(orgs, cells)
    expect(r.g.NIST_CSF.taux).toBe(50)
    expect(r.e.ISO27001).toBeUndefined()     // pas de données ISO pour e
    expect(Object.keys(r.d)).toEqual(['NIST_CSF'])
  })

  it('taux = 0 si aucun contrôle pertinent (que des NA)', () => {
    const r = rollupConformiteTree(orgs, [
      { organizationId: 'g', referentiel: 'ISO27001', conforme: 0, partiel: 0, nonConforme: 0, na: 3, total: 93 },
    ])
    expect(r.g.ISO27001.taux).toBe(0)
    expect(r.g.ISO27001.evalues).toBe(3)
  })

  it('met en commun plusieurs suivis (socle org-wide + entités) d\'un même org × référentiel', () => {
    // Multi-suivis (portée ENTITE) : le dashboard émet une cellule par suivi
    // pour la MÊME organisation. Le roll-up doit les mettre en commun (comme il
    // le fait pour des sous-organisations) et ne compter l'org qu'une fois.
    const cells: RollupConfInput[] = [
      { organizationId: 'g', referentiel: 'ISO27001', conforme: 6, partiel: 0, nonConforme: 0, na: 0, total: 93 }, // socle org-wide
      { organizationId: 'g', referentiel: 'ISO27001', conforme: 2, partiel: 1, nonConforme: 1, na: 0, total: 93 }, // suivi entité A
    ]
    const r = rollupConformiteTree(orgs, cells)
    // Pool : conforme 8, pertinents 10 → 80% ; total commun conservé (max, pas la somme).
    expect(r.g.ISO27001).toMatchObject({ conforme: 8, partiel: 1, nonConforme: 1, taux: 80, total: 93 })
    // Une seule organisation contribue, même avec deux suivis.
    expect(r.g.ISO27001.orgCount).toBe(1)
  })

  it('ignore les cellules d\'organisations inconnues', () => {
    const r = rollupConformiteTree(orgs, [
      { organizationId: 'inconnu', referentiel: 'ISO27001', conforme: 9, partiel: 0, nonConforme: 0, na: 0, total: 93 },
    ])
    expect(r.g.ISO27001).toBeUndefined()
  })
})
