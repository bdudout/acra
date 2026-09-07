// ─── Export PowerPoint d'une analyse de risques (présentation managériale) ───
// Jeu de diapositives décisionnel pour un comité de direction : couverture
// (gouvernance : version, statut, approbateur), synthèse (RAG + appétit + KPI),
// « pourquoi » (scénarios narrés : source → objectif → chemin → impact),
// cartographie FIDÈLE à la matrice configurée (échelles + seuils), effet du
// traitement (brut → résiduel), risques prioritaires (G/V + appétit), plan de
// traitement (mesure → risque réduit, coût, efficacité) ; puis annexes.
//
// Fidélité : les couleurs/paliers de la carto viennent de la ScaleConfig de
// l'organisation (risk-scale) — mode qualitatif inclus — jamais d'un barème codé
// en dur. L'appétit vient du moteur pur (appetit.ts). pptxgenjs = JS pur.

import PptxGenJS from 'pptxgenjs'
import { execGlobalLevel, execTopRisks, execMeasuresToEngage, type ExecLevel } from './pdf-exec-summary'
import {
  getRiskTier, getRiskLevel, buildRiskMatrixModel,
  type RiskTier, type ScaleConfig, type EchelleNiveau, type Seuil, type MatrixModel,
} from './risk-scale'
import { synthetiserAppetit, seuilApplicable, evaluerAppetit, APPETIT_DEFAULT, type AppetitConfig } from './appetit'
import { SOUS_SECTEURS } from './ebios-data'

type Any = Record<string, unknown> // eslint-disable-line @typescript-eslint/no-explicit-any

export interface RenderOpts {
  appetit?: AppetitConfig
  approbateurNom?: string
}

const C = {
  primary: '4338CA', ink: '111827', muted: '6B7280', white: 'FFFFFF', band: 'EEF2FF', line: 'E5E7EB',
  high: 'DC2626', medium: 'D97706', low: '16A34A', none: '9CA3AF', tile: 'F9FAFB',
  tierCritique: 'DC2626', tierEleve: 'EA580C', tierModere: 'D97706', tierFaible: '16A34A',
}
const tierHex: Record<RiskTier, string> = { critique: C.tierCritique, eleve: C.tierEleve, modere: C.tierModere, faible: C.tierFaible }
const levelHex: Record<ExecLevel, string> = { high: C.high, medium: C.medium, low: C.low, none: C.none }

const SOUS_SECTEUR_LABEL = new Map<string, string>((SOUS_SECTEURS as { id: string; label: string }[]).map(s => [s.id, s.label]))

interface L {
  coverKicker: string; org: string; secteur: string; versionLabel: string; generatedOn: string; approvedBy: string
  statutAnalyse: Record<string, string>
  mentionLabels: Record<string, string>
  synthTitle: string; globalLevel: Record<ExecLevel, string>; globalLevelLead: string
  appetitBanner: string; appetitNone: string; appetitThreshold: string; lastRevision: string; currentVersion: string
  kpiRisks: string; kpiHigh: string; kpiOutAppetit: string; kpiMeasures: string; kpiProgress: string; kpiCompliance: string
  topRisks: string; noRisks: string; outAppetit: string
  whyTitle: string; whySource: string; whyObjective: string; whyPath: string; whyImpact: string; whyNone: string
  cartoTitle: string; cartoAxisG: string; cartoAxisV: string; scaleG: string; scaleV: string; seuilsLegend: string; appetitZone: string
  treatEffectTitle: string; cartoBrut: string; cartoResiduel: string; treatEffectNote: string
  treatTitle: string; thRisk: string; thGV: string; thLevel: string; thAppetit: string; thStrategy: string; thResidual: string
  planTitle: string; thMeasure: string; thReduces: string; thCost: string; thEffic: string; thStatus: string; thOwner: string; thDue: string; overdue: string
  strategies: Record<string, string>; statuses: Record<string, string>; categoriesEbios: Record<string, string>
  annexKicker: string
  axPerimetre: string; axPerimetreTitle: string; axVM: string; axBiens: string; axER: string
  axSrOv: string; axSource: string; axCat: string; axPert: string; axOv: string
  axEco: string; axPP: string; axType: string; axMenace: string
  axScen: string; axConf: string; axConfStatut: Record<string, string>; axConfNone: string
  axRisksDetail: string; empty: string; abbrevG: string; abbrevV: string
}

const FR: L = {
  coverKicker: 'Analyse de risques cyber — EBIOS Risk Manager', org: 'Organisation', secteur: 'Secteur', versionLabel: 'Version', generatedOn: 'Généré le', approvedBy: 'Approuvé par',
  statutAnalyse: { EN_COURS: 'En cours', SOUMIS: 'Soumis pour approbation', APPROUVE: 'Approuvé', REJETE: 'Rejeté', TERMINE: 'Terminé', ARCHIVE: 'Archivé' },
  mentionLabels: { NON_PROTEGEE: 'Non protégée', SENSIBLE: 'Sensible', RESTREINTE: 'Diffusion restreinte', CONFIDENTIELLE: 'Confidentielle' },
  synthTitle: 'Synthèse pour la direction', globalLevel: { high: 'Élevé', medium: 'Moyen', low: 'Maîtrisé', none: 'Non évalué' }, globalLevelLead: 'Niveau de risque global',
  appetitBanner: 'hors appétit', appetitNone: 'Appétit au risque non défini', appetitThreshold: 'seuil', lastRevision: 'Dernière révision', currentVersion: 'Version courante',
  kpiRisks: 'Risques identifiés', kpiHigh: 'Élevés', kpiOutAppetit: 'Hors appétit', kpiMeasures: 'Mesures', kpiProgress: 'Avancement', kpiCompliance: 'Conformité socle',
  topRisks: 'Risques prioritaires', noRisks: 'Aucun risque évalué.', outAppetit: 'hors appétit',
  whyTitle: 'Pourquoi ces risques — scénarios majeurs', whySource: 'Source', whyObjective: 'Objectif', whyPath: 'Chemin d’attaque', whyImpact: 'Impact métier', whyNone: 'Aucun scénario stratégique renseigné.',
  cartoTitle: 'Cartographie des risques', cartoAxisG: 'Gravité →', cartoAxisV: 'Vraisemblance ↑', scaleG: 'Gravité', scaleV: 'Vraisemblance', seuilsLegend: 'Niveaux', appetitZone: 'Contour foncé = au-dessus de l’appétit',
  treatEffectTitle: 'Effet du traitement (brut → résiduel)', cartoBrut: 'Risque brut', cartoResiduel: 'Après traitement', treatEffectNote: 'Le plan de traitement déplace les risques vers le bas-gauche (moins grave, moins probable).',
  treatTitle: 'Risques prioritaires & traitement', thRisk: 'Risque', thGV: 'G×V', thLevel: 'Niveau', thAppetit: 'Appétit', thStrategy: 'Stratégie', thResidual: 'Résiduel',
  planTitle: 'Plan de traitement', thMeasure: 'Mesure', thReduces: 'Réduit', thCost: 'Coût', thEffic: 'Effic.', thStatus: 'Statut', thOwner: 'Responsable', thDue: 'Échéance', overdue: 'en retard',
  strategies: { REDUIRE: 'Réduire', ACCEPTER: 'Accepter', TRANSFERER: 'Transférer', REFUSER: 'Refuser', SURVEILLER: 'Surveiller' },
  statuses: { A_FAIRE: 'À faire', EN_COURS: 'En cours', REALISE: 'Réalisé' },
  categoriesEbios: { GOUVERNANCE: 'Gouvernance', PROTECTION: 'Protection', DEFENSE: 'Défense', RESILIENCE: 'Résilience' },
  annexKicker: 'Annexe',
  axPerimetre: 'Périmètre & valeurs métier', axPerimetreTitle: 'Périmètre de l’étude', axVM: 'Valeurs métier', axBiens: 'Biens supports', axER: 'Événements redoutés',
  axSrOv: 'Sources de risque & objectifs visés', axSource: 'Source', axCat: 'Catégorie', axPert: 'Pert.', axOv: 'Objectifs visés',
  axEco: 'Écosystème — parties prenantes', axPP: 'Partie prenante', axType: 'Type', axMenace: 'Menace',
  axScen: 'Scénarios stratégiques', axConf: 'Conformité au socle de sécurité', axConfStatut: { conforme: 'Conforme', partiel: 'Partiel', non_conforme: 'Non conforme', non_applicable: 'N/A' }, axConfNone: 'Socle non renseigné.',
  axRisksDetail: 'Détail des risques', empty: '—', abbrevG: 'G', abbrevV: 'V',
}

const EN: L = {
  coverKicker: 'Cyber risk analysis — EBIOS Risk Manager', org: 'Organisation', secteur: 'Sector', versionLabel: 'Version', generatedOn: 'Generated on', approvedBy: 'Approved by',
  statutAnalyse: { EN_COURS: 'In progress', SOUMIS: 'Submitted for approval', APPROUVE: 'Approved', REJETE: 'Rejected', TERMINE: 'Completed', ARCHIVE: 'Archived' },
  mentionLabels: { NON_PROTEGEE: 'Unrestricted', SENSIBLE: 'Sensitive', RESTREINTE: 'Restricted', CONFIDENTIELLE: 'Confidential' },
  synthTitle: 'Executive summary', globalLevel: { high: 'High', medium: 'Medium', low: 'Controlled', none: 'Not assessed' }, globalLevelLead: 'Overall risk level',
  appetitBanner: 'above appetite', appetitNone: 'Risk appetite not defined', appetitThreshold: 'threshold', lastRevision: 'Last revision', currentVersion: 'Current version',
  kpiRisks: 'Risks identified', kpiHigh: 'High', kpiOutAppetit: 'Above appetite', kpiMeasures: 'Measures', kpiProgress: 'Progress', kpiCompliance: 'Baseline compliance',
  topRisks: 'Priority risks', noRisks: 'No assessed risk.', outAppetit: 'above appetite',
  whyTitle: 'Why these risks — major scenarios', whySource: 'Source', whyObjective: 'Objective', whyPath: 'Attack path', whyImpact: 'Business impact', whyNone: 'No strategic scenario provided.',
  cartoTitle: 'Risk map', cartoAxisG: 'Severity →', cartoAxisV: 'Likelihood ↑', scaleG: 'Severity', scaleV: 'Likelihood', seuilsLegend: 'Levels', appetitZone: 'Dark border = above appetite',
  treatEffectTitle: 'Treatment effect (initial → residual)', cartoBrut: 'Initial risk', cartoResiduel: 'After treatment', treatEffectNote: 'The treatment plan moves risks toward the bottom-left (less severe, less likely).',
  treatTitle: 'Priority risks & treatment', thRisk: 'Risk', thGV: 'S×L', thLevel: 'Level', thAppetit: 'Appetite', thStrategy: 'Strategy', thResidual: 'Residual',
  planTitle: 'Treatment plan', thMeasure: 'Measure', thReduces: 'Reduces', thCost: 'Cost', thEffic: 'Effic.', thStatus: 'Status', thOwner: 'Owner', thDue: 'Due', overdue: 'overdue',
  strategies: { REDUIRE: 'Reduce', ACCEPTER: 'Accept', TRANSFERER: 'Transfer', REFUSER: 'Refuse', SURVEILLER: 'Monitor' },
  statuses: { A_FAIRE: 'To do', EN_COURS: 'In progress', REALISE: 'Done' },
  categoriesEbios: { GOUVERNANCE: 'Governance', PROTECTION: 'Protection', DEFENSE: 'Defense', RESILIENCE: 'Resilience' },
  annexKicker: 'Appendix',
  axPerimetre: 'Scope & business values', axPerimetreTitle: 'Study scope', axVM: 'Business values', axBiens: 'Supporting assets', axER: 'Feared events',
  axSrOv: 'Risk sources & targeted objectives', axSource: 'Source', axCat: 'Category', axPert: 'Rel.', axOv: 'Targeted objectives',
  axEco: 'Ecosystem — stakeholders', axPP: 'Stakeholder', axType: 'Type', axMenace: 'Threat',
  axScen: 'Strategic scenarios', axConf: 'Compliance with the security baseline', axConfStatut: { conforme: 'Compliant', partiel: 'Partial', non_conforme: 'Non-compliant', non_applicable: 'N/A' }, axConfNone: 'Baseline not filled in.',
  axRisksDetail: 'Risk details', empty: '—', abbrevG: 'S', abbrevV: 'L',
}

const DE: L = {
  coverKicker: 'Cyber-Risikoanalyse — EBIOS Risk Manager', org: 'Organisation', secteur: 'Branche', versionLabel: 'Version', generatedOn: 'Erstellt am', approvedBy: 'Genehmigt von',
  statutAnalyse: { EN_COURS: 'In Bearbeitung', SOUMIS: 'Zur Genehmigung eingereicht', APPROUVE: 'Genehmigt', REJETE: 'Abgelehnt', TERMINE: 'Abgeschlossen', ARCHIVE: 'Archiviert' },
  mentionLabels: { NON_PROTEGEE: 'Nicht eingestuft', SENSIBLE: 'Sensibel', RESTREINTE: 'Eingeschränkt', CONFIDENTIELLE: 'Vertraulich' },
  synthTitle: 'Zusammenfassung für die Leitung', globalLevel: { high: 'Hoch', medium: 'Mittel', low: 'Beherrscht', none: 'Nicht bewertet' }, globalLevelLead: 'Gesamtrisikoniveau',
  appetitBanner: 'über dem Appetit', appetitNone: 'Risikoappetit nicht definiert', appetitThreshold: 'Schwelle', lastRevision: 'Letzte Revision', currentVersion: 'Aktuelle Version',
  kpiRisks: 'Identifizierte Risiken', kpiHigh: 'Hoch', kpiOutAppetit: 'Über Appetit', kpiMeasures: 'Maßnahmen', kpiProgress: 'Fortschritt', kpiCompliance: 'Konformität Basis',
  topRisks: 'Prioritäre Risiken', noRisks: 'Kein bewertetes Risiko.', outAppetit: 'über Appetit',
  whyTitle: 'Warum diese Risiken — Hauptszenarien', whySource: 'Quelle', whyObjective: 'Ziel', whyPath: 'Angriffspfad', whyImpact: 'Auswirkung', whyNone: 'Kein strategisches Szenario vorhanden.',
  cartoTitle: 'Risikokarte', cartoAxisG: 'Schwere →', cartoAxisV: 'Wahrscheinlichkeit ↑', scaleG: 'Schwere', scaleV: 'Wahrscheinlichkeit', seuilsLegend: 'Stufen', appetitZone: 'Dunkler Rahmen = über dem Appetit',
  treatEffectTitle: 'Wirkung der Behandlung (brutto → Rest)', cartoBrut: 'Bruttorisiko', cartoResiduel: 'Nach Behandlung', treatEffectNote: 'Der Behandlungsplan verschiebt die Risiken nach unten links (weniger schwer, weniger wahrscheinlich).',
  treatTitle: 'Prioritäre Risiken & Behandlung', thRisk: 'Risiko', thGV: 'S×W', thLevel: 'Niveau', thAppetit: 'Appetit', thStrategy: 'Strategie', thResidual: 'Rest',
  planTitle: 'Behandlungsplan', thMeasure: 'Maßnahme', thReduces: 'Reduziert', thCost: 'Kosten', thEffic: 'Wirks.', thStatus: 'Status', thOwner: 'Verantwortl.', thDue: 'Fällig', overdue: 'überfällig',
  strategies: { REDUIRE: 'Reduzieren', ACCEPTER: 'Akzeptieren', TRANSFERER: 'Übertragen', REFUSER: 'Ablehnen', SURVEILLER: 'Überwachen' },
  statuses: { A_FAIRE: 'Zu erledigen', EN_COURS: 'In Bearbeitung', REALISE: 'Erledigt' },
  categoriesEbios: { GOUVERNANCE: 'Governance', PROTECTION: 'Schutz', DEFENSE: 'Abwehr', RESILIENCE: 'Resilienz' },
  annexKicker: 'Anhang',
  axPerimetre: 'Umfang & Geschäftswerte', axPerimetreTitle: 'Untersuchungsumfang', axVM: 'Geschäftswerte', axBiens: 'Unterstützende Werte', axER: 'Befürchtete Ereignisse',
  axSrOv: 'Risikoquellen & angestrebte Ziele', axSource: 'Quelle', axCat: 'Kategorie', axPert: 'Rel.', axOv: 'Angestrebte Ziele',
  axEco: 'Ökosystem — Beteiligte', axPP: 'Beteiligter', axType: 'Typ', axMenace: 'Bedrohung',
  axScen: 'Strategische Szenarien', axConf: 'Konformität mit der Sicherheitsbasis', axConfStatut: { conforme: 'Konform', partiel: 'Teilweise', non_conforme: 'Nicht konform', non_applicable: 'N/V' }, axConfNone: 'Basis nicht ausgefüllt.',
  axRisksDetail: 'Risikodetails', empty: '—', abbrevG: 'S', abbrevV: 'W',
}

const ES: L = {
  coverKicker: 'Análisis de riesgos cibernéticos — EBIOS Risk Manager', org: 'Organización', secteur: 'Sector', versionLabel: 'Versión', generatedOn: 'Generado el', approvedBy: 'Aprobado por',
  statutAnalyse: { EN_COURS: 'En curso', SOUMIS: 'Enviado para aprobación', APPROUVE: 'Aprobado', REJETE: 'Rechazado', TERMINE: 'Finalizado', ARCHIVE: 'Archivado' },
  mentionLabels: { NON_PROTEGEE: 'Sin clasificar', SENSIBLE: 'Sensible', RESTREINTE: 'Restringido', CONFIDENTIELLE: 'Confidencial' },
  synthTitle: 'Resumen para la dirección', globalLevel: { high: 'Alto', medium: 'Medio', low: 'Controlado', none: 'No evaluado' }, globalLevelLead: 'Nivel de riesgo global',
  appetitBanner: 'por encima del apetito', appetitNone: 'Apetito de riesgo no definido', appetitThreshold: 'umbral', lastRevision: 'Última revisión', currentVersion: 'Versión actual',
  kpiRisks: 'Riesgos identificados', kpiHigh: 'Altos', kpiOutAppetit: 'Fuera de apetito', kpiMeasures: 'Medidas', kpiProgress: 'Avance', kpiCompliance: 'Conformidad base',
  topRisks: 'Riesgos prioritarios', noRisks: 'Ningún riesgo evaluado.', outAppetit: 'fuera de apetito',
  whyTitle: 'Por qué estos riesgos — escenarios principales', whySource: 'Fuente', whyObjective: 'Objetivo', whyPath: 'Ruta de ataque', whyImpact: 'Impacto de negocio', whyNone: 'Ningún escenario estratégico registrado.',
  cartoTitle: 'Mapa de riesgos', cartoAxisG: 'Gravedad →', cartoAxisV: 'Probabilidad ↑', scaleG: 'Gravedad', scaleV: 'Probabilidad', seuilsLegend: 'Niveles', appetitZone: 'Borde oscuro = por encima del apetito',
  treatEffectTitle: 'Efecto del tratamiento (bruto → residual)', cartoBrut: 'Riesgo bruto', cartoResiduel: 'Tras el tratamiento', treatEffectNote: 'El plan de tratamiento desplaza los riesgos hacia abajo-izquierda (menos grave, menos probable).',
  treatTitle: 'Riesgos prioritarios y tratamiento', thRisk: 'Riesgo', thGV: 'G×P', thLevel: 'Nivel', thAppetit: 'Apetito', thStrategy: 'Estrategia', thResidual: 'Residual',
  planTitle: 'Plan de tratamiento', thMeasure: 'Medida', thReduces: 'Reduce', thCost: 'Coste', thEffic: 'Efic.', thStatus: 'Estado', thOwner: 'Responsable', thDue: 'Vencim.', overdue: 'vencida',
  strategies: { REDUIRE: 'Reducir', ACCEPTER: 'Aceptar', TRANSFERER: 'Transferir', REFUSER: 'Rechazar', SURVEILLER: 'Vigilar' },
  statuses: { A_FAIRE: 'Por hacer', EN_COURS: 'En curso', REALISE: 'Hecho' },
  categoriesEbios: { GOUVERNANCE: 'Gobernanza', PROTECTION: 'Protección', DEFENSE: 'Defensa', RESILIENCE: 'Resiliencia' },
  annexKicker: 'Anexo',
  axPerimetre: 'Alcance y valores de negocio', axPerimetreTitle: 'Alcance del estudio', axVM: 'Valores de negocio', axBiens: 'Activos de soporte', axER: 'Eventos temidos',
  axSrOv: 'Fuentes de riesgo y objetivos', axSource: 'Fuente', axCat: 'Categoría', axPert: 'Rel.', axOv: 'Objetivos',
  axEco: 'Ecosistema — partes interesadas', axPP: 'Parte interesada', axType: 'Tipo', axMenace: 'Amenaza',
  axScen: 'Escenarios estratégicos', axConf: 'Conformidad con la base de seguridad', axConfStatut: { conforme: 'Conforme', partiel: 'Parcial', non_conforme: 'No conforme', non_applicable: 'N/A' }, axConfNone: 'Base no rellenada.',
  axRisksDetail: 'Detalle de riesgos', empty: '—', abbrevG: 'G', abbrevV: 'P',
}

const IT: L = {
  coverKicker: 'Analisi dei rischi cyber — EBIOS Risk Manager', org: 'Organizzazione', secteur: 'Settore', versionLabel: 'Versione', generatedOn: 'Generato il', approvedBy: 'Approvato da',
  statutAnalyse: { EN_COURS: 'In corso', SOUMIS: 'Inviato per approvazione', APPROUVE: 'Approvato', REJETE: 'Respinto', TERMINE: 'Completato', ARCHIVE: 'Archiviato' },
  mentionLabels: { NON_PROTEGEE: 'Non classificato', SENSIBLE: 'Sensibile', RESTREINTE: 'Riservato', CONFIDENTIELLE: 'Confidenziale' },
  synthTitle: 'Sintesi per la direzione', globalLevel: { high: 'Alto', medium: 'Medio', low: 'Controllato', none: 'Non valutato' }, globalLevelLead: 'Livello di rischio globale',
  appetitBanner: 'oltre la propensione', appetitNone: 'Propensione al rischio non definita', appetitThreshold: 'soglia', lastRevision: 'Ultima revisione', currentVersion: 'Versione corrente',
  kpiRisks: 'Rischi identificati', kpiHigh: 'Alti', kpiOutAppetit: 'Oltre propensione', kpiMeasures: 'Misure', kpiProgress: 'Avanzamento', kpiCompliance: 'Conformità base',
  topRisks: 'Rischi prioritari', noRisks: 'Nessun rischio valutato.', outAppetit: 'oltre propensione',
  whyTitle: 'Perché questi rischi — scenari principali', whySource: 'Fonte', whyObjective: 'Obiettivo', whyPath: 'Percorso di attacco', whyImpact: 'Impatto di business', whyNone: 'Nessuno scenario strategico presente.',
  cartoTitle: 'Mappa dei rischi', cartoAxisG: 'Gravità →', cartoAxisV: 'Probabilità ↑', scaleG: 'Gravità', scaleV: 'Probabilità', seuilsLegend: 'Livelli', appetitZone: 'Bordo scuro = oltre la propensione',
  treatEffectTitle: 'Effetto del trattamento (lordo → residuo)', cartoBrut: 'Rischio lordo', cartoResiduel: 'Dopo il trattamento', treatEffectNote: 'Il piano di trattamento sposta i rischi verso il basso a sinistra (meno grave, meno probabile).',
  treatTitle: 'Rischi prioritari e trattamento', thRisk: 'Rischio', thGV: 'G×P', thLevel: 'Livello', thAppetit: 'Propensione', thStrategy: 'Strategia', thResidual: 'Residuo',
  planTitle: 'Piano di trattamento', thMeasure: 'Misura', thReduces: 'Riduce', thCost: 'Costo', thEffic: 'Effic.', thStatus: 'Stato', thOwner: 'Responsabile', thDue: 'Scadenza', overdue: 'in ritardo',
  strategies: { REDUIRE: 'Ridurre', ACCEPTER: 'Accettare', TRANSFERER: 'Trasferire', REFUSER: 'Rifiutare', SURVEILLER: 'Sorvegliare' },
  statuses: { A_FAIRE: 'Da fare', EN_COURS: 'In corso', REALISE: 'Fatto' },
  categoriesEbios: { GOUVERNANCE: 'Governance', PROTECTION: 'Protezione', DEFENSE: 'Difesa', RESILIENCE: 'Resilienza' },
  annexKicker: 'Allegato',
  axPerimetre: 'Perimetro e valori di business', axPerimetreTitle: 'Perimetro dello studio', axVM: 'Valori di business', axBiens: 'Beni di supporto', axER: 'Eventi temuti',
  axSrOv: 'Fonti di rischio e obiettivi', axSource: 'Fonte', axCat: 'Categoria', axPert: 'Ril.', axOv: 'Obiettivi',
  axEco: 'Ecosistema — parti interessate', axPP: 'Parte interessata', axType: 'Tipo', axMenace: 'Minaccia',
  axScen: 'Scenari strategici', axConf: 'Conformità alla base di sicurezza', axConfStatut: { conforme: 'Conforme', partiel: 'Parziale', non_conforme: 'Non conforme', non_applicable: 'N/D' }, axConfNone: 'Base non compilata.',
  axRisksDetail: 'Dettaglio dei rischi', empty: '—', abbrevG: 'G', abbrevV: 'P',
}

function strings(locale: string): L {
  switch (locale) {
    case 'fr': return FR
    case 'de': return DE
    case 'es': return ES
    case 'it': return IT
    default: return EN
  }
}

const asArr = (v: unknown): Any[] => (Array.isArray(v) ? (v as Any[]) : [])
const s = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))
const num = (v: unknown): number => (Number(v) || 0)
const trunc = (v: string, n: number): string => (v.length > n ? v.slice(0, n - 1) + '…' : v)
const hex = (c: unknown, fallback = '9CA3AF'): string => {
  const v = s(c).replace('#', '').trim()
  return /^[0-9a-fA-F]{6}$/.test(v) ? v.toUpperCase() : fallback
}

/** Narration décisionnelle d'un scénario stratégique (le « pourquoi »). */
export interface ScenarioNarrative {
  nom: string; gravite: number; vraisemblance: number; niveau: number
  source: string; objectif: string; chemin: string[]; impact: string
}

/**
 * Top N scénarios stratégiques (retenus, triés par niveau) résolus en récit :
 * source (via sourceRisqueId) → objectif visé → chemin d'attaque (parties
 * prenantes) → impact métier (via evenementRedouteRef puis valeur métier).
 * Pure et testée — c'est le « pourquoi » présenté à la direction.
 */
export function topScenarioNarratives(analyse: Any, n: number): ScenarioNarrative[] {
  const cadrage = (analyse.cadrage as Any) ?? {}
  const srcById = new Map(asArr(analyse.sourcesRisque).map(sr => [s(sr.id), s(sr.nom)]))
  const erById = new Map(asArr(cadrage.evenementsRedoutes).map(er => [s(er.id), er]))
  const vmById = new Map(asArr(cadrage.valeursMetier).map(vm => [s(vm.id), s(vm.nom)]))
  const impactOf = (sc: Any): string => {
    const ref = s(sc.evenementRedouteRef)
    const er = erById.get(ref)
    if (er) return s(er.description) || vmById.get(s(er.valeurMetierId)) || ref
    return ref
  }
  return asArr(analyse.scenariosStrategiques)
    .filter(x => x.retenu !== false)
    .sort((a, b) => num(b.niveauRisque) - num(a.niveauRisque))
    .slice(0, Math.max(0, n))
    .map(sc => ({
      nom: s(sc.nom), gravite: num(sc.gravite), vraisemblance: num(sc.vraisemblance), niveau: num(sc.niveauRisque),
      source: srcById.get(s(sc.sourceRisqueId)) || '',
      objectif: s(sc.objectifVise),
      chemin: asArr(sc.cheminAttaque).map(e => s(e.partiePrenante)).filter(Boolean),
      impact: impactOf(sc),
    }))
}

/** Ne conserve que des entrées d'échelle valides (repli sur les défauts sinon). */
function cleanEchelle(v: unknown): EchelleNiveau[] | undefined {
  const arr = asArr(v).filter(e => e && typeof e === 'object' && typeof (e as Any).niveau === 'number')
  return arr.length ? (arr as unknown as EchelleNiveau[]) : undefined
}
function cleanSeuils(v: unknown): Seuil[] | undefined {
  const arr = asArr(v).filter(e => e && typeof e === 'object' && typeof (e as Any).scoreMin === 'number')
  return arr.length ? (arr as unknown as Seuil[]) : undefined
}

/** Diapositive : bandeau de titre + numérotation (kicker « Annexe » optionnel). */
function slideHeader(pptx: PptxGenJS, title: string, kicker: string): PptxGenJS.Slide {
  const slide = pptx.addSlide()
  slide.background = { color: C.white }
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.9, fill: { color: C.band }, line: { type: 'none' } })
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.16, h: 0.9, fill: { color: C.primary }, line: { type: 'none' } })
  if (kicker) slide.addText(kicker.toUpperCase(), { x: 0.5, y: 0.12, w: 12, h: 0.24, fontSize: 10, color: C.primary, bold: true, charSpacing: 1 })
  slide.addText(title, { x: 0.5, y: kicker ? 0.34 : 0.22, w: 12.3, h: 0.5, fontSize: 22, bold: true, color: C.ink })
  return slide
}

/** Petite tuile de KPI (label + grand chiffre coloré). */
function kpiTile(slide: PptxGenJS.Slide, pptx: PptxGenJS, x: number, y: number, w: number, label: string, value: string | number, color: string) {
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h: 1.25, rectRadius: 0.06, fill: { color: C.tile }, line: { color: C.line, width: 1 } })
  slide.addText(String(value), { x, y: y + 0.12, w, h: 0.6, align: 'center', fontSize: 28, bold: true, color })
  slide.addText(label, { x, y: y + 0.8, w, h: 0.34, align: 'center', fontSize: 9, color: C.muted })
}

/**
 * Dessine une matrice des risques fidèle à la config (couleurs des paliers,
 * marqueurs Rn placés par le couple g×v, contour foncé au-dessus de l'appétit).
 * `place` fournit le couple (g, v) où poser chaque risque (brut ou résiduel).
 */
function drawMatrix(
  slide: PptxGenJS.Slide, pptx: PptxGenJS, model: MatrixModel, risques: Any[],
  ox: number, oy: number, cell: number,
  place: (r: Any) => { g: number; v: number }, appetitSeuil: number | null,
) {
  const nCols = model.graviteLevels.length
  const nRows = model.vraisemblanceLevels.length
  model.cells.forEach((row, ri) => {
    row.forEach((c, ci) => {
      const x = ox + ci * cell, y = oy + ri * cell
      const above = appetitSeuil != null && c.score > appetitSeuil
      slide.addShape(pptx.ShapeType.rect, {
        x, y, w: cell, h: cell, fill: { color: hex(c.couleur), transparency: 22 },
        line: above ? { color: C.ink, width: 2.25 } : { color: C.white, width: 1.5 },
      })
      const here = risques.map((r, idx) => ({ r, idx })).filter(({ r }) => { const p = place(r); return p.g === c.gravite && p.v === c.vraisemblance })
      if (here.length) slide.addText(here.map(({ idx }) => `R${idx + 1}`).join(' '), { x, y, w: cell, h: cell, align: 'center', valign: 'middle', fontSize: cell < 0.7 ? 8 : 10, bold: true, color: C.ink })
    })
  })
  // Ticks de vraisemblance (à gauche, décroissant du haut)
  const vDesc = [...model.vraisemblanceLevels].sort((a, b) => b.niveau - a.niveau)
  vDesc.forEach((lvl, ri) => slide.addText(String(lvl.niveau), { x: ox - 0.32, y: oy + ri * cell, w: 0.28, h: cell, align: 'center', valign: 'middle', fontSize: 9, color: C.muted }))
  // Ticks de gravité (en bas, croissant de gauche à droite)
  model.graviteLevels.forEach((lvl, ci) => slide.addText(String(lvl.niveau), { x: ox + ci * cell, y: oy + nRows * cell, w: cell, h: 0.26, align: 'center', fontSize: 9, color: C.muted }))
  return { w: nCols * cell, h: nRows * cell }
}

export async function renderAnalysePptx(analyse: Any, config: Any | null, locale: string, opts?: RenderOpts): Promise<Buffer> {
  const L = strings(locale)
  const dateLocale = locale === 'en' ? 'en-GB' : locale === 'de' ? 'de-DE' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : 'fr-FR'
  const fmtDate = (d: unknown): string => { const t = new Date(d as string); return isNaN(t.getTime()) ? '' : t.toLocaleDateString(dateLocale) }
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE' // 13.33 × 7.5
  pptx.author = 'ACRA — Augmented Cyber Risk Analysis'

  const cadrage = (analyse.cadrage as Any) ?? {}
  const risques = asArr(analyse.risques)
  const mesures = asArr(analyse.mesures)
  const revisions = asArr(analyse.revisions)
  const now = new Date()

  // Échelles / matrice configurées (repli sur les défauts) — pour la cartographie fidèle
  const scaleInput: Partial<ScaleConfig> = {
    nbNiveaux: (config as Any)?.nbNiveaux === 5 ? 5 : undefined,
    echelleGravite: cleanEchelle((config as Any)?.echelleGravite),
    echelleVraisemblance: cleanEchelle((config as Any)?.echelleVraisemblance),
    seuilsMatrice: cleanSeuils((config as Any)?.seuilsMatrice),
    matriceMode: (config as Any)?.matriceMode === 'QUALITATIVE' ? 'QUALITATIVE' : undefined,
    matriceQualitative: asArr((config as Any)?.matriceQualitative).length ? ((config as Any).matriceQualitative as ScaleConfig['matriceQualitative']) : undefined,
  }
  const model = buildRiskMatrixModel(scaleInput)

  // Appétit au risque
  const appetit: AppetitConfig = opts?.appetit ?? APPETIT_DEFAULT
  const appetitDefined = appetit.seuilGlobal != null || Object.keys(appetit.parCategorie ?? {}).length > 0
  const riskLite = risques.map(r => ({ taxonomieCode: (r.taxonomieCode as string) ?? null, niveauResiduel: r.niveauResiduel != null ? num(r.niveauResiduel) : null }))
  const appetitSynth = synthetiserAppetit(riskLite, appetit)
  const appetitStatut = (r: Any) => evaluerAppetit(r.niveauResiduel != null ? num(r.niveauResiduel) : null, seuilApplicable(appetit, (r.taxonomieCode as string) ?? null))

  // ── 1. Couverture ──────────────────────────────────────────────────────────
  const cover = pptx.addSlide()
  cover.background = { color: C.primary }
  cover.addText(L.coverKicker.toUpperCase(), { x: 0.7, y: 1.5, w: 12, h: 0.4, fontSize: 12, color: 'C7D2FE', bold: true, charSpacing: 1 })
  cover.addText(s(analyse.nom) || 'Analyse', { x: 0.7, y: 2.0, w: 12, h: 1.3, fontSize: 40, bold: true, color: C.white })
  const meta: string[] = []
  if (analyse.organisation) meta.push(`${L.org} : ${s(analyse.organisation)}`)
  if (analyse.secteur) meta.push(`${L.secteur} : ${s(analyse.secteur)}`)
  const ssLabel = SOUS_SECTEUR_LABEL.get(s(analyse.sousSecteur))
  if (ssLabel) meta.push(ssLabel)
  cover.addText(meta.join('    ·    '), { x: 0.7, y: 3.5, w: 12, h: 0.4, fontSize: 14, color: 'E0E7FF' })
  // Gouvernance : version · statut · approbateur
  const gov: string[] = []
  gov.push(`${L.versionLabel} ${num(analyse.versionMajeure) || 1}.${num(analyse.versionMineure)}`)
  const statutLbl = L.statutAnalyse[s(analyse.statut)] ?? (analyse.statut ? s(analyse.statut) : '')
  if (statutLbl) gov.push(statutLbl)
  if (s(analyse.statut) === 'APPROUVE' && opts?.approbateurNom) gov.push(`${L.approvedBy} ${opts.approbateurNom}`)
  cover.addText(gov.join('    ·    '), { x: 0.7, y: 3.95, w: 12, h: 0.35, fontSize: 12, color: 'C7D2FE' })
  const mention = s(analyse.mentionProtection) || 'NON_PROTEGEE'
  if (mention !== 'NON_PROTEGEE') {
    cover.addShape(pptx.ShapeType.roundRect, { x: 0.7, y: 4.55, w: 3.2, h: 0.5, rectRadius: 0.25, fill: { color: 'FFFFFF' }, line: { type: 'none' } })
    cover.addText(L.mentionLabels[mention] ?? mention, { x: 0.7, y: 4.55, w: 3.2, h: 0.5, align: 'center', fontSize: 12, bold: true, color: C.primary })
  }
  cover.addText(`${L.generatedOn} ${now.toLocaleDateString(dateLocale)}`, { x: 0.7, y: 6.7, w: 12, h: 0.4, fontSize: 11, color: 'C7D2FE' })

  // ── 2. Synthèse pour la direction ────────────────────────────────────────
  {
    const slide = slideHeader(pptx, L.synthTitle, '')
    const level = execGlobalLevel(risques as { niveauRisque: number }[])
    // Bandeau RAG + appétit à droite
    slide.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 1.1, w: 12.33, h: 0.86, rectRadius: 0.06, fill: { color: levelHex[level] }, line: { type: 'none' } })
    slide.addText(L.globalLevelLead, { x: 0.8, y: 1.2, w: 6, h: 0.3, fontSize: 12, color: 'FFFFFF' })
    slide.addText(L.globalLevel[level], { x: 0.8, y: 1.42, w: 6, h: 0.5, fontSize: 22, bold: true, color: 'FFFFFF' })
    if (appetitDefined) {
      slide.addText([
        { text: `${appetitSynth.horsAppetit}`, options: { fontSize: 22, bold: true, color: 'FFFFFF' } },
        { text: `  ${L.appetitBanner}`, options: { fontSize: 12, color: 'FFFFFF' } },
        { text: appetit.seuilGlobal != null ? `   (${L.appetitThreshold} ${appetit.seuilGlobal})` : '', options: { fontSize: 11, color: 'EEF2FF' } },
      ], { x: 6.9, y: 1.28, w: 5.7, h: 0.5, align: 'right' })
    } else {
      slide.addText(L.appetitNone, { x: 6.9, y: 1.34, w: 5.7, h: 0.4, align: 'right', fontSize: 11, italic: true, color: 'EEF2FF' })
    }
    // KPI tiles (6)
    const tiers = risques.map(r => getRiskTier(num(r.niveauRisque)))
    const nHigh = tiers.filter(t => t === 'critique' || t === 'eleve').length
    const done = mesures.filter(m => s(m.statut) === 'REALISE').length
    const progress = mesures.length ? Math.round((done / mesures.length) * 100) : 0
    const socle = asArr(cadrage.socleSecurite)
    const nConf = socle.filter(e => s(e.statut) === 'conforme').length
    const confPct = socle.length ? Math.round((nConf / socle.length) * 100) : null
    const y = 2.25, w = 1.9, gap = 0.14, x0 = 0.5
    kpiTile(slide, pptx, x0 + 0 * (w + gap), y, w, L.kpiRisks, risques.length, C.ink)
    kpiTile(slide, pptx, x0 + 1 * (w + gap), y, w, L.kpiHigh, nHigh, C.high)
    kpiTile(slide, pptx, x0 + 2 * (w + gap), y, w, L.kpiOutAppetit, appetitDefined ? appetitSynth.horsAppetit : '—', appetitDefined && appetitSynth.horsAppetit > 0 ? C.high : C.muted)
    kpiTile(slide, pptx, x0 + 3 * (w + gap), y, w, L.kpiMeasures, mesures.length, C.ink)
    kpiTile(slide, pptx, x0 + 4 * (w + gap), y, w, L.kpiProgress, `${progress}%`, C.primary)
    kpiTile(slide, pptx, x0 + 5 * (w + gap), y, w, L.kpiCompliance, confPct != null ? `${confPct}%` : '—', confPct != null ? (confPct >= 80 ? C.low : confPct >= 50 ? C.medium : C.high) : C.muted)
    // Ligne de révision
    const rev = revisions[0]
    const revLine = rev
      ? `${L.lastRevision} : v${s(rev.version)} · ${fmtDate(rev.createdAt)}${rev.note ? ' — ' + trunc(s(rev.note), 80) : ''}`
      : `${L.currentVersion} v${num(analyse.versionMajeure) || 1}.${num(analyse.versionMineure)}`
    slide.addText(revLine, { x: 0.5, y: 3.62, w: 12.3, h: 0.3, fontSize: 10, italic: true, color: C.muted })
    // Top 3 risques (avec G/V + appétit)
    slide.addText(L.topRisks, { x: 0.5, y: 4.0, w: 12, h: 0.35, fontSize: 14, bold: true, color: C.ink })
    const top = execTopRisks(risques as { niveauRisque: number }[], 3) as Any[]
    if (top.length === 0) {
      slide.addText(L.noRisks, { x: 0.5, y: 4.4, w: 12, h: 0.4, fontSize: 12, italic: true, color: C.muted })
    } else {
      const runs: PptxGenJS.TextProps[] = []
      top.forEach((r, i) => {
        const tier = getRiskTier(num(r.niveauRisque))
        const hors = appetitDefined && appetitStatut(r) === 'HORS'
        runs.push({ text: `${i + 1}. ${trunc(s(r.nom), 74)}  —  ${num(r.niveauRisque)} (${L.abbrevG}${num(r.gravite)}×${L.abbrevV}${num(r.vraisemblance)})`, options: { color: tierHex[tier], fontSize: 13, breakLine: !hors, paraSpaceAfter: hors ? 0 : 6 } })
        if (hors) runs.push({ text: `   · ${L.outAppetit}`, options: { color: C.high, fontSize: 11, bold: true, breakLine: true, paraSpaceAfter: 6 } })
      })
      slide.addText(runs, { x: 0.6, y: 4.4, w: 12.2, h: 2 })
    }
  }

  // ── 3. Pourquoi ces risques (scénarios narrés) ───────────────────────────
  {
    const slide = slideHeader(pptx, L.whyTitle, '')
    const nar = topScenarioNarratives(analyse, 3)
    if (nar.length === 0) {
      slide.addText(L.whyNone, { x: 0.5, y: 1.4, w: 12, h: 0.5, fontSize: 12, italic: true, color: C.muted })
    } else {
      const cardH = Math.min(1.75, (6.1 / nar.length) - 0.15)
      nar.forEach((sc, i) => {
        const y = 1.15 + i * (cardH + 0.15)
        const tier = getRiskTier(sc.niveau)
        slide.addShape(pptx.ShapeType.roundRect, { x: 0.5, y, w: 12.33, h: cardH, rectRadius: 0.05, fill: { color: C.tile }, line: { color: C.line, width: 1 } })
        // Pastille de niveau
        slide.addShape(pptx.ShapeType.roundRect, { x: 0.7, y: y + 0.2, w: 1.15, h: 0.7, rectRadius: 0.05, fill: { color: tierHex[tier] }, line: { type: 'none' } })
        slide.addText([
          { text: `${sc.niveau}`, options: { fontSize: 18, bold: true, color: 'FFFFFF', breakLine: true } },
          { text: `${L.abbrevG}${sc.gravite}×${L.abbrevV}${sc.vraisemblance}`, options: { fontSize: 9, color: 'FFFFFF' } },
        ], { x: 0.7, y: y + 0.2, w: 1.15, h: 0.7, align: 'center', valign: 'middle' })
        slide.addText(trunc(sc.nom, 78), { x: 2.0, y: y + 0.14, w: 10.6, h: 0.34, fontSize: 13, bold: true, color: C.ink })
        const facts: PptxGenJS.TextProps[] = []
        const addFact = (label: string, val: string) => { if (val) { facts.push({ text: `${label} : `, options: { fontSize: 10, bold: true, color: C.primary } }); facts.push({ text: val, options: { fontSize: 10, color: C.ink } }); facts.push({ text: '    ', options: { fontSize: 10 } }) } }
        addFact(L.whySource, sc.source)
        addFact(L.whyObjective, sc.objectif)
        addFact(L.whyImpact, sc.impact)
        if (facts.length) slide.addText(facts, { x: 2.0, y: y + 0.5, w: 10.6, h: 0.32, valign: 'middle' })
        if (sc.chemin.length) slide.addText([{ text: `${L.whyPath} : `, options: { fontSize: 10, bold: true, color: C.primary } }, { text: sc.chemin.join('  →  '), options: { fontSize: 10, color: C.ink } }], { x: 2.0, y: y + 0.5 + (facts.length ? 0.34 : 0), w: 10.6, h: 0.32, valign: 'middle' })
      })
    }
  }

  // ── 4. Cartographie des risques (fidèle à la matrice configurée) ──────────
  {
    const slide = slideHeader(pptx, L.cartoTitle, '')
    const cell = 0.9, ox = 2.0, oy = 1.5
    const seuil = appetitDefined ? appetit.seuilGlobal : null
    const dims = drawMatrix(slide, pptx, model, risques, ox, oy, cell, r => ({ g: num(r.gravite), v: num(r.vraisemblance) }), seuil)
    // Axes
    slide.addText(L.cartoAxisG, { x: ox, y: oy + dims.h + 0.3, w: dims.w, h: 0.3, align: 'center', fontSize: 11, color: C.muted })
    // Étiquette verticale : boîte large (= hauteur de la grille) pivotée, pour que
    // les libellés longs (ex. « Wahrscheinlichkeit ») tiennent sur une seule ligne.
    slide.addText(L.cartoAxisV, { x: ox - 0.85 - dims.h / 2, y: oy + dims.h / 2 - 0.2, w: dims.h, h: 0.4, align: 'center', valign: 'middle', fontSize: 11, color: C.muted, rotate: 270 })
    // Légende des échelles (labels des niveaux) + paliers + appétit
    const lx = ox + dims.w + 0.5, lw = 13.33 - lx - 0.4
    let ly = oy
    const scaleLine = (title: string, levels: EchelleNiveau[]) => {
      slide.addText(title, { x: lx, y: ly, w: lw, h: 0.26, fontSize: 11, bold: true, color: C.primary }); ly += 0.28
      slide.addText([...levels].sort((a, b) => a.niveau - b.niveau).map(l => `${l.niveau} ${l.label}`).join('   ·   '), { x: lx, y: ly, w: lw, h: 0.5, fontSize: 10, color: C.ink }); ly += 0.56
    }
    scaleLine(L.scaleG, model.graviteLevels)
    scaleLine(L.scaleV, model.vraisemblanceLevels)
    // Paliers (couleurs)
    slide.addText(L.seuilsLegend, { x: lx, y: ly, w: lw, h: 0.26, fontSize: 11, bold: true, color: C.primary }); ly += 0.3
    // Paliers ordonnés du plus faible score au plus fort
    const seuilMin = new Map<string, { couleur: string; min: number }>()
    model.cells.flat().forEach(c => { const cur = seuilMin.get(c.label); if (!cur || c.score < cur.min) seuilMin.set(c.label, { couleur: c.couleur, min: c.score }) })
    Array.from(seuilMin.entries()).sort((a, b) => a[1].min - b[1].min).forEach(([label, { couleur }]) => {
      slide.addShape(pptx.ShapeType.rect, { x: lx, y: ly + 0.03, w: 0.22, h: 0.22, fill: { color: hex(couleur), transparency: 22 }, line: { color: C.line, width: 1 } })
      slide.addText(label, { x: lx + 0.32, y: ly, w: lw - 0.32, h: 0.28, fontSize: 10, color: C.ink, valign: 'middle' }); ly += 0.32
    })
    if (seuil != null) slide.addText(L.appetitZone, { x: lx, y: ly + 0.1, w: lw, h: 0.5, fontSize: 9, italic: true, color: C.muted })
  }

  // ── 5. Effet du traitement (brut → résiduel) ─────────────────────────────
  if (risques.some(r => r.niveauResiduel != null)) {
    const slide = slideHeader(pptx, L.treatEffectTitle, '')
    const cell = 0.62
    const mapW = model.graviteLevels.length * cell
    const seuil = appetitDefined ? appetit.seuilGlobal : null
    // Brut (gauche)
    const oxB = 1.6, oy = 1.7
    slide.addText(L.cartoBrut, { x: oxB, y: oy - 0.4, w: mapW, h: 0.3, align: 'center', fontSize: 12, bold: true, color: C.ink })
    drawMatrix(slide, pptx, model, risques, oxB, oy, cell, r => ({ g: num(r.gravite), v: num(r.vraisemblance) }), seuil)
    // Résiduel (droite) — position par G/V résiduels (repli sur brut)
    const oxR = oxB + mapW + 1.6
    slide.addText(L.cartoResiduel, { x: oxR, y: oy - 0.4, w: mapW, h: 0.3, align: 'center', fontSize: 12, bold: true, color: C.ink })
    drawMatrix(slide, pptx, model, risques, oxR, oy, cell, r => ({ g: num(r.graviteResiduelle ?? r.gravite), v: num(r.vraisemblanceResiduelle ?? r.vraisemblance) }), seuil)
    // Flèche entre les deux + note
    slide.addShape(pptx.ShapeType.line, { x: oxB + mapW + 0.35, y: oy + (model.vraisemblanceLevels.length * cell) / 2, w: 0.9, h: 0, line: { color: C.primary, width: 2, endArrowType: 'triangle' } })
    slide.addText(L.treatEffectNote, { x: 1.6, y: oy + model.vraisemblanceLevels.length * cell + 0.5, w: 11, h: 0.5, fontSize: 11, italic: true, color: C.muted })
  }

  // ── 6. Risques prioritaires & traitement ─────────────────────────────────
  {
    const slide = slideHeader(pptx, L.treatTitle, '')
    const head = [L.thRisk, L.thGV, L.thLevel, L.thAppetit, L.thStrategy, L.thResidual].map((t, i) => ({ text: t, options: { bold: true, color: 'FFFFFF', fill: { color: C.primary }, fontSize: 11, align: (i === 0 ? 'left' : 'center') as 'left' | 'center' } }))
    const top = execTopRisks(risques as { niveauRisque: number }[], 8) as Any[]
    const rows = top.map((r, i) => {
      const tier = getRiskTier(num(r.niveauRisque))
      const st = appetitStatut(r)
      const rTier = r.niveauResiduel != null ? getRiskTier(num(r.niveauResiduel)) : null
      return [
        { text: `R${risques.indexOf(r) + 1 || i + 1} · ${trunc(s(r.nom), 58)}`, options: { fontSize: 10 } },
        { text: `${num(r.gravite)}×${num(r.vraisemblance)}`, options: { fontSize: 10, align: 'center' as const, color: C.muted } },
        { text: String(num(r.niveauRisque)), options: { fontSize: 10, bold: true, color: tierHex[tier], align: 'center' as const } },
        { text: !appetitDefined || st === 'INCONNU' ? L.empty : st === 'HORS' ? L.outAppetit : '✓', options: { fontSize: 10, align: 'center' as const, bold: st === 'HORS', color: st === 'HORS' ? C.high : C.low } },
        { text: (L.strategies[s(r.strategie)] ?? s(r.strategie)) || L.empty, options: { fontSize: 10 } },
        { text: r.niveauResiduel != null ? String(num(r.niveauResiduel)) : L.empty, options: { fontSize: 10, bold: rTier != null, color: rTier != null ? tierHex[rTier] : C.ink, align: 'center' as const } },
      ]
    })
    slide.addTable([head, ...(rows.length ? rows : [[{ text: L.noRisks, options: { colspan: 6, italic: true, color: C.muted } }]])], {
      x: 0.5, y: 1.2, w: 12.33, colW: [5.63, 1.2, 1.2, 1.5, 1.7, 1.1], border: { type: 'solid', color: C.line, pt: 1 }, valign: 'middle', rowH: 0.35,
    })
  }

  // ── 7. Plan de traitement (mesure → risque réduit, coût, efficacité) ──────
  {
    const slide = slideHeader(pptx, L.planTitle, '')
    const rnById = new Map(risques.map((r, i) => [s(r.id), i + 1]))
    const head = [L.thMeasure, L.thReduces, L.thCost, L.thEffic, L.thStatus, L.thOwner, L.thDue].map((t, i) => ({ text: t, options: { bold: true, color: 'FFFFFF', fill: { color: C.primary }, fontSize: 10, align: (i === 0 || i === 4 || i === 5 ? 'left' : 'center') as 'left' | 'center' } }))
    const list = execMeasuresToEngage(mesures as { statut?: string; priorite?: number }[], 10) as Any[]
    const rows = list.map(m => {
      const rn = rnById.get(s(m.risqueId))
      const eff = num(m.efficacite)
      const late = m.echeance && new Date(m.echeance as string) < now && s(m.statut) !== 'REALISE'
      return [
        { text: trunc(s(m.nom), 62), options: { fontSize: 9 } },
        { text: rn ? `R${rn}` : L.empty, options: { fontSize: 9, align: 'center' as const, color: C.primary, bold: !!rn } },
        { text: trunc(s(m.cout), 14) || L.empty, options: { fontSize: 9, align: 'center' as const } },
        { text: eff ? '★'.repeat(Math.min(4, eff)) : L.empty, options: { fontSize: 9, align: 'center' as const, color: C.medium } },
        { text: (L.statuses[s(m.statut)] ?? s(m.statut)) || L.empty, options: { fontSize: 9 } },
        { text: trunc(s(m.responsable), 20) || L.empty, options: { fontSize: 9 } },
        { text: (m.echeance ? fmtDate(m.echeance) : L.empty) + (late ? ` (${L.overdue})` : ''), options: { fontSize: 9, align: 'center' as const, color: late ? C.high : C.ink, bold: !!late } },
      ]
    })
    slide.addTable([head, ...(rows.length ? rows : [[{ text: L.empty, options: { colspan: 7, italic: true, color: C.muted } }]])], {
      x: 0.5, y: 1.2, w: 12.33, colW: [4.2, 0.85, 1.25, 1.05, 1.4, 1.53, 2.05], border: { type: 'solid', color: C.line, pt: 1 }, valign: 'middle', rowH: 0.32,
    })
  }

  // ── ANNEXES ───────────────────────────────────────────────────────────────
  // A. Périmètre & valeurs métier
  {
    const slide = slideHeader(pptx, L.axPerimetre, L.annexKicker)
    let y = 1.2
    const perimetre = s(cadrage.perimetre)
    if (perimetre) { slide.addText(L.axPerimetreTitle, { x: 0.5, y, w: 12, h: 0.3, fontSize: 12, bold: true, color: C.primary }); y += 0.32; slide.addText(trunc(perimetre, 600), { x: 0.5, y, w: 12.3, h: 1.1, fontSize: 11, color: C.ink }); y += 1.2 }
    const vms = asArr(cadrage.valeursMetier)
    if (vms.length) {
      slide.addText(`${L.axVM} (${vms.length})`, { x: 0.5, y, w: 6, h: 0.3, fontSize: 12, bold: true, color: C.primary })
      slide.addText(vms.slice(0, 8).map(vm => ({ text: s(vm.nom), options: { bullet: true, fontSize: 11, breakLine: true } })), { x: 0.6, y: y + 0.32, w: 6, h: 2 })
    }
    const biens = asArr(cadrage.biensSupports)
    if (biens.length) {
      slide.addText(`${L.axBiens} (${biens.length})`, { x: 6.8, y, w: 6, h: 0.3, fontSize: 12, bold: true, color: C.primary })
      slide.addText(biens.slice(0, 8).map(b => ({ text: s(b.nom), options: { bullet: true, fontSize: 11, breakLine: true } })), { x: 6.9, y: y + 0.32, w: 6, h: 2 })
    }
  }

  // B. Sources de risque & objectifs visés
  {
    const slide = slideHeader(pptx, L.axSrOv, L.annexKicker)
    const srs = asArr(analyse.sourcesRisque).filter(sr => sr.retenu !== false)
    const head = [L.axSource, L.axCat, L.axPert, L.axOv].map(t => ({ text: t, options: { bold: true, color: 'FFFFFF', fill: { color: C.primary }, fontSize: 11 } }))
    const rows = srs.slice(0, 12).map(sr => [
      { text: trunc(s(sr.nom), 40), options: { fontSize: 10 } },
      { text: trunc(s(sr.categorie), 22), options: { fontSize: 10 } },
      { text: String(num(sr.pertinence) || ''), options: { fontSize: 10, align: 'center' as const } },
      { text: trunc(asArr(sr.objectifsVises).map(o => s(o.nom)).join(', '), 90), options: { fontSize: 10 } },
    ])
    slide.addTable([head, ...(rows.length ? rows : [[{ text: L.empty, options: { colspan: 4, italic: true, color: C.muted } }]])], {
      x: 0.5, y: 1.2, w: 12.33, colW: [3.6, 2.4, 1.0, 5.33], border: { type: 'solid', color: C.line, pt: 1 }, valign: 'middle', rowH: 0.34,
    })
  }

  // C. Écosystème — parties prenantes (si présentes)
  {
    const pps = asArr(analyse.partiesPrenantes)
    if (pps.length) {
      const slide = slideHeader(pptx, L.axEco, L.annexKicker)
      const head = [L.axPP, L.axType, L.axMenace].map(t => ({ text: t, options: { bold: true, color: 'FFFFFF', fill: { color: C.primary }, fontSize: 11 } }))
      const rows = pps.slice(0, 14).map(pp => {
        const men = (num(pp.exposition) || 1) / (num(pp.fiabilite) || 1)
        return [
          { text: trunc(s(pp.nom), 46), options: { fontSize: 10 } },
          { text: trunc(s(pp.type), 22), options: { fontSize: 10 } },
          { text: men.toFixed(2), options: { fontSize: 10, align: 'center' as const } },
        ]
      })
      slide.addTable([head, ...rows], { x: 0.5, y: 1.2, w: 12.33, colW: [7.5, 3.0, 1.83], border: { type: 'solid', color: C.line, pt: 1 }, valign: 'middle', rowH: 0.34 })
    }
  }

  // D. Scénarios stratégiques
  {
    const scen = asArr(analyse.scenariosStrategiques).filter(x => x.retenu !== false)
    if (scen.length) {
      const slide = slideHeader(pptx, L.axScen, L.annexKicker)
      const mk = (t: string, c: boolean) => ({ text: t, options: { bold: true, color: 'FFFFFF', fill: { color: C.primary }, fontSize: 11, ...(c ? { align: 'center' as const } : {}) } })
      const head = [mk(L.thRisk, false), mk(L.abbrevG, true), mk(L.abbrevV, true), mk(L.thLevel, true)]
      const rows = scen.slice(0, 14).map(sc => {
        const tier = getRiskTier(num(sc.niveauRisque))
        return [
          { text: trunc(s(sc.nom), 80), options: { fontSize: 10 } },
          { text: String(num(sc.gravite) || ''), options: { fontSize: 10, align: 'center' as const } },
          { text: String(num(sc.vraisemblance) || ''), options: { fontSize: 10, align: 'center' as const } },
          { text: String(num(sc.niveauRisque) || ''), options: { fontSize: 10, bold: true, color: tierHex[tier], align: 'center' as const } },
        ]
      })
      slide.addTable([head, ...rows], { x: 0.5, y: 1.2, w: 12.33, colW: [9.33, 1.0, 1.0, 1.0], border: { type: 'solid', color: C.line, pt: 1 }, valign: 'middle', rowH: 0.34 })
    }
  }

  // E. Conformité au socle
  {
    const socle = asArr(cadrage.socleSecurite)
    if (socle.length) {
      const slide = slideHeader(pptx, L.axConf, L.annexKicker)
      const counts: Record<string, number> = {}
      socle.forEach(e => { const st = s(e.statut) || 'non_applicable'; counts[st] = (counts[st] ?? 0) + 1 })
      const y = 1.6, w = 2.7, gap = 0.2
      const order = ['conforme', 'partiel', 'non_conforme', 'non_applicable']
      const cols: Record<string, string> = { conforme: C.low, partiel: C.medium, non_conforme: C.high, non_applicable: C.none }
      order.forEach((st, i) => kpiTile(slide, pptx, 0.6 + i * (w + gap), y, w, L.axConfStatut[st] ?? st, counts[st] ?? 0, cols[st]))
    }
  }

  // F. Détail des risques (table complète)
  {
    const slide = slideHeader(pptx, L.axRisksDetail, L.annexKicker)
    const head = [L.thRisk, L.abbrevG, L.abbrevV, L.thLevel, L.thStrategy, L.thResidual].map((t, i) => ({ text: t, options: { bold: true, color: 'FFFFFF', fill: { color: C.primary }, fontSize: 10, align: (i === 0 ? 'left' : 'center') as 'left' | 'center' } }))
    const rows = risques.slice(0, 16).map((r, i) => {
      const tier = getRiskTier(num(r.niveauRisque))
      return [
        { text: `R${i + 1} · ${trunc(s(r.nom), 60)}`, options: { fontSize: 9 } },
        { text: String(num(r.gravite) || ''), options: { fontSize: 9, align: 'center' as const } },
        { text: String(num(r.vraisemblance) || ''), options: { fontSize: 9, align: 'center' as const } },
        { text: String(num(r.niveauRisque) || ''), options: { fontSize: 9, bold: true, color: tierHex[tier], align: 'center' as const } },
        { text: (L.strategies[s(r.strategie)] ?? s(r.strategie)) || L.empty, options: { fontSize: 9 } },
        { text: r.niveauResiduel != null ? String(num(r.niveauResiduel)) : L.empty, options: { fontSize: 9, align: 'center' as const } },
      ]
    })
    slide.addTable([head, ...(rows.length ? rows : [[{ text: L.noRisks, options: { colspan: 6, italic: true, color: C.muted } }]])], {
      x: 0.5, y: 1.2, w: 12.33, colW: [6.83, 0.8, 0.8, 1.1, 1.8, 1.0], border: { type: 'solid', color: C.line, pt: 1 }, valign: 'middle', rowH: 0.3,
    })
  }

  const out = await pptx.write({ outputType: 'nodebuffer' })
  return out as Buffer
}
