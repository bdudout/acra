import { describe, expect, it } from 'vitest'
import { ATELIER_ROLES, detectAtelierRole, suggestAtelierMapping, buildAtelierContent, defaultRetainedMode, type AtelierSheet } from '@/lib/import-ateliers-build'

describe('détection des rôles d’atelier (B-IMP-12)', () => {
  it.each([
    ['1 - Valeurs Métiers', ['Réf.VM', 'Dénomination', 'Nature (Information / Processus)', 'Description', 'Besoins de sécurité › Disponibilité', 'Besoins de sécurité › Intégrité', 'Besoins de sécurité › Confidentialité', 'Responsable'], 'BUSINESS_VALUES'],
    ['1 - Événements redoutés', ['Réf.ER', 'Intitulés des événements redoutés', 'Description des événements redoutés', 'Impacts', 'Gravité', 'Valeur(s) Métier(s) liée(s)', 'Retenu ?'], 'FEARED_EVENTS'],
    ['2 - Biens supports', ['SOUS CATEGORIE', 'Réf.BS', 'Catégorie', 'Bien support', 'Description', 'Retenu', 'Responsable'], 'SUPPORT_ASSETS'],
    ['2 - Parties prenantes', ['Réf.PP', 'Catégorie', 'Partie prenante', 'Activités', 'Dépendance', 'Pénétration', 'Maturité', 'Confiance'], 'STAKEHOLDERS'],
    ['1 - SROV', ['Réf.SR/OV', 'Sources de risques', 'Objectifs visés', 'Motivation', 'Ressources', 'Pertinence', 'Retenu ?', 'Justification'], 'RISK_SOURCES'],
    ['3 - S.Stratégiques', ['Réf.SS', 'Scénario stratégique', 'Sources de risques', 'Objectifs visés', 'Intitulé des chemins d\'attaque stratégiques', 'Partie prenante impliquée', 'Evenements redoutés', 'Gravité'], 'STRATEGIC_SCENARIOS'],
    ['4 - S.Opérationnels', ['Réf.SO', 'Réf.SS', 'Source de risque', 'Objectif visé', 'Description du scénario opérationnel', 'Connaitre', 'Facilité d\'exploitation', 'Probabilité d\'exploitation', 'Vraisemblance initiale'], 'OPERATIONAL_SCENARIOS'],
    ['2 - Socle de sécurité', ['Catégorie', 'Sous-catégorie', 'Exigence', 'Description', 'Transverse / Projet', 'Couverture Projet', 'Couverture transverse (organisation)'], 'SECURITY_BASELINE'],
  ])('%s → %s', (name, columns, role) => expect(detectAtelierRole(name, columns)).toMatchObject({ type: role, confidence: 'HIGH' }))
  it('registre de risques, feuille inconnue : pas de rôle d’atelier', () => {
    expect(detectAtelierRole('Registre', ['Réf', 'Risque', 'Gravité'])).toBeNull()
    expect(detectAtelierRole('Divers', ['a', 'b'])).toBeNull()
  })
  it('liste des rôles', () => expect(ATELIER_ROLES).toContain('BUSINESS_VALUES'))
})

describe('risques résiduels (feuille Réf.RR)', () => {
  it('détection par Réf.RR, mapping des trois cotations, construction rattachée aux risques initiaux', () => {
    const cols = ['Réf.RR', 'Réf.RI', 'Intitulé du risque résiduel', 'Option de traitement', 'Gravité initiale', 'Vraisemblance initiale', 'Niveau de risque initial', 'Gravité actuelle', 'Vraisemblance actuelle', 'Niveau de risque actuel', 'Gravité résiduelle', 'Vraisemblance résiduelle', 'Niveau de risque résiduel']
    expect(detectAtelierRole('5 - Risques résiduels', cols)).toMatchObject({ type: 'RESIDUAL_RISKS' })
    const mapping = suggestAtelierMapping('RESIDUAL_RISKS', cols)
    expect(mapping).toMatchObject({ externalId: 'Réf.RR', riskRef: 'Réf.RI', currentGravity: 'Gravité actuelle', currentLikelihood: 'Vraisemblance actuelle', residualGravity: 'Gravité résiduelle', residualLikelihood: 'Vraisemblance résiduelle' })
    const { content } = buildAtelierContent([{ name: 'RR', type: 'RESIDUAL_RISKS', mapping, rows: [{ 'Réf.RR': 'RR_01', 'Réf.RI': 'RI_01', 'Gravité actuelle': '3 - Importante', 'Vraisemblance actuelle': '2 - Vraisemblable', 'Gravité résiduelle': '3 - Importante', 'Vraisemblance résiduelle': '1 - Peu vraisemblable' }, { 'Réf.RR': 'RR_02', 'Réf.RI': '' }] }])
    expect(content.residualRisks).toEqual([{ externalId: 'RR_01', riskExternalId: 'RI1', currentGravity: 3, currentLikelihood: 2, residualGravity: 3, residualLikelihood: 1 }])
  })
})

describe('mapping suggéré par rôle', () => {
  it('valeurs métier : D / I / C composés', () => {
    expect(suggestAtelierMapping('BUSINESS_VALUES', ['Réf.VM', 'Dénomination', 'Nature (Information / Processus)', 'Description', 'Besoins de sécurité › Disponibilité', 'Besoins de sécurité › Intégrité', 'Besoins de sécurité › Confidentialité', 'Besoins de sécurité › Justification DIC', 'Responsable']))
      .toMatchObject({ externalId: 'Réf.VM', title: 'Dénomination', type: 'Nature (Information / Processus)', description: 'Description', availability: 'Besoins de sécurité › Disponibilité', integrity: 'Besoins de sécurité › Intégrité', confidentiality: 'Besoins de sécurité › Confidentialité', responsible: 'Responsable' })
  })
  it('scénarios stratégiques et parties prenantes', () => {
    expect(suggestAtelierMapping('STRATEGIC_SCENARIOS', ['Réf.SS', 'Scénario stratégique', 'Sources de risques', 'Objectifs visés', 'Intitulé des chemins d\'attaque stratégiques', 'Partie prenante impliquée', 'Evenements redoutés', 'Gravité', 'Mesures', 'Commentaires']))
      .toMatchObject({ externalId: 'Réf.SS', title: 'Scénario stratégique', riskSource: 'Sources de risques', objective: 'Objectifs visés', attackPath: 'Intitulé des chemins d\'attaque stratégiques', stakeholderRefs: 'Partie prenante impliquée', fearedEventRefs: 'Evenements redoutés', gravity: 'Gravité' })
    expect(suggestAtelierMapping('STAKEHOLDERS', ['Réf.PP', 'Catégorie', 'Partie prenante', 'Activités', 'Dépendance', 'Pénétration', 'Maturité', 'Confiance']))
      .toMatchObject({ externalId: 'Réf.PP', type: 'Catégorie', title: 'Partie prenante', description: 'Activités', dependency: 'Dépendance', penetration: 'Pénétration', maturity: 'Maturité', trust: 'Confiance' })
  })
})

const sheet = (type: AtelierSheet['type'], mapping: Record<string, string>, rows: Record<string, string>[], extra: Partial<AtelierSheet> = {}): AtelierSheet => ({ name: type, type, mapping, rows, ...extra })

describe('buildAtelierContent — feuilles → paquet canonique v3', () => {
  const vm = sheet('BUSINESS_VALUES', { externalId: 'Réf.VM', title: 'Dénomination', type: 'Nature', availability: 'D', integrity: 'I', confidentiality: 'C' }, [
    { 'Réf.VM': 'VM_01', Dénomination: 'Planification', Nature: 'Processus/Information', D: '3', I: '3', C: '2' },
    { 'Réf.VM': 'VM_02', Dénomination: 'Pointage', Nature: 'Information', D: '3', I: '3', C: '3' },
  ])
  const er = sheet('FEARED_EVENTS', { externalId: 'Réf.ER', title: 'Intitulé', gravity: 'Gravité', businessValueRefs: 'VM liées', retained: 'Retenu ?' }, [
    { 'Réf.ER': 'ER_01', Intitulé: 'Divulgation', Gravité: '3 - Importante', 'VM liées': 'VM02, VM_01', 'Retenu ?': 'Oui' },
    { 'Réf.ER': 'ER_02', Intitulé: 'Indisponibilité', Gravité: '2 - Limitée', 'VM liées': 'VM_01 à VM_02', 'Retenu ?': 'Non' },
  ])
  it('valeurs métier : besoins D/I/C, type ; événements redoutés : gravité lue dans « N - libellé », liens par référence, non retenus écartés', () => {
    const { content, report } = buildAtelierContent([vm, er])
    expect(content.businessValues[1]).toMatchObject({ externalId: 'VM_02', title: 'Pointage', needs: { availability: 3, integrity: 3, confidentiality: 3 } })
    expect(content.fearedEvents).toHaveLength(1)
    expect(content.fearedEvents[0]).toMatchObject({ externalId: 'ER_01', gravity: 3, businessValueExternalIds: ['VM2', 'VM1'] })
    expect(report.notRetained).toEqual({ FEARED_EVENTS: 1 })
  })
  it('sources de risque : lignes SR/OV regroupées par source, objectifs listés, symboles + → niveaux, catégorie via le dictionnaire (AUTRE signalé)', () => {
    const sr = sheet('RISK_SOURCES', { externalId: 'Réf', title: 'Source', objective: 'Objectif', motivation: 'Motivation', resources: 'Ressources', retained: 'Retenu ?', justification: 'Justif' }, [
      { Réf: 'SR/OV_01', Source: 'Etat', Objectif: 'Espionnage', Motivation: '+ +', Ressources: '+ + +', 'Retenu ?': 'Non', Justif: 'Non' },
      { Réf: 'SR/OV_02', Source: 'Etat', Objectif: 'Influence', Motivation: '+ +', Ressources: '+ + +', 'Retenu ?': 'Non', Justif: 'Non' },
      { Réf: 'SR/OV_20', Source: 'Officine Spécialisée', Objectif: 'Lucratif', Motivation: '+ + +', Ressources: '+ + +', 'Retenu ?': 'Oui', Justif: 'Prestataire d’attaque' },
    ])
    const { content, report } = buildAtelierContent([sr])
    expect(content.riskSources).toHaveLength(2)
    expect(content.riskSources[0]).toMatchObject({ title: 'Etat', category: 'ETAT_NATION', motivation: 2, resources: 3, retained: false, objectives: ['Espionnage', 'Influence'] })
    expect(content.riskSources[1]).toMatchObject({ title: 'Officine Spécialisée', category: 'AUTRE', retained: true, justification: 'Prestataire d’attaque' })
    expect(report.defaulted).toEqual([{ sheet: 'RISK_SOURCES', field: 'category', source: 'Officine Spécialisée', value: 'AUTRE' }])
  })
  it('parties prenantes et scénarios : références résolues par leurs feuilles, source par nom, ER cités avec libellé', () => {
    const pp = sheet('STAKEHOLDERS', { externalId: 'Réf', title: 'Partie prenante', type: 'Catégorie', dependency: 'Dép', penetration: 'Pén', maturity: 'Mat', trust: 'Conf' }, [{ Réf: 'PP_01', 'Partie prenante': 'Chefs de chantier', Catégorie: 'Interne', Dép: '4', Pén: '2', Mat: '3', Conf: '4' }])
    const ss = sheet('STRATEGIC_SCENARIOS', { externalId: 'Réf', title: 'Scénario', riskSource: 'Source', objective: 'Objectif', stakeholderRefs: 'PP', fearedEventRefs: 'ER', gravity: 'Gravité', attackPath: 'Chemin' }, [
      { Réf: 'SS_03', Scénario: 'Vol de données', Source: 'Malveillant pathologique', Objectif: 'Lucratif', PP: 'PP_01, PP_27', ER: 'ER01 : Divulgation ER_02: Indisponibilité', Gravité: '3 - Importante', Chemin: '1 - Hameçonnage 2 - Usurpation' },
    ])
    const so = sheet('OPERATIONAL_SCENARIOS', { externalId: 'Réf', strategicRef: 'Réf.SS', title: 'Description', likelihood: 'Vraisemblance' }, [{ Réf: 'SO_03a', 'Réf.SS': 'SS03', Description: 'Hameçonnage ciblé', Vraisemblance: '2 - Vraisemblable' }])
    const { content } = buildAtelierContent([vm, er, pp, ss, so])
    expect(content.stakeholders[0]).toMatchObject({ title: 'Chefs de chantier', type: 'AUTRE', dependency: 4, penetration: 2, maturity: 3, trust: 4 })
    expect(content.strategicScenarios[0]).toMatchObject({ externalId: 'SS_03', gravity: 3, riskSourceLabel: 'Malveillant pathologique', stakeholderExternalIds: ['PP1', 'PP27'], fearedEventExternalIds: ['ER1', 'ER2'], attackPath: ['Hameçonnage', 'Usurpation'] })
    expect(content.operationalScenarios[0]).toMatchObject({ externalId: 'SO_03a', strategicScenarioExternalId: 'SS3', title: 'Hameçonnage ciblé', likelihood: 2 })
  })
  it('socle : exigences sans référence ; couverture 0–3', () => {
    const sb = sheet('SECURITY_BASELINE', { title: 'Description', category: 'Catégorie', subCategory: 'Sous-catégorie', coverage: 'Couverture' }, [{ Description: 'Comptes nominatifs', Catégorie: 'Protection', 'Sous-catégorie': 'Identités', Couverture: '2' }, { Description: 'Journaux conservés 12 mois', Catégorie: 'Défense', 'Sous-catégorie': 'Exploitation', Couverture: 'NA' }])
    const { content } = buildAtelierContent([sb])
    expect(content.securityBaseline).toEqual([
      { title: 'Comptes nominatifs', category: 'Protection', subCategory: 'Identités', coverage: 2 },
      { title: 'Journaux conservés 12 mois', category: 'Défense', subCategory: 'Exploitation' },
    ])
  })
  it('modes de retenue par défaut : biens supports = retenus seulement ; sources = tous (indicateur conservé)', () => {
    expect(defaultRetainedMode('SUPPORT_ASSETS')).toBe('ONLY_RETAINED')
    expect(defaultRetainedMode('RISK_SOURCES')).toBe('ALL')
  })
  it('aucune feuille d’atelier : contenu vide', () => {
    expect(buildAtelierContent([]).content.businessValues).toEqual([])
  })
})

describe('correspondances de valeurs validées par l’utilisateur (B-IMP-32)', () => {
  it('la table choisie prime sur le dictionnaire ; sans table, AUTRE reste signalé', () => {
    const sr = sheet('RISK_SOURCES', { title: 'Source', objective: 'Objectif' }, [{ Source: 'Officine Spécialisée', Objectif: 'Lucratif' }, { Source: 'Etat', Objectif: 'Espionnage' }], { valueMaps: { category: { 'Officine Spécialisée': 'CYBERCRIMINEL' } } })
    const { content, report } = buildAtelierContent([sr])
    expect(content.riskSources.map(x => x.category)).toEqual(['CYBERCRIMINEL', 'ETAT_NATION'])
    expect(report.defaulted).toEqual([])
    const pp = sheet('STAKEHOLDERS', { title: 'PP', type: 'Cat' }, [{ PP: 'Hébergeur', Cat: 'Externe' }], { valueMaps: { type: { Externe: 'PRESTATAIRE' } } })
    expect(buildAtelierContent([pp]).content.stakeholders[0].type).toBe('PRESTATAIRE')
  })
})
