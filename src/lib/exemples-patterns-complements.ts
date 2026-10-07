/**
 * Compléments des patterns du lot 1 : les ateliers où le pattern a un sens mais qui n'avaient pas encore d'exemple
 * (tiers impliqués → partie prenante et mesure d'écosystème ; profil de menace → source de risque). Peu d'éléments,
 * les plus utiles. Cohérence vérifiée par exemples-patterns-coherence.test.ts.
 */
import { L, ae, me, pp, sr, ss, type PatternItem } from './exemples-patterns-core'

const INTERNET = ['EXPOSITION_INTERNET'] as const
const DISTANT = ['ACCES_DISTANT'] as const
const CONF = ['ZONE_CONFIANCE'] as const
const MOINDRE = ['ZONE_MOINDRE_CONFIANCE'] as const
const TELEMAINT = ['TELEMAINTENANCE'] as const
const ADMIN = ['SI_ADMINISTRATION'] as const
const DC = ['FLUX_INTERNES_DC'] as const
const BURO = ['BUREAUTIQUE'] as const
const TPE = ['SI_TPE'] as const
const SENS = ['SI_SENSIBLE'] as const

export const COMPLEMENT_ITEMS: PatternItem[] = [
  // ═══ Exposition sur Internet ═══
  pp(INTERNET, L('Hébergeur ou infogéreur des services exposés sur Internet', 'Host or managed-service provider of the Internet-facing services', 'Hoster oder Betreiber der aus dem Internet erreichbaren Dienste', 'Proveedor de alojamiento o de gestión de los servicios expuestos en Internet', 'Hosting provider o gestore dei servizi esposti su Internet'), 'PRESTATAIRE', 3, 3, 3, 3),
  me(INTERNET, L('Protection contre les dénis de service et alerte en cas d’incident prévues dans le contrat d’hébergement', 'Denial-of-service protection and incident alerting provided for in the hosting contract', 'Schutz vor Denial-of-Service und Alarmierung bei Vorfällen im Hosting-Vertrag vorgesehen', 'Protección contra denegaciones de servicio y alerta en caso de incidente previstas en el contrato de alojamiento', 'Protezione contro i denial of service e allerta in caso di incidente previste nel contratto di hosting'), 'TECHNIQUE', '5.22',
    L('Délais et contacts d’urgence connus avant l’incident', 'Times and emergency contacts known before the incident', 'Fristen und Notfallkontakte vor dem Vorfall bekannt', 'Plazos y contactos de emergencia conocidos antes del incidente', 'Tempi e contatti di emergenza noti prima dell’incidente')),

  // ═══ Accès distant ═══
  pp(DISTANT, L('Fournisseur de la solution d’accès distant (VPN, accès « zero trust »)', 'Remote access solution provider (VPN, zero-trust access)', 'Anbieter der Fernzugriffslösung (VPN, Zero-Trust-Zugang)', 'Proveedor de la solución de acceso remoto (VPN, acceso «zero trust»)', 'Fornitore della soluzione di accesso remoto (VPN, accesso «zero trust»)'), 'FOURNISSEUR', 3, 3, 3, 3),

  // ═══ Zone de confiance ═══
  ae(CONF, 'ESCALADE_PRIVILEGES', 'T1078', L('Réutilisation d’un compte d’administration pour entrer dans la zone de confiance', 'Reuse of an administration account to enter the trusted zone', 'Wiederverwendung eines Administratorkontos für den Zugang zur Vertrauenszone', 'Reutilización de una cuenta de administración para entrar en la zona de confianza', 'Riutilizzo di un account di amministrazione per entrare nella zona di fiducia'),
    L('Compte commun à plusieurs zones', 'Account shared across several zones', 'Mehreren Zonen gemeinsames Konto', 'Cuenta común a varias zonas', 'Account comune a più zone')),

  // ═══ Zone de moindre confiance ═══
  sr(MOINDRE, L('Visiteur, invité ou équipement non maîtrisé connecté au réseau', 'Visitor, guest or unmanaged device connected to the network', 'Besucher, Gast oder nicht verwaltetes Gerät im Netz', 'Visitante, invitado o equipo no controlado conectado a la red', 'Visitatore, ospite o dispositivo non gestito collegato alla rete'), 'AMATEUR',
    L('Personne ou appareil présent sur un réseau de moindre confiance, parfois à son insu porteur d’un code malveillant', 'Person or device on a lower-trust network, sometimes unknowingly carrying malware', 'Person oder Gerät in einem Netz mit geringerem Vertrauen, manchmal unwissentlich mit Schadcode', 'Persona o dispositivo presente en una red de menor confianza, a veces portador de código malicioso sin saberlo', 'Persona o dispositivo presente su una rete a fiducia ridotta, talvolta portatore inconsapevole di codice malevolo'),
    L('Curiosité, opportunisme', 'Curiosity, opportunism', 'Neugier, Opportunismus', 'Curiosidad, oportunismo', 'Curiosità, opportunismo'),
    L('Accès physique, équipement personnel', 'Physical access, personal device', 'Physischer Zugang, eigenes Gerät', 'Acceso físico, equipo personal', 'Accesso fisico, dispositivo personale'), 2),

  // ═══ Télémaintenance ═══
  sr(TELEMAINT, L('Attaquant passant par le prestataire de télémaintenance compromis', 'Attacker going through a compromised remote-maintenance provider', 'Angreifer, der über den kompromittierten Fernwartungsdienstleister vorgeht', 'Atacante que pasa por el proveedor de telemantenimiento comprometido', 'Attaccante che passa attraverso il fornitore di teleassistenza compromesso'), 'CYBERCRIMINEL',
    L('Acteur qui vise un prestataire pour atteindre en une fois tous ses clients', 'Actor targeting a provider to reach all its customers at once', 'Akteur, der einen Dienstleister angreift, um alle seine Kunden auf einmal zu erreichen', 'Actor que ataca a un proveedor para alcanzar de una vez a todos sus clientes', 'Attore che prende di mira un fornitore per raggiungere in una volta tutti i suoi clienti'),
    L('Rançongiciel, accès revendu', 'Ransomware, resold access', 'Ransomware, weiterverkaufter Zugang', 'Ransomware, acceso revendido', 'Ransomware, accesso rivenduto'),
    L('Outils de prise de main à distance légitimes, identifiants du prestataire', 'Legitimate remote-control tools, provider credentials', 'Legitime Fernsteuerungswerkzeuge, Zugangsdaten des Dienstleisters', 'Herramientas legítimas de control remoto, credenciales del proveedor', 'Strumenti legittimi di controllo remoto, credenziali del fornitore'), 3),
  pp(TELEMAINT, L('Prestataire de télémaintenance (éditeur, constructeur)', 'Remote-maintenance provider (vendor, manufacturer)', 'Fernwartungsdienstleister (Softwarehersteller, Gerätehersteller)', 'Proveedor de telemantenimiento (editor, fabricante)', 'Fornitore di teleassistenza (editore, costruttore)'), 'PRESTATAIRE', 2, 4, 2, 2),
  me(TELEMAINT, L('Engagements du prestataire de télémaintenance : comptes nominatifs, poste dédié, notification de ses propres incidents', 'Remote-maintenance provider commitments: named accounts, dedicated workstation, notification of its own incidents', 'Verpflichtungen des Fernwartungsdienstleisters: persönliche Konten, eigener Arbeitsplatz, Meldung eigener Vorfälle', 'Compromisos del proveedor de telemantenimiento: cuentas nominativas, puesto dedicado, notificación de sus propios incidentes', 'Impegni del fornitore di teleassistenza: account nominativi, postazione dedicata, notifica dei propri incidenti'), 'ORGANISATIONNELLE', '5.20',
    L('Écrits dans le contrat et vérifiés', 'Written into the contract and checked', 'Im Vertrag festgelegt und überprüft', 'Escritos en el contrato y verificados', 'Scritti nel contratto e verificati')),

  // ═══ Système d’administration ═══
  sr(ADMIN, L('Administrateur interne malveillant ou contraint', 'Malicious or coerced internal administrator', 'Böswilliger oder unter Druck gesetzter interner Administrator', 'Administrador interno malintencionado o coaccionado', 'Amministratore interno malintenzionato o costretto'), 'EMPLOYE_MALVEILLANT',
    L('Personne disposant de droits légitimes étendus qu’elle détourne', 'Person holding broad legitimate rights that they misuse', 'Person mit weitreichenden legitimen Rechten, die sie missbraucht', 'Persona con amplios derechos legítimos que desvía', 'Persona con ampi diritti legittimi di cui abusa'),
    L('Vengeance, gain financier, contrainte extérieure', 'Revenge, financial gain, external coercion', 'Rache, finanzieller Gewinn, äußerer Druck', 'Venganza, beneficio económico, coacción externa', 'Vendetta, guadagno economico, costrizione esterna'),
    L('Droits d’administration, connaissance du SI', 'Administration rights, knowledge of the IS', 'Administratorrechte, Kenntnis des IS', 'Derechos de administración, conocimiento del SI', 'Diritti di amministrazione, conoscenza del SI'), 2),
  pp(ADMIN, L('Infogérant chargé de l’administration du SI', 'Managed-service provider in charge of IS administration', 'Mit der IS-Administration beauftragter Betreiber', 'Proveedor de servicios gestionados encargado de la administración del SI', 'Fornitore di servizi gestiti incaricato dell’amministrazione del SI'), 'PRESTATAIRE', 4, 4, 3, 2),
  me(ADMIN, L('Administration par l’infogérant uniquement via le bastion, avec comptes nominatifs et revue des actions', 'Administration by the managed-service provider only through the bastion, with named accounts and review of actions', 'Administration durch den Betreiber nur über den Bastion-Host, mit persönlichen Konten und Überprüfung der Aktionen', 'Administración por el proveedor únicamente a través del bastión, con cuentas nominativas y revisión de las acciones', 'Amministrazione da parte del fornitore solo tramite il bastion host, con account nominativi e revisione delle azioni'), 'TECHNIQUE', '8.2',
    L('Toute action du prestataire est attribuable', 'Every action of the provider is attributable', 'Jede Aktion des Dienstleisters ist zurechenbar', 'Toda acción del proveedor es atribuible', 'Ogni azione del fornitore è attribuibile')),

  // ═══ Flux internes au datacenter ═══
  pp(DC, L('Hébergeur du centre de données (colocation)', 'Data-centre host (colocation)', 'Rechenzentrumsbetreiber (Colocation)', 'Proveedor del centro de datos (colocation)', 'Gestore del data center (colocation)'), 'PRESTATAIRE', 3, 2, 3, 3),
  me(DC, L('Contrôle des accès physiques et des interventions de l’hébergeur dans les salles', 'Control of physical access and of the host’s interventions in the server rooms', 'Kontrolle des physischen Zugangs und der Eingriffe des Betreibers in den Serverräumen', 'Control de los accesos físicos y de las intervenciones del proveedor en las salas', 'Controllo degli accessi fisici e degli interventi del gestore nelle sale'), 'PHYSIQUE', '7.2',
    L('Interventions annoncées, accompagnées et tracées', 'Interventions announced, escorted and logged', 'Eingriffe angekündigt, begleitet und protokolliert', 'Intervenciones anunciadas, acompañadas y registradas', 'Interventi annunciati, accompagnati e tracciati')),

  // ═══ SI bureautique ═══
  ss(BURO, 'C', L('Un courriel piégé compromet un poste puis l’attaquant récupère les fichiers partagés de l’équipe (C)', 'A malicious email compromises a workstation, then the attacker collects the team’s shared files (C)', 'Eine präparierte E-Mail kompromittiert einen Arbeitsplatz, danach sammelt der Angreifer die gemeinsamen Dateien des Teams (C)', 'Un correo trampa compromete un puesto y el atacante recupera los archivos compartidos del equipo (C)', 'Una e-mail trappola compromette una postazione e l’attaccante recupera i file condivisi del team (C)'),
    L('Droits trop larges sur les partages', 'Overly broad rights on shares', 'Zu weitreichende Rechte auf Freigaben', 'Derechos demasiado amplios sobre los recursos compartidos', 'Diritti troppo ampi sulle condivisioni'), 3, 3),
  pp(BURO, L('Prestataire de support des postes de travail', 'Workstation support provider', 'Dienstleister für den Arbeitsplatz-Support', 'Proveedor de soporte de los puestos de trabajo', 'Fornitore di supporto delle postazioni di lavoro'), 'PRESTATAIRE', 2, 3, 2, 3),
  me(BURO, L('Comptes du prestataire de support limités aux postes, sans droits d’administration du domaine', 'Support provider accounts limited to workstations, without domain administration rights', 'Konten des Support-Dienstleisters auf Arbeitsplätze beschränkt, ohne Domänen-Administratorrechte', 'Cuentas del proveedor de soporte limitadas a los puestos, sin derechos de administración del dominio', 'Account del fornitore di supporto limitati alle postazioni, senza diritti di amministrazione del dominio'), 'TECHNIQUE', '8.2',
    L('Un compte de support volé ne donne pas tout le SI', 'A stolen support account does not give away the whole IS', 'Ein gestohlenes Support-Konto gibt nicht das ganze IS preis', 'Una cuenta de soporte robada no da acceso a todo el SI', 'Un account di supporto rubato non dà accesso a tutto il SI')),

  // ═══ SI de très petite entreprise ═══
  ae(TPE, 'ACCES_INITIAL', 'T1133', L('Connexion à un accès à distance laissé ouvert avec un mot de passe par défaut', 'Connection to a remote access left open with a default password', 'Verbindung zu einem offen gelassenen Fernzugang mit Standardpasswort', 'Conexión a un acceso remoto dejado abierto con una contraseña por defecto', 'Connessione a un accesso remoto lasciato aperto con una password predefinita'),
    L('Box, NAS ou logiciel de prise de main exposés', 'Exposed router, NAS or remote-control software', 'Erreichbarer Router, NAS oder Fernsteuerungssoftware', 'Router, NAS o software de control remoto expuestos', 'Router, NAS o software di controllo remoto esposti')),
  me(TPE, L('Contrat avec le prestataire informatique : sauvegardes, mises à jour et délai d’intervention écrits', 'Contract with the IT provider: backups, updates and response time in writing', 'Vertrag mit dem IT-Dienstleister: Sicherungen, Updates und Reaktionszeit schriftlich festgelegt', 'Contrato con el proveedor informático: copias de seguridad, actualizaciones y plazo de intervención por escrito', 'Contratto con il fornitore informatico: backup, aggiornamenti e tempi di intervento per iscritto'), 'ORGANISATIONNELLE', '5.20',
    L('Ce qui n’est pas écrit n’est souvent pas fait', 'What is not written is often not done', 'Was nicht schriftlich festgelegt ist, wird oft nicht getan', 'Lo que no está escrito a menudo no se hace', 'Ciò che non è scritto spesso non viene fatto')),

  // ═══ SI sensible ═══
  sr(SENS, L('Service de renseignement étranger visant les informations sensibles', 'Foreign intelligence service targeting sensitive information', 'Ausländischer Nachrichtendienst, der es auf sensible Informationen abgesehen hat', 'Servicio de inteligencia extranjero que busca información sensible', 'Servizio di intelligence straniero che punta alle informazioni sensibili'), 'ETAT_NATION',
    L('Acteur patient et discret, prêt à investir longtemps pour une cible précise', 'Patient and discreet actor, ready to invest a long time in a specific target', 'Geduldiger und unauffälliger Akteur, der lange in ein bestimmtes Ziel investiert', 'Actor paciente y discreto, dispuesto a invertir mucho tiempo en un objetivo concreto', 'Attore paziente e discreto, pronto a investire a lungo su un obiettivo preciso'),
    L('Espionnage', 'Espionage', 'Spionage', 'Espionaje', 'Spionaggio'),
    L('Moyens importants, attaques ciblées et persistantes', 'Substantial means, targeted and persistent attacks', 'Erhebliche Mittel, gezielte und hartnäckige Angriffe', 'Medios importantes, ataques dirigidos y persistentes', 'Mezzi importanti, attacchi mirati e persistenti'), 3),
  ae(SENS, 'EXFILTRATION', 'T1041', L('Exfiltration lente de documents sensibles par un canal discret', 'Slow exfiltration of sensitive documents through a discreet channel', 'Langsame Exfiltration sensibler Dokumente über einen unauffälligen Kanal', 'Exfiltración lenta de documentos sensibles por un canal discreto', 'Esfiltrazione lenta di documenti sensibili tramite un canale discreto'),
    L('Volumes faibles pour échapper à la détection', 'Small volumes to evade detection', 'Geringe Mengen, um der Erkennung zu entgehen', 'Volúmenes reducidos para eludir la detección', 'Volumi ridotti per sfuggire al rilevamento')),
]
