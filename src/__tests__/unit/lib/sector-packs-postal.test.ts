// Pack postal, lot L6 : catalogue GRC sectoriel POSTAL (processus, risques rattachés à la catégorie bâloise, contrôles,
// KRI sans seuil, missions d'audit, test de résilience), proposé seulement aux organisations du secteur.
import { describe, expect, it } from 'vitest'
import { SECTOR_CODES, listSectorSuggestions, CATALOGUE_PACK_VERSION } from '@/lib/sector-suggestions'
import { CATALOGUE_CHANGELOG } from '@/lib/sector-suggestions-changelog'
import { codesCatalogueSecteur, secteurDepuisCodes } from '@/lib/secteur-catalogue'
import { reviewNotice } from '@/lib/catalogue-review-status'
import { getEbiosData } from '@/lib/ebios-data-i18n'
import { SECTEURS_ACTIVITE } from '@/lib/ebios-data'

const POSTAL = 'Services postaux et d’expédition'

describe('catalogue POSTAL', () => {
  it('code POSTAL après TRANSPORT ; le secteur postal y est rattaché dans les 5 langues', () => {
    expect(SECTOR_CODES.indexOf('POSTAL')).toBe(SECTOR_CODES.indexOf('TRANSPORT') + 1)
    const i = SECTEURS_ACTIVITE.indexOf(POSTAL)
    for (const l of ['fr', 'en', 'de', 'es', 'it'] as const) expect(codesCatalogueSecteur(getEbiosData(l).SECTEURS_ACTIVITE[i]), l).toEqual(['POSTAL'])
    expect(secteurDepuisCodes(['POSTAL'])).toBe(POSTAL)
    expect(secteurDepuisCodes(['TRANSPORT'])).toBe('Transports / Logistique')
  })
  it('processus, risques bâlois, contrôles, KRI, audits et test de résilience — visibles seulement pour POSTAL', () => {
    const items = listSectorSuggestions('POSTAL', 'fr').filter(x => x.key.startsWith('postal.'))
    const kinds = new Set(items.map(x => x.kind))
    for (const k of ['PROCESS', 'RISK', 'CONTROL', 'KRI', 'AUDIT', 'RESILIENCE_TEST']) expect(kinds.has(k as never), k).toBe(true)
    expect(items.filter(x => x.kind === 'RISK').every(x => /^BALE_[1-7]$/.test(String(x.taxonomieCode)))).toBe(true)
    expect(items.filter(x => x.kind === 'RISK')).toHaveLength(12)
    expect(listSectorSuggestions('TRANSPORT', 'fr').some(x => x.key.startsWith('postal.'))).toBe(false)
  })
  it('5 langues, aucun seuil, aucune date, aucun résultat ; jamais de TLPT', () => {
    for (const l of ['en', 'de', 'es', 'it'] as const) {
      const fr = listSectorSuggestions('POSTAL', 'fr').filter(x => x.key.startsWith('postal.'))
      const tr = listSectorSuggestions('POSTAL', l).filter(x => x.key.startsWith('postal.'))
      tr.forEach((x, i) => { expect(x.title.trim(), `${l} ${x.key}`).not.toBe(''); expect(x.title, `${l} ${x.key}`).not.toBe(fr[i].title) })
    }
    for (const x of listSectorSuggestions('POSTAL', 'fr').filter(x => x.key.startsWith('postal.'))) {
      expect(JSON.stringify(x)).not.toMatch(/seuil|threshold|"date"|resultat/i)
      if (x.kind === 'RESILIENCE_TEST') expect(x.testType).not.toBe('TLPT')
    }
  })
  it('version du catalogue 1.16 et changelog ; statut « à relire » automatique', () => {
    expect(CATALOGUE_PACK_VERSION).toBe('1.16')
    const v116 = CATALOGUE_CHANGELOG.find(e => e.version === '1.16')!
    expect(v116.added.length).toBeGreaterThan(0)
    expect(v116.added.every(k => k.startsWith('postal.'))).toBe(true)
    expect(reviewNotice(['POSTAL'])).toEqual(['POSTAL'])
  })
})
