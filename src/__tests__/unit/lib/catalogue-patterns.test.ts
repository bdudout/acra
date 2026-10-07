// Lot A5 — catalogue (contrôles, KRI, audits, risques) rattaché aux patterns d'architecture ; secteur Technique supprimé.
import { describe, it, expect } from 'vitest'
import { listSectorSuggestions, searchSectorSuggestions, SECTOR_CODES, sanitizeSectorSelection, CATALOGUE_PACK_VERSION } from '@/lib/sector-suggestions'
import { CATALOGUE_CHANGELOG } from '@/lib/sector-suggestions-changelog'
import { ARCHI_PATTERNS, LOT1_CODES, isPatternCode } from '@/lib/patterns-archi'
import { SECTOR_INCIDENT_TYPES } from '@/lib/incident-types-sector'
import { searchIncidentTypes } from '@/lib/incident-types-catalogue'

const all = (patterns: string[] | null, sector: never = null as never) => listSectorSuggestions(sector, 'fr', patterns)
const keysOf = (patterns: string[] | null) => new Set(all(patterns).map(i => i.key))

describe('secteur « Technique / Interconnexion de SI » supprimé du catalogue', () => {
  it('n’est plus un code de secteur ni acceptable dans une sélection', () => {
    expect((SECTOR_CODES as readonly string[]).includes('TECHNIQUE')).toBe(false)
    expect(sanitizeSectorSelection(['TECHNIQUE'])).toBeNull()
  })
  it('aucun élément du catalogue ne porte plus le secteur TECHNIQUE', () => {
    for (const s of [null, ...SECTOR_CODES]) for (const i of listSectorSuggestions(s as never, 'fr', ARCHI_PATTERNS.map(p => p.code))) expect(i.sector as string).not.toBe('TECHNIQUE')
  })
  it('les incidents types d’interconnexion sont devenus génériques (proposés à tous, sans secteur)', () => {
    const t = SECTOR_INCIDENT_TYPES.filter(x => x.key.startsWith('technique.'))
    expect(t.length).toBe(4)
    for (const x of t) expect(x.sector).toBeUndefined()
    expect(searchIncidentTypes('interconnexion', 'fr', ['SANTE']).some(x => x.key === 'technique.partner-compromise')).toBe(true)
  })
})

describe('rattachement aux patterns', () => {
  it('sans pattern coché, aucun élément rattaché à un pattern', () => {
    expect([...keysOf(null)].some(k => k.startsWith('technique.') || k.startsWith('archi.'))).toBe(false)
    expect([...keysOf([])].some(k => k.startsWith('technique.') || k.startsWith('archi.'))).toBe(false)
  })
  it('INTERCO_TIERS recommande les contrôles d’interconnexion ; API_PARTENAIRES ceux des API ; ECHANGE_FICHIERS ceux des analyseurs', () => {
    expect(keysOf(['INTERCO_TIERS'])).toContain('technique.control.interco-inventory')
    expect(keysOf(['INTERCO_TIERS'])).not.toContain('technique.control.api-authz-tests')
    expect(keysOf(['API_PARTENAIRES'])).toContain('technique.control.api-authz-tests')
    expect(keysOf(['ECHANGE_FICHIERS'])).toContain('technique.control.input-validation-review')
    expect(keysOf(['EXTERNALISATION_DONNEES'])).toContain('technique.control.completeness-check')
  })
  it('indépendant du secteur : un secteur choisi n’en change pas la présence', () => {
    const avec = new Set(listSectorSuggestions(['SANTE'] as never, 'fr', ['API_PARTENAIRES']).map(i => i.key))
    expect(avec).toContain('technique.control.api-authz-tests')
    expect(avec).toContain('sante.control.portal-mfa-coverage')
  })
  it('chaque élément rattaché référence des patterns connus ; les clés sont uniques', () => {
    const items = listSectorSuggestions(null, 'fr', ARCHI_PATTERNS.map(p => p.code))
    const keys = items.map(i => i.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const i of items.filter(x => (x as { patterns?: readonly string[] }).patterns)) for (const p of (i as { patterns: readonly string[] }).patterns) expect(isPatternCode(p), `${i.key}:${p}`).toBe(true)
  })
  it('la recherche textuelle tient compte des patterns', () => {
    expect(searchSectorSuggestions(null, 'fr', 'revue des règles de filtrage', ['INTERCO_TIERS']).length).toBeGreaterThan(0)
    expect(searchSectorSuggestions(null, 'fr', 'revue des règles de filtrage', []).filter(i => i.key.startsWith('technique.')).length).toBe(0)
  })
})

describe('plancher de profondeur du catalogue (patterns du lot 1)', () => {
  for (const code of LOT1_CODES) {
    it(`${code} : au moins 1 risque, 2 contrôles et 1 indicateur`, () => {
      const own = all([code]).filter(i => (i as { patterns?: readonly string[] }).patterns?.length === 1 && (i as { patterns?: readonly string[] }).patterns![0] === code)
      const n = (k: string) => own.filter(i => i.kind === k).length
      expect(n('RISK'), `${code} risques`).toBeGreaterThanOrEqual(1)
      expect(n('CONTROL'), `${code} contrôles`).toBeGreaterThanOrEqual(2)
      expect(n('KRI'), `${code} KRI`).toBeGreaterThanOrEqual(1)
    })
  }
  it('contrôles : périodicité et type suggérés, jamais d’exécution', () => {
    for (const i of all(ARCHI_PATTERNS.map(p => p.code)).filter(x => x.kind === 'CONTROL' && x.key.startsWith('archi.'))) {
      expect(i.periodicite, i.key).toBeTruthy(); expect(i.controlType, i.key).toBeTruthy()
    }
  })
  it('libellés dans les 5 langues pour le contenu rattaché', () => {
    const codes = ARCHI_PATTERNS.map(p => p.code)
    for (const l of ['en', 'de', 'es', 'it'] as const) {
      const fr = listSectorSuggestions(null, 'fr', codes), tr = listSectorSuggestions(null, l, codes)
      expect(tr.length).toBe(fr.length)
      for (const [idx, i] of tr.entries()) if (i.key.startsWith('archi.')) expect(i.title, `${l}:${i.key}`).not.toBe(fr[idx].title)
    }
  })
})

describe('version du catalogue', () => {
  it('1.15 : les nouveaux éléments rattachés aux patterns figurent dans le journal', () => {
    expect(CATALOGUE_PACK_VERSION).toBe('1.15')
    const e = CATALOGUE_CHANGELOG.find(x => x.version === '1.15')
    expect(e).toBeTruthy()
    const archi = all(ARCHI_PATTERNS.map(p => p.code)).filter(i => i.key.startsWith('archi.')).map(i => i.key)
    expect(archi.length).toBeGreaterThan(30)
    for (const k of archi) expect(e!.added, k).toContain(k)
  })
})
