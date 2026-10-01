import { describe, expect, it } from 'vitest'
import { CATALOGUE_PACK_VERSION, SECTOR_CODES, listSectorSuggestions } from '@/lib/sector-suggestions'
import { CATALOGUE_CHANGELOG, compareCatalogueVersions, newSince, oldestImportedVersion } from '@/lib/sector-suggestions-changelog'

describe('historique du catalogue', () => {
  it('chaque clé de l’historique existe dans le catalogue, une seule fois ; la dernière version est la version courante', () => {
    const all = new Set(SECTOR_CODES.flatMap(s => listSectorSuggestions(s, 'fr').map(i => i.key)))
    const seen = new Set<string>()
    for (const entry of CATALOGUE_CHANGELOG) for (const key of entry.added) {
      expect(all.has(key), key).toBe(true); expect(seen.has(key), `doublon ${key}`).toBe(false); seen.add(key)
    }
    expect(CATALOGUE_CHANGELOG.at(-1)!.version).toBe(CATALOGUE_PACK_VERSION)
  })
  it('compare les versions numériquement (1.10 > 1.9)', () => {
    expect(compareCatalogueVersions('1.10', '1.9')).toBe(1); expect(compareCatalogueVersions('1.2', '1.2')).toBe(0); expect(compareCatalogueVersions('1.0', '2.0')).toBe(-1)
  })
  it('version de référence = la plus ancienne importée ; rien importé = null ; valeurs invalides ignorées', () => {
    expect(oldestImportedVersion(['1.3', '1.0', null, 'x'])).toBe('1.0'); expect(oldestImportedVersion([])).toBeNull(); expect(oldestImportedVersion([null])).toBeNull()
  })
  it('nouveautés : seulement les clés ajoutées après la version de référence et non importées ; sans référence, rien n’est signalé', () => {
    expect(newSince(null, [])).toEqual([])
    const fromOne = newSince('1.0', [])
    expect(fromOne).toContain('core.control.access-review'); expect(fromOne).toContain('core.process.digital.iam')
    expect(newSince('1.3', [])).toEqual(CATALOGUE_CHANGELOG.find(e => e.version === '1.4')!.added)
    expect(newSince('1.0', ['core.control.access-review'])).not.toContain('core.control.access-review')
    expect(newSince('1.4', [])).toEqual([])
  })
})
