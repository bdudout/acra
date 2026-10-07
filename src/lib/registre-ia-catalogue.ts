// ─── Systèmes d'IA types (registre IA) — catalogue traduit, import ligne par ligne ─
// Usages d'IA courants dans une organisation, en 5 langues, avec une clé stable (provenance `catalogueKey` : réimport
// idempotent, aucune fusion avec un système existant de même nom). Le fournisseur, la date de revue, le lien vers
// l'analyse et l'AIPD restent à compléter ; le classement est calculé (lib/registre-ia, indicatif, à vérifier).
// Un système « propre à votre activité » est laissé incomplet. Module pur → testé (registre-ia-catalogue.test.ts).

import type { DecisionIa, SystemeIaSaisie, UsageIa } from '@/lib/registre-ia'

export type IaLocale = 'fr' | 'en' | 'de' | 'es' | 'it'
type L = Record<IaLocale, string>
const l = (fr: string, en: string, de: string, es: string, it: string): L => ({ fr, en, de, es, it })

export const IA_CATALOGUE_VERSION = '1.0'

interface Modele {
  key: string; usage: UsageIa; typeDecision: DecisionIa; categoriesParticulieres?: boolean
  nom: L; finalite: L; donnees: L[]; interventionHumaine: L; controlesBiais: L
}

const D = {
  saisies: l('Textes saisis par les utilisateurs', 'Text entered by users', 'Von Nutzern eingegebene Texte', 'Textos introducidos por los usuarios', 'Testi inseriti dagli utenti'),
  documentsInternes: l('Documents internes', 'Internal documents', 'Interne Dokumente', 'Documentos internos', 'Documenti interni'),
  questionsClients: l('Questions des clients ou usagers', 'Customer or user questions', 'Fragen von Kunden oder Nutzern', 'Preguntas de clientes o usuarios', 'Domande di clienti o utenti'),
  baseConnaissances: l('Base de connaissances', 'Knowledge base', 'Wissensdatenbank', 'Base de conocimientos', 'Base di conoscenza'),
  cv: l('CV et lettres de motivation', 'CVs and cover letters', 'Lebensläufe und Anschreiben', 'CV y cartas de presentación', 'CV e lettere di presentazione'),
  transactions: l('Transactions et paiements', 'Transactions and payments', 'Transaktionen und Zahlungen', 'Transacciones y pagos', 'Transazioni e pagamenti'),
  historiqueClient: l('Historique client', 'Customer history', 'Kundenhistorie', 'Historial del cliente', 'Storico del cliente'),
  courrier: l('Courriers et pièces justificatives', 'Letters and supporting documents', 'Schreiben und Belege', 'Cartas y justificantes', 'Corrispondenza e documenti giustificativi'),
  revenus: l('Revenus et situation financière', 'Income and financial situation', 'Einkommen und finanzielle Lage', 'Ingresos y situación financiera', 'Redditi e situazione finanziaria'),
  situation: l('Situation familiale et sociale', 'Family and social situation', 'Familiäre und soziale Situation', 'Situación familiar y social', 'Situazione familiare e sociale'),
  journaux: l('Journaux techniques et événements de sécurité', 'Technical logs and security events', 'Technische Protokolle und Sicherheitsereignisse', 'Registros técnicos y eventos de seguridad', 'Log tecnici ed eventi di sicurezza'),
  code: l('Code source', 'Source code', 'Quellcode', 'Código fuente', 'Codice sorgente'),
}

const MODELES: Modele[] = [
  {
    key: 'ia.assistant-generatif', usage: 'IA_GENERATIVE', typeDecision: 'AIDE',
    nom: l('Assistant d’IA générative pour les collaborateurs', 'Generative AI assistant for staff', 'Generativer KI-Assistent für Beschäftigte', 'Asistente de IA generativa para el personal', 'Assistente di IA generativa per il personale'),
    finalite: l('Aider à rédiger, résumer et traduire des documents de travail.', 'Help draft, summarise and translate working documents.', 'Unterstützung beim Verfassen, Zusammenfassen und Übersetzen von Arbeitsdokumenten.', 'Ayudar a redactar, resumir y traducir documentos de trabajo.', 'Aiutare a redigere, riassumere e tradurre documenti di lavoro.'),
    donnees: [D.saisies, D.documentsInternes],
    interventionHumaine: l('Le collaborateur relit et reste responsable de tout contenu produit.', 'Staff review and remain responsible for any content produced.', 'Die Beschäftigten prüfen jeden erzeugten Inhalt und bleiben dafür verantwortlich.', 'El empleado revisa y sigue siendo responsable de todo contenido producido.', 'Il dipendente rilegge e resta responsabile di ogni contenuto prodotto.'),
    controlesBiais: l('Charte d’usage, interdiction d’y saisir des données sensibles, revue des cas d’usage.', 'Usage policy, ban on entering sensitive data, review of use cases.', 'Nutzungsrichtlinie, Verbot der Eingabe sensibler Daten, Überprüfung der Anwendungsfälle.', 'Política de uso, prohibición de introducir datos sensibles, revisión de los casos de uso.', 'Policy di utilizzo, divieto di inserire dati sensibili, revisione dei casi d’uso.'),
  },
  {
    key: 'ia.assistant-code', usage: 'IA_GENERATIVE', typeDecision: 'AIDE',
    nom: l('Assistant de développement (génération de code)', 'Coding assistant (code generation)', 'Entwicklungsassistent (Codegenerierung)', 'Asistente de desarrollo (generación de código)', 'Assistente di sviluppo (generazione di codice)'),
    finalite: l('Proposer du code, des tests et des explications aux développeurs.', 'Suggest code, tests and explanations to developers.', 'Code, Tests und Erläuterungen für Entwickler vorschlagen.', 'Proponer código, pruebas y explicaciones a los desarrolladores.', 'Proporre codice, test e spiegazioni agli sviluppatori.'),
    donnees: [D.code],
    interventionHumaine: l('Revue de code et tests avant toute mise en production.', 'Code review and testing before any release.', 'Code-Review und Tests vor jeder Inbetriebnahme.', 'Revisión de código y pruebas antes de cualquier puesta en producción.', 'Revisione del codice e test prima di ogni messa in produzione.'),
    controlesBiais: l('Analyse de sécurité du code produit, contrôle des licences.', 'Security analysis of generated code, licence checks.', 'Sicherheitsanalyse des erzeugten Codes, Lizenzprüfung.', 'Análisis de seguridad del código generado, control de licencias.', 'Analisi di sicurezza del codice prodotto, controllo delle licenze.'),
  },
  {
    key: 'ia.agent-conversationnel', usage: 'ORIENTATION_USAGERS', typeDecision: 'AIDE',
    nom: l('Agent conversationnel du service client', 'Customer service chatbot', 'Chatbot des Kundenservice', 'Agente conversacional del servicio de atención al cliente', 'Agente conversazionale del servizio clienti'),
    finalite: l('Répondre aux questions courantes et orienter vers le bon interlocuteur.', 'Answer common questions and direct users to the right contact.', 'Häufige Fragen beantworten und an den richtigen Ansprechpartner weiterleiten.', 'Responder a las preguntas habituales y orientar hacia el interlocutor adecuado.', 'Rispondere alle domande frequenti e indirizzare verso l’interlocutore giusto.'),
    donnees: [D.questionsClients, D.baseConnaissances],
    interventionHumaine: l('Passage à un conseiller à la demande ; la personne est informée qu’elle échange avec une IA.', 'Hand-over to an agent on request; users are told they are interacting with an AI.', 'Übergabe an einen Mitarbeiter auf Wunsch; die Person wird informiert, dass sie mit einer KI interagiert.', 'Derivación a un agente a petición; se informa a la persona de que interactúa con una IA.', 'Passaggio a un operatore su richiesta; la persona è informata che interagisce con un’IA.'),
    controlesBiais: l('Échantillon de conversations relu chaque mois, suivi des réponses erronées.', 'Monthly review of a sample of conversations, tracking of wrong answers.', 'Monatliche Prüfung einer Stichprobe von Gesprächen, Verfolgung falscher Antworten.', 'Revisión mensual de una muestra de conversaciones, seguimiento de respuestas erróneas.', 'Revisione mensile di un campione di conversazioni, monitoraggio delle risposte errate.'),
  },
  {
    key: 'ia.tri-cv', usage: 'RECRUTEMENT', typeDecision: 'AIDE',
    nom: l('Présélection des candidatures', 'Job application screening', 'Vorauswahl von Bewerbungen', 'Preselección de candidaturas', 'Preselezione delle candidature'),
    finalite: l('Classer les candidatures selon leur adéquation au poste.', 'Rank applications by fit with the position.', 'Bewerbungen nach Eignung für die Stelle ordnen.', 'Clasificar las candidaturas según su adecuación al puesto.', 'Classificare le candidature in base all’adeguatezza al posto.'),
    donnees: [D.cv],
    interventionHumaine: l('Toute candidature écartée est revue par un recruteur ; aucune décision sans intervention humaine.', 'Every rejected application is reviewed by a recruiter; no decision without human intervention.', 'Jede abgelehnte Bewerbung wird von einem Recruiter geprüft; keine Entscheidung ohne menschliches Eingreifen.', 'Toda candidatura descartada es revisada por un reclutador; ninguna decisión sin intervención humana.', 'Ogni candidatura scartata è rivista da un selezionatore; nessuna decisione senza intervento umano.'),
    controlesBiais: l('Mesure des écarts de sélection (genre, âge), revue des critères, journalisation.', 'Measurement of selection gaps (gender, age), review of criteria, logging.', 'Messung von Auswahlunterschieden (Geschlecht, Alter), Überprüfung der Kriterien, Protokollierung.', 'Medición de las diferencias de selección (género, edad), revisión de criterios, registro.', 'Misurazione degli scostamenti di selezione (genere, età), revisione dei criteri, registrazione.'),
  },
  {
    key: 'ia.detection-fraude', usage: 'DETECTION_FRAUDE', typeDecision: 'AIDE',
    nom: l('Détection de fraude', 'Fraud detection', 'Betrugserkennung', 'Detección de fraude', 'Rilevamento delle frodi'),
    finalite: l('Repérer les opérations ou déclarations atypiques à contrôler.', 'Flag unusual transactions or claims for review.', 'Ungewöhnliche Vorgänge oder Erklärungen zur Prüfung kennzeichnen.', 'Detectar operaciones o declaraciones atípicas que deban controlarse.', 'Individuare operazioni o dichiarazioni atipiche da controllare.'),
    donnees: [D.transactions, D.historiqueClient],
    interventionHumaine: l('Chaque alerte est instruite par un analyste avant toute mesure.', 'Each alert is investigated by an analyst before any action.', 'Jede Warnung wird vor jeder Maßnahme von einem Analysten geprüft.', 'Cada alerta es investigada por un analista antes de cualquier medida.', 'Ogni allerta è esaminata da un analista prima di qualsiasi misura.'),
    controlesBiais: l('Suivi du taux de fausses alertes et des écarts entre populations, recalibrage périodique.', 'Tracking of false-alert rates and gaps between populations, periodic recalibration.', 'Überwachung der Fehlalarmquote und der Unterschiede zwischen Gruppen, regelmäßige Neukalibrierung.', 'Seguimiento de la tasa de falsas alertas y de las diferencias entre poblaciones, recalibración periódica.', 'Monitoraggio del tasso di falsi allarmi e degli scostamenti tra popolazioni, ricalibrazione periodica.'),
  },
  {
    key: 'ia.lecture-documents', usage: 'TRI_DOCUMENTS', typeDecision: 'AIDE',
    nom: l('Lecture et classement automatiques du courrier entrant', 'Automatic reading and sorting of incoming mail', 'Automatisches Lesen und Sortieren eingehender Post', 'Lectura y clasificación automáticas del correo entrante', 'Lettura e classificazione automatiche della posta in arrivo'),
    finalite: l('Extraire les informations des documents reçus et les orienter vers le bon service.', 'Extract information from received documents and route them to the right team.', 'Informationen aus eingegangenen Dokumenten extrahieren und an die zuständige Stelle weiterleiten.', 'Extraer la información de los documentos recibidos y dirigirlos al servicio adecuado.', 'Estrarre le informazioni dai documenti ricevuti e indirizzarli all’ufficio giusto.'),
    donnees: [D.courrier],
    interventionHumaine: l('Les documents mal reconnus sont traités par un gestionnaire.', 'Poorly recognised documents are handled by a clerk.', 'Schlecht erkannte Dokumente werden von einem Sachbearbeiter bearbeitet.', 'Los documentos mal reconocidos los trata un gestor.', 'I documenti non riconosciuti correttamente sono trattati da un operatore.'),
    controlesBiais: l('Contrôle par échantillon du taux de reconnaissance et des erreurs d’orientation.', 'Sample checks of recognition rate and routing errors.', 'Stichprobenkontrolle der Erkennungsrate und der Weiterleitungsfehler.', 'Control por muestreo de la tasa de reconocimiento y de los errores de orientación.', 'Controllo a campione del tasso di riconoscimento e degli errori di instradamento.'),
  },
  {
    key: 'ia.octroi-credit', usage: 'NOTATION_CREDIT', typeDecision: 'AIDE',
    nom: l('Évaluation de la solvabilité (octroi de crédit)', 'Creditworthiness assessment (lending)', 'Bonitätsbewertung (Kreditvergabe)', 'Evaluación de la solvencia (concesión de créditos)', 'Valutazione del merito creditizio (concessione di credito)'),
    finalite: l('Estimer le risque de défaut d’un demandeur de crédit.', 'Estimate the default risk of a credit applicant.', 'Das Ausfallrisiko eines Kreditantragstellers schätzen.', 'Estimar el riesgo de impago de un solicitante de crédito.', 'Stimare il rischio di insolvenza di un richiedente credito.'),
    donnees: [D.revenus, D.historiqueClient],
    interventionHumaine: l('Un conseiller valide la décision et peut s’écarter du score en le justifiant.', 'An adviser validates the decision and may depart from the score with a justification.', 'Ein Berater bestätigt die Entscheidung und kann begründet vom Score abweichen.', 'Un asesor valida la decisión y puede apartarse de la puntuación justificándolo.', 'Un consulente convalida la decisione e può discostarsi dal punteggio motivandolo.'),
    controlesBiais: l('Tests de non-discrimination, suivi de la performance du modèle, documentation des variables.', 'Non-discrimination testing, model performance monitoring, documentation of variables.', 'Tests auf Nichtdiskriminierung, Überwachung der Modellleistung, Dokumentation der Variablen.', 'Pruebas de no discriminación, seguimiento del rendimiento del modelo, documentación de las variables.', 'Test di non discriminazione, monitoraggio delle prestazioni del modello, documentazione delle variabili.'),
  },
  {
    key: 'ia.eligibilite-prestations', usage: 'ELIGIBILITE_PRESTATIONS', typeDecision: 'AIDE', categoriesParticulieres: true,
    nom: l('Aide à l’instruction des droits aux prestations', 'Support for benefit entitlement assessment', 'Unterstützung bei der Prüfung von Leistungsansprüchen', 'Ayuda a la tramitación del derecho a prestaciones', 'Supporto all’istruttoria del diritto alle prestazioni'),
    finalite: l('Pré-évaluer l’éligibilité d’une personne à une prestation et signaler les dossiers à examiner.', 'Pre-assess a person’s eligibility for a benefit and flag files for review.', 'Die Anspruchsberechtigung einer Person für eine Leistung vorab prüfen und zu prüfende Akten kennzeichnen.', 'Evaluar previamente la elegibilidad de una persona para una prestación y señalar los expedientes que deben examinarse.', 'Valutare preliminarmente l’ammissibilità di una persona a una prestazione e segnalare le pratiche da esaminare.'),
    donnees: [D.revenus, D.situation],
    interventionHumaine: l('La décision est prise par un agent ; la personne peut demander un réexamen.', 'The decision is taken by an officer; the person may request a review.', 'Die Entscheidung trifft ein Sachbearbeiter; die Person kann eine Überprüfung verlangen.', 'La decisión la toma un agente; la persona puede solicitar una revisión.', 'La decisione è presa da un funzionario; la persona può chiederne il riesame.'),
    controlesBiais: l('Analyse des écarts de traitement entre catégories de bénéficiaires, revue annuelle des règles.', 'Analysis of treatment gaps between categories of beneficiaries, annual review of rules.', 'Analyse von Behandlungsunterschieden zwischen Leistungsempfängergruppen, jährliche Überprüfung der Regeln.', 'Análisis de las diferencias de trato entre categorías de beneficiarios, revisión anual de las reglas.', 'Analisi degli scostamenti di trattamento tra categorie di beneficiari, revisione annuale delle regole.'),
  },
  {
    key: 'ia.detection-menaces', usage: 'AUTRE', typeDecision: 'AUTOMATISEE',
    nom: l('Détection des menaces de sécurité par apprentissage automatique', 'Machine-learning security threat detection', 'Erkennung von Sicherheitsbedrohungen durch maschinelles Lernen', 'Detección de amenazas de seguridad mediante aprendizaje automático', 'Rilevamento delle minacce di sicurezza tramite apprendimento automatico'),
    finalite: l('Détecter les comportements suspects sur les postes et le réseau, et bloquer les plus évidents.', 'Detect suspicious behaviour on endpoints and the network, and block the most obvious cases.', 'Verdächtiges Verhalten auf Endgeräten und im Netzwerk erkennen und die eindeutigsten Fälle blockieren.', 'Detectar comportamientos sospechosos en los equipos y la red, y bloquear los más evidentes.', 'Rilevare comportamenti sospetti sulle postazioni e sulla rete, e bloccare i casi più evidenti.'),
    donnees: [D.journaux],
    interventionHumaine: l('Les blocages sont revus par l’équipe de sécurité, qui peut les lever.', 'Blocks are reviewed by the security team, which can lift them.', 'Sperren werden vom Sicherheitsteam geprüft, das sie aufheben kann.', 'Los bloqueos los revisa el equipo de seguridad, que puede levantarlos.', 'I blocchi sono rivisti dal team di sicurezza, che può revocarli.'),
    controlesBiais: l('Suivi des faux positifs et des menaces manquées, mises à jour du modèle par l’éditeur.', 'Tracking of false positives and missed threats, model updates by the vendor.', 'Überwachung von Fehlalarmen und übersehenen Bedrohungen, Modellaktualisierungen durch den Anbieter.', 'Seguimiento de falsos positivos y amenazas no detectadas, actualizaciones del modelo por el proveedor.', 'Monitoraggio dei falsi positivi e delle minacce non rilevate, aggiornamenti del modello da parte del fornitore.'),
  },
]

/** Système propre à l'activité : laissé incomplet, à décrire par l'organisation. */
export const IA_PLACEHOLDER_KEY = 'ia.propre-activite'
const PLACEHOLDER: L = l('Système d’IA propre à votre activité (à décrire)', 'AI system specific to your business (to be described)', 'Geschäftsspezifisches KI-System (zu beschreiben)', 'Sistema de IA propio de su actividad (por describir)', 'Sistema di IA specifico della vostra attività (da descrivere)')

export type SystemeIaType = Omit<SystemeIaSaisie, 'derniereRevue' | 'analyseId' | 'aipdReference'> & { key: string }

/** Systèmes types traduits, prêts à importer (statut « en projet », fournisseur à compléter). */
export function listSystemesIaTypes(locale: IaLocale): SystemeIaType[] {
  return [
    ...MODELES.map(m => ({
      key: m.key, nom: m.nom[locale], finalite: m.finalite[locale], fournisseur: null, donnees: m.donnees.map(d => d[locale]),
      categoriesParticulieres: m.categoriesParticulieres ?? false, typeDecision: m.typeDecision, usage: m.usage,
      interventionHumaine: m.interventionHumaine[locale], controlesBiais: m.controlesBiais[locale], statut: 'EN_PROJET' as const,
    })),
    { key: IA_PLACEHOLDER_KEY, nom: PLACEHOLDER[locale], finalite: '', fournisseur: null, donnees: [], categoriesParticulieres: false, typeDecision: 'AIDE', usage: 'AUTRE', interventionHumaine: null, controlesBiais: null, statut: 'EN_PROJET' },
  ]
}
