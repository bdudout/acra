import { describe, expect, it } from 'vitest'
import { SECTOR_CODES, listSectorSuggestions, searchSectorSuggestions, sanitizeSectorSelection } from '@/lib/sector-suggestions'

describe('catalogue de suggestions sectorielles', () => {
  it('propose un socle transversal et un pack pertinent pour chaque secteur disponible', () => {
    expect(SECTOR_CODES).toEqual(['FINANCE', 'ASSURANCE', 'SANTE', 'PUBLIC', 'SAAS', 'INDUSTRIE', 'COMMERCE', 'SERVICES'])
    for (const sector of SECTOR_CODES) {
      const items = listSectorSuggestions(sector, 'fr')
      expect(items.filter(item => item.sector === 'TRANSVERSAL' && item.kind === 'PROCESS')).toHaveLength(6)
      expect(items.filter(item => item.sector === sector && item.kind === 'PROCESS').length).toBeGreaterThanOrEqual(4)
      expect(items.filter(item => item.sector === sector && item.kind === 'RISK').length).toBeGreaterThanOrEqual(5)
      expect(new Set(items.map(item => item.key)).size).toBe(items.length)
    }
  })

  it('relie les risques à des processus connus, avec tous les libellés traduits', () => {
    for (const sector of SECTOR_CODES) {
      for (const locale of ['fr', 'en', 'de', 'es', 'it'] as const) {
        const items = listSectorSuggestions(sector, locale)
        const processes = new Set(items.filter(item => item.kind === 'PROCESS').map(item => item.key))
        for (const item of items) {
          expect(item.title.trim()).not.toBe('')
          expect(item.packVersion).toMatch(/^\d+\.\d+$/)
          expect(item.key).toMatch(/^[a-z][a-z0-9._-]+$/)
          if (item.kind === 'RISK') expect(processes.has(item.processKey!), `${item.key} → ${item.processKey}`).toBe(true)
          if (item.kind === 'PROCESS' && item.parentKey) expect(processes.has(item.parentKey), `${item.key} → ${item.parentKey}`).toBe(true)
        }
      }
    }
  })

  it('garde les exemples sans cotation, seuil approuvé, incident fictif ni contrat fictif', () => {
    for (const item of listSectorSuggestions('FINANCE', 'fr')) {
      expect(item).not.toHaveProperty('gravite')
      expect(item).not.toHaveProperty('vraisemblance')
      expect(item).not.toHaveProperty('criticiteDora')
      expect(item).not.toHaveProperty('prestataireNom')
      expect(item).not.toHaveProperty('statutConformite')
    }
  })

  it('recherche les suggestions sans tenir compte des accents ni de la casse', () => {
    const found = searchSectorSuggestions('SANTE', 'fr', 'donnees sante')
    expect(found.some(item => item.key === 'sante.risk.patient-data')).toBe(true)
    expect(searchSectorSuggestions('SANTE', 'fr', 'INTROUVABLE')).toEqual([])
  })

  it('valide une sélection de secteurs limitée, sans doublon ni code inconnu', () => {
    expect(sanitizeSectorSelection(['SANTE', 'SAAS', 'SANTE'])).toEqual(['SANTE', 'SAAS'])
    expect(sanitizeSectorSelection([])).toEqual([])
    expect(sanitizeSectorSelection(['INCONNU'])).toBeNull()
    expect(sanitizeSectorSelection(['SANTE', 'SAAS', 'PUBLIC', 'FINANCE'])).toBeNull()
  })
})
