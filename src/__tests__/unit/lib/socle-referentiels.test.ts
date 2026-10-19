// n° 53 (recette 2026-10-12, RSSI d'une régie d'eau) : « Évaluer NIS2 » → aucun référentiel ne
// mentionnait NIS 2. ReCyF porte désormais son intitulé officiel ANSSI (« Référentiel Cyber
// France ») et sa finalité (NIS 2) ; le sélecteur du socle présente d'abord les référentiels
// recommandés pour le secteur de l'organisation.
import { describe, expect, it } from 'vitest'
import { FRAMEWORK_META } from '@/lib/frameworks-data'
import { referentielCodeFromNom } from '@/lib/referentiel-catalogue'
import { grouperReferentielsSocle } from '@/lib/socle-referentiels'

describe('ReCyF — intitulé officiel et finalité', () => {
  it('le nom affiché cite le Référentiel Cyber France et NIS 2', () => {
    expect(FRAMEWORK_META.RECYF.nom).toContain('Référentiel Cyber France')
    expect(FRAMEWORK_META.RECYF.nom).toContain('NIS 2')
  })
  it('les imports reconnaissent l\'ancien et le nouveau nom', () => {
    expect(referentielCodeFromNom('ReCyF')).toBe('RECYF')
    expect(referentielCodeFromNom(FRAMEWORK_META.RECYF.nom)).toBe('RECYF')
    expect(referentielCodeFromNom('Référentiel Cyber France')).toBe('RECYF')
  })
})

describe('grouperReferentielsSocle', () => {
  const refs = [{ code: 'ISO27001', nom: 'ISO' }, { code: 'PCI_DSS', nom: 'PCI' }, { code: 'RECYF', nom: 'ReCyF' }, { code: 'PERSO', nom: 'Perso' }]
  it('recommandés d\'abord, dans l\'ordre de recommandation ; les autres ensuite, ordre d\'origine', () => {
    expect(grouperReferentielsSocle(refs, ['RECYF', 'ISO27001', 'DORA'])).toEqual({
      recommandes: [{ code: 'RECYF', nom: 'ReCyF' }, { code: 'ISO27001', nom: 'ISO' }],
      autres: [{ code: 'PCI_DSS', nom: 'PCI' }, { code: 'PERSO', nom: 'Perso' }],
    })
  })
  it('sans recommandation (secteur inconnu) : un seul groupe', () => {
    expect(grouperReferentielsSocle(refs, [])).toEqual({ recommandes: [], autres: refs })
  })
})
