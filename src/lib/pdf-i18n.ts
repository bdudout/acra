/**
 * pdf-i18n.ts — Chaînes du rapport PDF EBIOS RM, traduites (fr/en/de/es/it).
 *
 * Le template PDF (`pdf-template.tsx`) rend côté serveur (route d'export) et est
 * pré-compilé par esbuild. Il ne peut pas utiliser le hook React `useTranslation`,
 * donc on lui passe un objet `PdfStrings` résolu via `getPdfStrings(locale)`.
 *
 * Type-safe : chaque locale DOIT implémenter `PdfStrings` (tsc échoue sinon), ce
 * qui garantit la complétude des traductions. Repli FR si la locale est inconnue.
 */
import type { Locale } from '@/lib/i18n'

interface ScaleRow { label: string; description: string }

export interface PdfStrings {
  docSubject: string
  cover: {
    title: string; method: string; iso: string; generatedOn: string
    organisation: string; secteur: string; statut: string; createdOn: string; updatedOn: string
    statutTermine: string; statutApprouve: string; statutEnCours: string
    profilLabel: string; profils: Record<string, string>
    statutRegLabel: string; statutsReg: Record<string, string>
    mentionLabel: string; mentions: Record<string, string>
  }
  footer: { confidential: string; page: (n: number, total: number) => string }
  risk: { critique: string; eleve: string; modere: string; faible: string }
  summary: {
    banner: string; intro: string
    conclNone: string
    conclCritiques: (total: number, crit: number, p1: number) => string
    conclEleves: (total: number, eleves: number, mesures: number) => string
    conclModeres: (total: number, mesures: number) => string
    kpiRisques: (n: number) => string
    kpiCritiques: (n: number) => string
    kpiReduits: (n: number) => string
    kpiRealisees: (n: number) => string
    matrixBrute: string; matrixResiduelle: string; ecoMapTitle: string
    distribTitle: string; distribCritique: string; distribEleve: string; distribModere: string; distribFaible: string
    top5Title: string; top5Headers: string[]
    actionTitle: string
    statutRealise: string; statutEnCours: string; statutAFaire: string; statutReporte: string
    taux: (pct: number, done: number, total: number, enCours: number) => string
    noMesure: string
    /** Notes de valorisation du rapport (issues #70/#74/#96). */
    usageTitle: string; usageDoraArt8: string; usageHomologSSI: string; usageHomologII901: string; usageOrsaSolva2: string
  }
  /** Résumé exécutif non technique en tête de rapport (issue #76). */
  execSummary: {
    banner: string; intro: string; globalLabel: string
    levels: { high: string; medium: string; low: string; none: string }
    levelTexts: { high: string; medium: string; low: string; none: string }
    topRisksTitle: string; topMeasuresTitle: string
    noRisk: string; noMeasure: string
  }
  a1: {
    banner: string; perimetre: string; objectifs: string
    classifHeader: string; classifications: Record<string, string>
    vm: string; vmHeaders: string[]
    bs: string; bsHeaders: string[]
    er: string; erHeaders: string[]
    socle: string; socleHeaders: string[]
    empty: string
  }
  a2: { banner: string; empty: string; retenues: string; ecartees: string; headers: string[]; headersShort: string[] }
  eco: { danger: string; controle: string; veille: string; legendFiab: string; legendExpo: string; legendCritique: string }
  partyTypes: Record<string, string>
  a3: {
    banner: string; empty: string; retenus: string; ecartes: string
    headers: string[]; headersShort: string[]
    ppTitle: string; ppHeaders: string[]
  }
  a4: { banner: string; empty: string; titleSing: string; titlePlur: string; headers: string[]; aeDetail: string; aeHeaders: string[] }
  a5: {
    banner: string; risquesEmpty: string; risquesTitleSing: string; risquesTitlePlur: string; risquesHeaders: string[]
    planTitle: string; mesuresEmpty: string; mesuresHeaders: string[]
  }
  annexe: {
    banner: string; methodeTitle: string; methodeIntro: string; ateliers: string
    formule: (nb: number, max: number) => string
    graviteTitle: string; vraisTitle: string; scaleHeaders: string[]
    matriceTitle: string
    strategiesTitle: string; strategiesHeaders: string[]; strategies: [string, string][]
    defaultGravite: ScaleRow[]; defaultVrais: ScaleRow[]
  }
  /** Étiquette BCP-47 pour toLocaleDateString. */
  dateLocale: string
}

const fr: PdfStrings = {
  docSubject: "Rapport d'analyse de risques EBIOS RM",
  cover: {
    title: 'ANALYSE DE RISQUES', method: 'EBIOS Risk Manager — Méthode ANSSI', iso: 'Compatible ISO/IEC 27005',
    generatedOn: 'Généré le', organisation: 'Organisation', secteur: 'Secteur', statut: 'Statut', createdOn: 'Créée le', updatedOn: 'Mise à jour',
    statutTermine: 'Terminée', statutApprouve: 'Approuvée', statutEnCours: 'En cours',
    profilLabel: 'Profil', profils: { TPE: 'TPE / très petite structure', PME: 'PME', ETI_GE: 'ETI / grande organisation' },
    statutRegLabel: 'Statut réglementaire', statutsReg: { OSE: 'OSE (services essentiels)', EEI: 'Entité essentielle/importante (NIS2)', OIV: "OIV (importance vitale)" },
    mentionLabel: 'Mention de protection', mentions: { NON_PROTEGEE: 'Non protégée', SENSIBLE: 'Sensible', RESTREINTE: 'Restreinte', CONFIDENTIELLE: 'Confidentielle' },
  },
  footer: { confidential: 'Confidentiel — généré le', page: (n, t) => `Page ${n} / ${t}` },
  risk: { critique: 'Critique', eleve: 'Élevé', modere: 'Modéré', faible: 'Faible' },
  summary: {
    banner: 'SYNTHÈSE EXÉCUTIVE',
    intro: "Cette synthèse présente les résultats de l'analyse de risques réalisée selon la méthode EBIOS Risk Manager (ANSSI), compatible ISO/IEC 27005. L'objectif est d'identifier les menaces pesant sur l'organisation, d'évaluer leur impact potentiel et de définir un plan d'action pour les traiter.",
    conclNone: "L'analyse n'a pas encore identifié de risques formalisés. Les ateliers de travail sont en cours.",
    conclCritiques: (total, crit, p1) => `L'analyse a identifié ${total} ${total === 1 ? 'risque' : 'risques'}, dont ${crit} de niveau CRITIQUE nécessitant une action immédiate.` + (p1 > 0 ? ` ${p1} ${p1 === 1 ? 'mesure prioritaire (P1) a été définie' : 'mesures prioritaires (P1) ont été définies'} pour y répondre.` : ''),
    conclEleves: (total, eleves, mesures) => `L'analyse a identifié ${total} ${total === 1 ? 'risque' : 'risques'}, dont ${eleves} de niveau ÉLEVÉ à traiter en priorité.` + (mesures > 0 ? ` ${mesures} ${mesures === 1 ? 'mesure de sécurité a été définie' : 'mesures de sécurité ont été définies'}.` : ''),
    conclModeres: (total, mesures) => `L'analyse a identifié ${total} ${total === 1 ? 'risque' : 'risques'} de niveaux modérés à faibles.` + (mesures > 0 ? ` ${mesures} ${mesures === 1 ? 'mesure de sécurité a été définie' : 'mesures de sécurité ont été définies'}.` : ''),
    kpiRisques: (n) => n === 1 ? 'Risque identifié' : 'Risques identifiés',
    kpiCritiques: (n) => n === 1 ? 'Risque critique' : 'Risques critiques',
    kpiReduits: (n) => n === 1 ? 'Risque réduit' : 'Risques réduits',
    kpiRealisees: (n) => n === 1 ? 'Mesure réalisée' : 'Mesures réalisées',
    matrixBrute: 'Matrice des risques bruts', matrixResiduelle: 'Matrice des risques résiduels', ecoMapTitle: 'Écosystème — cartographie de menace',
    distribTitle: 'Répartition des risques initiaux', distribCritique: 'Critique (>=12)', distribEleve: 'Élevé (8-11)', distribModere: 'Modéré (4-7)', distribFaible: 'Faible (1-3)',
    top5Title: 'Top 5 des risques les plus élevés', top5Headers: ['Risque', 'Score initial', 'Niveau', 'Stratégie', 'Score résiduel'],
    actionTitle: "Avancement du plan d'action",
    statutRealise: 'Réalisé', statutEnCours: 'En cours', statutAFaire: 'À faire', statutReporte: 'Reporté',
    taux: (pct, done, total, enCours) => `Taux de réalisation : ${pct}% (${done} sur ${total} mesures réalisées).` + (enCours > 0 ? ` ${enCours} ${enCours === 1 ? 'mesure en cours de déploiement' : 'mesures en cours de déploiement'}.` : ''),
    noMesure: 'Aucune mesure de sécurité définie dans cette analyse.',
    usageTitle: "Valorisation du rapport", usageDoraArt8: "Documentation de l'évaluation des risques ICT requise par l'article 8 du règlement DORA (UE 2022/2554).", usageHomologSSI: "Utilisable comme rapport d'analyse de risques d'un dossier d'homologation SSI (PSSIE/RGS, IGI 1300).", usageHomologII901: "Défense (BITD) : utilisable comme pièce d'analyse de risques d'un dossier d'homologation II 901 (SGDSN/ANSSI) pour un SI en Diffusion Restreinte.", usageOrsaSolva2: "Assurance : alimente l'évaluation ORSA (art. 45 de Solvabilité II) au titre du risque opérationnel / cyber.",
  },
  execSummary: {
    banner: "Résumé exécutif", intro: "Cette synthèse en une page s'adresse à un lecteur non spécialiste (direction, assureur, ordre professionnel, partenaire). Elle résume le niveau de risque et les actions prioritaires.", globalLabel: "Niveau de risque global",
    levels: { high: "Élevé", medium: "Modéré", low: "Maîtrisé", none: "À évaluer" },
    levelTexts: { high: "Des risques majeurs nécessitent une action rapide de la direction.", medium: "Des risques notables sont à traiter selon le plan d'action.", low: "Les risques identifiés sont sous contrôle ; maintenir la vigilance.", none: "Analyse en cours : les risques ne sont pas encore évalués." },
    topRisksTitle: "Principaux risques", topMeasuresTitle: "Premières actions à engager",
    noRisk: "Aucun risque évalué pour le moment.", noMeasure: "Aucune action définie pour le moment.",
  },
  a1: {
    banner: 'ATELIER 1 — CADRAGE ET SOCLE DE SÉCURITÉ', perimetre: "Périmètre de l'étude", objectifs: 'Objectifs :',
    classifHeader: 'Classification', classifications: { NP: 'Non protégé', DR: 'Diffusion Restreinte', S: 'Secret', TS: 'Très Secret' },
    vm: 'Valeurs métier FM1', vmHeaders: ['Nom', 'Type', 'Description', 'Responsable'],
    bs: 'Biens supports', bsHeaders: ['Nom', 'Type', 'Description', 'Valeurs métier liées'],
    er: 'Événements redoutés', erHeaders: ['Description', 'Impacts', 'Gravité'],
    socle: 'Socle de sécurité', socleHeaders: ['Mesure', 'Source / Référentiel', 'Statut'],
    empty: "Le cadrage n'a pas encore été complété.",
  },
  a2: { banner: 'ATELIER 2 — SOURCES DE RISQUE', empty: 'Aucune source de risque définie dans cette analyse.', retenues: 'Sources retenues', ecartees: 'Sources écartées', headers: ['Source de risque', 'Catégorie', 'Pertinence', 'Motivation', 'Ressources', 'Activité'], headersShort: ['Source de risque', 'Catégorie', 'Pertinence'] },
  eco: { danger: 'Danger', controle: 'Contrôle', veille: 'Veille', legendFiab: 'Couleur = fiabilité (rouge→vert)', legendExpo: 'Taille = exposition', legendCritique: 'Tiers critique' },
  partyTypes: { FOURNISSEUR: 'Fournisseur', CLIENT: 'Client', PARTENAIRE: 'Partenaire', PRESTATAIRE: 'Prestataire', ORGANISME_REGULATION: 'Régulateur', AUTRE: 'Autre' },
  a3: {
    banner: 'ATELIER 3 — SCÉNARIOS STRATÉGIQUES', empty: 'Aucun scénario stratégique défini dans cette analyse.', retenus: 'Scénarios retenus', ecartes: 'Scénarios écartés',
    headers: ['Scénario', 'Source de risque', 'Vraisemblance', 'Gravité', 'Score', 'Niveau'], headersShort: ['Scénario', 'Vraisemblance', 'Gravité', 'Score'],
    ppTitle: 'Écosystème — parties prenantes', ppHeaders: ['Réf', 'Partie prenante', 'Type', 'Dép.', 'Pén.', 'Mat.', 'Conf.', 'Expo.', 'Fiab.', 'Menace', 'Zone', 'Crit.'],
  },
  a4: { banner: 'ATELIER 4 — SCÉNARIOS OPÉRATIONNELS', empty: 'Aucun scénario opérationnel défini dans cette analyse.', titleSing: 'Scénario opérationnel', titlePlur: 'Scénarios opérationnels', headers: ['Scénario opérationnel', 'Scénario stratégique', 'Vraisemblance', 'Gravité', 'Score'], aeDetail: 'Détail des actions élémentaires', aeHeaders: ['Action élémentaire', 'Type', 'Bien support', 'Vulnérabilité'] },
  a5: {
    banner: 'ATELIER 5 — TRAITEMENT DU RISQUE', risquesEmpty: 'Aucun risque identifié dans cette analyse.', risquesTitleSing: 'Risque identifié', risquesTitlePlur: 'Risques identifiés', risquesHeaders: ['Risque', 'G', 'V', 'Score initial', 'Niveau', 'Stratégie', 'Score résiduel'],
    planTitle: "Plan d'action — Mesures de sécurité", mesuresEmpty: 'Aucune mesure de sécurité définie dans cette analyse.', mesuresHeaders: ['Mesure', 'Type', 'Priorité', 'Statut', 'Responsable', 'Entité', 'Échéance'],
  },
  annexe: {
    banner: 'ANNEXE — MÉTHODOLOGIE ET RÉFÉRENTIEL DE COTATION', methodeTitle: '1. Méthode EBIOS Risk Manager (EBIOS RM)',
    methodeIntro: "EBIOS Risk Manager est la méthode officielle de l'ANSSI (Agence Nationale de la Sécurité des Systèmes d'Information) pour apprécier et traiter les risques numériques. Elle est compatible avec la norme ISO/IEC 27005.",
    ateliers: "L'analyse se déroule en 5 ateliers :\n• Atelier 1 — Cadrage et socle de sécurité : périmètre, valeurs métier, biens supports, événements redoutés.\n• Atelier 2 — Sources de risque : identification et évaluation des acteurs malveillants.\n• Atelier 3 — Scénarios stratégiques : chemins d'attaque ciblant les valeurs métier via l'écosystème.\n• Atelier 4 — Scénarios opérationnels : déclinaison technique des chemins d'attaque retenus.\n• Atelier 5 — Traitement du risque : cotation finale, stratégies de traitement, plan d'action.",
    formule: (nb, max) => `Le niveau de risque est calculé par la formule : Niveau = Gravité × Vraisemblance (max ${nb}×${nb} = ${max}).`,
    graviteTitle: '2. Échelle de gravité (impact)', vraisTitle: '3. Échelle de vraisemblance (probabilité)', scaleHeaders: ['Valeur', 'Niveau', 'Signification'],
    matriceTitle: '4. Matrice de cotation (Gravité × Vraisemblance)',
    strategiesTitle: '5. Stratégies de traitement des risques', strategiesHeaders: ['Stratégie', 'Description'],
    strategies: [
      ['Réduire', 'Mettre en place des mesures de sécurité pour abaisser le niveau du risque à un niveau acceptable.'],
      ['Accepter', "Le risque est jugé acceptable en l'état (niveau faible ou coût de traitement supérieur au bénéfice)."],
      ['Transférer', 'Reporter le risque sur un tiers (assurance cyber, sous-traitant, clause contractuelle).'],
      ['Refuser', "L'activité ou le système portant le risque est abandonné ou modifié en profondeur."],
      ['Surveiller', 'Le risque est suivi sans traitement immédiat : réévaluation périodique prévue.'],
    ],
    defaultGravite: [
      { label: 'Négligeable', description: "Impact minimal, ne remet pas en cause les activités essentielles de l'organisation." },
      { label: 'Limité', description: "Impact notable mais l'organisation peut faire face sans mesures exceptionnelles." },
      { label: 'Important', description: 'Impact significatif nécessitant des moyens exceptionnels pour y faire face.' },
      { label: 'Critique', description: "Impact vital pouvant menacer la survie ou la continuité de l'organisation." },
    ],
    defaultVrais: [
      { label: 'Minime', description: "Scénario très peu probable : l'attaquant a peu de moyens, de motivation ou d'opportunité." },
      { label: 'Significatif', description: "Scénario possible mais peu fréquent : conditions d'attaque partiellement réunies." },
      { label: 'Fort', description: "Scénario probable : l'attaquant dispose des capacités et motivations suffisantes." },
      { label: 'Maximal', description: "Scénario très probable ou quasiment certain : toutes conditions d'attaque réunies." },
    ],
  },
  dateLocale: 'fr-FR',
}

const en: PdfStrings = {
  docSubject: 'EBIOS RM risk analysis report',
  cover: {
    title: 'RISK ANALYSIS', method: 'EBIOS Risk Manager — ANSSI method', iso: 'Compatible with ISO/IEC 27005',
    generatedOn: 'Generated on', organisation: 'Organisation', secteur: 'Sector', statut: 'Status', createdOn: 'Created on', updatedOn: 'Updated',
    statutTermine: 'Completed', statutApprouve: 'Approved', statutEnCours: 'In progress',
    profilLabel: 'Profile', profils: { TPE: 'Micro / very small org', PME: 'SME', ETI_GE: 'Large organisation' },
    statutRegLabel: 'Regulatory status', statutsReg: { OSE: 'OES (essential services)', EEI: 'Essential/important entity (NIS2)', OIV: 'Vital-importance operator' },
    mentionLabel: 'Protection marking', mentions: { NON_PROTEGEE: 'Unprotected', SENSIBLE: 'Sensitive', RESTREINTE: 'Restricted', CONFIDENTIELLE: 'Confidential' },
  },
  footer: { confidential: 'Confidential — generated on', page: (n, t) => `Page ${n} / ${t}` },
  risk: { critique: 'Critical', eleve: 'High', modere: 'Moderate', faible: 'Low' },
  summary: {
    banner: 'EXECUTIVE SUMMARY',
    intro: 'This summary presents the results of the risk analysis carried out using the EBIOS Risk Manager method (ANSSI), compatible with ISO/IEC 27005. The objective is to identify the threats to the organisation, assess their potential impact and define an action plan to address them.',
    conclNone: 'The analysis has not yet identified any formalised risks. The workshops are in progress.',
    conclCritiques: (total, crit, p1) => `The analysis identified ${total} ${total === 1 ? 'risk' : 'risks'}, including ${crit} at CRITICAL level requiring immediate action.` + (p1 > 0 ? ` ${p1} ${p1 === 1 ? 'priority (P1) measure has been defined' : 'priority (P1) measures have been defined'} to address them.` : ''),
    conclEleves: (total, eleves, mesures) => `The analysis identified ${total} ${total === 1 ? 'risk' : 'risks'}, including ${eleves} at HIGH level to be treated as a priority.` + (mesures > 0 ? ` ${mesures} ${mesures === 1 ? 'security measure has been defined' : 'security measures have been defined'}.` : ''),
    conclModeres: (total, mesures) => `The analysis identified ${total} ${total === 1 ? 'risk' : 'risks'} of moderate to low levels.` + (mesures > 0 ? ` ${mesures} ${mesures === 1 ? 'security measure has been defined' : 'security measures have been defined'}.` : ''),
    kpiRisques: (n) => n === 1 ? 'Identified risk' : 'Identified risks',
    kpiCritiques: (n) => n === 1 ? 'Critical risk' : 'Critical risks',
    kpiReduits: (n) => n === 1 ? 'Reduced risk' : 'Reduced risks',
    kpiRealisees: (n) => n === 1 ? 'Completed measure' : 'Completed measures',
    matrixBrute: 'Inherent risk matrix', matrixResiduelle: 'Residual risk matrix', ecoMapTitle: 'Ecosystem — threat mapping',
    distribTitle: 'Distribution of initial risks', distribCritique: 'Critical (>=12)', distribEleve: 'High (8-11)', distribModere: 'Moderate (4-7)', distribFaible: 'Low (1-3)',
    top5Title: 'Top 5 highest risks', top5Headers: ['Risk', 'Initial score', 'Level', 'Strategy', 'Residual score'],
    actionTitle: 'Action plan progress',
    statutRealise: 'Completed', statutEnCours: 'In progress', statutAFaire: 'To do', statutReporte: 'Postponed',
    taux: (pct, done, total, enCours) => `Completion rate: ${pct}% (${done} of ${total} measures completed).` + (enCours > 0 ? ` ${enCours} ${enCours === 1 ? 'measure being deployed' : 'measures being deployed'}.` : ''),
    noMesure: 'No security measure defined in this analysis.',
    usageTitle: "Making the most of this report", usageDoraArt8: "ICT risk assessment documentation required by Article 8 of the DORA Regulation (EU 2022/2554).", usageHomologSSI: "Usable as the risk-analysis report of a security accreditation file (PSSIE/RGS, IGI 1300).", usageHomologII901: "Defence (BITD): usable as the risk-analysis part of a II 901 accreditation file (SGDSN/ANSSI) for a Restricted-level system.", usageOrsaSolva2: "Insurance: feeds the ORSA (art. 45 of Solvency II) for operational / cyber risk.",
  },
  execSummary: {
    banner: "Executive summary", intro: "This one-page summary is intended for a non-specialist reader (management, insurer, professional body, partner). It outlines the risk level and the priority actions.", globalLabel: "Overall risk level",
    levels: { high: "High", medium: "Moderate", low: "Under control", none: "To be assessed" },
    levelTexts: { high: "Major risks require prompt action from management.", medium: "Significant risks should be addressed according to the action plan.", low: "Identified risks are under control; maintain vigilance.", none: "Analysis in progress: risks have not yet been assessed." },
    topRisksTitle: "Main risks", topMeasuresTitle: "First actions to take",
    noRisk: "No risk assessed yet.", noMeasure: "No action defined yet.",
  },
  a1: {
    banner: 'WORKSHOP 1 — SCOPE AND SECURITY BASELINE', perimetre: 'Scope of the study', objectifs: 'Objectives:',
    classifHeader: 'Classification', classifications: { NP: 'Unclassified', DR: 'Restricted', S: 'Secret', TS: 'Top Secret' },
    vm: 'Business values FM1', vmHeaders: ['Name', 'Type', 'Description', 'Owner'],
    bs: 'Supporting assets', bsHeaders: ['Name', 'Type', 'Description', 'Linked business values'],
    er: 'Feared events', erHeaders: ['Description', 'Impacts', 'Severity'],
    socle: 'Security baseline', socleHeaders: ['Measure', 'Source / Framework', 'Status'],
    empty: 'The scoping has not been completed yet.',
  },
  a2: { banner: 'WORKSHOP 2 — RISK ORIGINS', empty: 'No risk origin defined in this analysis.', retenues: 'Selected origins', ecartees: 'Discarded origins', headers: ['Risk origin', 'Category', 'Relevance', 'Motivation', 'Resources', 'Activity'], headersShort: ['Risk origin', 'Category', 'Relevance'] },
  eco: { danger: 'Danger', controle: 'Control', veille: 'Watch', legendFiab: 'Colour = reliability (red→green)', legendExpo: 'Size = exposure', legendCritique: 'Critical third party' },
  partyTypes: { FOURNISSEUR: 'Supplier', CLIENT: 'Client', PARTENAIRE: 'Partner', PRESTATAIRE: 'Service provider', ORGANISME_REGULATION: 'Regulator', AUTRE: 'Other' },
  a3: {
    banner: 'WORKSHOP 3 — STRATEGIC SCENARIOS', empty: 'No strategic scenario defined in this analysis.', retenus: 'Selected scenarios', ecartes: 'Discarded scenarios',
    headers: ['Scenario', 'Risk origin', 'Likelihood', 'Severity', 'Score', 'Level'], headersShort: ['Scenario', 'Likelihood', 'Severity', 'Score'],
    ppTitle: 'Ecosystem — stakeholders', ppHeaders: ['Ref', 'Stakeholder', 'Type', 'Dep.', 'Pen.', 'Mat.', 'Conf.', 'Expo.', 'Rel.', 'Threat', 'Zone', 'Crit.'],
  },
  a4: { banner: 'WORKSHOP 4 — OPERATIONAL SCENARIOS', empty: 'No operational scenario defined in this analysis.', titleSing: 'Operational scenario', titlePlur: 'Operational scenarios', headers: ['Operational scenario', 'Strategic scenario', 'Likelihood', 'Severity', 'Score'], aeDetail: 'Elementary actions detail', aeHeaders: ['Elementary action', 'Type', 'Supporting asset', 'Vulnerability'] },
  a5: {
    banner: 'WORKSHOP 5 — RISK TREATMENT', risquesEmpty: 'No risk identified in this analysis.', risquesTitleSing: 'Identified risk', risquesTitlePlur: 'Identified risks', risquesHeaders: ['Risk', 'S', 'L', 'Initial score', 'Level', 'Strategy', 'Residual score'],
    planTitle: 'Action plan — Security measures', mesuresEmpty: 'No security measure defined in this analysis.', mesuresHeaders: ['Measure', 'Type', 'Priority', 'Status', 'Owner', 'Entity', 'Due date'],
  },
  annexe: {
    banner: 'APPENDIX — METHODOLOGY AND RATING REFERENCE', methodeTitle: '1. EBIOS Risk Manager (EBIOS RM) method',
    methodeIntro: 'EBIOS Risk Manager is the official ANSSI (French National Cybersecurity Agency) method for assessing and treating digital risks. It is compatible with the ISO/IEC 27005 standard.',
    ateliers: 'The analysis is carried out in 5 workshops:\n• Workshop 1 — Scope and security baseline: scope, business values, supporting assets, feared events.\n• Workshop 2 — Risk origins: identification and assessment of malicious actors.\n• Workshop 3 — Strategic scenarios: attack paths targeting business values via the ecosystem.\n• Workshop 4 — Operational scenarios: technical breakdown of the selected attack paths.\n• Workshop 5 — Risk treatment: final rating, treatment strategies, action plan.',
    formule: (nb, max) => `The risk level is calculated by the formula: Level = Severity × Likelihood (max ${nb}×${nb} = ${max}).`,
    graviteTitle: '2. Severity scale (impact)', vraisTitle: '3. Likelihood scale (probability)', scaleHeaders: ['Value', 'Level', 'Meaning'],
    matriceTitle: '4. Rating matrix (Severity × Likelihood)',
    strategiesTitle: '5. Risk treatment strategies', strategiesHeaders: ['Strategy', 'Description'],
    strategies: [
      ['Reduce', 'Implement security measures to bring the risk level down to an acceptable level.'],
      ['Accept', 'The risk is deemed acceptable as is (low level or treatment cost higher than the benefit).'],
      ['Transfer', 'Shift the risk to a third party (cyber insurance, subcontractor, contractual clause).'],
      ['Refuse', 'The activity or system bearing the risk is abandoned or deeply modified.'],
      ['Monitor', 'The risk is tracked without immediate treatment: periodic reassessment planned.'],
    ],
    defaultGravite: [
      { label: 'Negligible', description: 'Minimal impact, does not jeopardise the essential activities of the organisation.' },
      { label: 'Limited', description: 'Notable impact but the organisation can cope without exceptional measures.' },
      { label: 'Significant', description: 'Significant impact requiring exceptional means to cope with it.' },
      { label: 'Critical', description: 'Vital impact that may threaten the survival or continuity of the organisation.' },
    ],
    defaultVrais: [
      { label: 'Minimal', description: 'Very unlikely scenario: the attacker has little means, motivation or opportunity.' },
      { label: 'Significant', description: 'Possible but infrequent scenario: attack conditions partially met.' },
      { label: 'Strong', description: 'Likely scenario: the attacker has sufficient capabilities and motivation.' },
      { label: 'Maximal', description: 'Very likely or almost certain scenario: all attack conditions met.' },
    ],
  },
  dateLocale: 'en-GB',
}

const de: PdfStrings = {
  docSubject: 'EBIOS RM Risikoanalysebericht',
  cover: {
    title: 'RISIKOANALYSE', method: 'EBIOS Risk Manager — ANSSI-Methode', iso: 'Kompatibel mit ISO/IEC 27005',
    generatedOn: 'Erstellt am', organisation: 'Organisation', secteur: 'Branche', statut: 'Status', createdOn: 'Erstellt am', updatedOn: 'Aktualisiert',
    statutTermine: 'Abgeschlossen', statutApprouve: 'Genehmigt', statutEnCours: 'In Bearbeitung',
    profilLabel: 'Profil', profils: { TPE: 'Kleinst-/sehr kleine Organisation', PME: 'KMU', ETI_GE: 'Großorganisation' },
    statutRegLabel: 'Regulatorischer Status', statutsReg: { OSE: 'OES (wesentliche Dienste)', EEI: 'Wesentliche/wichtige Einrichtung (NIS2)', OIV: 'Betreiber von vitaler Bedeutung' },
    mentionLabel: 'Schutzkennzeichnung', mentions: { NON_PROTEGEE: 'Nicht geschützt', SENSIBLE: 'Sensibel', RESTREINTE: 'Eingeschränkt', CONFIDENTIELLE: 'Vertraulich' },
  },
  footer: { confidential: 'Vertraulich — erstellt am', page: (n, t) => `Seite ${n} / ${t}` },
  risk: { critique: 'Kritisch', eleve: 'Hoch', modere: 'Mittel', faible: 'Niedrig' },
  summary: {
    banner: 'MANAGEMENT-ZUSAMMENFASSUNG',
    intro: 'Diese Zusammenfassung stellt die Ergebnisse der Risikoanalyse nach der Methode EBIOS Risk Manager (ANSSI), kompatibel mit ISO/IEC 27005, dar. Ziel ist es, die Bedrohungen für die Organisation zu identifizieren, ihre möglichen Auswirkungen zu bewerten und einen Maßnahmenplan zu deren Behandlung festzulegen.',
    conclNone: 'Die Analyse hat noch keine formalisierten Risiken identifiziert. Die Workshops sind im Gange.',
    conclCritiques: (total, crit, p1) => `Die Analyse hat ${total} ${total === 1 ? 'Risiko' : 'Risiken'} identifiziert, davon ${crit} der Stufe KRITISCH, die sofortiges Handeln erfordern.` + (p1 > 0 ? ` ${p1} ${p1 === 1 ? 'vorrangige Maßnahme (P1) wurde definiert' : 'vorrangige Maßnahmen (P1) wurden definiert'}.` : ''),
    conclEleves: (total, eleves, mesures) => `Die Analyse hat ${total} ${total === 1 ? 'Risiko' : 'Risiken'} identifiziert, davon ${eleves} der Stufe HOCH, die vorrangig zu behandeln sind.` + (mesures > 0 ? ` ${mesures} ${mesures === 1 ? 'Sicherheitsmaßnahme wurde definiert' : 'Sicherheitsmaßnahmen wurden definiert'}.` : ''),
    conclModeres: (total, mesures) => `Die Analyse hat ${total} ${total === 1 ? 'Risiko' : 'Risiken'} mittlerer bis niedriger Stufe identifiziert.` + (mesures > 0 ? ` ${mesures} ${mesures === 1 ? 'Sicherheitsmaßnahme wurde definiert' : 'Sicherheitsmaßnahmen wurden definiert'}.` : ''),
    kpiRisques: (n) => n === 1 ? 'Identifiziertes Risiko' : 'Identifizierte Risiken',
    kpiCritiques: (n) => n === 1 ? 'Kritisches Risiko' : 'Kritische Risiken',
    kpiReduits: (n) => n === 1 ? 'Reduziertes Risiko' : 'Reduzierte Risiken',
    kpiRealisees: (n) => n === 1 ? 'Umgesetzte Maßnahme' : 'Umgesetzte Maßnahmen',
    matrixBrute: 'Brutto-Risikomatrix', matrixResiduelle: 'Rest-Risikomatrix', ecoMapTitle: 'Ökosystem — Bedrohungskartierung',
    distribTitle: 'Verteilung der anfänglichen Risiken', distribCritique: 'Kritisch (>=12)', distribEleve: 'Hoch (8-11)', distribModere: 'Mittel (4-7)', distribFaible: 'Niedrig (1-3)',
    top5Title: 'Top 5 der höchsten Risiken', top5Headers: ['Risiko', 'Anfangswert', 'Stufe', 'Strategie', 'Restwert'],
    actionTitle: 'Fortschritt des Maßnahmenplans',
    statutRealise: 'Umgesetzt', statutEnCours: 'In Bearbeitung', statutAFaire: 'Zu erledigen', statutReporte: 'Verschoben',
    taux: (pct, done, total, enCours) => `Umsetzungsgrad: ${pct}% (${done} von ${total} Maßnahmen umgesetzt).` + (enCours > 0 ? ` ${enCours} ${enCours === 1 ? 'Maßnahme in Umsetzung' : 'Maßnahmen in Umsetzung'}.` : ''),
    noMesure: 'Keine Sicherheitsmaßnahme in dieser Analyse definiert.',
    usageTitle: "Nutzen des Berichts", usageDoraArt8: "Dokumentation der IKT-Risikobewertung gemäß Artikel 8 der DORA-Verordnung (EU 2022/2554).", usageHomologSSI: "Verwendbar als Risikoanalysebericht einer Sicherheitsakkreditierung (PSSIE/RGS, IGI 1300).", usageHomologII901: "Verteidigung (BITD): verwendbar als Risikoanalyseteil einer II-901-Akkreditierung (SGDSN/ANSSI) für ein System der Stufe Diffusion Restreinte.", usageOrsaSolva2: "Versicherung: fließt in die ORSA (Art. 45 Solvency II) für das operationelle / Cyberrisiko ein.",
  },
  execSummary: {
    banner: "Zusammenfassung für die Leitung", intro: "Diese einseitige Zusammenfassung richtet sich an nicht spezialisierte Leser (Leitung, Versicherer, Berufskammer, Partner). Sie fasst das Risikoniveau und die vorrangigen Maßnahmen zusammen.", globalLabel: "Gesamtrisikoniveau",
    levels: { high: "Hoch", medium: "Mittel", low: "Unter Kontrolle", none: "Zu bewerten" },
    levelTexts: { high: "Schwerwiegende Risiken erfordern rasches Handeln der Leitung.", medium: "Erhebliche Risiken sind gemäß Maßnahmenplan zu behandeln.", low: "Die identifizierten Risiken sind unter Kontrolle; Wachsamkeit bewahren.", none: "Analyse läuft: Risiken wurden noch nicht bewertet." },
    topRisksTitle: "Wichtigste Risiken", topMeasuresTitle: "Erste zu ergreifende Maßnahmen",
    noRisk: "Noch kein Risiko bewertet.", noMeasure: "Noch keine Maßnahme definiert.",
  },
  a1: {
    banner: 'WORKSHOP 1 — RAHMEN UND SICHERHEITSBASIS', perimetre: 'Untersuchungsbereich', objectifs: 'Ziele:',
    classifHeader: 'Einstufung', classifications: { NP: 'Nicht eingestuft', DR: 'Verschlusssache (DR)', S: 'Geheim', TS: 'Streng geheim' },
    vm: 'Geschäftswerte FM1', vmHeaders: ['Name', 'Typ', 'Beschreibung', 'Verantwortlich'],
    bs: 'Unterstützende Assets', bsHeaders: ['Name', 'Typ', 'Beschreibung', 'Verknüpfte Geschäftswerte'],
    er: 'Befürchtete Ereignisse', erHeaders: ['Beschreibung', 'Auswirkungen', 'Schweregrad'],
    socle: 'Sicherheitsbasis', socleHeaders: ['Maßnahme', 'Quelle / Rahmenwerk', 'Status'],
    empty: 'Die Rahmensetzung wurde noch nicht abgeschlossen.',
  },
  a2: { banner: 'WORKSHOP 2 — RISIKOQUELLEN', empty: 'Keine Risikoquelle in dieser Analyse definiert.', retenues: 'Ausgewählte Quellen', ecartees: 'Verworfene Quellen', headers: ['Risikoquelle', 'Kategorie', 'Relevanz', 'Motivation', 'Ressourcen', 'Aktivität'], headersShort: ['Risikoquelle', 'Kategorie', 'Relevanz'] },
  eco: { danger: 'Gefahr', controle: 'Kontrolle', veille: 'Beobachtung', legendFiab: 'Farbe = Zuverlässigkeit (rot→grün)', legendExpo: 'Größe = Exposition', legendCritique: 'Kritischer Dritter' },
  partyTypes: { FOURNISSEUR: 'Lieferant', CLIENT: 'Kunde', PARTENAIRE: 'Partner', PRESTATAIRE: 'Dienstleister', ORGANISME_REGULATION: 'Regulierungsbehörde', AUTRE: 'Sonstige' },
  a3: {
    banner: 'WORKSHOP 3 — STRATEGISCHE SZENARIEN', empty: 'Kein strategisches Szenario in dieser Analyse definiert.', retenus: 'Ausgewählte Szenarien', ecartes: 'Verworfene Szenarien',
    headers: ['Szenario', 'Risikoquelle', 'Eintrittswahrscheinlichkeit', 'Schweregrad', 'Wert', 'Stufe'], headersShort: ['Szenario', 'Wahrscheinlichkeit', 'Schweregrad', 'Wert'],
    ppTitle: 'Ökosystem — Stakeholder', ppHeaders: ['Ref', 'Stakeholder', 'Typ', 'Abh.', 'Eindr.', 'Reife', 'Vertr.', 'Expo.', 'Zuv.', 'Bedr.', 'Zone', 'Krit.'],
  },
  a4: { banner: 'WORKSHOP 4 — OPERATIVE SZENARIEN', empty: 'Kein operatives Szenario in dieser Analyse definiert.', titleSing: 'Operatives Szenario', titlePlur: 'Operative Szenarien', headers: ['Operatives Szenario', 'Strategisches Szenario', 'Wahrscheinlichkeit', 'Schweregrad', 'Wert'], aeDetail: 'Detail der Elementaraktionen', aeHeaders: ['Elementaraktion', 'Typ', 'Unterstützendes Asset', 'Schwachstelle'] },
  a5: {
    banner: 'WORKSHOP 5 — RISIKOBEHANDLUNG', risquesEmpty: 'Kein Risiko in dieser Analyse identifiziert.', risquesTitleSing: 'Identifiziertes Risiko', risquesTitlePlur: 'Identifizierte Risiken', risquesHeaders: ['Risiko', 'S', 'W', 'Anfangswert', 'Stufe', 'Strategie', 'Restwert'],
    planTitle: 'Maßnahmenplan — Sicherheitsmaßnahmen', mesuresEmpty: 'Keine Sicherheitsmaßnahme in dieser Analyse definiert.', mesuresHeaders: ['Maßnahme', 'Typ', 'Priorität', 'Status', 'Verantwortlich', 'Einheit', 'Fälligkeit'],
  },
  annexe: {
    banner: 'ANHANG — METHODIK UND BEWERTUNGSREFERENZ', methodeTitle: '1. Methode EBIOS Risk Manager (EBIOS RM)',
    methodeIntro: 'EBIOS Risk Manager ist die offizielle Methode der ANSSI (französische Cybersicherheitsbehörde) zur Bewertung und Behandlung digitaler Risiken. Sie ist mit der Norm ISO/IEC 27005 kompatibel.',
    ateliers: 'Die Analyse erfolgt in 5 Workshops:\n• Workshop 1 — Rahmen und Sicherheitsbasis: Umfang, Geschäftswerte, unterstützende Assets, befürchtete Ereignisse.\n• Workshop 2 — Risikoquellen: Identifizierung und Bewertung böswilliger Akteure.\n• Workshop 3 — Strategische Szenarien: Angriffswege auf Geschäftswerte über das Ökosystem.\n• Workshop 4 — Operative Szenarien: technische Ausarbeitung der gewählten Angriffswege.\n• Workshop 5 — Risikobehandlung: Endbewertung, Behandlungsstrategien, Maßnahmenplan.',
    formule: (nb, max) => `Das Risikoniveau wird nach der Formel berechnet: Niveau = Schweregrad × Wahrscheinlichkeit (max ${nb}×${nb} = ${max}).`,
    graviteTitle: '2. Schweregradskala (Auswirkung)', vraisTitle: '3. Wahrscheinlichkeitsskala', scaleHeaders: ['Wert', 'Stufe', 'Bedeutung'],
    matriceTitle: '4. Bewertungsmatrix (Schweregrad × Wahrscheinlichkeit)',
    strategiesTitle: '5. Strategien zur Risikobehandlung', strategiesHeaders: ['Strategie', 'Beschreibung'],
    strategies: [
      ['Reduzieren', 'Sicherheitsmaßnahmen umsetzen, um das Risikoniveau auf ein akzeptables Maß zu senken.'],
      ['Akzeptieren', 'Das Risiko wird als akzeptabel angesehen (niedriges Niveau oder Behandlungskosten höher als der Nutzen).'],
      ['Übertragen', 'Das Risiko auf einen Dritten verlagern (Cyber-Versicherung, Subunternehmer, Vertragsklausel).'],
      ['Ablehnen', 'Die das Risiko tragende Aktivität oder das System wird aufgegeben oder grundlegend geändert.'],
      ['Überwachen', 'Das Risiko wird ohne sofortige Behandlung verfolgt: regelmäßige Neubewertung vorgesehen.'],
    ],
    defaultGravite: [
      { label: 'Vernachlässigbar', description: 'Minimale Auswirkung, gefährdet die wesentlichen Aktivitäten der Organisation nicht.' },
      { label: 'Begrenzt', description: 'Spürbare Auswirkung, aber die Organisation kann ohne außergewöhnliche Maßnahmen damit umgehen.' },
      { label: 'Erheblich', description: 'Erhebliche Auswirkung, die außergewöhnliche Mittel zur Bewältigung erfordert.' },
      { label: 'Kritisch', description: 'Existenzielle Auswirkung, die das Überleben oder die Kontinuität der Organisation bedrohen kann.' },
    ],
    defaultVrais: [
      { label: 'Gering', description: 'Sehr unwahrscheinliches Szenario: der Angreifer hat wenig Mittel, Motivation oder Gelegenheit.' },
      { label: 'Signifikant', description: 'Mögliches, aber seltenes Szenario: Angriffsbedingungen teilweise erfüllt.' },
      { label: 'Stark', description: 'Wahrscheinliches Szenario: der Angreifer verfügt über ausreichende Fähigkeiten und Motivation.' },
      { label: 'Maximal', description: 'Sehr wahrscheinliches oder nahezu sicheres Szenario: alle Angriffsbedingungen erfüllt.' },
    ],
  },
  dateLocale: 'de-DE',
}

const es: PdfStrings = {
  docSubject: 'Informe de análisis de riesgos EBIOS RM',
  cover: {
    title: 'ANÁLISIS DE RIESGOS', method: 'EBIOS Risk Manager — Método ANSSI', iso: 'Compatible con ISO/IEC 27005',
    generatedOn: 'Generado el', organisation: 'Organización', secteur: 'Sector', statut: 'Estado', createdOn: 'Creado el', updatedOn: 'Actualizado',
    statutTermine: 'Terminado', statutApprouve: 'Aprobado', statutEnCours: 'En curso',
    profilLabel: 'Perfil', profils: { TPE: 'Microempresa / muy pequeña', PME: 'PYME', ETI_GE: 'Gran organización' },
    statutRegLabel: 'Estatus regulatorio', statutsReg: { OSE: 'OSE (servicios esenciales)', EEI: 'Entidad esencial/importante (NIS2)', OIV: 'Operador de importancia vital' },
    mentionLabel: 'Mención de protección', mentions: { NON_PROTEGEE: 'No protegida', SENSIBLE: 'Sensible', RESTREINTE: 'Restringida', CONFIDENTIELLE: 'Confidencial' },
  },
  footer: { confidential: 'Confidencial — generado el', page: (n, t) => `Página ${n} / ${t}` },
  risk: { critique: 'Crítico', eleve: 'Alto', modere: 'Moderado', faible: 'Bajo' },
  summary: {
    banner: 'RESUMEN EJECUTIVO',
    intro: 'Este resumen presenta los resultados del análisis de riesgos realizado según el método EBIOS Risk Manager (ANSSI), compatible con ISO/IEC 27005. El objetivo es identificar las amenazas para la organización, evaluar su impacto potencial y definir un plan de acción para tratarlas.',
    conclNone: 'El análisis aún no ha identificado riesgos formalizados. Los talleres están en curso.',
    conclCritiques: (total, crit, p1) => `El análisis identificó ${total} ${total === 1 ? 'riesgo' : 'riesgos'}, de los cuales ${crit} de nivel CRÍTICO que requieren acción inmediata.` + (p1 > 0 ? ` Se ${p1 === 1 ? 'ha definido' : 'han definido'} ${p1} ${p1 === 1 ? 'medida prioritaria (P1)' : 'medidas prioritarias (P1)'} para responder.` : ''),
    conclEleves: (total, eleves, mesures) => `El análisis identificó ${total} ${total === 1 ? 'riesgo' : 'riesgos'}, de los cuales ${eleves} de nivel ALTO a tratar de forma prioritaria.` + (mesures > 0 ? ` Se ${mesures === 1 ? 'ha definido' : 'han definido'} ${mesures} ${mesures === 1 ? 'medida de seguridad' : 'medidas de seguridad'}.` : ''),
    conclModeres: (total, mesures) => `El análisis identificó ${total} ${total === 1 ? 'riesgo' : 'riesgos'} de niveles moderados a bajos.` + (mesures > 0 ? ` Se ${mesures === 1 ? 'ha definido' : 'han definido'} ${mesures} ${mesures === 1 ? 'medida de seguridad' : 'medidas de seguridad'}.` : ''),
    kpiRisques: (n) => n === 1 ? 'Riesgo identificado' : 'Riesgos identificados',
    kpiCritiques: (n) => n === 1 ? 'Riesgo crítico' : 'Riesgos críticos',
    kpiReduits: (n) => n === 1 ? 'Riesgo reducido' : 'Riesgos reducidos',
    kpiRealisees: (n) => n === 1 ? 'Medida realizada' : 'Medidas realizadas',
    matrixBrute: 'Matriz de riesgos brutos', matrixResiduelle: 'Matriz de riesgos residuales', ecoMapTitle: 'Ecosistema — mapa de amenazas',
    distribTitle: 'Distribución de los riesgos iniciales', distribCritique: 'Crítico (>=12)', distribEleve: 'Alto (8-11)', distribModere: 'Moderado (4-7)', distribFaible: 'Bajo (1-3)',
    top5Title: 'Top 5 de los riesgos más altos', top5Headers: ['Riesgo', 'Puntuación inicial', 'Nivel', 'Estrategia', 'Puntuación residual'],
    actionTitle: 'Avance del plan de acción',
    statutRealise: 'Realizado', statutEnCours: 'En curso', statutAFaire: 'Por hacer', statutReporte: 'Aplazado',
    taux: (pct, done, total, enCours) => `Tasa de realización: ${pct}% (${done} de ${total} medidas realizadas).` + (enCours > 0 ? ` ${enCours} ${enCours === 1 ? 'medida en despliegue' : 'medidas en despliegue'}.` : ''),
    noMesure: 'Ninguna medida de seguridad definida en este análisis.',
    usageTitle: "Aprovechamiento del informe", usageDoraArt8: "Documentación de la evaluación de riesgos TIC exigida por el artículo 8 del Reglamento DORA (UE 2022/2554).", usageHomologSSI: "Utilizable como informe de análisis de riesgos de un expediente de homologación de seguridad (PSSIE/RGS, IGI 1300).", usageHomologII901: "Defensa (BITD): utilizable como parte de análisis de riesgos de un expediente de homologación II 901 (SGDSN/ANSSI) para un SI de nivel Difusión Restringida.", usageOrsaSolva2: "Seguros: alimenta la evaluación ORSA (art. 45 de Solvencia II) por el riesgo operacional / cibernético.",
  },
  execSummary: {
    banner: "Resumen ejecutivo", intro: "Esta síntesis de una página está dirigida a un lector no especializado (dirección, asegurador, colegio profesional, socio). Resume el nivel de riesgo y las acciones prioritarias.", globalLabel: "Nivel de riesgo global",
    levels: { high: "Alto", medium: "Moderado", low: "Bajo control", none: "Por evaluar" },
    levelTexts: { high: "Riesgos importantes que requieren una acción rápida de la dirección.", medium: "Riesgos notables que deben tratarse según el plan de acción.", low: "Los riesgos identificados están bajo control; mantener la vigilancia.", none: "Análisis en curso: los riesgos aún no se han evaluado." },
    topRisksTitle: "Principales riesgos", topMeasuresTitle: "Primeras acciones a emprender",
    noRisk: "Ningún riesgo evaluado por el momento.", noMeasure: "Ninguna acción definida por el momento.",
  },
  a1: {
    banner: 'TALLER 1 — ENCUADRE Y BASE DE SEGURIDAD', perimetre: 'Alcance del estudio', objectifs: 'Objetivos:',
    classifHeader: 'Clasificación', classifications: { NP: 'No protegido', DR: 'Difusión Restringida', S: 'Secreto', TS: 'Alto Secreto' },
    vm: 'Valores de negocio FM1', vmHeaders: ['Nombre', 'Tipo', 'Descripción', 'Responsable'],
    bs: 'Activos de soporte', bsHeaders: ['Nombre', 'Tipo', 'Descripción', 'Valores de negocio vinculados'],
    er: 'Eventos temidos', erHeaders: ['Descripción', 'Impactos', 'Gravedad'],
    socle: 'Base de seguridad', socleHeaders: ['Medida', 'Fuente / Referencial', 'Estado'],
    empty: 'El encuadre aún no se ha completado.',
  },
  a2: { banner: 'TALLER 2 — FUENTES DE RIESGO', empty: 'Ninguna fuente de riesgo definida en este análisis.', retenues: 'Fuentes seleccionadas', ecartees: 'Fuentes descartadas', headers: ['Fuente de riesgo', 'Categoría', 'Pertinencia', 'Motivación', 'Recursos', 'Actividad'], headersShort: ['Fuente de riesgo', 'Categoría', 'Pertinencia'] },
  eco: { danger: 'Peligro', controle: 'Control', veille: 'Vigilancia', legendFiab: 'Color = fiabilidad (rojo→verde)', legendExpo: 'Tamaño = exposición', legendCritique: 'Tercero crítico' },
  partyTypes: { FOURNISSEUR: 'Proveedor', CLIENT: 'Cliente', PARTENAIRE: 'Socio', PRESTATAIRE: 'Prestador de servicios', ORGANISME_REGULATION: 'Regulador', AUTRE: 'Otro' },
  a3: {
    banner: 'TALLER 3 — ESCENARIOS ESTRATÉGICOS', empty: 'Ningún escenario estratégico definido en este análisis.', retenus: 'Escenarios seleccionados', ecartes: 'Escenarios descartados',
    headers: ['Escenario', 'Fuente de riesgo', 'Verosimilitud', 'Gravedad', 'Puntuación', 'Nivel'], headersShort: ['Escenario', 'Verosimilitud', 'Gravedad', 'Puntuación'],
    ppTitle: 'Ecosistema — partes interesadas', ppHeaders: ['Ref', 'Parte interesada', 'Tipo', 'Dep.', 'Pen.', 'Mad.', 'Conf.', 'Expo.', 'Fiab.', 'Amen.', 'Zona', 'Crít.'],
  },
  a4: { banner: 'TALLER 4 — ESCENARIOS OPERATIVOS', empty: 'Ningún escenario operativo definido en este análisis.', titleSing: 'Escenario operativo', titlePlur: 'Escenarios operativos', headers: ['Escenario operativo', 'Escenario estratégico', 'Verosimilitud', 'Gravedad', 'Puntuación'], aeDetail: 'Detalle de las acciones elementales', aeHeaders: ['Acción elemental', 'Tipo', 'Activo de soporte', 'Vulnerabilidad'] },
  a5: {
    banner: 'TALLER 5 — TRATAMIENTO DEL RIESGO', risquesEmpty: 'Ningún riesgo identificado en este análisis.', risquesTitleSing: 'Riesgo identificado', risquesTitlePlur: 'Riesgos identificados', risquesHeaders: ['Riesgo', 'G', 'V', 'Puntuación inicial', 'Nivel', 'Estrategia', 'Puntuación residual'],
    planTitle: 'Plan de acción — Medidas de seguridad', mesuresEmpty: 'Ninguna medida de seguridad definida en este análisis.', mesuresHeaders: ['Medida', 'Tipo', 'Prioridad', 'Estado', 'Responsable', 'Entidad', 'Vencimiento'],
  },
  annexe: {
    banner: 'ANEXO — METODOLOGÍA Y REFERENCIAL DE VALORACIÓN', methodeTitle: '1. Método EBIOS Risk Manager (EBIOS RM)',
    methodeIntro: 'EBIOS Risk Manager es el método oficial de la ANSSI (Agencia Nacional Francesa de Ciberseguridad) para evaluar y tratar los riesgos digitales. Es compatible con la norma ISO/IEC 27005.',
    ateliers: 'El análisis se desarrolla en 5 talleres:\n• Taller 1 — Encuadre y base de seguridad: alcance, valores de negocio, activos de soporte, eventos temidos.\n• Taller 2 — Fuentes de riesgo: identificación y evaluación de los actores maliciosos.\n• Taller 3 — Escenarios estratégicos: rutas de ataque que apuntan a los valores de negocio a través del ecosistema.\n• Taller 4 — Escenarios operativos: desglose técnico de las rutas de ataque seleccionadas.\n• Taller 5 — Tratamiento del riesgo: valoración final, estrategias de tratamiento, plan de acción.',
    formule: (nb, max) => `El nivel de riesgo se calcula mediante la fórmula: Nivel = Gravedad × Verosimilitud (máx. ${nb}×${nb} = ${max}).`,
    graviteTitle: '2. Escala de gravedad (impacto)', vraisTitle: '3. Escala de verosimilitud (probabilidad)', scaleHeaders: ['Valor', 'Nivel', 'Significado'],
    matriceTitle: '4. Matriz de valoración (Gravedad × Verosimilitud)',
    strategiesTitle: '5. Estrategias de tratamiento de los riesgos', strategiesHeaders: ['Estrategia', 'Descripción'],
    strategies: [
      ['Reducir', 'Implantar medidas de seguridad para reducir el nivel del riesgo a un nivel aceptable.'],
      ['Aceptar', 'El riesgo se considera aceptable tal cual (nivel bajo o coste de tratamiento superior al beneficio).'],
      ['Transferir', 'Trasladar el riesgo a un tercero (ciberseguro, subcontratista, cláusula contractual).'],
      ['Rechazar', 'La actividad o el sistema que conlleva el riesgo se abandona o se modifica en profundidad.'],
      ['Vigilar', 'El riesgo se sigue sin tratamiento inmediato: se prevé una reevaluación periódica.'],
    ],
    defaultGravite: [
      { label: 'Insignificante', description: 'Impacto mínimo, no cuestiona las actividades esenciales de la organización.' },
      { label: 'Limitado', description: 'Impacto notable pero la organización puede afrontarlo sin medidas excepcionales.' },
      { label: 'Importante', description: 'Impacto significativo que requiere medios excepcionales para afrontarlo.' },
      { label: 'Crítico', description: 'Impacto vital que puede amenazar la supervivencia o continuidad de la organización.' },
    ],
    defaultVrais: [
      { label: 'Mínimo', description: 'Escenario muy poco probable: el atacante tiene pocos medios, motivación u oportunidad.' },
      { label: 'Significativo', description: 'Escenario posible pero poco frecuente: condiciones de ataque parcialmente reunidas.' },
      { label: 'Fuerte', description: 'Escenario probable: el atacante dispone de capacidades y motivación suficientes.' },
      { label: 'Máximo', description: 'Escenario muy probable o casi seguro: todas las condiciones de ataque reunidas.' },
    ],
  },
  dateLocale: 'es-ES',
}

const it: PdfStrings = {
  docSubject: 'Rapporto di analisi dei rischi EBIOS RM',
  cover: {
    title: 'ANALISI DEI RISCHI', method: 'EBIOS Risk Manager — Metodo ANSSI', iso: 'Compatibile con ISO/IEC 27005',
    generatedOn: 'Generato il', organisation: 'Organizzazione', secteur: 'Settore', statut: 'Stato', createdOn: 'Creato il', updatedOn: 'Aggiornato',
    statutTermine: 'Completato', statutApprouve: 'Approvato', statutEnCours: 'In corso',
    profilLabel: 'Profilo', profils: { TPE: 'Micro / struttura molto piccola', PME: 'PMI', ETI_GE: 'Grande organizzazione' },
    statutRegLabel: 'Stato normativo', statutsReg: { OSE: 'OSE (servizi essenziali)', EEI: 'Soggetto essenziale/importante (NIS2)', OIV: 'Operatore di importanza vitale' },
    mentionLabel: 'Menzione di protezione', mentions: { NON_PROTEGEE: 'Non protetta', SENSIBLE: 'Sensibile', RESTREINTE: 'Ristretta', CONFIDENTIELLE: 'Riservata' },
  },
  footer: { confidential: 'Riservato — generato il', page: (n, t) => `Pagina ${n} / ${t}` },
  risk: { critique: 'Critico', eleve: 'Elevato', modere: 'Moderato', faible: 'Basso' },
  summary: {
    banner: 'SINTESI ESECUTIVA',
    intro: "Questa sintesi presenta i risultati dell'analisi dei rischi svolta secondo il metodo EBIOS Risk Manager (ANSSI), compatibile con ISO/IEC 27005. L'obiettivo è identificare le minacce per l'organizzazione, valutarne l'impatto potenziale e definire un piano d'azione per trattarle.",
    conclNone: "L'analisi non ha ancora identificato rischi formalizzati. I workshop sono in corso.",
    conclCritiques: (total, crit, p1) => `L'analisi ha identificato ${total} ${total === 1 ? 'rischio' : 'rischi'}, di cui ${crit} di livello CRITICO che richiedono un'azione immediata.` + (p1 > 0 ? ` ${p1 === 1 ? 'È stata definita' : 'Sono state definite'} ${p1} ${p1 === 1 ? 'misura prioritaria (P1)' : 'misure prioritarie (P1)'}.` : ''),
    conclEleves: (total, eleves, mesures) => `L'analisi ha identificato ${total} ${total === 1 ? 'rischio' : 'rischi'}, di cui ${eleves} di livello ELEVATO da trattare in via prioritaria.` + (mesures > 0 ? ` ${mesures === 1 ? 'È stata definita' : 'Sono state definite'} ${mesures} ${mesures === 1 ? 'misura di sicurezza' : 'misure di sicurezza'}.` : ''),
    conclModeres: (total, mesures) => `L'analisi ha identificato ${total} ${total === 1 ? 'rischio' : 'rischi'} di livello da moderato a basso.` + (mesures > 0 ? ` ${mesures === 1 ? 'È stata definita' : 'Sono state definite'} ${mesures} ${mesures === 1 ? 'misura di sicurezza' : 'misure di sicurezza'}.` : ''),
    kpiRisques: (n) => n === 1 ? 'Rischio identificato' : 'Rischi identificati',
    kpiCritiques: (n) => n === 1 ? 'Rischio critico' : 'Rischi critici',
    kpiReduits: (n) => n === 1 ? 'Rischio ridotto' : 'Rischi ridotti',
    kpiRealisees: (n) => n === 1 ? 'Misura realizzata' : 'Misure realizzate',
    matrixBrute: 'Matrice dei rischi lordi', matrixResiduelle: 'Matrice dei rischi residui', ecoMapTitle: 'Ecosistema — mappa delle minacce',
    distribTitle: 'Distribuzione dei rischi iniziali', distribCritique: 'Critico (>=12)', distribEleve: 'Elevato (8-11)', distribModere: 'Moderato (4-7)', distribFaible: 'Basso (1-3)',
    top5Title: 'Top 5 dei rischi più elevati', top5Headers: ['Rischio', 'Punteggio iniziale', 'Livello', 'Strategia', 'Punteggio residuo'],
    actionTitle: "Avanzamento del piano d'azione",
    statutRealise: 'Realizzato', statutEnCours: 'In corso', statutAFaire: 'Da fare', statutReporte: 'Rinviato',
    taux: (pct, done, total, enCours) => `Tasso di realizzazione: ${pct}% (${done} su ${total} misure realizzate).` + (enCours > 0 ? ` ${enCours} ${enCours === 1 ? 'misura in fase di implementazione' : 'misure in fase di implementazione'}.` : ''),
    noMesure: 'Nessuna misura di sicurezza definita in questa analisi.',
    usageTitle: "Valorizzazione del rapporto", usageDoraArt8: "Documentazione della valutazione dei rischi ICT richiesta dall'articolo 8 del Regolamento DORA (UE 2022/2554).", usageHomologSSI: "Utilizzabile come rapporto di analisi dei rischi di un fascicolo di omologazione di sicurezza (PSSIE/RGS, IGI 1300).", usageHomologII901: "Difesa (BITD): utilizzabile come parte di analisi dei rischi di un fascicolo di omologazione II 901 (SGDSN/ANSSI) per un SI di livello Diffusione Ristretta.", usageOrsaSolva2: "Assicurazione: alimenta la valutazione ORSA (art. 45 di Solvency II) per il rischio operativo / cyber.",
  },
  execSummary: {
    banner: "Sintesi esecutiva", intro: "Questa sintesi di una pagina è destinata a un lettore non specialista (direzione, assicuratore, ordine professionale, partner). Riassume il livello di rischio e le azioni prioritarie.", globalLabel: "Livello di rischio complessivo",
    levels: { high: "Elevato", medium: "Moderato", low: "Sotto controllo", none: "Da valutare" },
    levelTexts: { high: "Rischi importanti che richiedono un'azione rapida della direzione.", medium: "Rischi rilevanti da trattare secondo il piano d'azione.", low: "I rischi identificati sono sotto controllo; mantenere la vigilanza.", none: "Analisi in corso: i rischi non sono ancora stati valutati." },
    topRisksTitle: "Rischi principali", topMeasuresTitle: "Prime azioni da intraprendere",
    noRisk: "Nessun rischio valutato al momento.", noMeasure: "Nessuna azione definita al momento.",
  },
  a1: {
    banner: 'WORKSHOP 1 — INQUADRAMENTO E BASE DI SICUREZZA', perimetre: "Ambito dello studio", objectifs: 'Obiettivi:',
    classifHeader: 'Classificazione', classifications: { NP: 'Non protetto', DR: 'Diffusione Riservata', S: 'Segreto', TS: 'Top Secret' },
    vm: 'Valori aziendali FM1', vmHeaders: ['Nome', 'Tipo', 'Descrizione', 'Responsabile'],
    bs: 'Asset di supporto', bsHeaders: ['Nome', 'Tipo', 'Descrizione', 'Valori aziendali collegati'],
    er: 'Eventi temuti', erHeaders: ['Descrizione', 'Impatti', 'Gravità'],
    socle: 'Base di sicurezza', socleHeaders: ['Misura', 'Fonte / Riferimento', 'Stato'],
    empty: "L'inquadramento non è stato ancora completato.",
  },
  a2: { banner: 'WORKSHOP 2 — FONTI DI RISCHIO', empty: 'Nessuna fonte di rischio definita in questa analisi.', retenues: 'Fonti selezionate', ecartees: 'Fonti scartate', headers: ['Fonte di rischio', 'Categoria', 'Pertinenza', 'Motivazione', 'Risorse', 'Attività'], headersShort: ['Fonte di rischio', 'Categoria', 'Pertinenza'] },
  eco: { danger: 'Pericolo', controle: 'Controllo', veille: 'Sorveglianza', legendFiab: 'Colore = affidabilità (rosso→verde)', legendExpo: 'Dimensione = esposizione', legendCritique: 'Terza parte critica' },
  partyTypes: { FOURNISSEUR: 'Fornitore', CLIENT: 'Cliente', PARTENAIRE: 'Partner', PRESTATAIRE: 'Fornitore di servizi', ORGANISME_REGULATION: 'Autorità di regolamentazione', AUTRE: 'Altro' },
  a3: {
    banner: 'WORKSHOP 3 — SCENARI STRATEGICI', empty: 'Nessuno scenario strategico definito in questa analisi.', retenus: 'Scenari selezionati', ecartes: 'Scenari scartati',
    headers: ['Scenario', 'Fonte di rischio', 'Verosimiglianza', 'Gravità', 'Punteggio', 'Livello'], headersShort: ['Scenario', 'Verosimiglianza', 'Gravità', 'Punteggio'],
    ppTitle: 'Ecosistema — parti interessate', ppHeaders: ['Rif', 'Parte interessata', 'Tipo', 'Dip.', 'Pen.', 'Mat.', 'Fid.', 'Espo.', 'Affid.', 'Min.', 'Zona', 'Crit.'],
  },
  a4: { banner: 'WORKSHOP 4 — SCENARI OPERATIVI', empty: 'Nessuno scenario operativo definito in questa analisi.', titleSing: 'Scenario operativo', titlePlur: 'Scenari operativi', headers: ['Scenario operativo', 'Scenario strategico', 'Verosimiglianza', 'Gravità', 'Punteggio'], aeDetail: 'Dettaglio delle azioni elementari', aeHeaders: ['Azione elementare', 'Tipo', 'Asset di supporto', 'Vulnerabilità'] },
  a5: {
    banner: 'WORKSHOP 5 — TRATTAMENTO DEL RISCHIO', risquesEmpty: 'Nessun rischio identificato in questa analisi.', risquesTitleSing: 'Rischio identificato', risquesTitlePlur: 'Rischi identificati', risquesHeaders: ['Rischio', 'G', 'V', 'Punteggio iniziale', 'Livello', 'Strategia', 'Punteggio residuo'],
    planTitle: "Piano d'azione — Misure di sicurezza", mesuresEmpty: 'Nessuna misura di sicurezza definita in questa analisi.', mesuresHeaders: ['Misura', 'Tipo', 'Priorità', 'Stato', 'Responsabile', 'Entità', 'Scadenza'],
  },
  annexe: {
    banner: 'APPENDICE — METODOLOGIA E RIFERIMENTO DI VALUTAZIONE', methodeTitle: '1. Metodo EBIOS Risk Manager (EBIOS RM)',
    methodeIntro: "EBIOS Risk Manager è il metodo ufficiale dell'ANSSI (Agenzia nazionale francese per la cibersicurezza) per valutare e trattare i rischi digitali. È compatibile con la norma ISO/IEC 27005.",
    ateliers: "L'analisi si svolge in 5 workshop:\n• Workshop 1 — Inquadramento e base di sicurezza: ambito, valori aziendali, asset di supporto, eventi temuti.\n• Workshop 2 — Fonti di rischio: identificazione e valutazione degli attori malevoli.\n• Workshop 3 — Scenari strategici: percorsi di attacco verso i valori aziendali tramite l'ecosistema.\n• Workshop 4 — Scenari operativi: declinazione tecnica dei percorsi di attacco selezionati.\n• Workshop 5 — Trattamento del rischio: valutazione finale, strategie di trattamento, piano d'azione.",
    formule: (nb, max) => `Il livello di rischio è calcolato con la formula: Livello = Gravità × Verosimiglianza (max ${nb}×${nb} = ${max}).`,
    graviteTitle: '2. Scala di gravità (impatto)', vraisTitle: '3. Scala di verosimiglianza (probabilità)', scaleHeaders: ['Valore', 'Livello', 'Significato'],
    matriceTitle: '4. Matrice di valutazione (Gravità × Verosimiglianza)',
    strategiesTitle: '5. Strategie di trattamento dei rischi', strategiesHeaders: ['Strategia', 'Descrizione'],
    strategies: [
      ['Ridurre', 'Attuare misure di sicurezza per abbassare il livello del rischio a un livello accettabile.'],
      ['Accettare', 'Il rischio è ritenuto accettabile così com’è (livello basso o costo di trattamento superiore al beneficio).'],
      ['Trasferire', 'Spostare il rischio su una terza parte (assicurazione cyber, subappaltatore, clausola contrattuale).'],
      ['Rifiutare', "L'attività o il sistema che comporta il rischio viene abbandonato o modificato in profondità."],
      ['Sorvegliare', 'Il rischio viene monitorato senza trattamento immediato: rivalutazione periodica prevista.'],
    ],
    defaultGravite: [
      { label: 'Trascurabile', description: "Impatto minimo, non compromette le attività essenziali dell'organizzazione." },
      { label: 'Limitato', description: "Impatto notevole ma l'organizzazione può farvi fronte senza misure eccezionali." },
      { label: 'Importante', description: 'Impatto significativo che richiede mezzi eccezionali per farvi fronte.' },
      { label: 'Critico', description: "Impatto vitale che può minacciare la sopravvivenza o la continuità dell'organizzazione." },
    ],
    defaultVrais: [
      { label: 'Minimo', description: "Scenario molto improbabile: l'attaccante ha pochi mezzi, motivazione o opportunità." },
      { label: 'Significativo', description: "Scenario possibile ma poco frequente: condizioni di attacco parzialmente soddisfatte." },
      { label: 'Forte', description: "Scenario probabile: l'attaccante dispone di capacità e motivazione sufficienti." },
      { label: 'Massimo', description: 'Scenario molto probabile o quasi certo: tutte le condizioni di attacco soddisfatte.' },
    ],
  },
  dateLocale: 'it-IT',
}

const DICTS: Record<Locale, PdfStrings> = { fr, en, de, es, it }

/** Chaînes PDF pour une locale (repli FR si inconnue). */
export function getPdfStrings(locale: string | null | undefined): PdfStrings {
  return DICTS[(locale ?? 'fr') as Locale] ?? fr
}
