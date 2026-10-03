import { describe, expect, it } from 'vitest'
import { CATALOGUE_PACK_VERSION, SECTOR_CODES, listSectorSuggestions } from '@/lib/sector-suggestions'
import { SECTOR_INCIDENT_TYPES } from '@/lib/incident-types-sector'
import { CATALOGUE_CHANGELOG } from '@/lib/sector-suggestions-changelog'
import { fr } from '@/lib/i18n/fr'
import { en } from '@/lib/i18n/en'
import { de } from '@/lib/i18n/de'
import { es } from '@/lib/i18n/es'
import { it as itDict } from '@/lib/i18n/it'

const keys = (sector: (typeof SECTOR_CODES)[number]) => new Set(listSectorSuggestions(sector, 'fr').map(i => i.key))

describe('catalogue 1.12 : santé (portail, entrepôt, interconnexions), mutuelle santé et Technique / Interconnexion de SI', () => {
  it('le secteur TECHNIQUE existe (dernier, comme dans la liste des secteurs d’analyse) et a un libellé ×5', () => {
    expect(SECTOR_CODES.at(-1)).toBe('TECHNIQUE')
    for (const d of [fr, en, de, es, itDict]) expect((d.sectorSuggestions.sectors as Record<string, string>).TECHNIQUE).toBeTruthy()
  })
  it('santé : risques, contrôles et KRI du portail, de l’entrepôt de données et des flux reçus', () => {
    const k = keys('SANTE')
    for (const key of ['sante.risk.portal-account-takeover', 'sante.risk.portal-object-authz', 'sante.risk.eds-reidentification', 'sante.risk.feed-integrity',
      'sante.control.portal-mfa-coverage', 'sante.control.eds-export-review', 'sante.kri.portal-takeovers', 'sante.audit.portal']) expect(k, key).toContain(key)
  })
  it('mutuelle santé : détournement de remboursements par changement d’IBAN et délégation de gestion', () => {
    const k = keys('ASSURANCE')
    for (const key of ['assurance.risk.iban-diversion', 'assurance.risk.delegate-segregation', 'assurance.control.iban-change-review', 'assurance.control.delegate-reporting', 'assurance.kri.iban-changes']) expect(k, key).toContain(key)
  })
  it('technique : chaque contrôle couvre au moins un risque du catalogue', () => {
    const items = listSectorSuggestions('TECHNIQUE', 'fr').filter(i => i.sector === 'TECHNIQUE')
    const risks = new Set(listSectorSuggestions('TECHNIQUE', 'fr').filter(i => i.kind === 'RISK').map(i => i.key))
    for (const c of items.filter(i => i.kind === 'CONTROL')) {
      expect(c.riskKeys?.length, c.key).toBeGreaterThan(0)
      for (const r of c.riskKeys!) expect(risks.has(r), `${c.key} → ${r}`).toBe(true)
    }
  })
  it('technique : au moins 3 incidents types (flux falsifié, partenaire compromis, interruption de flux)', () => {
    expect(SECTOR_INCIDENT_TYPES.filter(t => t.sector === 'TECHNIQUE').length).toBeGreaterThanOrEqual(3)
  })
  it('les nouveautés sont datées dans l’historique du catalogue (version 1.12)', () => {
    expect(['1.12', '1.13']).toContain(CATALOGUE_PACK_VERSION)
    const added = CATALOGUE_CHANGELOG.find(e => e.version === '1.12')!.added
    expect(added).toEqual(expect.arrayContaining(['sante.risk.portal-account-takeover', 'technique.process.exchange', 'assurance.risk.iban-diversion']))
  })
})
