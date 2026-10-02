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

export const ROPA_PLACEHOLDER_KEY = 'ropa.business-specific'

/** Traitements types dans la langue demandée (clé stable incluse). */
export function listRopaTemplates(locale: RopaLocale): Array<Traitement & { key: string }> {
  return ROPA_TEMPLATES.map(t => ({
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
