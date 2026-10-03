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
    referentielsDesactives: [],
    qualificationQuestionnaire: {},
    strategiesTraitement: [],
    exemplesAteliers: {},
    echellesEcosysteme: {},
    qualificationActive: false,
    qualificationObligatoire: false,
    conformiteActive: false,
    conformiteNiveau: 'ANALYSE',
    conformiteSnapshotMode: 'MANUEL',
    conformiteSnapshotPeriode: 'MENSUEL',
    conseilsAteliersActive: true,
    acceptationRisquesActive: false,
    gelApresAcceptationActive: false,
    interdireAutoApprobation: true,
    derogationsActive: false,
    derogationDureeDefautJours: 180,
    derogationAlerteJours: 30,
    derogationDureeMaxJours: 365,
    archivageMissionsAnnees: 5,
    derogationWorkflow: 'RSSI_METIER',
    derogationDoubleRegard: true,
    derogationSortCatalogue: true,
    taxonomieRisques: [],
    registreRisquesActive: false,
    ...partial,
  }
}

describe('resolveOrgConfig — héritage de configuration par organisation', () => {
  it('chaîne vide → valeurs par défaut', () => {
    const c = resolveOrgConfig([])
    expect(c.entitesMesures).toEqual(DEFAULT_ORG_CONFIG.entitesMesures)
    expect(c.conseilsAteliersActive).toBe(true)
    expect(c.qualificationActive).toBe(true)
    expect(c.echellesEcosysteme).toEqual({})
  })

  it('referentielsDesactives : défaut vide, renseigné par row, hérité comme un JSON', () => {
    expect(resolveOrgConfig([]).referentielsDesactives).toEqual([])
    expect(resolveOrgConfig([row({ referentielsDesactives: ['DORA', 'ANSSI_HYG'] })]).referentielsDesactives).toEqual(['DORA', 'ANSSI_HYG'])
    // Enfant sans valeur (JSON vide) → hérite de l'ancêtre.
    const enfant = row({ referentielsDesactives: [] })
    const racine = row({ referentielsDesactives: ['DORA'] })
    expect(resolveOrgConfig([enfant, racine]).referentielsDesactives).toEqual(['DORA'])
  })

  it('patterns masqués : aucun par défaut ; la liste valide la plus proche est héritée', () => {
    expect(resolveOrgConfig([]).patternsArchiMasques).toEqual([])
    expect(resolveOrgConfig([row({ patternsArchiMasques: ['DMZ', 'inconnu', 'DMZ'] })]).patternsArchiMasques).toEqual(['DMZ'])
    expect(resolveOrgConfig([row({ patternsArchiMasques: [] }), row({ patternsArchiMasques: ['SI_TPE'] })]).patternsArchiMasques).toEqual(['SI_TPE'])
  })

  it('2ᵉ ligne de défense : active par défaut (rétrocompatible), désactivable par row', () => {
    expect(resolveOrgConfig([]).secondeLigneActive).toBe(true)
    expect(DEFAULT_ORG_CONFIG.secondeLigneActive).toBe(true)
    expect(resolveOrgConfig([row({ secondeLigneActive: false })]).secondeLigneActive).toBe(false)
  })

  it('profils opérationnels : inactifs par défaut et hérités comme un toggle', () => {
    expect(DEFAULT_ORG_CONFIG.profilsOperationnelsActive).toBe(false)
    expect(resolveOrgConfig([]).profilsOperationnelsActive).toBe(false)
    const enfant = row({ profilsOperationnelsActive: true })
    const racine = row({ profilsOperationnelsActive: false })
    expect(resolveOrgConfig([enfant, racine]).profilsOperationnelsActive).toBe(true)
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
    expect(resolveOrgConfig([]).conformiteNiveau).toBe('ORGANISATION') // défaut basculé
    expect(resolveOrgConfig([]).conformiteSnapshotMode).toBe('MANUEL')
    const enfant = row({ conformiteNiveau: 'ANALYSE', conformiteSnapshotMode: 'AUTO' })
    const racine = row({ conformiteNiveau: 'ORGANISATION', conformiteSnapshotMode: 'MANUEL' })
    expect(resolveOrgConfig([enfant, racine]).conformiteNiveau).toBe('ANALYSE')
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

describe('resolveOrgConfig — échelle de maturité (CMMI)', () => {
  it('vide par défaut (libellés CMMI de l’i18n), héritée du parent sinon', () => {
    expect(resolveOrgConfig([]).echelleMaturite).toEqual([])
    const parent = row({ echelleMaturite: [{ niveau: 3, libelle: 'Défini groupe', definition: '' }] })
    expect(resolveOrgConfig([row({}), parent]).echelleMaturite).toEqual([{ niveau: 3, libelle: 'Défini groupe', definition: '' }])
  })
})

describe('mcpActive (interrupteur MCP par organisation)', () => {
  it('désactivé par défaut ; une filiale hérite de l’organisation parente ; la valeur propre l’emporte', () => {
    expect(resolveOrgConfig([null]).mcpActive).toBe(false)
    expect(resolveOrgConfig([null, { mcpActive: true } as never]).mcpActive).toBe(true)
    expect(resolveOrgConfig([{ mcpActive: false } as never, { mcpActive: true } as never]).mcpActive).toBe(false)
  })
})
