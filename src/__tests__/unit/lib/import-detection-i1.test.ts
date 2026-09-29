/**
 * Lot I1 (import universel) — non-régression de la détection sur les en-têtes d'un dossier EBIOS RM :
 * aucune feuille d'échelles ou de scénarios n'est proposée « Risques » à confiance haute.
 */
import { describe, expect, it } from 'vitest'
import { detectHistoricImportSheet, detectHistoricHeaderLayout, suggestHistoricColumnMapping } from '@/lib/historic-import'

describe('détection de rôle : pas de faux positif « Risques » (B-IMP-13)', () => {
  it('feuille d’échelles (métriques) : ni risques ni confiance haute', () => {
    const r = detectHistoricImportSheet('Métriques', ['Besoins de sécurité', 'Échelle de gravité', 'Couverture du socle de sécurité', 'Ressource', 'Motivation', 'Évaluation de la pertinence des couples SR/OV', 'Échelle de vraisemblance', 'Échelle des niveaux de risques', 'Calcul du niveau de risque'])
    expect(r.type).toBe('UNKNOWN')
    expect(r.confidence).toBe('NONE')
  })
  it('scénarios stratégiques (sources de risques + gravité) : rôle d’atelier, pas des risques', () => {
    const r = detectHistoricImportSheet('3 - S.Stratégiques', ['Réf.SS', 'Scénario stratégique', 'Sources de risques', 'Objectifs visés', 'Intitulé des chemins d\'attaque stratégiques', 'Partie prenante impliquée', 'Evenements redoutés', 'Gravité', 'Mesures', 'Commentaires'])
    expect(r.type).toBe('STRATEGIC_SCENARIOS') // reconnu par sa colonne Réf.SS, jamais comme registre de risques
  })
  it('scénarios opérationnels (probabilité d’exploitation) : pas des risques', () => {
    const r = detectHistoricImportSheet('4 - S.Opérationnels', ['Réf.SO', 'Réf.SS', 'Source de risque', 'Objectif visé', 'Description du scénario opérationnel', 'Connaitre', 'Rentrer', 'Trouver', 'Exploiter', 'Facilité d\'exploitation', 'Probabilité d\'exploitation', 'Vraisemblance initiale', 'Commentaires'])
    expect(r.type).toBe('OPERATIONAL_SCENARIOS')
  })
  it('sources de risque / objectifs visés, événements redoutés : pas des risques', () => {
    expect(detectHistoricImportSheet('1 - SROV', ['Réf.SR/OV', 'Sources de risques', 'Objectifs visés', 'Motivation', 'Ressources', 'Pertinence', 'Retenu ?', 'Justification']).type).toBe('RISK_SOURCES')
    expect(detectHistoricImportSheet('1 - Événements redoutés', ['Réf.ER', 'Intitulés des événements redoutés', 'Description des événements redoutés', 'Impacts', 'Gravité', 'Valeur(s) Métier(s) liée(s)', 'Retenu ?']).type).toBe('FEARED_EVENTS')
  })
  it('vrais registres de risques toujours reconnus (feuille « Risques initiaux », registres plats)', () => {
    expect(detectHistoricImportSheet('5 - Risques initiaux', ['Réf.RI', 'Réf.SS', 'Gravité initiale', 'Réf.SO', 'Vraisemblance initiale', 'Niveau de risque initial', 'Description du risque', 'Traitement du risque initial'])).toMatchObject({ type: 'RISKS', confidence: 'HIGH' })
    expect(detectHistoricImportSheet('Feuil1', ['Réf', 'Risque', 'Description', 'Impact', 'Probabilité', 'Traitement'])).toMatchObject({ type: 'RISKS', confidence: 'HIGH' })
    expect(detectHistoricImportSheet('Registre', ['ID', 'Libellé du risque', 'Gravité', 'Vraisemblance'])).toMatchObject({ type: 'RISKS' })
  })
  it('plan de mesures : reste reconnu comme mesures', () => {
    expect(detectHistoricImportSheet('5 - PACS', ['Réf. de la mesure de sécurité', 'Description courte de la mesure', 'Description longue', 'Catégorie de la mesure', 'Réf. des risques initiaux concernés', 'Statut', 'Date de mise en œuvre', 'Responsable', 'Priorité', 'Origine']).type).toBe('MEASURES')
  })
})

describe('en-tête : titres, bandeaux et paragraphes ne sont jamais l’en-tête (B-IMP-11)', () => {
  const ref = ['Réf.SR/OV', 'Sources de risques', 'Objectifs visés', 'Motivation', 'Ressources', 'Pertinence', 'Retenu ?', 'Justification']
  it('titre fusionné (une seule cellule) puis bandeau de groupes puis vrais en-têtes', () => {
    const rows = [
      ['Analyse de risques 1 - Sélection et évaluation des couples SR/OV'],
      [],
      ['>>> Accès au sommaire <<<'],
      ['Identification', '', '', 'Cotation', '', '', '', 'Commentaires'],
      ref,
      ['SR/OV_01', 'Etat', 'Espionnage', '+ +', '+ + +', '3 - Elevé', 'Non', 'Non'],
    ]
    expect(detectHistoricHeaderLayout(rows).headerRowIndex).toBe(4)
  })
  it('titre de feuille contenant des mots-clés (« … Traitement des risques initiaux ») : pas retenu', () => {
    const rows = [['Analyse de risques 5 - Traitement des risques initiaux'], [], [], [], ['Réf.RI', 'Réf.SS', 'Gravité initiale', 'Réf.SO', 'Vraisemblance initiale', 'Niveau de risque initial', 'Description du risque', 'Traitement du risque initial'], ['RI_01', 'SS_01', '2 - Limitée', 'SO_01', '2 - Vraisemblable', '1 - Faible', 'Un utilisateur…', 'Partage']]
    expect(detectHistoricHeaderLayout(rows).headerRowIndex).toBe(4)
  })
  it('paragraphe de texte libre : jamais pris pour un en-tête', () => {
    const long = 'Application mobile et web de suivi de chantiers : planning, pointage des heures, échanges avec les sous-traitants et photos de chantier, connectée à la comptabilité.'
    const rows = [['Contexte du projet et description fonctionnelle :'], [long], [], ['Contexte juridique et réglementaire :'], [long]]
    const layout = detectHistoricHeaderLayout(rows)
    expect(layout.columns.map(c => c.label)).not.toContain(long)
  })
})

describe('lot I2 — en-têtes sur deux niveaux (B-IMP-10)', () => {
  const rows = [
    ['Analyse de risques 1 - Valeurs métier'],
    [],
    ['Réf.VM', 'Dénomination', 'Nature (Information / Processus)', 'Description', 'Besoins de sécurité', '', '', '', 'Responsable', 'Parties prenantes associées'],
    ['', '', '', '', 'Disponibilité', 'Intégrité', 'Confidentialité', 'Justification DIC', '', ''],
    ['VM_01', 'Administration', 'Processus/Information', 'Déploiement national', '2', '3', '2', 'D2 : pas d’urgence', 'Chefs de projet', 'MOA'],
  ]
  it('compose « bandeau › sous-en-tête » et place les données après les deux lignes', () => {
    const l = detectHistoricHeaderLayout(rows)
    expect(l.headerRowIndex).toBe(3)
    expect(l.columns.map(c => [c.key, c.index])).toEqual([
      ['Réf.VM', 0], ['Dénomination', 1], ['Nature (Information / Processus)', 2], ['Description', 3],
      ['Besoins de sécurité › Disponibilité', 4], ['Besoins de sécurité › Intégrité', 5], ['Besoins de sécurité › Confidentialité', 6], ['Besoins de sécurité › Justification DIC', 7],
      ['Responsable', 8], ['Parties prenantes associées', 9],
    ])
  })
  it('une première ligne de données n’est jamais prise pour un sous-en-tête', () => {
    const l = detectHistoricHeaderLayout([['Réf.ER', 'Intitulé', 'Gravité'], ['ER_01', 'Divulgation', '3 - Importante']])
    expect(l.headerRowIndex).toBe(0)
    expect(l.columns.map(c => c.key)).toEqual(['Réf.ER', 'Intitulé', 'Gravité'])
  })
  it('deux lignes d’en-tête sans bandeau fusionné : pas de composition', () => {
    const l = detectHistoricHeaderLayout([['Réf', 'Libellé du risque', 'Gravité'], ['', '', ''], ['R1', 'Risque', '2']])
    expect(l.headerRowIndex).toBe(0)
  })
})

describe('lot I2 — alias multilingues (B-IMP-16)', () => {
  it.each([
    ['Risks', ['Risiko', 'Bezeichnung des Risikos', 'Auswirkung', 'Wahrscheinlichkeit']],
    ['Riesgos', ['Riesgo', 'Descripción del riesgo', 'Impacto', 'Probabilidad']],
    ['Rischi', ['Rischio', 'Descrizione del rischio', 'Impatto', 'Probabilità']],
  ])('reconnaît un registre de risques : %s', (name, cols) => {
    expect(detectHistoricImportSheet(name, cols)).toMatchObject({ type: 'RISKS' })
  })
  it('propose le mapping de colonnes usuelles dans les 5 langues', () => {
    expect(suggestHistoricColumnMapping(['Risiko', 'Auswirkung', 'Wahrscheinlichkeit', 'Verantwortlich', 'Frist'])).toMatchObject({ gravity: 'Auswirkung', likelihood: 'Wahrscheinlichkeit', responsible: 'Verantwortlich', dueDate: 'Frist' })
    expect(suggestHistoricColumnMapping(['Gravedad', 'Probabilidad', 'Responsable', 'Fecha límite'])).toMatchObject({ gravity: 'Gravedad', likelihood: 'Probabilidad', responsible: 'Responsable', dueDate: 'Fecha límite' })
    expect(suggestHistoricColumnMapping(['Gravità', 'Probabilità', 'Responsabile', 'Scadenza'])).toMatchObject({ gravity: 'Gravità', likelihood: 'Probabilità', responsible: 'Responsabile', dueDate: 'Scadenza' })
    expect(suggestHistoricColumnMapping(['Severity', 'Likelihood', 'Owner', 'Due date', 'Status'])).toMatchObject({ gravity: 'Severity', likelihood: 'Likelihood', responsible: 'Owner', dueDate: 'Due date', status: 'Status' })
  })
})
