import { describe, expect, it } from 'vitest'
import { applyHistoricRowOverrides, buildHistoricImportPackage, buildHistoricImportPackages, detectHistoricHeaderLayout, detectHistoricImportSheet, extractHistoricMappedValues, getHistoricColumnCompatibility, partitionHistoricImportSheets, profileHistoricColumn, resolveHistoricImportSheetType, suggestHistoricColumnMapping, validateHistoricColumnProfile, validateHistoricImportFormats, validateHistoricImportSelection, validateHistoricColumnMapping } from '@/lib/historic-import'

describe('detectHistoricImportSheet', () => {
  it('reconnaît une feuille de risques malgré les accents et espaces', () => {
    expect(detectHistoricImportSheet(' Registre des risques ', ['Référence risque', 'Intitulé', 'Gravité', 'Vraisemblance'])).toMatchObject({ type: 'RISKS', confidence: 'HIGH' })
  })

  it('propose le type plan d’action par ses colonnes, sans inventer de lien', () => {
    expect(detectHistoricImportSheet('Suivi', ['Action ID', 'Intitulé action', 'Échéance', 'Responsable'])).toMatchObject({ type: 'ACTIONS', confidence: 'MEDIUM' })
  })

  it.each([
    ['Risks', ['Risk ID', 'Risk label', 'Impact', 'Likelihood']],
    ['registre', ['Libellé de risque', 'Gravité', 'Probabilité']],
  ])('reconnaît les synonymes métier de risque : %s', (name, columns) => {
    expect(detectHistoricImportSheet(name, columns)).toMatchObject({ type: 'RISKS', confidence: 'HIGH' })
  })

  it('reconnaît une feuille de vulnérabilités rattachée par référence de risque', () => {
    expect(detectHistoricImportSheet('Vulnérabilités', ['Référence risque', 'Libellé vulnérabilité'])).toMatchObject({ type: 'VULNERABILITIES', confidence: 'HIGH' })
  })

  it('mappe la référence d’analyse normalisée par les exports GRC', () => {
    expect(suggestHistoricColumnMapping(['analysis_external_id', 'Risk label']).analysisExternalId).toBe('analysis_external_id')
  })

  it('signale une feuille inconnue', () => {
    expect(detectHistoricImportSheet('Divers', ['Colonne A'])).toEqual({ type: 'UNKNOWN', confidence: 'NONE', missing: [] })
  })
})

describe('detectHistoricHeaderLayout', () => {
  it('trouve les en-têtes après un titre et conserve les index quand une colonne est vide', () => {
    const layout = detectHistoricHeaderLayout([
      ['Registre des risques 2026'],
      [],
      ['Référence risque', '', 'Libellé de risque', 'Gravité', 'Probabilité'],
      ['R-1', 'interne', 'Indisponibilité', '3', '2'],
    ])

    expect(layout.headerRowIndex).toBe(2)
    expect(layout.columns).toEqual([
      { key: 'Référence risque', label: 'Référence risque', index: 0 },
      { key: 'Libellé de risque', label: 'Libellé de risque', index: 2 },
      { key: 'Gravité', label: 'Gravité', index: 3 },
      { key: 'Probabilité', label: 'Probabilité', index: 4 },
    ])
  })

  it('rend deux en-têtes identiques sélectionnables sans les écraser', () => {
    const layout = detectHistoricHeaderLayout([['ID', 'ID', 'Intitulé'], ['R-1', 'client-42', 'Risque']])
    expect(layout.columns.map(column => column.key)).toEqual(['ID', 'ID [B]', 'Intitulé'])
  })
})

describe('buildHistoricImportPackage', () => {
  it('complète uniquement le champ requis explicitement saisi pour une ligne autrement rejetée', () => {
    const sheets = applyHistoricRowOverrides([{
      name: 'Risques', type: 'RISKS', mapping: { title: 'Intitulé' },
      rows: [{ Intitulé: '' }], rowNumbers: [8],
    }], { Risques: { '8': { title: 'Risque complété par l’utilisateur', gravity: '4' } } })

    expect(sheets[0].rows[0]).toEqual({ Intitulé: 'Risque complété par l’utilisateur' })
    expect(partitionHistoricImportSheets(sheets).decisions).toContainEqual({ sheetName: 'Risques', row: 8, status: 'READY' })
  })

  it('signale tous les champs requis manquants d’une même ligne avant de proposer une correction', () => {
    const partition = partitionHistoricImportSheets([{
      name: 'Liens', type: 'RISK_ACTION_LINKS', mapping: { riskExternalId: 'Risque', actionExternalId: 'Action' }, rows: [{ Risque: '', Action: '' }], rowNumbers: [12],
    }])
    expect(partition.decisions).toEqual(expect.arrayContaining([
      { sheetName: 'Liens', row: 12, status: 'REJECTED', field: 'riskExternalId', reason: 'MISSING_REQUIRED_VALUE', sourceColumn: 'Risque', sourceValue: '', expectedValue: 'référence non vide' },
      { sheetName: 'Liens', row: 12, status: 'REJECTED', field: 'actionExternalId', reason: 'MISSING_REQUIRED_VALUE', sourceColumn: 'Action', sourceValue: '', expectedValue: 'référence non vide' },
    ]))
  })

  it('préserve le sous-ensemble fiable et documente les lignes rejetées ou champs retirés', () => {
    const partition = partitionHistoricImportSheets([
      { name: 'Risques', type: 'RISKS', mapping: { externalId: 'Ref', title: 'Risque', gravity: 'Gravité' }, rows: [
        { Ref: 'R-1', Risque: 'Risque fiable', Gravité: '3' },
        { Ref: 'R-2', Risque: '', Gravité: '2' },
        { Ref: 'R-3', Risque: 'Risque sans cotation fiable', Gravité: 'très fort' },
      ], rowNumbers: [4, 5, 6] },
    ])

    expect(partition.sheets[0].rows).toEqual([
      { Ref: 'R-1', Risque: 'Risque fiable', Gravité: '3' },
      { Ref: 'R-3', Risque: 'Risque sans cotation fiable', Gravité: '' },
    ])
    expect(partition.decisions).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'REJECTED', row: 5, field: 'title', reason: 'MISSING_REQUIRED_VALUE' }),
      expect.objectContaining({ status: 'FIELD_OMITTED', row: 6, field: 'gravity', reason: 'INVALID_FORMAT' }),
    ]))
  })

  it('propage une référence fusionnée uniquement quand le mapping le demande', () => {
    const partition = partitionHistoricImportSheets([{
      name: 'Vulnérabilités', type: 'VULNERABILITIES',
      mapping: { riskExternalId: 'Référence risque', title: 'Vulnérabilité' },
      transforms: { riskExternalId: { carryForward: true } },
      rows: [
        { 'Référence risque': 'R-1', Vulnérabilité: 'Sauvegardes non testées' },
        { 'Référence risque': '', Vulnérabilité: 'PRA non exercé' },
      ],
    }])
    expect(partition.sheets[0].rows[1]['Référence risque']).toBe('R-1')
    expect(partition.decisions).toContainEqual(expect.objectContaining({ status: 'READY', row: 3 }))
  })

  it('éclate explicitement les vulnérabilités listées dans une seule cellule, sans toucher au texte libre par défaut', () => {
    const row = { Risque: 'R-1', Vulnérabilités: '• Sauvegardes non testées\n• PRA jamais exercé' }
    expect(extractHistoricMappedValues(row, 'Vulnérabilités')).toEqual(['• Sauvegardes non testées\n• PRA jamais exercé'])
    expect(extractHistoricMappedValues(row, 'Vulnérabilités', { mode: 'LINES' })).toEqual(['Sauvegardes non testées', 'PRA jamais exercé'])

    const result = buildHistoricImportPackage([{
      type: 'VULNERABILITIES',
      mapping: { riskExternalId: 'Risque', title: 'Vulnérabilités' },
      transforms: { title: { mode: 'LINES' } },
      rows: [row],
    }], 'Import historique')

    expect(result.vulnerabilities).toEqual([
      { riskExternalId: 'R-1', title: 'Sauvegardes non testées' },
      { riskExternalId: 'R-1', title: 'PRA jamais exercé' },
    ])
  })

  it('diffuse une référence risque vers plusieurs plans listés dans une même cellule', () => {
    const result = buildHistoricImportPackage([{
      type: 'ACTIONS',
      mapping: { riskExternalId: 'Risque', title: 'Plans' },
      transforms: { title: { mode: 'SEMICOLON' } },
      rows: [{ Risque: 'R-1', Plans: 'Tester le PRA ; Former les équipes' }],
    }], 'Import historique')

    expect(result.actions).toEqual([
      expect.objectContaining({ riskExternalId: 'R-1', title: 'Tester le PRA' }),
      expect.objectContaining({ riskExternalId: 'R-1', title: 'Former les équipes' }),
    ])
  })

  it('importe les vulnérabilités et plans contenus dans la même ligne que le risque', () => {
    const result = buildHistoricImportPackage([{
      type: 'RISKS',
      mapping: { externalId: 'Ref', title: 'Risque', embeddedVulnerabilities: 'Faiblesses', embeddedActions: 'Traitements' },
      transforms: { embeddedVulnerabilities: { mode: 'LINES' }, embeddedActions: { mode: 'SEMICOLON' } },
      rows: [{ Ref: 'R-1', Risque: 'Indisponibilité', Faiblesses: 'Sauvegardes non testées\nPRA absent', Traitements: 'Tester PRA ; Former les équipes' }],
    }], 'Import historique')

    expect(result.vulnerabilities).toEqual([
      { riskExternalId: 'R-1', title: 'Sauvegardes non testées' },
      { riskExternalId: 'R-1', title: 'PRA absent' },
    ])
    expect(result.actions).toEqual([
      expect.objectContaining({ riskExternalId: 'R-1', title: 'Tester PRA' }),
      expect.objectContaining({ riskExternalId: 'R-1', title: 'Former les équipes' }),
    ])
  })

  it('applique un mapping explicite d’échelle source avant de créer le risque', () => {
    const result = buildHistoricImportPackage([{
      type: 'RISKS', mapping: { title: 'Risque', gravity: 'Impact', likelihood: 'Probabilité' },
      scoreMappings: { gravity: { '5': '4' }, likelihood: { Faible: '1' } },
      rows: [{ Risque: 'Risque consultant', Impact: '5', Probabilité: 'Faible' }],
    }], 'Import historique')
    expect(result.risks[0]).toMatchObject({ gravity: 4, likelihood: 1 })
  })

  it('déplie les liens multi-risques/multi-plans par position ou diffusion, jamais en produit cartésien', () => {
    const result = buildHistoricImportPackage([{
      type: 'RISK_ACTION_LINKS',
      mapping: { riskExternalId: 'Risques', actionExternalId: 'Actions' },
      transforms: { riskExternalId: { mode: 'PIPE' }, actionExternalId: { mode: 'PIPE' } },
      rows: [
        { Risques: 'R-1|R-2', Actions: 'A-1|A-2' },
        { Risques: 'R-3', Actions: 'A-3|A-4' },
        { Risques: 'R-5|R-6', Actions: 'A-5|A-6|A-7' },
      ],
    }], 'Import historique')
    expect(result.links).toEqual([
      { riskExternalId: 'R-1', actionExternalId: 'A-1' },
      { riskExternalId: 'R-2', actionExternalId: 'A-2' },
      { riskExternalId: 'R-3', actionExternalId: 'A-3' },
      { riskExternalId: 'R-3', actionExternalId: 'A-4' },
    ])
  })

  it('conserve les références externes afin de relier risques et actions après import', () => {
    const result = buildHistoricImportPackage([
      { type: 'RISKS', mapping: { externalId: 'Ref', title: 'Risque', gravity: 'G', likelihood: 'V' }, rows: [{ Ref: 'R-1', Risque: 'Indisponibilité', G: '3', V: '2' }] },
      { type: 'ACTIONS', mapping: { externalId: 'Ref action', riskExternalId: 'Ref risque', title: 'Action' }, rows: [{ 'Ref action': 'A-1', 'Ref risque': 'R-1', Action: 'Tester le PRA' }] },
    ], 'Import historique')
    expect(result.risks).toEqual([expect.objectContaining({ externalId: 'R-1', title: 'Indisponibilité', gravity: 3, likelihood: 2 })])
    expect(result.actions).toEqual([expect.objectContaining({ externalId: 'A-1', riskExternalId: 'R-1', title: 'Tester le PRA' })])
  })

  it('importe des vulnérabilités depuis une autre feuille du même classeur', () => {
    const result = buildHistoricImportPackage([
      { type: 'RISKS', mapping: { externalId: 'Ref', title: 'Risque' }, rows: [{ Ref: 'R-1', Risque: 'Indisponibilité' }] },
      { type: 'VULNERABILITIES', mapping: { riskExternalId: 'Ref risque', title: 'Libellé vulnérabilité' }, rows: [{ 'Ref risque': 'R-1', 'Libellé vulnérabilité': 'Sauvegardes non testées' }] },
    ], 'Import historique')
    expect(result.vulnerabilities).toEqual([{ riskExternalId: 'R-1', title: 'Sauvegardes non testées' }])
  })

  it('sépare les risques de deux analyses grâce à leur référence source', () => {
    const packages = buildHistoricImportPackages([
      { type: 'ANALYSES', mapping: { externalId: 'Analyse ID', title: 'Titre' }, rows: [{ 'Analyse ID': 'A-1', Titre: 'Analyse 1' }, { 'Analyse ID': 'A-2', Titre: 'Analyse 2' }] },
      { type: 'RISKS', mapping: { externalId: 'Risque ID', analysisExternalId: 'Analyse ID', title: 'Risque' }, rows: [{ 'Analyse ID': 'A-1', 'Risque ID': 'R-1', Risque: 'R1' }, { 'Analyse ID': 'A-2', 'Risque ID': 'R-2', Risque: 'R2' }] },
      { type: 'VULNERABILITIES', mapping: { riskExternalId: 'Risque ID', title: 'Vulnérabilité' }, rows: [{ 'Risque ID': 'R-1', Vulnérabilité: 'V1' }, { 'Risque ID': 'R-2', Vulnérabilité: 'V2' }] },
    ], 'Fallback')
    expect(packages.map(item => [item.analysis.title, item.risks[0]?.title])).toEqual([['Analyse 1', 'R1'], ['Analyse 2', 'R2']])
    expect(packages.map(item => item.vulnerabilities[0]?.title)).toEqual(['V1', 'V2'])
  })
})

describe('validateHistoricColumnMapping', () => {
  it('bloque les risques sans intitulé, mais accepte les cotations absentes', () => {
    expect(validateHistoricColumnMapping('RISKS', { externalId: 'Ref', title: 'Intitulé' })).toEqual([])
    expect(validateHistoricColumnMapping('RISKS', { externalId: 'Ref' })).toEqual(['title'])
  })

  it('exige les deux références pour relier un risque à une action', () => {
    expect(validateHistoricColumnMapping('RISK_ACTION_LINKS', { riskExternalId: 'Risque', actionExternalId: 'Action' })).toEqual([])
    expect(validateHistoricColumnMapping('RISK_ACTION_LINKS', { riskExternalId: 'Risque' })).toEqual(['actionExternalId'])
  })
})

describe('resolveHistoricImportSheetType', () => {
  it('laisse l’utilisateur requalifier une feuille non reconnue avant import', () => {
    expect(resolveHistoricImportSheetType('UNKNOWN', 'MEASURES')).toBe('MEASURES')
  })

  it('laisse l’utilisateur ignorer une feuille détectée automatiquement', () => {
    expect(resolveHistoricImportSheetType('RISKS', 'UNKNOWN')).toBe('UNKNOWN')
  })
})

describe('validation du sous-ensemble importé', () => {
  it('autorise un import minimal composé uniquement de risques avec leur intitulé', () => {
    expect(validateHistoricImportSelection([{ name: 'Registre', type: 'RISKS', mapping: { title: 'Libellé risque' } }])).toEqual([])
  })

  it('bloque des vulnérabilités lorsque les risques ne fournissent pas de référence externe', () => {
    expect(validateHistoricImportSelection([
      { name: 'Risques', type: 'RISKS', mapping: { title: 'Intitulé' } },
      { name: 'Vulnérabilités', type: 'VULNERABILITIES', mapping: { title: 'Faiblesse', riskExternalId: 'Risque lié' } },
    ])).toContainEqual({ sheetName: 'Risques', field: 'externalId' })
  })

  it('bloque des vulnérabilités sans feuille de risques à laquelle les rattacher', () => {
    expect(validateHistoricImportSelection([
      { name: 'Vulnérabilités', type: 'VULNERABILITIES', mapping: { title: 'Faiblesse', riskExternalId: 'Risque lié' } },
    ])).toContainEqual({ sheetName: 'Vulnérabilités', field: '__RISK_SHEET__' })
  })

  it('distingue une colonne reconnue d’une colonne à vérifier manuellement', () => {
    expect(getHistoricColumnCompatibility('title', 'Libellé de risque')).toBe('COMPATIBLE')
    expect(getHistoricColumnCompatibility('title', 'Colonne libre consultant')).toBe('REVIEW')
    expect(getHistoricColumnCompatibility('title', undefined, true)).toBe('MISSING')
  })

  it('signale précisément les valeurs hors échelle d’une cotation', () => {
    const profile = profileHistoricColumn(['1', '4', '5', 'fort'])
    expect(profile.examples).toEqual(['1', '4', '5'])
    expect(validateHistoricColumnProfile('gravity', profile)).toMatchObject({ expected: '1–4', invalidCount: 2, total: 4 })
  })

  it('accepte les dates ISO et rejette les dates ambiguës', () => {
    const profile = profileHistoricColumn(['2026-01-15', '15/01/2026'])
    expect(validateHistoricColumnProfile('dueDate', profile)).toMatchObject({ expected: 'YYYY-MM-DD ou JJ/MM/AAAA', invalidCount: 0, total: 2 })
  })

  it('bloque l’import avant écriture quand une cotation sélectionnée contient des valeurs hors échelle', () => {
    expect(validateHistoricImportFormats([{
      name: 'Risques', type: 'RISKS', mapping: { title: 'Intitulé', gravity: 'Impact' },
      profiles: { Impact: profileHistoricColumn(['2', '5']) },
    }])).toEqual([{ sheetName: 'Risques', field: 'gravity' }])
  })

  it('autorise un statut consultant une fois toutes ses valeurs rapprochées', () => {
    const profile = profileHistoricColumn(['Terminé', 'À démarrer'])
    expect(validateHistoricImportFormats([{ name: 'Mesures', type: 'MEASURES', mapping: { title: 'Nom', status: 'Statut' }, profiles: { Statut: profile }, statusMapping: { Terminé: 'REALISE', 'À démarrer': 'A_FAIRE' } }])).toEqual([])
  })
})
