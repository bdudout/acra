// ─── Socle RoPA par défaut (registre RGPD art. 30) — catalogue traduit, import ligne par ligne ─
// Traitements « habituels » que réalise toute entreprise, inspirés du registre type de la CNIL
// (simplifié), en 5 langues, avec une clé stable par traitement (provenance `catalogueKey` :
// réimport idempotent, aucune fusion avec un traitement existant de même nom).
// Les durées de conservation sont des RÉFÉRENCES DU DROIT FRANÇAIS : hors français, elles sont
// présentées comme telles et restent à vérifier pour le pays de l'organisation. La base légale est
// une suggestion à confirmer par le DPO. Un traitement « métier » PLACEHOLDER est laissé incomplet
// (mis en avant « à compléter » par champsManquantsArt30). Module pur → testable.

import type { BaseLegale, Traitement } from './ropa'

export type RopaLocale = 'fr' | 'en' | 'de' | 'es' | 'it'
type L = Record<RopaLocale, string>
type LL = Record<RopaLocale, string[]>

export const ROPA_CATALOGUE_VERSION = '2.0'

const l = (fr: string, en: string, de: string, es: string, it: string): L => ({ fr, en, de, es, it })
/** Listes parallèles : un libellé par langue pour chaque élément. */
const ll = (...items: L[]): LL => ({
  fr: items.map(i => i.fr), en: items.map(i => i.en), de: items.map(i => i.de), es: items.map(i => i.es), it: items.map(i => i.it),
})

// Vocabulaire commun (catégories, destinataires) — une seule traduction par terme.
const V = {
  salaries: l('Salariés', 'Employees', 'Beschäftigte', 'Empleados', 'Dipendenti'),
  stagiaires: l('Stagiaires', 'Interns', 'Praktikanten', 'Becarios', 'Tirocinanti'),
  candidats: l('Candidats', 'Applicants', 'Bewerber', 'Candidatos', 'Candidati'),
  clients: l('Clients', 'Customers', 'Kunden', 'Clientes', 'Clienti'),
  contactsClients: l('Contacts clients', 'Customer contacts', 'Kundenkontakte', 'Contactos de clientes', 'Contatti dei clienti'),
  prospects: l('Prospects', 'Prospects', 'Interessenten', 'Clientes potenciales', 'Potenziali clienti'),
  contactsFournisseurs: l('Contacts fournisseurs', 'Supplier contacts', 'Lieferantenkontakte', 'Contactos de proveedores', 'Contatti dei fornitori'),
  fournisseurs: l('Fournisseurs', 'Suppliers', 'Lieferanten', 'Proveedores', 'Fornitori'),
  visiteurs: l('Visiteurs', 'Visitors', 'Besucher', 'Visitantes', 'Visitatori'),
  prestataires: l('Prestataires', 'Contractors', 'Dienstleister', 'Proveedores de servicios', 'Prestatori di servizi'),
  public: l('Public', 'General public', 'Öffentlichkeit', 'Público', 'Pubblico'),
  identite: l('Identité', 'Identity', 'Identität', 'Identidad', 'Identità'),
  coordonnees: l('Coordonnées', 'Contact details', 'Kontaktdaten', 'Datos de contacto', 'Recapiti'),
  coordonneesPro: l('Coordonnées professionnelles', 'Business contact details', 'Berufliche Kontaktdaten', 'Datos de contacto profesionales', 'Recapiti professionali'),
  rib: l('Coordonnées bancaires', 'Bank details', 'Bankverbindung', 'Datos bancarios', 'Coordinate bancarie'),
  situationFamiliale: l('Situation familiale', 'Family situation', 'Familienstand', 'Situación familiar', 'Situazione familiare'),
  remuneration: l('Rémunération', 'Pay', 'Vergütung', 'Remuneración', 'Retribuzione'),
  secu: l('Numéro de sécurité sociale', 'Social security number', 'Sozialversicherungsnummer', 'Número de la seguridad social', 'Numero di previdenza sociale'),
  contrat: l('Contrat', 'Contract', 'Vertrag', 'Contrato', 'Contratto'),
  diplomes: l('Diplômes', 'Qualifications', 'Abschlüsse', 'Titulaciones', 'Titoli di studio'),
  absences: l('Absences et congés', 'Absences and leave', 'Abwesenheiten und Urlaub', 'Ausencias y permisos', 'Assenze e ferie'),
  cv: l('CV et parcours', 'CV and career history', 'Lebenslauf und Werdegang', 'CV y trayectoria', 'CV e percorso'),
  commandes: l('Données de commande', 'Order data', 'Bestelldaten', 'Datos de pedidos', 'Dati degli ordini'),
  factures: l('Historique de facturation', 'Billing history', 'Rechnungshistorie', 'Historial de facturación', 'Storico di fatturazione'),
  facturation: l('Données de facturation', 'Billing data', 'Rechnungsdaten', 'Datos de facturación', 'Dati di fatturazione'),
  interets: l('Centres d’intérêt', 'Interests', 'Interessen', 'Intereses', 'Interessi'),
  donneesContrat: l('Données contractuelles', 'Contract data', 'Vertragsdaten', 'Datos contractuales', 'Dati contrattuali'),
  horodatage: l('Horodatage des accès', 'Access timestamps', 'Zeitstempel der Zutritte', 'Fecha y hora de los accesos', 'Data e ora degli accessi'),
  badge: l('Numéro de badge', 'Badge number', 'Ausweisnummer', 'Número de tarjeta', 'Numero di badge'),
  images: l('Images', 'Images', 'Bilder', 'Imágenes', 'Immagini'),
  identifiants: l('Identifiants', 'User IDs', 'Kennungen', 'Identificadores', 'Identificativi'),
  journaux: l('Journaux de connexion et d’activité', 'Connection and activity logs', 'Verbindungs- und Aktivitätsprotokolle', 'Registros de conexión y actividad', 'Log di connessione e di attività'),
  fonction: l('Fonction', 'Job title', 'Funktion', 'Puesto', 'Funzione'),
  service: l('Service', 'Department', 'Abteilung', 'Departamento', 'Reparto'),
  rh: l('Ressources humaines', 'Human resources', 'Personalabteilung', 'Recursos humanos', 'Risorse umane'),
  paie: l('Service paie', 'Payroll department', 'Lohnbuchhaltung', 'Departamento de nóminas', 'Ufficio paghe'),
  organismesSociaux: l('Organismes sociaux (en France : URSSAF, caisses de retraite)', 'Social security bodies (in France: URSSAF, pension funds)', 'Sozialversicherungsträger (in Frankreich: URSSAF, Rentenkassen)', 'Organismos de seguridad social (en Francia: URSSAF, cajas de pensiones)', 'Enti previdenziali (in Francia: URSSAF, casse pensionistiche)'),
  fisc: l('Administration fiscale', 'Tax authorities', 'Finanzverwaltung', 'Administración tributaria', 'Amministrazione fiscale'),
  encadrement: l('Encadrement', 'Line management', 'Führungskräfte', 'Mandos', 'Responsabili'),
  recruteurs: l('Managers recruteurs', 'Hiring managers', 'Einstellende Führungskräfte', 'Responsables de selección', 'Responsabili delle assunzioni'),
  commercial: l('Service commercial', 'Sales department', 'Vertrieb', 'Departamento comercial', 'Ufficio commerciale'),
  compta: l('Comptabilité', 'Accounting', 'Buchhaltung', 'Contabilidad', 'Contabilità'),
  logistique: l('Logistique', 'Logistics', 'Logistik', 'Logística', 'Logistica'),
  marketing: l('Service marketing', 'Marketing department', 'Marketing', 'Departamento de marketing', 'Ufficio marketing'),
  achats: l('Service achats', 'Purchasing department', 'Einkauf', 'Departamento de compras', 'Ufficio acquisti'),
  cac: l('Commissaire aux comptes', 'Statutory auditor', 'Abschlussprüfer', 'Auditor de cuentas', 'Revisore legale'),
  securite: l('Sécurité / services généraux', 'Security / facilities', 'Sicherheit / Gebäudemanagement', 'Seguridad / servicios generales', 'Sicurezza / servizi generali'),
  habilitesSecu: l('Personnes habilitées à la sécurité', 'Authorised security staff', 'Befugtes Sicherheitspersonal', 'Personal de seguridad autorizado', 'Personale di sicurezza autorizzato'),
  forcesOrdre: l('Forces de l’ordre sur réquisition', 'Law enforcement on request', 'Strafverfolgungsbehörden auf Anordnung', 'Fuerzas del orden previo requerimiento', 'Forze dell’ordine su richiesta'),
  dsi: l('DSI', 'IT department', 'IT-Abteilung', 'Departamento de TI', 'Direzione IT'),
  rssi: l('RSSI', 'CISO', 'Informationssicherheitsbeauftragter', 'Responsable de seguridad de la información', 'Responsabile della sicurezza delle informazioni'),
  personnel: l('Personnel', 'Staff', 'Personal', 'Personal', 'Personale'),
}
const SECU_BASE = ll(
  l('Contrôle d’accès (habilitations)', 'Access control (authorisations)', 'Zugriffskontrolle (Berechtigungen)', 'Control de acceso (autorizaciones)', 'Controllo degli accessi (autorizzazioni)'),
  l('Journalisation des accès', 'Access logging', 'Protokollierung der Zugriffe', 'Registro de accesos', 'Registrazione degli accessi'),
  l('Sauvegardes chiffrées', 'Encrypted backups', 'Verschlüsselte Sicherungen', 'Copias de seguridad cifradas', 'Backup cifrati'),
)
/** Durée de conservation : référence du droit français, signalée comme telle hors français. */
const duree = (fr: string, en: string, de: string, es: string, it: string): L => l(
  fr,
  `Reference (French law, to be checked for your country): ${en}`,
  `Referenz (französisches Recht, für Ihr Land zu prüfen): ${de}`,
  `Referencia (derecho francés, a verificar para su país): ${es}`,
  `Riferimento (diritto francese, da verificare per il vostro paese): ${it}`,
)

type RopaTemplate = {
  key: string
  nom: L; finalite: L; baseLegale: BaseLegale | ''
  categoriesPersonnes: LL; categoriesDonnees: LL; destinataires: LL
  dureeConservation: L | null; mesuresSecurite: LL | null
  surveillanceSystematique?: boolean
  /** Codes de secteur (catalogue) : traitement propre au métier, proposé seulement à ces secteurs, en tête. */
  secteurs?: readonly string[]
}
const EMPTY: LL = { fr: [], en: [], de: [], es: [], it: [] }

export const ROPA_TEMPLATES: RopaTemplate[] = [
  { key: 'ropa.payroll', baseLegale: 'obligation_legale',
    nom: l('Gestion de la paie', 'Payroll', 'Lohn- und Gehaltsabrechnung', 'Gestión de nóminas', 'Gestione delle paghe'),
    finalite: l('Établissement des bulletins de paie et versement des rémunérations, déclarations sociales.', 'Preparing payslips and paying salaries, social security declarations.', 'Erstellung der Gehaltsabrechnungen und Auszahlung der Vergütungen, Sozialversicherungsmeldungen.', 'Elaboración de nóminas y pago de las retribuciones, declaraciones sociales.', 'Predisposizione delle buste paga e pagamento delle retribuzioni, dichiarazioni previdenziali.'),
    categoriesPersonnes: ll(V.salaries), categoriesDonnees: ll(V.identite, V.coordonnees, V.situationFamiliale, V.rib, V.remuneration, V.secu),
    destinataires: ll(V.paie, V.organismesSociaux, V.fisc),
    dureeConservation: duree('Bulletins : 5 ans (durée légale, 50 ans recommandée pour le double) ; données de paie : 5 ans.', 'payslips 5 years (50 years recommended for the employer’s copy); payroll data 5 years.', 'Gehaltsabrechnungen 5 Jahre (50 Jahre für die Zweitschrift empfohlen); Lohndaten 5 Jahre.', 'nóminas 5 años (se recomiendan 50 años para el duplicado); datos de nómina 5 años.', 'buste paga 5 anni (50 anni raccomandati per la copia); dati retributivi 5 anni.'),
    mesuresSecurite: SECU_BASE },
  { key: 'ropa.hr-admin', baseLegale: 'contrat',
    nom: l('Gestion administrative du personnel', 'Personnel administration', 'Personalverwaltung', 'Gestión administrativa del personal', 'Gestione amministrativa del personale'),
    finalite: l('Gestion des dossiers du personnel, contrats, absences, congés et carrières.', 'Management of personnel files, contracts, absences, leave and careers.', 'Verwaltung der Personalakten, Verträge, Abwesenheiten, Urlaube und Laufbahnen.', 'Gestión de expedientes del personal, contratos, ausencias, permisos y carreras.', 'Gestione dei fascicoli del personale, contratti, assenze, ferie e carriere.'),
    categoriesPersonnes: ll(V.salaries, V.stagiaires), categoriesDonnees: ll(V.identite, V.coordonnees, V.contrat, V.diplomes, V.absences),
    destinataires: ll(V.rh, V.encadrement),
    dureeConservation: duree('Durée du contrat + 5 ans après le départ.', 'term of the contract + 5 years after departure.', 'Vertragsdauer + 5 Jahre nach dem Ausscheiden.', 'duración del contrato + 5 años tras la salida.', 'durata del contratto + 5 anni dopo l’uscita.'),
    mesuresSecurite: SECU_BASE },
  { key: 'ropa.recruitment', baseLegale: 'interet_legitime',
    nom: l('Recrutement', 'Recruitment', 'Personalgewinnung', 'Selección de personal', 'Selezione del personale'),
    finalite: l('Gestion des candidatures et des campagnes de recrutement.', 'Management of applications and recruitment campaigns.', 'Verwaltung von Bewerbungen und Rekrutierungskampagnen.', 'Gestión de candidaturas y campañas de selección.', 'Gestione delle candidature e delle campagne di selezione.'),
    categoriesPersonnes: ll(V.candidats), categoriesDonnees: ll(V.identite, V.coordonnees, V.cv, V.diplomes),
    destinataires: ll(V.rh, V.recruteurs),
    dureeConservation: duree('2 ans après le dernier contact, sauf consentement pour un vivier.', '2 years after the last contact, unless consent is given for a talent pool.', '2 Jahre nach dem letzten Kontakt, sofern keine Einwilligung für einen Bewerberpool vorliegt.', '2 años tras el último contacto, salvo consentimiento para una bolsa de candidatos.', '2 anni dall’ultimo contatto, salvo consenso per un bacino di candidati.'),
    mesuresSecurite: SECU_BASE },
  { key: 'ropa.customers', baseLegale: 'contrat',
    nom: l('Gestion des clients et des commandes', 'Customer and order management', 'Kunden- und Auftragsverwaltung', 'Gestión de clientes y pedidos', 'Gestione dei clienti e degli ordini'),
    finalite: l('Gestion de la relation client : contrats, commandes, livraisons, facturation et service après-vente.', 'Customer relationship management: contracts, orders, deliveries, invoicing and after-sales service.', 'Kundenbeziehungsmanagement: Verträge, Bestellungen, Lieferungen, Rechnungsstellung und Kundendienst.', 'Gestión de la relación con el cliente: contratos, pedidos, entregas, facturación y servicio posventa.', 'Gestione della relazione con il cliente: contratti, ordini, consegne, fatturazione e assistenza post-vendita.'),
    categoriesPersonnes: ll(V.clients, V.contactsClients), categoriesDonnees: ll(V.identite, V.coordonnees, V.commandes, V.factures),
    destinataires: ll(V.commercial, V.compta, V.logistique),
    dureeConservation: duree('Relation commerciale + 3 ans à des fins de prospection ; pièces comptables 10 ans.', 'business relationship + 3 years for marketing purposes; accounting records 10 years.', 'Geschäftsbeziehung + 3 Jahre zu Werbezwecken; Buchungsbelege 10 Jahre.', 'relación comercial + 3 años con fines de prospección; documentos contables 10 años.', 'rapporto commerciale + 3 anni a fini di marketing; documenti contabili 10 anni.'),
    mesuresSecurite: SECU_BASE },
  { key: 'ropa.prospecting', baseLegale: 'interet_legitime',
    nom: l('Prospection commerciale', 'Direct marketing', 'Kundenakquise', 'Prospección comercial', 'Marketing diretto'),
    finalite: l('Envoi de sollicitations commerciales et gestion des prospects.', 'Sending marketing messages and managing prospects.', 'Versand von Werbeansprachen und Verwaltung von Interessenten.', 'Envío de comunicaciones comerciales y gestión de clientes potenciales.', 'Invio di comunicazioni commerciali e gestione dei potenziali clienti.'),
    categoriesPersonnes: ll(V.prospects), categoriesDonnees: ll(V.identite, V.coordonnees, V.interets),
    destinataires: ll(V.marketing, V.commercial),
    dureeConservation: duree('3 ans à compter du dernier contact du prospect.', '3 years from the prospect’s last contact.', '3 Jahre ab dem letzten Kontakt des Interessenten.', '3 años desde el último contacto del cliente potencial.', '3 anni dall’ultimo contatto del potenziale cliente.'),
    mesuresSecurite: SECU_BASE },
  { key: 'ropa.suppliers', baseLegale: 'contrat',
    nom: l('Gestion des fournisseurs et sous-traitants', 'Supplier and subcontractor management', 'Lieferanten- und Subunternehmerverwaltung', 'Gestión de proveedores y subcontratistas', 'Gestione dei fornitori e dei subappaltatori'),
    finalite: l('Gestion des achats, contrats et paiements des fournisseurs et prestataires.', 'Management of purchasing, contracts and payments of suppliers and service providers.', 'Verwaltung von Einkauf, Verträgen und Zahlungen der Lieferanten und Dienstleister.', 'Gestión de compras, contratos y pagos a proveedores y prestadores.', 'Gestione di acquisti, contratti e pagamenti di fornitori e prestatori.'),
    categoriesPersonnes: ll(V.contactsFournisseurs), categoriesDonnees: ll(V.identite, V.coordonneesPro, V.rib, V.donneesContrat),
    destinataires: ll(V.achats, V.compta),
    dureeConservation: duree('Durée de la relation + 10 ans (obligations comptables).', 'term of the relationship + 10 years (accounting obligations).', 'Dauer der Geschäftsbeziehung + 10 Jahre (Buchführungspflichten).', 'duración de la relación + 10 años (obligaciones contables).', 'durata del rapporto + 10 anni (obblighi contabili).'),
    mesuresSecurite: SECU_BASE },
  { key: 'ropa.accounting', baseLegale: 'obligation_legale',
    nom: l('Comptabilité et gestion financière', 'Accounting and financial management', 'Buchhaltung und Finanzverwaltung', 'Contabilidad y gestión financiera', 'Contabilità e gestione finanziaria'),
    finalite: l('Tenue de la comptabilité, établissement des états financiers et pièces justificatives.', 'Bookkeeping, preparation of financial statements and supporting documents.', 'Buchführung, Erstellung der Abschlüsse und Belege.', 'Llevanza de la contabilidad, elaboración de los estados financieros y justificantes.', 'Tenuta della contabilità, redazione dei bilanci e dei documenti giustificativi.'),
    categoriesPersonnes: ll(V.clients, V.fournisseurs, V.salaries), categoriesDonnees: ll(V.identite, V.facturation, V.rib),
    destinataires: ll(V.compta, V.cac, V.fisc),
    dureeConservation: duree('10 ans (livres et pièces comptables).', '10 years (books and accounting records).', '10 Jahre (Bücher und Buchungsbelege).', '10 años (libros y documentos contables).', '10 anni (libri e documenti contabili).'),
    mesuresSecurite: SECU_BASE },
  { key: 'ropa.physical-access', baseLegale: 'interet_legitime',
    nom: l('Contrôle d’accès aux locaux', 'Physical access control', 'Zutrittskontrolle zu den Räumlichkeiten', 'Control de acceso a las instalaciones', 'Controllo degli accessi ai locali'),
    finalite: l('Gestion des badges et contrôle des accès physiques aux locaux.', 'Badge management and control of physical access to premises.', 'Ausweisverwaltung und Kontrolle des physischen Zutritts zu den Räumlichkeiten.', 'Gestión de tarjetas y control del acceso físico a las instalaciones.', 'Gestione dei badge e controllo degli accessi fisici ai locali.'),
    categoriesPersonnes: ll(V.salaries, V.visiteurs, V.prestataires), categoriesDonnees: ll(V.identite, V.horodatage, V.badge),
    destinataires: ll(V.securite),
    dureeConservation: duree('Logs d’accès : 3 mois ; habilitations : durée de présence.', 'access logs 3 months; authorisations for the duration of presence.', 'Zutrittsprotokolle 3 Monate; Berechtigungen für die Dauer der Anwesenheit.', 'registros de acceso 3 meses; autorizaciones durante la permanencia.', 'log di accesso 3 mesi; autorizzazioni per la durata della presenza.'),
    mesuresSecurite: SECU_BASE },
  { key: 'ropa.cctv', baseLegale: 'interet_legitime', surveillanceSystematique: true,
    nom: l('Vidéosurveillance', 'Video surveillance', 'Videoüberwachung', 'Videovigilancia', 'Videosorveglianza'),
    finalite: l('Sécurité des biens et des personnes par vidéoprotection des locaux.', 'Protection of property and people through video surveillance of the premises.', 'Schutz von Sachen und Personen durch Videoüberwachung der Räumlichkeiten.', 'Seguridad de bienes y personas mediante videovigilancia de las instalaciones.', 'Sicurezza di beni e persone tramite videosorveglianza dei locali.'),
    categoriesPersonnes: ll(V.salaries, V.visiteurs, V.public), categoriesDonnees: ll(V.images),
    destinataires: ll(V.habilitesSecu, V.forcesOrdre),
    dureeConservation: duree('30 jours maximum.', '30 days maximum.', 'höchstens 30 Tage.', '30 días como máximo.', '30 giorni al massimo.'),
    mesuresSecurite: SECU_BASE },
  { key: 'ropa.it-access', baseLegale: 'interet_legitime',
    nom: l('Gestion des accès informatiques et journalisation', 'IT access management and logging', 'IT-Zugriffsverwaltung und Protokollierung', 'Gestión de accesos informáticos y registro', 'Gestione degli accessi informatici e registrazione'),
    finalite: l('Gestion des comptes et habilitations informatiques et journalisation à des fins de sécurité.', 'Management of IT accounts and authorisations, and logging for security purposes.', 'Verwaltung von IT-Konten und -Berechtigungen sowie Protokollierung zu Sicherheitszwecken.', 'Gestión de cuentas y autorizaciones informáticas y registro con fines de seguridad.', 'Gestione degli account e delle autorizzazioni informatiche e registrazione a fini di sicurezza.'),
    categoriesPersonnes: ll(V.salaries, V.prestataires), categoriesDonnees: ll(V.identite, V.identifiants, V.journaux),
    destinataires: ll(V.dsi, V.rssi),
    dureeConservation: duree('Journaux : 6 mois à 1 an ; comptes : durée de présence.', 'logs 6 months to 1 year; accounts for the duration of presence.', 'Protokolle 6 Monate bis 1 Jahr; Konten für die Dauer der Anwesenheit.', 'registros de 6 meses a 1 año; cuentas durante la permanencia.', 'log da 6 mesi a 1 anno; account per la durata della presenza.'),
    mesuresSecurite: SECU_BASE },
  { key: 'ropa.directory', baseLegale: 'interet_legitime',
    nom: l('Annuaire interne et messagerie', 'Staff directory and email', 'Internes Verzeichnis und E-Mail', 'Directorio interno y correo electrónico', 'Rubrica interna e posta elettronica'),
    finalite: l('Mise à disposition d’un annuaire du personnel et gestion de la messagerie professionnelle.', 'Providing a staff directory and managing business email.', 'Bereitstellung eines Mitarbeiterverzeichnisses und Verwaltung der geschäftlichen E-Mail.', 'Puesta a disposición de un directorio del personal y gestión del correo profesional.', 'Messa a disposizione di una rubrica del personale e gestione della posta professionale.'),
    categoriesPersonnes: ll(V.salaries), categoriesDonnees: ll(V.identite, V.coordonneesPro, V.fonction, V.service),
    destinataires: ll(V.personnel, V.dsi),
    dureeConservation: duree('Durée de présence dans l’organisation.', 'duration of presence in the organisation.', 'Dauer der Zugehörigkeit zur Organisation.', 'duración de la permanencia en la organización.', 'durata della presenza nell’organizzazione.'),
    mesuresSecurite: SECU_BASE },
  // Placeholder « métier » volontairement incomplet → mis en avant « à compléter ».
  { key: 'ropa.business-specific', baseLegale: '',
    nom: l('Traitement métier spécifique (à compléter)', 'Business-specific processing (to be completed)', 'Fachspezifische Verarbeitung (zu ergänzen)', 'Tratamiento específico de la actividad (a completar)', 'Trattamento specifico dell’attività (da completare)'),
    finalite: l('À compléter : décrire un traitement spécifique à votre activité (ex. gestion d’un service métier propre).', 'To be completed: describe processing specific to your business (e.g. a service of your own).', 'Zu ergänzen: eine für Ihre Tätigkeit spezifische Verarbeitung beschreiben (z. B. eine eigene Fachleistung).', 'A completar: describa un tratamiento propio de su actividad (p. ej., un servicio específico).', 'Da completare: descrivere un trattamento specifico della vostra attività (es. un servizio proprio).'),
    categoriesPersonnes: EMPTY, categoriesDonnees: EMPTY, destinataires: EMPTY, dureeConservation: null, mesuresSecurite: null },
]

// ─── Services postaux et d'expédition (pack postal, lot L5) ───
// Durées reprises des fiches de la CNIL citées en commentaire ; à défaut de source officielle trouvée : null (« à
// compléter »), jamais inventée. Bases légales : suggestions à confirmer par le DPO.
const P = {
  agents: l('Agents de distribution', 'Delivery staff', 'Zusteller', 'Agentes de reparto', 'Addetti al recapito'),
  sousTraitants: l('Livreurs sous-traitants', 'Subcontracted couriers', 'Zusteller von Subunternehmern', 'Repartidores subcontratados', 'Corrieri subappaltatori'),
  destinataires: l('Destinataires', 'Recipients', 'Empfänger', 'Destinatarios', 'Destinatari'),
  expediteurs: l('Expéditeurs', 'Senders', 'Absender', 'Remitentes', 'Mittenti'),
  mandataires: l('Mandataires et procurations', 'Authorised representatives', 'Bevollmächtigte', 'Apoderados', 'Delegati'),
  agees: l('Personnes âgées ou isolées', 'Elderly or isolated people', 'Ältere oder alleinstehende Personen', 'Personas mayores o aisladas', 'Persone anziane o isolate'),
  appelants: l('Appelants du service client', 'Customer service callers', 'Anrufer beim Kundenservice', 'Personas que llaman al servicio de atención al cliente', 'Chiamanti del servizio clienti'),
  conseillers: l('Conseillers du service client', 'Customer service agents', 'Kundenberater', 'Agentes de atención al cliente', 'Operatori del servizio clienti'),
  localisation: l('Données de localisation', 'Location data', 'Standortdaten', 'Datos de localización', 'Dati di localizzazione'),
  vehicule: l('Véhicule ou terminal utilisé', 'Vehicle or device used', 'Verwendetes Fahrzeug oder Gerät', 'Vehículo o terminal utilizado', 'Veicolo o terminale utilizzato'),
  adresse: l('Adresse de livraison', 'Delivery address', 'Lieferadresse', 'Dirección de entrega', 'Indirizzo di consegna'),
  signature: l('Signature ou photo de remise', 'Signature or delivery photo', 'Unterschrift oder Zustellfoto', 'Firma o foto de entrega', 'Firma o foto di consegna'),
  evenements: l('Événements de suivi de l’envoi', 'Item tracking events', 'Sendungsverfolgungsereignisse', 'Eventos de seguimiento del envío', 'Eventi di tracciamento della spedizione'),
  ancienneAdresse: l('Ancienne et nouvelle adresses', 'Former and new addresses', 'Alte und neue Adresse', 'Dirección antigua y nueva', 'Vecchio e nuovo indirizzo'),
  pieceIdentite: l('Pièce d’identité présentée', 'Identity document presented', 'Vorgelegter Ausweis', 'Documento de identidad presentado', 'Documento d’identità presentato'),
  consignes: l('Consignes de livraison', 'Delivery instructions', 'Zustellanweisungen', 'Instrucciones de entrega', 'Istruzioni di consegna'),
  accesDomicile: l('Informations utiles à l’intervention (accès au domicile, consignes)', 'Information needed for the visit (home access, instructions)', 'Für den Einsatz nötige Angaben (Zugang zur Wohnung, Hinweise)', 'Información necesaria para la intervención (acceso al domicilio, instrucciones)', 'Informazioni utili all’intervento (accesso al domicilio, istruzioni)'),
  enregistrement: l('Enregistrement de la conversation', 'Call recording', 'Gesprächsaufzeichnung', 'Grabación de la conversación', 'Registrazione della conversazione'),
  distribution: l('Direction de la distribution', 'Delivery department', 'Abteilung Zustellung', 'Dirección de distribución', 'Direzione distribuzione'),
  serviceClient: l('Service client et réclamations', 'Customer service and claims', 'Kundenservice und Reklamationen', 'Atención al cliente y reclamaciones', 'Servizio clienti e reclami'),
  ecommercants: l('E-commerçants donneurs d’ordre', 'Ordering e-merchants', 'Auftraggebende Online-Händler', 'Comercios electrónicos ordenantes', 'E-commerce committenti'),
  guichet: l('Agents de guichet', 'Counter staff', 'Schalterpersonal', 'Agentes de ventanilla', 'Addetti allo sportello'),
  proximite: l('Direction des services de proximité', 'Local services department', 'Abteilung Dienstleistungen vor Ort', 'Dirección de servicios de proximidad', 'Direzione servizi di prossimità'),
}
const POSTAL = ['POSTAL'] as const

const POSTAL_TEMPLATES: RopaTemplate[] = [
  // CNIL, « La géolocalisation des véhicules des salariés » : 2 mois en principe ; 1 an pour optimiser les tournées ou
  // prouver les interventions (à défaut d'autre moyen) ; 5 ans pour le suivi du temps de travail.
  { key: 'ropa.postal.geolocation', baseLegale: 'interet_legitime', secteurs: POSTAL,
    nom: l('Géolocalisation des véhicules et terminaux des agents de distribution', 'Geolocation of delivery staff vehicles and devices', 'Ortung der Fahrzeuge und Geräte der Zusteller', 'Geolocalización de los vehículos y terminales de los agentes de reparto', 'Geolocalizzazione dei veicoli e dei terminali degli addetti al recapito'),
    finalite: l('Sécurité des agents, des envois et des véhicules ; organisation et optimisation des tournées ; preuve des interventions lorsqu’elle ne peut être apportée autrement.', 'Safety of staff, items and vehicles; organising and optimising routes; proof of visits where it cannot be provided otherwise.', 'Sicherheit der Zusteller, Sendungen und Fahrzeuge; Organisation und Optimierung der Touren; Nachweis der Einsätze, wenn er nicht anders erbracht werden kann.', 'Seguridad de los agentes, envíos y vehículos; organización y optimización de las rutas; prueba de las intervenciones cuando no pueda aportarse de otro modo.', 'Sicurezza degli addetti, delle spedizioni e dei veicoli; organizzazione e ottimizzazione dei giri; prova degli interventi quando non può essere fornita altrimenti.'),
    categoriesPersonnes: ll(P.agents, P.sousTraitants), categoriesDonnees: ll(V.identite, P.localisation, P.vehicule),
    destinataires: ll(P.distribution, V.encadrement),
    dureeConservation: duree('2 mois en principe ; 1 an pour l’optimisation des tournées ou la preuve des interventions ; 5 ans pour le suivi du temps de travail (CNIL).', 'in principle 2 months; 1 year to optimise routes or prove visits; 5 years for working-time tracking (CNIL).', 'grundsätzlich 2 Monate; 1 Jahr zur Tourenoptimierung oder als Einsatznachweis; 5 Jahre für die Arbeitszeiterfassung (CNIL).', 'en principio 2 meses; 1 año para optimizar las rutas o probar las intervenciones; 5 años para el seguimiento del tiempo de trabajo (CNIL).', 'in linea di principio 2 mesi; 1 anno per ottimizzare i giri o provare gli interventi; 5 anni per il monitoraggio dell’orario di lavoro (CNIL).'),
    mesuresSecurite: SECU_BASE },
  { key: 'ropa.postal.proof-of-delivery', baseLegale: 'contrat', secteurs: POSTAL,
    nom: l('Preuve de distribution des envois', 'Proof of delivery of items', 'Zustellnachweis für Sendungen', 'Prueba de entrega de los envíos', 'Prova di consegna delle spedizioni'),
    finalite: l('Attester la remise des envois (signature, photo, localisation du flashage) et traiter les litiges.', 'Proving delivery of items (signature, photo, scan location) and handling disputes.', 'Nachweis der Zustellung (Unterschrift, Foto, Scan-Standort) und Bearbeitung von Streitfällen.', 'Acreditar la entrega de los envíos (firma, foto, localización del escaneo) y tramitar los litigios.', 'Attestare la consegna delle spedizioni (firma, foto, posizione della scansione) e gestire le controversie.'),
    categoriesPersonnes: ll(P.destinataires, P.mandataires, P.agents), categoriesDonnees: ll(V.identite, P.signature, P.localisation, P.evenements),
    destinataires: ll(P.serviceClient, P.distribution),
    dureeConservation: null, mesuresSecurite: SECU_BASE }, // TODO(source) : aucune durée officielle CNIL trouvée
  { key: 'ropa.postal.forwarding', baseLegale: 'contrat', secteurs: POSTAL,
    nom: l('Réexpédition, garde du courrier et procurations', 'Mail forwarding, mail holding and powers of attorney', 'Nachsendung, Lagerung der Post und Vollmachten', 'Reexpedición, custodia del correo y poderes', 'Rispedizione, giacenza della corrispondenza e deleghe'),
    finalite: l('Exécuter les demandes de réexpédition, de garde du courrier et de procuration, et vérifier l’identité du demandeur.', 'Carrying out forwarding, mail-holding and power-of-attorney requests, and checking the requester’s identity.', 'Ausführung von Nachsende-, Lagerungs- und Vollmachtsaufträgen sowie Prüfung der Identität des Antragstellers.', 'Ejecutar las solicitudes de reexpedición, custodia del correo y poderes, y verificar la identidad del solicitante.', 'Eseguire le richieste di rispedizione, giacenza e delega, e verificare l’identità del richiedente.'),
    categoriesPersonnes: ll(V.clients, P.mandataires), categoriesDonnees: ll(V.identite, P.ancienneAdresse, P.pieceIdentite),
    destinataires: ll(P.serviceClient, P.distribution),
    dureeConservation: null, mesuresSecurite: SECU_BASE }, // TODO(source)
  { key: 'ropa.postal.merchant-recipients', baseLegale: '', secteurs: POSTAL,
    nom: l('Données des destinataires reçues des e-commerçants', 'Recipient data received from e-merchants', 'Von Online-Händlern erhaltene Empfängerdaten', 'Datos de destinatarios recibidos de los comercios electrónicos', 'Dati dei destinatari ricevuti dagli e-commerce'),
    finalite: l('Acheminer et livrer les colis confiés par les e-commerçants. Rôle (responsable de traitement ou sous-traitant) et base légale à qualifier par le DPO.', 'Routing and delivering parcels entrusted by e-merchants. Role (controller or processor) and legal basis to be determined by the DPO.', 'Beförderung und Zustellung der von Online-Händlern übergebenen Pakete. Rolle (Verantwortlicher oder Auftragsverarbeiter) und Rechtsgrundlage vom DSB zu bestimmen.', 'Encaminar y entregar los paquetes confiados por los comercios electrónicos. Función (responsable o encargado del tratamiento) y base jurídica que debe determinar el DPD.', 'Instradare e consegnare i pacchi affidati dagli e-commerce. Ruolo (titolare o responsabile del trattamento) e base giuridica da qualificare a cura del DPO.'),
    categoriesPersonnes: ll(P.destinataires), categoriesDonnees: ll(V.identite, P.adresse, V.coordonnees, P.consignes),
    destinataires: ll(P.distribution, P.ecommercants, P.serviceClient),
    dureeConservation: null, mesuresSecurite: SECU_BASE }, // TODO(source)
  { key: 'ropa.postal.home-services', baseLegale: 'contrat', secteurs: POSTAL,
    nom: l('Prestations au domicile des personnes', 'Services at people’s homes', 'Dienstleistungen bei Personen zu Hause', 'Prestaciones en el domicilio de las personas', 'Prestazioni al domicilio delle persone'),
    finalite: l('Organiser et réaliser les visites, portages et relevés au domicile, et en rendre compte au commanditaire.', 'Organising and carrying out home visits, deliveries and readings, and reporting to the client.', 'Organisation und Durchführung von Besuchen, Lieferungen und Ablesungen zu Hause sowie Bericht an den Auftraggeber.', 'Organizar y realizar las visitas, repartos y lecturas a domicilio, e informar al ordenante.', 'Organizzare ed effettuare visite, consegne e letture a domicilio, e riferirne al committente.'),
    categoriesPersonnes: ll(P.agees, V.clients), categoriesDonnees: ll(V.identite, V.coordonnees, P.accesDomicile),
    destinataires: ll(P.proximite, P.agents),
    dureeConservation: null, mesuresSecurite: SECU_BASE }, // TODO(source)
  { key: 'ropa.postal.counter-identity', baseLegale: 'contrat', secteurs: POSTAL,
    nom: l('Vérification d’identité au guichet', 'Identity checks at the counter', 'Identitätsprüfung am Schalter', 'Verificación de identidad en ventanilla', 'Verifica dell’identità allo sportello'),
    finalite: l('Vérifier l’identité des personnes qui retirent un envoi ou réalisent une opération au guichet, y compris pour compte de tiers.', 'Checking the identity of people collecting an item or carrying out an operation at the counter, including on behalf of third parties.', 'Prüfung der Identität von Personen, die eine Sendung abholen oder einen Vorgang am Schalter ausführen, auch im Auftrag Dritter.', 'Verificar la identidad de las personas que retiran un envío o realizan una operación en ventanilla, incluso por cuenta de terceros.', 'Verificare l’identità delle persone che ritirano una spedizione o effettuano un’operazione allo sportello, anche per conto terzi.'),
    categoriesPersonnes: ll(V.clients, P.mandataires), categoriesDonnees: ll(V.identite, P.pieceIdentite),
    destinataires: ll(P.guichet),
    dureeConservation: null, mesuresSecurite: SECU_BASE }, // TODO(source)
  // CNIL, « La vidéosurveillance – vidéoprotection au travail » : en principe, la durée n'excède pas un mois.
  { key: 'ropa.postal.cctv', baseLegale: 'interet_legitime', surveillanceSystematique: true, secteurs: POSTAL,
    nom: l('Vidéoprotection des plateformes de tri et des bureaux', 'Video surveillance of sorting platforms and post offices', 'Videoüberwachung der Sortierzentren und Filialen', 'Videovigilancia de las plataformas de clasificación y oficinas', 'Videosorveglianza delle piattaforme di smistamento e degli uffici'),
    finalite: l('Sécurité des biens, des envois et des personnes sur les plateformes et dans les bureaux.', 'Protection of property, items and people on platforms and in post offices.', 'Schutz von Sachen, Sendungen und Personen in Sortierzentren und Filialen.', 'Seguridad de bienes, envíos y personas en las plataformas y oficinas.', 'Sicurezza di beni, spedizioni e persone nelle piattaforme e negli uffici.'),
    categoriesPersonnes: ll(V.salaries, V.visiteurs, V.public), categoriesDonnees: ll(V.images),
    destinataires: ll(V.habilitesSecu, V.forcesOrdre),
    dureeConservation: duree('En principe, un mois au plus (CNIL).', 'in principle, one month at most (CNIL).', 'grundsätzlich höchstens ein Monat (CNIL).', 'en principio, un mes como máximo (CNIL).', 'in linea di principio, al massimo un mese (CNIL).'),
    mesuresSecurite: SECU_BASE },
  // TODO(source) : la fiche CNIL « L’écoute et l’enregistrement des appels sur le lieu de travail » se déclare
  // obsolète et en cours de mise à jour — durée non reprise tant que la version à jour n'est pas publiée.
  { key: 'ropa.postal.call-recording', baseLegale: 'interet_legitime', secteurs: POSTAL,
    nom: l('Enregistrement des appels du service client', 'Recording of customer service calls', 'Aufzeichnung von Kundenservice-Anrufen', 'Grabación de las llamadas del servicio de atención al cliente', 'Registrazione delle chiamate del servizio clienti'),
    finalite: l('Formation et évaluation des conseillers, amélioration de la qualité du service.', 'Training and assessing agents, improving service quality.', 'Schulung und Beurteilung der Berater, Verbesserung der Servicequalität.', 'Formación y evaluación de los agentes, mejora de la calidad del servicio.', 'Formazione e valutazione degli operatori, miglioramento della qualità del servizio.'),
    categoriesPersonnes: ll(P.appelants, P.conseillers), categoriesDonnees: ll(V.identite, P.enregistrement),
    destinataires: ll(P.serviceClient, V.encadrement),
    dureeConservation: null, mesuresSecurite: SECU_BASE },
]

/** Traitements types propres à un métier (filtrés par secteur de l'organisation, présentés en tête). */
export const ROPA_SECTOR_TEMPLATES: RopaTemplate[] = [...POSTAL_TEMPLATES]

export const ROPA_PLACEHOLDER_KEY = 'ropa.business-specific'

/**
 * Traitements types dans la langue demandée (clé stable incluse). `secteurs` (codes du catalogue de l'organisation) :
 * les traitements propres à ces secteurs sont présentés en tête ; sans secteur correspondant, comportement inchangé.
 */
export function listRopaTemplates(locale: RopaLocale, secteurs: readonly string[] = []): Array<Traitement & { key: string }> {
  const propres = ROPA_SECTOR_TEMPLATES.filter(t => t.secteurs?.some(c => secteurs.includes(c)))
  return [...propres, ...ROPA_TEMPLATES].map(t => ({
    key: t.key,
    nom: t.nom[locale],
    finalite: t.finalite[locale],
    baseLegale: t.baseLegale,
    categoriesPersonnes: t.categoriesPersonnes[locale],
    categoriesDonnees: t.categoriesDonnees[locale],
    destinataires: t.destinataires[locale],
    transfertHorsUE: false,
    dureeConservation: t.dureeConservation?.[locale] ?? '',
    mesuresSecurite: t.mesuresSecurite?.[locale] ?? [],
    grandeEchelle: false,
    surveillanceSystematique: t.surveillanceSystematique ?? false,
  }))
}
