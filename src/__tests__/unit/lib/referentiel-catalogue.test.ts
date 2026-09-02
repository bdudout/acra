import { describe, it, expect } from 'vitest'
import {
  builtinCatalogue,
  referentielCodeFromNom,
  resolveReferentielCode,
  NOM_ALIAS_CODE,
} from '../../../lib/referentiel-catalogue'
import { DEFAULT_REFERENTIELS } from '../../../lib/org-config-defaults'
import { FRAMEWORK_META } from '../../../lib/frameworks-data'

describe('builtinCatalogue', () => {
  it('liste les cadres livrés (hors CUSTOM) avec code + nom + domaine', () => {
    const cat = builtinCatalogue()
    expect(cat.length).toBeGreaterThan(10)
    expect(cat.find(c => c.code === 'CUSTOM')).toBeUndefined()
    const iso = cat.find(c => c.code === 'ISO27001')
    expect(iso).toMatchObject({ code: 'ISO27001', nom: FRAMEWORK_META.ISO27001.nom, domaine: 'SECURITE_SI' })
  })
})

describe('referentielCodeFromNom — mapping nom → code canonique', () => {
  it('mappe le nom exact d’un cadre livré', () => {
    expect(referentielCodeFromNom('DORA')).toBe('DORA')
    expect(referentielCodeFromNom('ISO/IEC 27001')).toBe('ISO27001')
  })

  it('tolère la version, la casse, les accents et la ponctuation', () => {
    expect(referentielCodeFromNom('ISO/IEC 27001:2022')).toBe('ISO27001')
    expect(referentielCodeFromNom('  dora  ')).toBe('DORA')
    expect(referentielCodeFromNom('PCI-DSS')).toBe('PCI_DSS')
  })

  it('applique les alias métier (variantes)', () => {
    expect(referentielCodeFromNom('CIS Controls v8')).toBe('CIS_V8')
    expect(referentielCodeFromNom('NIST CSF 2.0')).toBe('NIST_CSF')
    expect(referentielCodeFromNom('SOC 2')).toBe('SOC2')
  })

  it('tient ISO/IEC 27002 distinct de 27001 (→ null)', () => {
    expect(referentielCodeFromNom('ISO/IEC 27002:2022')).toBeNull()
    expect(referentielCodeFromNom('ISO 27002')).toBeNull()
  })

  it('retourne null pour un nom sans cadre livré correspondant (→ custom)', () => {
    expect(referentielCodeFromNom('LPM')).toBeNull()
    expect(referentielCodeFromNom('NIS2')).toBeNull()
    expect(referentielCodeFromNom('RGPD')).toBeNull()
    expect(referentielCodeFromNom('Politique interne maison')).toBeNull()
    expect(referentielCodeFromNom('')).toBeNull()
  })

  it('couvre TOUS les référentiels par défaut connus (aucune perte silencieuse)', () => {
    // Chaque DEFAULT_REFERENTIEL est soit mappé à un code livré, soit explicitement
    // reconnu comme « custom » (null) — jamais une correspondance accidentelle.
    const attendus: Record<string, string | null> = {
      'ISO/IEC 27001:2022': 'ISO27001',
      'ISO/IEC 27002:2022': null,
      'RGPD': null,
      'NIS2': null,
      'RGS': 'RGS',
      'HDS': 'HDS',
      'PCI-DSS': 'PCI_DSS',
      'SOC 2': 'SOC2',
      'LPM': null,
      'DORA': 'DORA',
      'CIS Controls v8': 'CIS_V8',
      'NIST CSF 2.0': 'NIST_CSF',
    }
    for (const r of DEFAULT_REFERENTIELS) {
      expect(r.nom in attendus, `nom non couvert par le test : ${r.nom}`).toBe(true)
      expect(referentielCodeFromNom(r.nom)).toBe(attendus[r.nom])
    }
  })
})

describe('resolveReferentielCode — point unique de résolution', () => {
  it('privilégie le code explicite d’une nouvelle sélection', () => {
    expect(resolveReferentielCode({ code: 'DORA', nom: 'peu importe' })).toBe('DORA')
  })
  it('rétro-résout par le nom quand le code est absent (données historiques)', () => {
    expect(resolveReferentielCode({ nom: 'ISO/IEC 27001:2022' })).toBe('ISO27001')
  })
  it('rétro-résout aussi les cadres GRC livrés (ex. RGPD)', () => {
    expect(resolveReferentielCode({ code: null, nom: 'RGPD' })).toBe('RGPD')
    expect(resolveReferentielCode({ nom: 'Gel des avoirs' })).toBe('SANCTIONS_GEL')
  })
  it('retourne null pour un label sans cadre livré', () => {
    expect(resolveReferentielCode({ nom: 'LPM' })).toBeNull()
    expect(resolveReferentielCode({ nom: 'Politique interne maison' })).toBeNull()
    expect(resolveReferentielCode(null)).toBeNull()
  })
})

describe('NOM_ALIAS_CODE', () => {
  it('n’a que des codes de cadres livrés valides comme cibles', () => {
    for (const code of Object.values(NOM_ALIAS_CODE)) {
      expect(FRAMEWORK_META[code]).toBeDefined()
    }
  })
})
