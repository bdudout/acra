import { describe, expect, it } from 'vitest'
import { SECTEURS_ACTIVITE } from '@/lib/ebios-data'
import { getEbiosData } from '@/lib/ebios-data-i18n'
import { secteurFamily, selectableSousSecteurIds, sousSecteurIdsFor } from '@/lib/sous-secteurs'
import { sectorExemplesFor, type SectorExempleCategory } from '@/lib/exemples-sectoriels'
import { SECTOR_CODES, listSectorSuggestions } from '@/lib/sector-suggestions'
import { SECTOR_INCIDENT_TYPES } from '@/lib/incident-types-sector'
import type { Locale } from '@/lib/i18n'
import { recommendedFrameworksForSector } from '@/lib/frameworks-data'

const PS = 'Protection sociale / Sécurité sociale'
const SANTE = 'Santé / Médico-social'
const IDS = ['protsoc-tete-reseau', 'protsoc-caisse-locale', 'protsoc-controle-medical', 'protsoc-production', 'protsoc-services-usagers', 'protsoc-services-pro', 'protsoc-risques-pro', 'protsoc-prevention', 'protsoc-fraude', 'protsoc-donnees', 'protsoc-international', 'protsoc-action-sociale', 'protsoc-mandats']
const CATS: SectorExempleCategory[] = ['valeursMetier', 'biensSupports', 'evenementsRedoutes', 'sourcesRisque', 'scenariosStrategiques', 'partiesPrenantes', 'actionsElementaires', 'mesuresEcosysteme', 'mesures']
const LOCS: Locale[] = ['en', 'de', 'es', 'it']
const idx = () => SECTEURS_ACTIVITE.indexOf(PS)
const textOf = (x: Record<string, unknown>) => String(x.nom ?? x.mesure ?? x.description ?? '')

describe('famille « Protection sociale » — taxonomie', () => {
  it('secteur présent juste avant « Autre », reconnu comme sa propre famille dans les 5 langues', () => {
    expect(idx()).toBeGreaterThan(-1)
    expect(SECTEURS_ACTIVITE[idx() + 1]).toBe('Autre')
    for (const loc of ['fr', ...LOCS] as Locale[]) {
      const label = getEbiosData(loc).SECTEURS_ACTIVITE[idx()]
      expect(secteurFamily(label), `${loc}: ${label}`).toBe('protection_sociale')
      expect(sectorExemplesFor(label, 'valeursMetier', loc).length, loc).toBeGreaterThan(0)
    }
    // pas de collision : les secteurs voisins gardent leur famille
    expect(secteurFamily(SANTE)).toBe('sante'); expect(secteurFamily('Banque / Finance')).toBe('banque')
  })
  it('13 sous-secteurs (les interconnexions relèvent des patterns)', () => {
    expect(sousSecteurIdsFor(PS)).toEqual(IDS)
    expect(selectableSousSecteurIds(PS)).toEqual(IDS)
    expect(selectableSousSecteurIds(SANTE)).not.toContain('protsoc-fraude')
  })
})

describe('famille « Protection sociale » — exemples d’ateliers', () => {
  it('chaque sous-secteur reçoit au moins un exemple dans chacune des 9 catégories', () => {
    for (const id of IDS) for (const cat of CATS) expect(sectorExemplesFor(PS, cat, 'fr', id).length, `${id}/${cat}`).toBeGreaterThan(0)
  })
  it('contenu propre au sous-secteur, en tête, et absent des autres sous-secteurs', () => {
    expect(textOf(sectorExemplesFor(PS, 'mesures', 'fr', 'protsoc-controle-medical')[0])).toMatch(/médic/i)
    expect(JSON.stringify(sectorExemplesFor(PS, 'mesures', 'fr', 'protsoc-production'))).toMatch(/grands systèmes/i)
    expect(JSON.stringify(sectorExemplesFor(PS, 'mesures', 'fr', 'protsoc-action-sociale'))).not.toMatch(/grands systèmes/i)
  })
  it('aucun contenu protection sociale pour un secteur santé', () => {
    expect(JSON.stringify(CATS.flatMap(c => sectorExemplesFor(SANTE, c, 'fr', 'sante-hopital')))).not.toMatch(/bénéficiaires|traitements de masse/i)
  })
  it('actions élémentaires avec technique ATT&CK ; traductions sans repli sur le français', () => {
    for (const id of IDS) for (const a of sectorExemplesFor(PS, 'actionsElementaires', 'fr', id)) expect(String(a.attack)).toMatch(/^T\d{4}(\.\d{3})?$/)
    for (const loc of LOCS) {
      const label = getEbiosData(loc).SECTEURS_ACTIVITE[idx()]
      for (const id of IDS) for (const cat of CATS) {
        const fr = sectorExemplesFor(PS, cat, 'fr', id).map(textOf)
        const tr = sectorExemplesFor(label, cat, loc, id).map(textOf)
        expect(tr.length, `${loc}/${id}/${cat}`).toBe(fr.length)
        expect(tr.filter((t, i) => t === fr[i]), `${loc}/${id}/${cat}`).toEqual([])
      }
    }
  })
})

describe('catalogue PROTECTION_SOCIALE (1.14)', () => {
  it('secteur de catalogue présent avant TECHNIQUE, avec fraude, paiements de masse et homologation', () => {
    expect(SECTOR_CODES.indexOf('PROTECTION_SOCIALE')).toBe(SECTOR_CODES.indexOf('TECHNIQUE') - 1)
    const keys = new Set(listSectorSuggestions('PROTECTION_SOCIALE', 'fr').map(i => i.key))
    for (const k of ['protection_sociale.risk.mass-payment-error', 'protection_sociale.risk.fake-professional', 'protection_sociale.control.teleservice-homologation', 'protection_sociale.kri.undue-detected', 'protection_sociale.audit.fraud-framework']) expect(keys, k).toContain(k)
  })
  it('incidents types propres au secteur (dont communication de crise de masse)', () => {
    const t = SECTOR_INCIDENT_TYPES.filter(x => x.sector === 'PROTECTION_SOCIALE')
    expect(t.length).toBeGreaterThanOrEqual(5)
    expect(t.some(x => /communication/i.test(x.title.fr))).toBe(true)
  })
})

describe('référentiels recommandés (P10)', () => {
  it('RGS (homologation), hygiène ANSSI, HDS et ISO 27001 pour la protection sociale, dans les 5 langues', () => {
    for (const loc of ['fr', ...LOCS] as Locale[]) {
      const r = recommendedFrameworksForSector(getEbiosData(loc).SECTEURS_ACTIVITE[idx()])
      expect(r.slice(0, 4), loc).toEqual(['RGS', 'ANSSI_HYG', 'HDS', 'ISO27001'])
    }
  })
})
