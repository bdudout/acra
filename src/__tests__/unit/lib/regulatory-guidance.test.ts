import { describe, it, expect } from 'vitest'
import { regulatoryObligations, suggestsComplianceModule, reportUsageNotes, nis2Classification, doraPrevailsOverNis2 } from '@/lib/regulatory-guidance'

// Obligations réglementaires différenciées selon le statut (issue #68).

describe('regulatoryObligations', () => {
  it('OIV → obligations SIIV + double régime NIS2 (issue #98)', () => {
    const o = regulatoryObligations('OIV')
    expect(o).toContain('oivAnssiSubmit')
    expect(o).toContain('oivSectorGuide')
    expect(o).toContain('oivCrisisExercise')
    expect(o).toContain('oivNis2Cumul') // double obligation OIV (LPM) + EEI (NIS2)
  })
  it('EEI (NIS2) → obligations NIS2 (notification d\'incident)', () => {
    const o = regulatoryObligations('EEI')
    expect(o.length).toBeGreaterThan(0)
    expect(o).toContain('eeiIncident')
  })
  it('EEI + secteur santé → autorité sectorielle ANS, pas ANSSI (issue #81)', () => {
    const o = regulatoryObligations('EEI', 'Santé / Médico-social')
    expect(o).toContain('eeiIncidentSante')
    expect(o).not.toContain('eeiIncident')
  })
  it('EEI hors santé → texte générique (ANSSI)', () => {
    const o = regulatoryObligations('EEI', 'Banque / Finance')
    expect(o).toContain('eeiIncident')
    expect(o).not.toContain('eeiIncidentSante')
  })
  it('OSE (NIS1) → au moins une obligation', () => {
    expect(regulatoryObligations('OSE').length).toBeGreaterThan(0)
  })
  it('aucun / null / inconnu → []', () => {
    expect(regulatoryObligations('aucun')).toEqual([])
    expect(regulatoryObligations(null)).toEqual([])
    expect(regulatoryObligations(undefined)).toEqual([])
    expect(regulatoryObligations('xxx')).toEqual([])
  })
})

describe('suggestsComplianceModule (issue #73)', () => {
  it('vrai pour les secteurs réglementés (NIS2 / régulés)', () => {
    for (const s of ['Banque / Finance', 'Santé / Médico-social', 'Énergie / Utilities',
      'Administration publique', 'Eau / Assainissement', 'Télécommunications', 'Défense / Sécurité nationale']) {
      expect(suggestsComplianceModule(s)).toBe(true)
    }
  })
  it('vrai dès qu\'un statut réglementaire est renseigné (même secteur neutre)', () => {
    expect(suggestsComplianceModule('Médias / Culture', 'EEI')).toBe(true)
    expect(suggestsComplianceModule(null, 'OIV')).toBe(true)
  })
  it('couvre l’enseignement supérieur et la recherche (ESR) (issue #101)', () => {
    expect(suggestsComplianceModule('Éducation / Recherche')).toBe(true)
    expect(suggestsComplianceModule('Université / enseignement supérieur')).toBe(true)
  })
  it('faux pour un secteur non réglementé sans statut', () => {
    expect(suggestsComplianceModule('Médias / Culture')).toBe(false)
    expect(suggestsComplianceModule('Tourisme / Hôtellerie-restauration', 'aucun')).toBe(false)
    expect(suggestsComplianceModule('')).toBe(false)
    expect(suggestsComplianceModule(null)).toBe(false)
  })
})

describe('reportUsageNotes (issues #70/#74)', () => {
  it('DORA sélectionné → note documentation risque ICT (art. 8)', () => {
    expect(reportUsageNotes(['DORA', 'ISO27001'], 'Banque / Finance')).toContain('doraArt8')
  })
  it('secteur public → note dossier d\'homologation SSI', () => {
    expect(reportUsageNotes(['ANSSI_HYG'], 'Administration publique')).toContain('homologationSSI')
    expect(reportUsageNotes([], 'Collectivité territoriale')).toContain('homologationSSI')
  })
  it('assurance → note d’articulation ORSA (Solvabilité II) (issue #96)', () => {
    expect(reportUsageNotes([], 'Assurance / mutuelle')).toContain('orsaSolva2')
    expect(reportUsageNotes(['DORA'], 'Banque / Finance')).not.toContain('orsaSolva2')
  })
  it('défense privée (BITD) avec VM classifiée → note homologation II 901 (issue #103)', () => {
    // Seulement si une valeur métier est classifiée (DR/SD)
    expect(reportUsageNotes(['ISO27001'], 'Défense / BITD', true)).toContain('homologationII901')
    // Défense sans VM classifiée → pas de note II 901
    expect(reportUsageNotes(['ISO27001'], 'Défense / BITD', false)).not.toContain('homologationII901')
    // Hors défense, même avec VM classifiée → pas de note II 901
    expect(reportUsageNotes([], 'Administration publique', true)).not.toContain('homologationII901')
  })
  it('ni DORA ni public → aucune note', () => {
    expect(reportUsageNotes(['ISO27001'], 'Tourisme / Hôtellerie-restauration')).toEqual([])
    expect(reportUsageNotes(undefined, null)).toEqual([])
  })
})

describe('nis2Classification (issues #85/#92)', () => {
  it('secteurs Annexe I → entité essentielle', () => {
    for (const s of ['Administration publique', 'Banque / Finance', 'Énergie / Utilities',
      'Santé / Médico-social', 'Télécommunications', 'Transports / Logistique', 'Eau / Assainissement',
      'Informatique / Numérique']) {
      expect(nis2Classification(s)).toBe('essentielle')
    }
  })
  it('secteurs Annexe II → entité importante (dont ESR — recherche)', () => {
    for (const s of ['Industrie / Manufacturing', 'Agriculture / Agroalimentaire',
      'E-commerce / Marketplace', 'Éducation / Recherche', 'Université / enseignement supérieur']) {
      expect(nis2Classification(s)).toBe('importante')
    }
  })
  it('hors périmètre NIS2 → null (défense exclue, commerce, juridique, immobilier…)', () => {
    for (const s of ['Défense / Sécurité nationale', 'Commerce / Distribution',
      "Professions juridiques / Cabinet d'avocats", 'Immobilier / Construction',
      'Médias / Culture', 'Tourisme / Hôtellerie-restauration', 'Associations / ESS', 'Autre', '']) {
      expect(nis2Classification(s)).toBeNull()
    }
  })
})

describe('doraPrevailsOverNis2 (issue #84)', () => {
  it('vrai pour le secteur financier', () => {
    expect(doraPrevailsOverNis2('Banque / Finance')).toBe(true)
    expect(doraPrevailsOverNis2('Assurance')).toBe(true)
  })
  it('faux hors finance', () => {
    expect(doraPrevailsOverNis2('Santé / Médico-social')).toBe(false)
    expect(doraPrevailsOverNis2(null)).toBe(false)
  })
})
