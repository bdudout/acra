// ─── Catalogue d'incidents types (cyber et autres risques) — à sélectionner, rechercher et compléter (PUR) ────────────────
// Un incident type préremplit l'intitulé, le type d'événement et la liste « à compléter » : il ne décrit JAMAIS un fait (aucune
// date, aucun chiffre, aucune gravité). Le caractère significatif / majeur et les déclarations aux autorités restent des décisions
// de l'entité ; le type sert seulement à suggérer les obligations à examiner (régimes de notification) et à préremplir les
// indices de déclaration (nature TIC ou non, cause racine probable, données personnelles possibles).

export type IncidentLocale = 'fr' | 'en' | 'de' | 'es' | 'it'
type Localized = Record<IncidentLocale, string>
const l = (fr: string, en: string, de: string, es: string, it: string): Localized => ({ fr, en, de, es, it })

export type IncidentCategorie = 'CYBER' | 'FRAUDE' | 'PROCESSUS' | 'CONTINUITE' | 'SECURITE_PHYSIQUE' | 'DONNEES_PERSONNELLES' | 'AUTRE'
export type CauseRacineType = 'PROCESSUS' | 'PERSONNES' | 'SYSTEMES' | 'EXTERNE' | 'TIERS'

export interface IncidentType {
  key: string
  categorie: IncidentCategorie
  title: Localized
  /** Synonymes de recherche (toutes langues, sans accents). */
  aliases: string[]
  /** Incident lié aux TIC (DORA : à évaluer pour la classification « majeur »). */
  tic: boolean
  /** Des données personnelles sont vraisemblablement concernées (RGPD art. 33 à examiner). */
  donnees: boolean
  causeRacine: CauseRacineType
  /** Identifiants de INCIDENT_CHECKLIST : informations à recueillir pour qualifier puis déclarer. */
  aCompleter: string[]
  /** Régimes de notification du catalogue à examiner (jamais appliqués automatiquement). */
  regimes: string[]
}

/** Informations à recueillir (reprises dans la description préremplie). */
export const INCIDENT_CHECKLIST: Record<string, Localized> = {
  systemes: l('Systèmes, applications ou services affectés', 'Systems, applications or services affected', 'Betroffene Systeme, Anwendungen oder Dienste', 'Sistemas, aplicaciones o servicios afectados', 'Sistemi, applicazioni o servizi interessati'),
  debut_fin: l('Heures de début et de fin (ou d’indisponibilité)', 'Start and end times (or downtime)', 'Beginn und Ende (bzw. Ausfallzeit)', 'Horas de inicio y fin (o de indisponibilidad)', 'Orari di inizio e fine (o di indisponibilità)'),
  clients: l('Impact sur les clients ou contreparties (nombre, nature)', 'Impact on clients or counterparties (number, nature)', 'Auswirkungen auf Kunden oder Gegenparteien (Anzahl, Art)', 'Impacto en clientes o contrapartes (número, naturaleza)', 'Impatto su clienti o controparti (numero, natura)'),
  donnees: l('Données concernées et volumétrie', 'Data concerned and volume', 'Betroffene Daten und Umfang', 'Datos afectados y volumen', 'Dati interessati e volume'),
  personnes: l('Personnes concernées (catégories, nombre)', 'Individuals concerned (categories, number)', 'Betroffene Personen (Kategorien, Anzahl)', 'Personas afectadas (categorías, número)', 'Persone interessate (categorie, numero)'),
  vecteur: l('Vecteur d’attaque ou cause suspectée', 'Attack vector or suspected cause', 'Angriffsvektor oder vermutete Ursache', 'Vector de ataque o causa sospechada', 'Vettore di attacco o causa sospetta'),
  indicateurs: l('Indicateurs de compromission', 'Indicators of compromise', 'Kompromittierungsindikatoren', 'Indicadores de compromiso', 'Indicatori di compromissione'),
  prestataire: l('Prestataire ou tiers impliqué (nom, identifiant LEI)', 'Provider or third party involved (name, LEI)', 'Beteiligter Dienstleister oder Dritter (Name, LEI)', 'Proveedor o tercero implicado (nombre, LEI)', 'Fornitore o terzo coinvolto (nome, LEI)'),
  mesures: l('Mesures de confinement et de reprise', 'Containment and recovery measures', 'Eindämmungs- und Wiederherstellungsmaßnahmen', 'Medidas de contención y recuperación', 'Misure di contenimento e ripristino'),
  pertes: l('Pertes financières estimées', 'Estimated financial losses', 'Geschätzte finanzielle Verluste', 'Pérdidas financieras estimadas', 'Perdite finanziarie stimate'),
  autorites: l('Autorités et parties à informer', 'Authorities and parties to inform', 'Zu informierende Behörden und Parteien', 'Autoridades y partes a informar', 'Autorità e parti da informare'),
  preuves: l('Preuves conservées, plainte déposée', 'Evidence preserved, complaint filed', 'Gesicherte Beweise, Anzeige erstattet', 'Pruebas conservadas, denuncia presentada', 'Prove conservate, denuncia presentata'),
}

const t = (key: string, categorie: IncidentCategorie, title: Localized, aliases: string[], o: { tic?: boolean; donnees?: boolean; cause: CauseRacineType; aCompleter: string[]; regimes?: string[] }): IncidentType =>
  ({ key, categorie, title, aliases, tic: o.tic ?? false, donnees: o.donnees ?? false, causeRacine: o.cause, aCompleter: o.aCompleter, regimes: o.regimes ?? [] })
const CYBER_BASE = ['systemes', 'vecteur', 'indicateurs', 'mesures', 'clients']

export const INCIDENT_TYPES: IncidentType[] = [
  // ── Cyber ──────────────────────────────────────────────────────────────
  t('cyber.phishing', 'CYBER', l('Hameçonnage (phishing) : message frauduleux ayant conduit à une action ou à une compromission', 'Phishing: fraudulent message leading to an action or a compromise', 'Phishing: betrügerische Nachricht mit Folgeaktion oder Kompromittierung', 'Phishing: mensaje fraudulento que provocó una acción o un compromiso', 'Phishing: messaggio fraudolento che ha causato un’azione o una compromissione'),
    ['phishing', 'hameconnage', 'spearphishing', 'smishing', 'vishing', 'courriel frauduleux', 'faux mail', 'ingenierie sociale'], { tic: true, cause: 'PERSONNES', aCompleter: [...CYBER_BASE, 'personnes'], regimes: ['NIS2'] }),
  t('cyber.ransomware', 'CYBER', l('Rançongiciel : données ou systèmes chiffrés avec demande de rançon', 'Ransomware: data or systems encrypted with a ransom demand', 'Ransomware: Daten oder Systeme verschlüsselt mit Lösegeldforderung', 'Ransomware: datos o sistemas cifrados con petición de rescate', 'Ransomware: dati o sistemi cifrati con richiesta di riscatto'),
    ['ransomware', 'rancongiciel', 'rancon', 'chiffrement malveillant', 'extorsion', 'lockbit'], { tic: true, donnees: true, cause: 'EXTERNE', aCompleter: [...CYBER_BASE, 'donnees', 'pertes', 'autorites', 'preuves'], regimes: ['NIS2', 'RGPD_33'] }),
  t('cyber.ddos', 'CYBER', l('Déni de service distribué (DDoS) : service indisponible ou dégradé sous un afflux de requêtes', 'Distributed denial of service (DDoS): service unavailable or degraded under a flood of requests', 'Distributed Denial of Service (DDoS): Dienst durch Anfragenflut nicht verfügbar oder beeinträchtigt', 'Denegación de servicio distribuida (DDoS): servicio no disponible o degradado por una avalancha de solicitudes', 'Negazione di servizio distribuita (DDoS): servizio non disponibile o degradato da un afflusso di richieste'),
    ['ddos', 'dos', 'deni de service', 'saturation', 'flood', 'attaque volumetrique', 'denial of service'], { tic: true, cause: 'EXTERNE', aCompleter: ['systemes', 'debut_fin', 'clients', 'vecteur', 'mesures', 'prestataire'], regimes: ['NIS2'] }),
  t('cyber.account-takeover', 'CYBER', l('Compromission de compte (identifiants volés, accès non autorisé)', 'Account compromise (stolen credentials, unauthorised access)', 'Kontokompromittierung (gestohlene Zugangsdaten, unbefugter Zugriff)', 'Compromiso de cuenta (credenciales robadas, acceso no autorizado)', 'Compromissione di account (credenziali rubate, accesso non autorizzato)'),
    ['compte compromis', 'identifiants voles', 'credential stuffing', 'usurpation de compte', 'takeover', 'mot de passe', 'mfa'], { tic: true, donnees: true, cause: 'PERSONNES', aCompleter: [...CYBER_BASE, 'donnees'], regimes: ['NIS2', 'RGPD_33'] }),
  t('cyber.data-exfiltration', 'CYBER', l('Fuite ou exfiltration de données (vol de données, divulgation à un tiers non autorisé)', 'Data leak or exfiltration (data theft, disclosure to an unauthorised party)', 'Datenabfluss oder -exfiltration (Datendiebstahl, Offenlegung gegenüber Unbefugten)', 'Fuga o exfiltración de datos (robo de datos, divulgación a un tercero no autorizado)', 'Fuga o esfiltrazione di dati (furto di dati, divulgazione a terzi non autorizzati)'),
    ['fuite de donnees', 'exfiltration', 'vol de donnees', 'data breach', 'breach', 'divulgation', 'leak'], { tic: true, donnees: true, cause: 'EXTERNE', aCompleter: [...CYBER_BASE, 'donnees', 'personnes', 'autorites', 'preuves'], regimes: ['NIS2', 'RGPD_33'] }),
  t('cyber.malware', 'CYBER', l('Logiciel malveillant (virus, cheval de Troie, voleur d’informations) sur un poste ou un serveur', 'Malware (virus, trojan, infostealer) on a workstation or server', 'Schadsoftware (Virus, Trojaner, Infostealer) auf Arbeitsplatz oder Server', 'Software malicioso (virus, troyano, infostealer) en un puesto o servidor', 'Software dannoso (virus, trojan, infostealer) su una postazione o un server'),
    ['malware', 'virus', 'cheval de troie', 'trojan', 'infostealer', 'logiciel malveillant', 'ver'], { tic: true, cause: 'EXTERNE', aCompleter: [...CYBER_BASE] }),
  t('cyber.intrusion', 'CYBER', l('Intrusion dans le système d’information (accès persistant, mouvement latéral, attaque ciblée)', 'Intrusion into the information system (persistent access, lateral movement, targeted attack)', 'Eindringen in das Informationssystem (persistenter Zugriff, laterale Bewegung, gezielter Angriff)', 'Intrusión en el sistema de información (acceso persistente, movimiento lateral, ataque dirigido)', 'Intrusione nel sistema informativo (accesso persistente, movimento laterale, attacco mirato)'),
    ['intrusion', 'apt', 'attaque ciblee', 'mouvement lateral', 'compromission du si', 'piratage', 'hacking'], { tic: true, donnees: true, cause: 'EXTERNE', aCompleter: [...CYBER_BASE, 'donnees', 'autorites'], regimes: ['NIS2', 'RGPD_33'] }),
  t('cyber.vulnerability-exploited', 'CYBER', l('Vulnérabilité exploitée (faille connue ou « zero-day » utilisée contre un produit ou un service)', 'Exploited vulnerability (known flaw or zero-day used against a product or service)', 'Ausgenutzte Schwachstelle (bekannte Lücke oder Zero-Day gegen ein Produkt oder einen Dienst)', 'Vulnerabilidad explotada (fallo conocido o «zero-day» usado contra un producto o servicio)', 'Vulnerabilità sfruttata (falla nota o «zero-day» usata contro un prodotto o un servizio)'),
    ['vulnerabilite', 'faille', 'zero day', 'zero-day', 'cve', 'exploitation', 'correctif', 'patch', 'cra'], { tic: true, cause: 'SYSTEMES', aCompleter: [...CYBER_BASE, 'prestataire', 'autorites'], regimes: ['CRA_14', 'NIS2'] }),
  t('cyber.supply-chain', 'CYBER', l('Compromission d’un prestataire ou de la chaîne d’approvisionnement logicielle', 'Compromise of a provider or of the software supply chain', 'Kompromittierung eines Dienstleisters oder der Software-Lieferkette', 'Compromiso de un proveedor o de la cadena de suministro de software', 'Compromissione di un fornitore o della catena di fornitura del software'),
    ['supply chain', 'chaine d approvisionnement', 'prestataire compromis', 'tiers compromis', 'sous-traitant', 'solarwinds'], { tic: true, donnees: true, cause: 'TIERS', aCompleter: [...CYBER_BASE, 'prestataire', 'donnees', 'autorites'], regimes: ['NIS2', 'RGPD_33'] }),
  t('cyber.cloud-misconfiguration', 'CYBER', l('Exposition de données par mauvaise configuration (stockage ou service cloud ouvert)', 'Data exposure through misconfiguration (open cloud storage or service)', 'Datenexposition durch Fehlkonfiguration (offener Cloud-Speicher oder -Dienst)', 'Exposición de datos por mala configuración (almacenamiento o servicio cloud abierto)', 'Esposizione di dati per errata configurazione (storage o servizio cloud aperto)'),
    ['mauvaise configuration', 'misconfiguration', 'bucket ouvert', 'cloud expose', 'stockage public', 'configuration'], { tic: true, donnees: true, cause: 'PROCESSUS', aCompleter: ['systemes', 'donnees', 'personnes', 'prestataire', 'mesures', 'autorites'], regimes: ['RGPD_33'] }),
  t('cyber.insider-abuse', 'CYBER', l('Abus de privilèges ou malveillance interne (collaborateur, administrateur, prestataire)', 'Privilege abuse or insider malice (employee, administrator, contractor)', 'Missbrauch von Privilegien oder interne Böswilligkeit (Mitarbeiter, Administrator, Dienstleister)', 'Abuso de privilegios o malicia interna (empleado, administrador, proveedor)', 'Abuso di privilegi o malevolenza interna (dipendente, amministratore, fornitore)'),
    ['abus de privileges', 'malveillance interne', 'insider', 'administrateur', 'collaborateur', 'depart', 'exfiltration interne'], { tic: true, donnees: true, cause: 'PERSONNES', aCompleter: ['systemes', 'donnees', 'vecteur', 'mesures', 'preuves'], regimes: ['RGPD_33'] }),
  t('cyber.web-compromise', 'CYBER', l('Compromission ou défiguration d’un site web ou d’une application exposée', 'Compromise or defacement of a website or exposed application', 'Kompromittierung oder Defacement einer Website oder exponierten Anwendung', 'Compromiso o desfiguración de un sitio web o aplicación expuesta', 'Compromissione o defacement di un sito web o di un’applicazione esposta'),
    ['defiguration', 'defacement', 'site web', 'injection sql', 'xss', 'application web', 'webshell'], { tic: true, donnees: true, cause: 'EXTERNE', aCompleter: [...CYBER_BASE, 'donnees'], regimes: ['NIS2'] }),
  t('cyber.bec-fraud', 'FRAUDE', l('Fraude au président ou usurpation d’identité (virement frauduleux, changement de coordonnées bancaires)', 'CEO fraud or impersonation (fraudulent transfer, bank-detail change)', 'CEO-Betrug oder Identitätsmissbrauch (betrügerische Überweisung, Änderung von Bankdaten)', 'Fraude del CEO o suplantación de identidad (transferencia fraudulenta, cambio de datos bancarios)', 'Frode del CEO o furto di identità (bonifico fraudolento, modifica delle coordinate bancarie)'),
    ['fraude au president', 'bec', 'faux ordre de virement', 'fovi', 'usurpation', 'rib', 'virement frauduleux', 'ceo fraud'], { tic: true, cause: 'PERSONNES', aCompleter: ['pertes', 'vecteur', 'mesures', 'autorites', 'preuves'], regimes: [] }),
  t('cyber.device-loss', 'SECURITE_PHYSIQUE', l('Perte ou vol d’un équipement (ordinateur, téléphone, clé, support de sauvegarde)', 'Loss or theft of a device (computer, phone, key, backup media)', 'Verlust oder Diebstahl eines Geräts (Computer, Telefon, Schlüssel, Sicherungsmedium)', 'Pérdida o robo de un equipo (ordenador, teléfono, llave, soporte de copia)', 'Smarrimento o furto di un dispositivo (computer, telefono, chiave, supporto di backup)'),
    ['perte', 'vol', 'ordinateur portable', 'telephone', 'cle usb', 'equipement perdu', 'laptop'], { tic: true, donnees: true, cause: 'PERSONNES', aCompleter: ['donnees', 'personnes', 'mesures', 'preuves'], regimes: ['RGPD_33'] }),
  // ── Autres risques ────────────────────────────────────────────────────
  t('ops.it-outage', 'PROCESSUS', l('Panne majeure du système d’information ou d’une application critique', 'Major outage of the information system or of a critical application', 'Großstörung des Informationssystems oder einer kritischen Anwendung', 'Caída mayor del sistema de información o de una aplicación crítica', 'Guasto maggiore del sistema informativo o di un’applicazione critica'),
    ['panne', 'indisponibilite', 'incident technique', 'crash', 'bug', 'application critique', 'si indisponible', 'outage'], { tic: true, cause: 'SYSTEMES', aCompleter: ['systemes', 'debut_fin', 'clients', 'mesures', 'pertes'], regimes: ['NIS2'] }),
  t('ops.third-party-outage', 'PROCESSUS', l('Défaillance d’un prestataire de services TIC ou cloud', 'Failure of an ICT or cloud service provider', 'Ausfall eines IKT- oder Cloud-Dienstleisters', 'Fallo de un proveedor de servicios TIC o cloud', 'Guasto di un fornitore di servizi TIC o cloud'),
    ['prestataire', 'cloud', 'saas', 'hebergeur', 'fournisseur tic', 'indisponibilite prestataire', 'third party', 'tpp'], { tic: true, cause: 'TIERS', aCompleter: ['prestataire', 'systemes', 'debut_fin', 'clients', 'mesures'], regimes: ['NIS2'] }),
  t('ops.failed-change', 'PROCESSUS', l('Échec d’un changement ou d’une mise en production (régression, migration ratée)', 'Failed change or release (regression, failed migration)', 'Fehlgeschlagene Änderung oder Freigabe (Regression, gescheiterte Migration)', 'Fallo de un cambio o puesta en producción (regresión, migración fallida)', 'Fallimento di una modifica o di un rilascio (regressione, migrazione fallita)'),
    ['changement', 'mise en production', 'deploiement', 'regression', 'migration', 'release', 'mise a jour'], { tic: true, cause: 'PROCESSUS', aCompleter: ['systemes', 'debut_fin', 'clients', 'mesures'] }),
  t('ops.data-loss', 'PROCESSUS', l('Perte ou corruption de données (sauvegarde défaillante, restauration impossible)', 'Data loss or corruption (failed backup, restore impossible)', 'Datenverlust oder -beschädigung (fehlerhafte Sicherung, Wiederherstellung unmöglich)', 'Pérdida o corrupción de datos (copia defectuosa, restauración imposible)', 'Perdita o corruzione di dati (backup difettoso, ripristino impossibile)'),
    ['perte de donnees', 'corruption', 'sauvegarde', 'restauration', 'backup', 'integrite'], { tic: true, donnees: true, cause: 'SYSTEMES', aCompleter: ['systemes', 'donnees', 'debut_fin', 'mesures', 'pertes'], regimes: ['RGPD_33'] }),
  t('ops.power-telecom', 'CONTINUITE', l('Coupure d’énergie ou de télécommunications', 'Power or telecommunications outage', 'Strom- oder Telekommunikationsausfall', 'Corte de energía o de telecomunicaciones', 'Interruzione di energia o telecomunicazioni'),
    ['coupure electrique', 'panne de courant', 'telecom', 'reseau', 'fibre', 'energie', 'onduleur', 'power outage'], { tic: true, cause: 'EXTERNE', aCompleter: ['systemes', 'debut_fin', 'clients', 'mesures', 'prestataire'] }),
  t('ops.site-disaster', 'CONTINUITE', l('Sinistre sur un site (incendie, inondation, dégât des eaux, tempête)', 'Site disaster (fire, flood, water damage, storm)', 'Schadensfall am Standort (Brand, Überschwemmung, Wasserschaden, Sturm)', 'Siniestro en un sitio (incendio, inundación, daños por agua, tormenta)', 'Sinistro presso una sede (incendio, alluvione, danni da acqua, tempesta)'),
    ['incendie', 'inondation', 'degat des eaux', 'sinistre', 'tempete', 'catastrophe', 'site indisponible', 'fire', 'flood'], { cause: 'EXTERNE', aCompleter: ['debut_fin', 'clients', 'mesures', 'pertes', 'autorites'] }),
  t('ops.physical-intrusion', 'SECURITE_PHYSIQUE', l('Intrusion, vol ou vandalisme sur site', 'On-site intrusion, theft or vandalism', 'Einbruch, Diebstahl oder Vandalismus vor Ort', 'Intrusión, robo o vandalismo en el sitio', 'Intrusione, furto o vandalismo in sede'),
    ['intrusion physique', 'cambriolage', 'vol sur site', 'vandalisme', 'acces non autorise', 'badge', 'effraction'], { cause: 'EXTERNE', aCompleter: ['debut_fin', 'mesures', 'pertes', 'preuves', 'autorites'] }),
  t('fraud.internal', 'FRAUDE', l('Fraude interne (détournement, falsification, contournement de contrôles)', 'Internal fraud (misappropriation, falsification, circumvention of controls)', 'Interner Betrug (Veruntreuung, Fälschung, Umgehung von Kontrollen)', 'Fraude interno (malversación, falsificación, elusión de controles)', 'Frode interna (appropriazione indebita, falsificazione, elusione dei controlli)'),
    ['fraude interne', 'detournement', 'falsification', 'malversation', 'collusion', 'abus de confiance'], { cause: 'PERSONNES', aCompleter: ['pertes', 'mesures', 'preuves', 'autorites'] }),
  t('fraud.payment', 'FRAUDE', l('Fraude externe sur moyens de paiement (cartes, virements, prélèvements, chèques)', 'External fraud on payment instruments (cards, transfers, direct debits, cheques)', 'Externer Betrug bei Zahlungsmitteln (Karten, Überweisungen, Lastschriften, Schecks)', 'Fraude externo en medios de pago (tarjetas, transferencias, adeudos, cheques)', 'Frode esterna su strumenti di pagamento (carte, bonifici, addebiti diretti, assegni)'),
    ['fraude paiement', 'carte bancaire', 'virement', 'prelevement', 'cheque', 'usurpation d identite', 'fraude externe', 'sepa'], { tic: true, cause: 'EXTERNE', aCompleter: ['pertes', 'clients', 'vecteur', 'mesures', 'autorites', 'preuves'] }),
  t('ops.processing-error', 'PROCESSUS', l('Erreur de traitement ou d’exécution d’une opération (montant, bénéficiaire, délai, doublon)', 'Processing or execution error (amount, beneficiary, timing, duplicate)', 'Verarbeitungs- oder Ausführungsfehler (Betrag, Begünstigter, Frist, Duplikat)', 'Error de tratamiento o de ejecución de una operación (importe, beneficiario, plazo, duplicado)', 'Errore di elaborazione o di esecuzione di un’operazione (importo, beneficiario, termine, duplicato)'),
    ['erreur de traitement', 'erreur operationnelle', 'doublon', 'mauvais montant', 'erreur de saisie', 'rapprochement', 'operation erronee'], { cause: 'PROCESSUS', aCompleter: ['systemes', 'clients', 'pertes', 'mesures'] }),
  t('priv.misdelivery', 'DONNEES_PERSONNELLES', l('Envoi ou accès erroné à des données personnelles (mauvais destinataire, droits trop larges)', 'Erroneous disclosure of or access to personal data (wrong recipient, excessive rights)', 'Irrtümliche Weitergabe von oder Zugriff auf personenbezogene Daten (falscher Empfänger, zu weite Rechte)', 'Envío o acceso erróneo a datos personales (destinatario equivocado, derechos excesivos)', 'Invio o accesso errato a dati personali (destinatario sbagliato, diritti eccessivi)'),
    ['mauvais destinataire', 'envoi erreur', 'courriel errone', 'droits trop larges', 'donnees personnelles', 'rgpd', 'violation', 'dpo'], { donnees: true, cause: 'PERSONNES', aCompleter: ['donnees', 'personnes', 'mesures', 'autorites'], regimes: ['RGPD_33'] }),
  t('ops.staff-unavailability', 'CONTINUITE', l('Indisponibilité de personnel clé ou d’une équipe (pandémie, grève, accident)', 'Unavailability of key staff or of a team (pandemic, strike, accident)', 'Ausfall von Schlüsselpersonal oder eines Teams (Pandemie, Streik, Unfall)', 'Indisponibilidad de personal clave o de un equipo (pandemia, huelga, accidente)', 'Indisponibilità di personale chiave o di un team (pandemia, sciopero, incidente)'),
    ['personnel cle', 'greve', 'pandemie', 'absence', 'epidemie', 'ressources humaines', 'indisponibilite equipe'], { cause: 'PERSONNES', aCompleter: ['debut_fin', 'clients', 'mesures'] }),
  t('ops.supplier-failure', 'PROCESSUS', l('Défaillance d’un fournisseur ou sous-traitant (hors TIC) : retard, rupture, faillite', 'Failure of a supplier or subcontractor (non-ICT): delay, disruption, bankruptcy', 'Ausfall eines Lieferanten oder Subunternehmers (nicht IKT): Verzug, Unterbrechung, Insolvenz', 'Fallo de un proveedor o subcontratista (no TIC): retraso, interrupción, quiebra', 'Inadempienza di un fornitore o subappaltatore (non TIC): ritardo, interruzione, fallimento'),
    ['fournisseur', 'sous-traitant', 'rupture', 'faillite', 'retard de livraison', 'defaillance fournisseur'], { cause: 'TIERS', aCompleter: ['prestataire', 'debut_fin', 'clients', 'mesures', 'pertes'] }),
  t('ops.compliance-breach', 'AUTRE', l('Manquement réglementaire ou de conformité constaté (obligation non respectée)', 'Regulatory or compliance breach identified (obligation not met)', 'Festgestellter regulatorischer oder Compliance-Verstoß (Pflicht nicht erfüllt)', 'Incumplimiento normativo o de conformidad detectado (obligación no cumplida)', 'Violazione normativa o di conformità rilevata (obbligo non rispettato)'),
    ['conformite', 'manquement', 'reglementaire', 'non conformite', 'obligation', 'lcb-ft', 'sanction', 'compliance'], { cause: 'PROCESSUS', aCompleter: ['mesures', 'clients', 'autorites', 'pertes'] }),
]

const BY_KEY = new Map(INCIDENT_TYPES.map(x => [x.key, x]))
export const incidentTypeByKey = (key: string | null | undefined): IncidentType | undefined => (key ? BY_KEY.get(key) : undefined)

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** Recherche tolérante (accents, casse, plusieurs mots) sur le titre dans la langue de l'utilisateur et sur les synonymes ; vide = tout. */
export function searchIncidentTypes(query: string, locale: IncidentLocale): IncidentType[] {
  const words = fold(query).split(' ').filter(Boolean)
  if (!words.length) return INCIDENT_TYPES
  return INCIDENT_TYPES.filter(x => {
    const hay = `${fold(x.title[locale])} ${fold(x.title.en)} ${x.aliases.map(fold).join(' ')}`
    return words.every(w => hay.includes(w))
  })
}

const TO_COMPLETE: Localized = l('À compléter :', 'To complete:', 'Zu ergänzen:', 'Por completar:', 'Da completare:')

export interface IncidentTemplate { catalogueKey: string; intitule: string; description: string; typeEvenement: IncidentCategorie; donneesPersonnelles: boolean; significatif: false; regimes: string[]; tic: boolean }

/** Préremplissage d'une déclaration : intitulé, liste « à compléter », type d'événement, données personnelles possibles. Aucun fait inventé. */
export function incidentTemplate(key: string, locale: IncidentLocale): IncidentTemplate | null {
  const x = incidentTypeByKey(key)
  if (!x) return null
  return {
    catalogueKey: x.key, intitule: x.title[locale], typeEvenement: x.categorie, donneesPersonnelles: x.donnees, significatif: false, regimes: x.regimes, tic: x.tic,
    description: `${TO_COMPLETE[locale]}\n${x.aCompleter.map(id => `- ${INCIDENT_CHECKLIST[id][locale]} : `).join('\n')}`,
  }
}
