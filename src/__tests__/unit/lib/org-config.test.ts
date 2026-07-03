import { describe, it, expect } from 'vitest'
import {
  resolveOrgConfig,
  DEFAULT_ORG_CONFIG,
  type RawOrgConfig,
} from '@/lib/org-config'

// Un row de config partiel (les champs absents = défaut Prisma : [] / {} / bool).
function row(partial: Partial<RawOrgConfig>): RawOrgConfig {
  return {
    entitesMesures: [],
    typesImpacts: [],
    referentielsActifs: [],
    strategiesTraitement: [],
    exemplesAteliers: {},
    echellesEcosysteme: {},
    qualificationActive: false,
    qualificationObligatoire: false,
    conformiteActive: false,
    conformiteNiveau: 'ANALYSE',
    conformiteSnapshotMode: 'MANUEL',
    conseilsAteliersActive: true,
    ...partial,
  }
}

describe('resolveOrgConfig — héritage de configuration par organisation', () => {
  it('chaîne vide → valeurs par défaut', () => {
    const c = resolveOrgConfig([])
    expect(c.entitesMesures).toEqual(DEFAULT_ORG_CONFIG.entitesMesures)
    expect(c.conseilsAteliersActive).toBe(true)
    expect(c.qualificationActive).toBe(false)
    expect(c.echellesEcosysteme).toEqual({})
  })

  it('un champ JSON vide hérite de l\'ancêtre (le plus proche non vide gagne)', () => {
    // chaîne SELF-first : [enfant, racine]
    const enfant = row({ entitesMesures: [] })                       // vide → hérite
    const racine = row({ entitesMesures: ['DSI', 'Métier'] })
    expect(resolveOrgConfig([enfant, racine]).entitesMesures).toEqual(['DSI', 'Métier'])
  })

  it('un champ JSON renseigné par l\'enfant prime sur l\'ancêtre', () => {
    const enfant = row({ entitesMesures: ['Sécurité'] })
    const racine = row({ entitesMesures: ['DSI'] })
    expect(resolveOrgConfig([enfant, racine]).entitesMesures).toEqual(['Sécurité'])
  })

  it('les booléens : la 1ʳᵉ organisation possédant un row dans la chaîne gagne', () => {
    // L'enfant a un row qui désactive les conseils ; il prime sur la racine.
    const enfant = row({ conseilsAteliersActive: false })
    const racine = row({ conseilsAteliersActive: true })
    expect(resolveOrgConfig([enfant, racine]).conseilsAteliersActive).toBe(false)
  })

  it('qualificationObligatoire : défaut false, hérité comme un booléen', () => {
    expect(resolveOrgConfig([]).qualificationObligatoire).toBe(false)
    const enfant = row({ qualificationObligatoire: true })
    const racine = row({ qualificationObligatoire: false })
    expect(resolveOrgConfig([enfant, racine]).qualificationObligatoire).toBe(true)
  })

  it('conformiteNiveau / conformiteSnapshotMode : défaut, puis 1re valeur non vide de la chaîne', () => {
    expect(resolveOrgConfig([]).conformiteNiveau).toBe('ANALYSE')
    expect(resolveOrgConfig([]).conformiteSnapshotMode).toBe('MANUEL')
    const enfant = row({ conformiteNiveau: 'ORGANISATION', conformiteSnapshotMode: 'AUTO' })
    const racine = row({ conformiteNiveau: 'ANALYSE', conformiteSnapshotMode: 'MANUEL' })
    expect(resolveOrgConfig([enfant, racine]).conformiteNiveau).toBe('ORGANISATION')
    expect(resolveOrgConfig([enfant, racine]).conformiteSnapshotMode).toBe('AUTO')
  })

  it('un nœud sans row (null) est ignoré et hérite de l\'ancêtre', () => {
    const racine = row({ qualificationActive: true, entitesMesures: ['DSI'] })
    // chaîne : [enfant=null, parent=null, racine]
    const c = resolveOrgConfig([null, null, racine])
    expect(c.qualificationActive).toBe(true)
    expect(c.entitesMesures).toEqual(['DSI'])
  })

  it('héritage multi-niveaux : échelles écosystème de la racine, exemples de l\'entité', () => {
    const echelles = { dependance: { niveaux: [{ valeur: 1, nom: 'Nulle' }] } }
    const racine = row({ echellesEcosysteme: echelles })
    const entite = row({ exemplesAteliers: { valeursMetier: [{ nom: 'Paie' }] } })
    // chaîne SELF-first : [entite, racine]
    const c = resolveOrgConfig([entite, racine])
    expect(c.echellesEcosysteme).toEqual(echelles)              // hérité de la racine
    expect(c.exemplesAteliers).toEqual({ valeursMetier: [{ nom: 'Paie' }] }) // propre à l'entité
  })

  it('objet exemplesAteliers vide ({}) hérite ; non vide prime', () => {
    const racine = row({ exemplesAteliers: { biensSupports: [{ nom: 'AD' }] } })
    const enfantVide = row({ exemplesAteliers: {} })
    expect(resolveOrgConfig([enfantVide, racine]).exemplesAteliers).toEqual({ biensSupports: [{ nom: 'AD' }] })
  })
})
