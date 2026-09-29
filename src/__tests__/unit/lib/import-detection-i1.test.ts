/**
 * Lot I1 (import universel) — non-régression de la détection sur les en-têtes d'un dossier EBIOS RM :
 * aucune feuille d'échelles ou de scénarios n'est proposée « Risques » à confiance haute.
 */
import { describe, expect, it } from 'vitest'
import { detectHistoricImportSheet, detectHistoricHeaderLayout, suggestHistoricColumnMapping, refineReferenceMapping, profileHistoricColumn, partitionHistoricImportSheets, buildHistoricImportPackage, linkChildSheetsToRisks, normalizeMeasureStatus, normalizeStrategy, suggestScoreMapping, validateHistoricColumnProfile } from '@/lib/historic-import'

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

describe('suggestion : « description courte » est l’intitulé, la description longue reste la description', () => {
  it('feuille de mesures d’un dossier EBIOS RM', () => {
    const m = suggestHistoricColumnMapping(['Réf. de la mesure de sécurité', 'Description courte de la mesure', 'Description longue', 'Statut'])
    expect(m.title).toBe('Description courte de la mesure')
    expect(m.description).toBe('Description longue')
  })
})

describe('refineReferenceMapping : la référence est la colonne aux valeurs uniques', () => {
  const prof = (values: string[]) => profileHistoricColumn(values)
  it('remplace une colonne de regroupement (valeurs répétées) par la vraie colonne de référence', () => {
    const header = ['Réf. de la mesure de sécurité', 'Ref. de la mesure de sécurité', 'Description courte de la mesure']
    const mapping = suggestHistoricColumnMapping(header)
    expect(mapping.externalId).toBe('Réf. de la mesure de sécurité')
    const refined = refineReferenceMapping(mapping, header, {
      [header[0]]: prof(['Exploitation', 'Exploitation', 'Résilience']),
      [header[1]]: prof(['M_01', 'M_02', 'M_03']),
    })
    expect(refined.externalId).toBe('Ref. de la mesure de sécurité')
  })
  it('ne touche à rien quand la colonne choisie est déjà unique, ou quand aucune autre n’est unique', () => {
    const header = ['Réf', 'Autre réf']
    const mapping = { externalId: 'Réf' }
    expect(refineReferenceMapping(mapping, header, { Réf: prof(['A', 'B']), 'Autre réf': prof(['X', 'Y']) })).toEqual(mapping)
    expect(refineReferenceMapping(mapping, header, { Réf: prof(['A', 'A']), 'Autre réf': prof(['X', 'X']) })).toEqual(mapping)
  })
})

describe('partitionHistoricImportSheets : une feuille non importée ne produit aucune décision', () => {
  it('« Sommaire » (rôle UNKNOWN) avec un mapping suggéré invalide : ni rejet ni champ écarté', () => {
    const sheet = { name: 'Sommaire', type: 'UNKNOWN' as const, mapping: { title: 'Titre', strategy: 'Stratégie' }, rows: [{ Titre: 'Accueil', Stratégie: '???' }] }
    expect(partitionHistoricImportSheets([sheet]).decisions).toEqual([])
  })
})

describe('normalizeMeasureStatus : libellés usuels reconnus sans profil', () => {
  it.each([
    ['Terminé', 'REALISE'], ['terminée', 'REALISE'], ['Réalisé', 'REALISE'], ['Done', 'REALISE'], ['Clôturé', 'REALISE'],
    ['A réaliser', 'A_FAIRE'], ['À faire', 'A_FAIRE'], ['Planifié', 'A_FAIRE'], ['To do', 'A_FAIRE'], ['Non démarré', 'A_FAIRE'],
    ['En cours', 'EN_COURS'], ['In progress', 'EN_COURS'], ['Abandonné / Suspendu', 'REPORTE'], ['Reporté', 'REPORTE'], ['EN_COURS', 'EN_COURS'],
  ])('%s → %s', (raw, expected) => expect(normalizeMeasureStatus(raw)).toBe(expected))
  it('libellé inconnu → null (jamais inventé)', () => expect(normalizeMeasureStatus('Bof')).toBeNull())
  it('la validation de format accepte ces libellés', () => {
    expect(validateHistoricColumnProfile('status', profileHistoricColumn(['Terminé', 'A réaliser', 'En cours'])).invalidCount).toBe(0)
  })
})

describe('suggestion : mesures d’un dossier EBIOS RM', () => {
  it('risques concernés → riskExternalId ; date de mise en œuvre → dueDate', () => {
    const m = suggestHistoricColumnMapping(['Réf. de la mesure de sécurité', 'Description courte de la mesure', 'Réf. des risques initiaux concernés', 'Statut', 'Date de mise en œuvre', 'Responsable'])
    expect(m.riskExternalId).toBe('Réf. des risques initiaux concernés')
    expect(m.dueDate).toBe('Date de mise en œuvre')
  })
  it('une colonne « Réf. du risque » reste une référence de risque, jamais la référence de la ligne quand la 1re colonne est plus générale', () => {
    const m = suggestHistoricColumnMapping(['Réf.', 'Risque concerné (réf.)', 'Titre'])
    expect(m.externalId).toBe('Réf.')
  })
})

describe('normalizeStrategy : options de traitement usuelles', () => {
  it.each([['Réduction', 'REDUIRE'], ['Réduire', 'REDUIRE'], ['Acceptation', 'ACCEPTER'], ['Accepté', 'ACCEPTER'], ['Transfert', 'TRANSFERER'], ['Partage', 'TRANSFERER'], ['Évitement', 'REFUSER'], ['Refuser', 'REFUSER'], ['Surveiller', 'SURVEILLER'], ['Mitigate', 'REDUIRE']])('%s → %s', (raw, expected) => expect(normalizeStrategy(raw)).toBe(expected))
  it('inconnu → null ; validation acceptée ; champ écarté documenté (colonne + valeur)', () => {
    expect(normalizeStrategy('Peut-être')).toBeNull()
    expect(validateHistoricColumnProfile('strategy', profileHistoricColumn(['Réduction', 'Transfert'])).invalidCount).toBe(0)
    const sheet = { name: 'R', type: 'RISKS' as const, mapping: { title: 'T', strategy: 'S' }, rows: [{ T: 'x', S: 'Peut-être' }] }
    const d = partitionHistoricImportSheets([sheet]).decisions.find(x => x.status === 'FIELD_OMITTED')
    expect(d).toMatchObject({ field: 'strategy', sourceColumn: 'S', sourceValue: 'Peut-être' })
  })
})

describe('registre plat : colonne « Risque » = intitulé ; cotations en clair proposées', () => {
  it('« Risque » seul est l’intitulé, sans que « risque » soit trop large ailleurs', () => {
    const m = suggestHistoricColumnMapping(['Réf', 'Risque', 'Description', 'Impact', 'Probabilité'])
    expect(m.title).toBe('Risque')
    expect(m.description).toBe('Description')
    expect(suggestHistoricColumnMapping(['Réf', 'Niveau de risque', 'Titre']).title).toBe('Titre')
  })
  it('suggestScoreMapping : valeurs reconnues → niveaux 1–4 ; inconnues laissées sans niveau ; rien si tout est inconnu ou numérique', () => {
    expect(suggestScoreMapping('gravity', ['Négligeable', 'Limitée', 'Importante', 'Critique'])).toEqual({ Négligeable: '1', Limitée: '2', Importante: '3', Critique: '4' })
    expect(suggestScoreMapping('likelihood', ['Peu vraisemblable', 'Vraisemblable', 'Très vraisemblable'])).toEqual({ 'Peu vraisemblable': '1', Vraisemblable: '2', 'Très vraisemblable': '3' })
    expect(suggestScoreMapping('gravity', ['Critique', 'Bof'])).toEqual({ Critique: '4' })
    expect(suggestScoreMapping('gravity', ['Bof'])).toBeNull()
    expect(suggestScoreMapping('gravity', ['1', '2'])).toBeNull() // colonne purement numérique : rien à configurer
  })
  it('suggestScoreMapping : le chiffre 1–4 présent dans la valeur (« 3 - Importante ») est pré-sélectionné', () => {
    expect(suggestScoreMapping('gravity', ['3 - Importante', '2 - Limitée', '1 - Négligeable'])).toEqual({ '3 - Importante': '3', '2 - Limitée': '2', '1 - Négligeable': '1' })
    expect(suggestScoreMapping('likelihood', ['2 - Vraisemblable', '1 - Peu vraisemblable'])).toEqual({ '2 - Vraisemblable': '2', '1 - Peu vraisemblable': '1' })
    // échelle à 5 niveaux : le « 5 - … » hors 1–4 reste à choisir (jamais deviné) ; les autres sont proposés
    expect(suggestScoreMapping('likelihood', ['4 - Très probable', '5 - Quasi certain'])).toEqual({ '4 - Très probable': '4' })
    // chiffre + mot : le chiffre fait foi
    expect(suggestScoreMapping('gravity', ['3 - Critique'])).toEqual({ '3 - Critique': '3' })
  })
})

describe('détection : registres génériques (JSON/CSV d’un autre outil)', () => {
  it('libellé + impact + probabilité → Risques ; feuille « controles » avec titre → Mesures', () => {
    expect(detectHistoricImportSheet('registre', ['id', 'libelle', 'impact', 'probabilite', 'proprietaire.nom']).type).toBe('RISKS')
    expect(detectHistoricImportSheet('registre.controles', ['registre', 'ref', 'titre', 'statut', 'echeance']).type).toBe('MEASURES')
    expect(detectHistoricImportSheet('Propriétés', ['Clé', 'Valeur']).type).toBe('UNKNOWN')
    expect(detectHistoricImportSheet('Métriques', ['Niveau', 'Impact', 'Probabilité']).type).toBe('UNKNOWN') // pas de colonne titre
  })
})

describe('import partiel : cotations mappées, doublons, contrôle partagé', () => {
  const risks = (rows: Record<string, string>[], extra: object = {}) => ({ name: 'Registre', type: 'RISKS' as const, mapping: { externalId: 'Réf', title: 'Risque', gravity: 'Impact' }, rows, ...extra })
  it('une cotation en clair mappée (Critique → 4) n’est ni écartée ni perdue', () => {
    const sheet = risks([{ Réf: 'R-01', Risque: 'A', Impact: 'Critique' }], { scoreMappings: { gravity: { Critique: '4' } } })
    const part = partitionHistoricImportSheets([sheet])
    expect(part.decisions.some(d => d.status === 'FIELD_OMITTED')).toBe(false)
    expect(buildHistoricImportPackage(part.sheets, 'x').risks[0].gravity).toBe(4)
  })
  it('sans correspondance, la cotation en clair reste écartée (comportement inchangé)', () => {
    const part = partitionHistoricImportSheets([risks([{ Réf: 'R-01', Risque: 'A', Impact: 'Critique' }])])
    expect(part.decisions.find(d => d.status === 'FIELD_OMITTED')).toMatchObject({ field: 'gravity' })
  })
  it('référence en double : la ligne suivante est rejetée (DUPLICATE_REFERENCE), la première est conservée', () => {
    const part = partitionHistoricImportSheets([risks([{ Réf: 'R-04', Risque: 'A', Impact: '3' }, { Réf: 'r_04', Risque: 'B', Impact: '3' }, { Réf: 'R-05', Risque: 'C', Impact: '3' }])])
    expect(part.decisions.find(d => d.status === 'REJECTED')).toMatchObject({ row: 3, reason: 'DUPLICATE_REFERENCE' })
    expect(part.sheets[0].rows.map(r => r.Réf)).toEqual(['R-04', 'R-05'])
  })
  it('contrôle partagé entre deux risques : une seule mesure, risques concernés listés', () => {
    const rs = risks([{ Réf: 'R-01', Risque: 'A', Impact: '3' }, { Réf: 'R-02', Risque: 'B', Impact: '3' }])
    const ms = { name: 'Mesures', type: 'MEASURES' as const, mapping: { externalId: 'Réf', title: 'Titre', riskExternalId: 'Risque' }, rows: [{ Réf: 'C-01', Titre: 'Cloisonner', Risque: 'R-01' }, { Réf: 'C-01', Titre: 'Cloisonner', Risque: 'R-02' }, { Réf: 'C-02', Titre: 'Chiffrer', Risque: 'R-02' }] }
    const part = partitionHistoricImportSheets([rs, ms])
    expect(part.decisions.filter(d => d.status === 'REJECTED')).toEqual([])
    const pkg = buildHistoricImportPackage(part.sheets, 'x')
    expect(pkg.measures).toHaveLength(2)
    expect(pkg.measures[0]).toMatchObject({ externalId: 'C-01', riskExternalId: 'R-01' })
    expect(pkg.measures[0].description).toContain('R-02')
  })
})

describe('linkChildSheetsToRisks : feuille enfant d’un JSON (colonne = nom de la feuille des risques)', () => {
  it('propose la colonne parent comme référence du risque, sans écraser un mapping existant', () => {
    const sheets = [
      { name: 'registre', detection: { type: 'RISKS' as const }, columns: ['id', 'libelle'], mapping: { externalId: 'id' } as Record<string, string | undefined> },
      { name: 'registre.controles', detection: { type: 'MEASURES' as const }, columns: ['registre', 'ref', 'titre'], mapping: { externalId: 'ref', title: 'titre' } as Record<string, string | undefined> },
      { name: 'autre.mesures', detection: { type: 'MEASURES' as const }, columns: ['registre', 'titre'], mapping: { riskExternalId: 'titre' } as Record<string, string | undefined> },
    ]
    const out = linkChildSheetsToRisks(sheets)
    expect(out[1].mapping.riskExternalId).toBe('registre')
    expect(out[2].mapping.riskExternalId).toBe('titre')
    expect(out[0].mapping).toEqual({ externalId: 'id' })
  })
})

describe('suggestion : colonne « id » seule = référence', () => {
  it('id / ref / code exacts (registre JSON), sans capter « valid » ou « identité »', () => {
    expect(suggestHistoricColumnMapping(['id', 'libelle', 'impact', 'probabilite']).externalId).toBe('id')
    expect(suggestHistoricColumnMapping(['Code', 'Titre']).externalId).toBe('Code')
    expect(suggestHistoricColumnMapping(['identite', 'Titre']).externalId).toBeUndefined()
  })
})
