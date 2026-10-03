import { describe, expect, it } from 'vitest'
import { BANCASSURANCE_ITEMS } from '@/lib/sector-packs-bancassurance'
import { CATALOGUE_PACK_VERSION, SECTOR_CODES, listSectorSuggestions } from '@/lib/sector-suggestions'
import { CATALOGUE_CHANGELOG, compareCatalogueVersions } from '@/lib/sector-suggestions-changelog'
import { PERIODICITES } from '@/lib/controle'

const LOCALES = ['fr', 'en', 'de', 'es', 'it'] as const
const controls = (sector: string) => BANCASSURANCE_ITEMS.filter(i => i.sector === sector && i.kind === 'CONTROL')

describe('pack banque / assurance / mutuelle (catalogue 1.9)', () => {
  it('banque : contrôles par domaine (gouvernance, crédit, marchés/liquidité, paiements, LCB-FT, conformité, reporting, TIC)', () => {
    const domaines = new Set(controls('FINANCE').map(c => c.processKey))
    for (const d of ['governance', 'credit', 'markets', 'payments', 'channels', 'aml', 'compliance', 'reporting', 'ict']) expect(domaines.has(`finance.process.${d}`), d).toBe(true)
    expect(controls('FINANCE').length).toBeGreaterThanOrEqual(25)
  })
  it('assurance / mutuelle : contrôles par domaine (gouvernance et fonctions clés, ORSA, souscription, provisions, sinistres, distribution, placements, LCB-FT, adhérents, TIC)', () => {
    const domaines = new Set(controls('ASSURANCE').map(c => c.processKey))
    for (const d of ['governance', 'orsa', 'underwrite', 'reserving', 'claims', 'brokers', 'investments', 'aml', 'members', 'ict']) expect(domaines.has(`assurance.process.${d}`), d).toBe(true)
    expect(controls('ASSURANCE').length).toBeGreaterThanOrEqual(28)
  })
  it('chaque contrôle est rattaché à un processus du même secteur disponible dans le catalogue, avec périodicité et type valides et libellés ×5', () => {
    for (const sector of ['FINANCE', 'ASSURANCE'] as const) for (const locale of LOCALES) {
      const items = listSectorSuggestions(sector, locale)
      const processes = new Set(items.filter(i => i.kind === 'PROCESS').map(i => i.key))
      for (const c of items.filter(i => i.kind === 'CONTROL' && BANCASSURANCE_ITEMS.some(b => b.key === i.key))) {
        expect(processes.has(c.processKey!), `${c.key} → ${c.processKey}`).toBe(true)
        expect((PERIODICITES as readonly string[]).includes(c.periodicite!), c.key).toBe(true)
        expect(['PREVENTIF', 'DETECTIF', 'CORRECTIF']).toContain(c.controlType)
        expect(c.title.trim(), `${c.key}/${locale}`).not.toBe('')
      }
    }
  })
  it('références : textes d’origine cités (arrêté du 3 novembre 2014, DORA, Solvabilité II, DDA, LCB-FT, Code de la mutualité) ; jamais un libellé d’exigence', () => {
    const all = BANCASSURANCE_ITEMS.flatMap(i => i.references ?? []).join(' | ')
    for (const s of ['Arrêté du 3 novembre 2014', 'Règlement (UE) 2022/2554', 'Directive 2009/138/CE', 'Directive (UE) 2016/97', 'Code monétaire et financier', 'Code de la mutualité']) expect(all).toContain(s)
    for (const i of BANCASSURANCE_ITEMS) for (const r of i.references ?? []) expect(r.length, `${i.key}: ${r}`).toBeLessThan(260)
  })
  it('clés uniques dans tout le catalogue, historique des versions à jour (1.9) et listé', () => {
    for (const sector of SECTOR_CODES) {
      const keys = listSectorSuggestions(sector, 'fr').map(i => i.key)
      expect(new Set(keys).size).toBe(keys.length)
    }
    expect(compareCatalogueVersions(CATALOGUE_PACK_VERSION, '1.9')).toBeGreaterThanOrEqual(0)
    const entry = CATALOGUE_CHANGELOG.find(e => e.version === '1.9')!
    expect(new Set(entry.added)).toEqual(new Set(BANCASSURANCE_ITEMS.map(i => i.key)))
  })
  it('les références sont exposées avec la suggestion (secteur choisi seulement) ; rien n’est proposé hors secteur', () => {
    const fin = listSectorSuggestions('FINANCE', 'fr').find(i => i.key === 'finance.control.ict-register')!
    expect(fin.references).toEqual(['Règlement (UE) 2022/2554 (DORA)'])
    expect(listSectorSuggestions('INDUSTRIE', 'fr').some(i => i.key.startsWith('finance.') || i.key.startsWith('assurance.control.key'))).toBe(false)
    expect(listSectorSuggestions(null, 'fr').some(i => i.key === 'finance.control.ict-register')).toBe(false)
  })
})
