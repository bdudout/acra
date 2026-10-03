/**
 * patterns-archi.ts — Patterns d'architecture de SI (docs/specs/patterns-architecture-besoins.md, lot A1).
 *
 * Secteur et sous-secteurs = vision MÉTIER ; patterns d'architecture = vision TECHNIQUE (forme du système étudié :
 * exposition, zones, interconnexions, administration, postes, sensibilité). Les deux se combinent ; aucun ne remplace
 * l'autre. Un pattern coché complète les exemples et les suggestions du secteur et des sous-secteurs.
 *
 * Codes STABLES (jamais renommés ; un pattern retiré reste lu). Libellés et aides dans les 5 langues dans la donnée.
 * Module pur → testé (patterns-archi.test.ts).
 */
import type { Locale } from '@/lib/i18n'

type Tr = readonly [fr: string, en: string, de: string, es: string, it: string]
const L = (fr: string, en: string, de: string, es: string, it: string): Tr => [fr, en, de, es, it]
const IDX: Record<Locale, number> = { fr: 0, en: 1, de: 2, es: 3, it: 4 }

export type PatternFamilyId = 'exposition' | 'interco' | 'admin' | 'postes' | 'sensibilite'

export const PATTERN_FAMILIES: ReadonlyArray<{ id: PatternFamilyId; label: Tr }> = [
  { id: 'exposition', label: L('Exposition et zones de sécurité', 'Exposure and security zones', 'Exposition und Sicherheitszonen', 'Exposición y zonas de seguridad', 'Esposizione e zone di sicurezza') },
  { id: 'interco', label: L('Interconnexions, tiers et externalisation', 'Interconnections, third parties and outsourcing', 'Verbindungen, Dritte und Auslagerung', 'Interconexiones, terceros y externalización', 'Interconnessioni, terze parti ed esternalizzazione') },
  { id: 'admin', label: L('Administration et exploitation', 'Administration and operations', 'Administration und Betrieb', 'Administración y explotación', 'Amministrazione ed esercizio') },
  { id: 'postes', label: L('Postes et usages', 'Workstations and usage', 'Arbeitsplätze und Nutzung', 'Puestos y usos', 'Postazioni e usi') },
  { id: 'sensibilite', label: L('Sensibilité et systèmes particuliers', 'Sensitivity and particular systems', 'Schutzbedarf und besondere Systeme', 'Sensibilidad y sistemas particulares', 'Sensibilità e sistemi particolari') },
]

export interface ArchiPattern { code: string; family: PatternFamilyId; lot: 1 | 2; label: Tr; help: Tr }
const P = (code: string, family: PatternFamilyId, lot: 1 | 2, label: Tr, help: Tr): ArchiPattern => ({ code, family, lot, label, help })

export const ARCHI_PATTERNS: readonly ArchiPattern[] = [
  // ── Exposition et zones de sécurité ───────────────────────────────────────────────────────────
  P('EXPOSITION_INTERNET', 'exposition', 1,
    L('Exposition sur Internet', 'Internet exposure', 'Exposition im Internet', 'Exposición en Internet', 'Esposizione su Internet'),
    L('Site, portail, téléservice ou API publique joignable depuis Internet.', 'Website, portal, online service or public API reachable from the Internet.', 'Website, Portal, Online-Dienst oder öffentliche API, aus dem Internet erreichbar.', 'Sitio, portal, servicio en línea o API pública accesible desde Internet.', 'Sito, portale, servizio online o API pubblica raggiungibile da Internet.')),
  P('DMZ', 'exposition', 1,
    L('Zone démilitarisée (DMZ)', 'Demilitarised zone (DMZ)', 'Demilitarisierte Zone (DMZ)', 'Zona desmilitarizada (DMZ)', 'Zona demilitarizzata (DMZ)'),
    L('Frontaux, reverse proxy, relais et filtrage entre Internet et le SI interne.', 'Front ends, reverse proxies, relays and filtering between the Internet and the internal IS.', 'Frontends, Reverse-Proxys, Relays und Filterung zwischen Internet und internem IS.', 'Frontales, proxy inverso, relés y filtrado entre Internet y el SI interno.', 'Frontend, reverse proxy, relay e filtraggio tra Internet e SI interno.')),
  P('ZONE_CONFIANCE', 'exposition', 1,
    L('Zone de confiance', 'Trusted zone', 'Vertrauenswürdige Zone', 'Zona de confianza', 'Zona di fiducia'),
    L('Cœur de SI hébergeant les données et traitements les plus sensibles, accès restreint.', 'Core IS hosting the most sensitive data and processing, restricted access.', 'Kern-IS mit den sensibelsten Daten und Verarbeitungen, eingeschränkter Zugriff.', 'Núcleo del SI que aloja los datos y tratamientos más sensibles, acceso restringido.', 'Nucleo del SI che ospita i dati e i trattamenti più sensibili, accesso ristretto.')),
  P('ZONE_MOINDRE_CONFIANCE', 'exposition', 1,
    L('Zone de moindre confiance', 'Lower-trust zone', 'Zone mit geringerem Vertrauen', 'Zona de menor confianza', 'Zona a minore fiducia'),
    L('Réseau invités, BYOD, laboratoire, partenaires sur site, équipements non maîtrisés.', 'Guest network, BYOD, laboratory, partners on site, unmanaged equipment.', 'Gästenetz, BYOD, Labor, Partner vor Ort, nicht kontrollierte Geräte.', 'Red de invitados, BYOD, laboratorio, socios in situ, equipos no controlados.', 'Rete ospiti, BYOD, laboratorio, partner in sede, apparecchiature non controllate.')),
  P('ACCES_DISTANT', 'exposition', 1,
    L('Accès distant des utilisateurs', 'Remote access for users', 'Fernzugriff der Benutzer', 'Acceso remoto de los usuarios', 'Accesso remoto degli utenti'),
    L('Télétravail, VPN, accès « zero trust », nomadisme.', 'Remote work, VPN, zero-trust access, mobility.', 'Telearbeit, VPN, Zero-Trust-Zugang, mobiles Arbeiten.', 'Teletrabajo, VPN, acceso «zero trust», movilidad.', 'Telelavoro, VPN, accesso «zero trust», mobilità.')),
  P('APPLICATIONS_MOBILES', 'exposition', 2,
    L('Applications et terminaux mobiles', 'Mobile applications and devices', 'Mobile Anwendungen und Geräte', 'Aplicaciones y terminales móviles', 'Applicazioni e terminali mobili'),
    L('Application grand public, flotte de terminaux, gestion de flotte (MDM).', 'Consumer application, device fleet, mobile device management (MDM).', 'Verbraucher-App, Geräteflotte, Mobile-Device-Management (MDM).', 'Aplicación para el público, flota de terminales, gestión de flota (MDM).', 'Applicazione per il pubblico, flotta di terminali, gestione della flotta (MDM).')),
  // ── Interconnexions, tiers et externalisation ─────────────────────────────────────────────────
  P('INTERCO_TIERS', 'interco', 1,
    L('Interconnexion avec un tiers', 'Interconnection with a third party', 'Verbindung mit einem Dritten', 'Interconexión con un tercero', 'Interconnessione con una terza parte'),
    L('Flux réseau ou applicatifs avec un partenaire, une filiale ou un délégataire (entrants et sortants).', 'Network or application flows with a partner, subsidiary or delegate (inbound and outbound).', 'Netzwerk- oder Anwendungsflüsse mit Partner, Tochter oder Delegierten (ein- und ausgehend).', 'Flujos de red o aplicativos con un socio, una filial o un delegado (entrantes y salientes).', 'Flussi di rete o applicativi con un partner, una controllata o un delegato (in entrata e in uscita).')),
  P('API_PARTENAIRES', 'interco', 1,
    L('API exposées à des partenaires', 'APIs exposed to partners', 'Für Partner bereitgestellte APIs', 'API expuestas a socios', 'API esposte ai partner'),
    L('API authentifiées pour clients ou partenaires, passerelle d’API.', 'Authenticated APIs for customers or partners, API gateway.', 'Authentifizierte APIs für Kunden oder Partner, API-Gateway.', 'API autenticadas para clientes o socios, pasarela de API.', 'API autenticate per clienti o partner, gateway API.')),
  P('ECHANGE_FICHIERS', 'interco', 1,
    L('Transfert de fichiers et intégration', 'File transfer and integration', 'Dateiübertragung und Integration', 'Transferencia de ficheros e integración', 'Trasferimento di file e integrazione'),
    L('Transfert de fichiers géré (MFT), SFTP, bus, ETL, traitements par lots entre SI.', 'Managed file transfer (MFT), SFTP, bus, ETL, batch processing between IS.', 'Managed File Transfer (MFT), SFTP, Bus, ETL, Batchverarbeitung zwischen IS.', 'Transferencia gestionada de ficheros (MFT), SFTP, bus, ETL, procesos por lotes entre SI.', 'Trasferimento file gestito (MFT), SFTP, bus, ETL, elaborazioni batch tra SI.')),
  P('EXTERNALISATION_DONNEES', 'interco', 1,
    L('Externalisation avec échange de données', 'Outsourcing with data exchange', 'Auslagerung mit Datenaustausch', 'Externalización con intercambio de datos', 'Esternalizzazione con scambio di dati'),
    L('Infogérance, sous-traitance d’un processus, prestataire qui reçoit ou livre des données.', 'Managed services, process outsourcing, provider that receives or delivers data.', 'Managed Services, Prozess-Auslagerung, Dienstleister, der Daten erhält oder liefert.', 'Gestión externalizada, subcontratación de un proceso, proveedor que recibe o entrega datos.', 'Servizi gestiti, esternalizzazione di un processo, fornitore che riceve o consegna dati.')),
  P('TELEMAINTENANCE', 'interco', 1,
    L('Télémaintenance', 'Remote maintenance', 'Fernwartung', 'Telemantenimiento', 'Teleassistenza'),
    L('Intervention à distance d’un éditeur, d’un constructeur ou d’un prestataire.', 'Remote intervention by a software vendor, manufacturer or service provider.', 'Fernzugriff eines Softwareherstellers, Geräteherstellers oder Dienstleisters.', 'Intervención remota de un editor, fabricante o prestador.', 'Intervento da remoto di un fornitore software, un costruttore o un prestatore.')),
  P('CLOUD_SAAS', 'interco', 2,
    L('Services en ligne (SaaS)', 'Online services (SaaS)', 'Online-Dienste (SaaS)', 'Servicios en línea (SaaS)', 'Servizi online (SaaS)'),
    L('Messagerie, outils collaboratifs, applications métier en ligne.', 'Messaging, collaboration tools, online business applications.', 'Messaging, Kollaborationswerkzeuge, Online-Fachanwendungen.', 'Mensajería, herramientas colaborativas, aplicaciones de negocio en línea.', 'Messaggistica, strumenti collaborativi, applicazioni aziendali online.')),
  P('CLOUD_IAAS_PAAS', 'interco', 2,
    L('Hébergement en nuage (IaaS / PaaS)', 'Cloud hosting (IaaS / PaaS)', 'Cloud-Hosting (IaaS / PaaS)', 'Alojamiento en la nube (IaaS / PaaS)', 'Hosting cloud (IaaS / PaaS)'),
    L('Infrastructure ou plateforme chez un fournisseur de nuage.', 'Infrastructure or platform at a cloud provider.', 'Infrastruktur oder Plattform bei einem Cloud-Anbieter.', 'Infraestructura o plataforma en un proveedor de nube.', 'Infrastruttura o piattaforma presso un fornitore cloud.')),
  // ── Administration et exploitation ────────────────────────────────────────────────────────────
  P('SI_ADMINISTRATION', 'admin', 1,
    L('Système d’administration', 'Administration system', 'Administrationssystem', 'Sistema de administración', 'Sistema di amministrazione'),
    L('Bastion, postes d’administration dédiés, annuaire, outils de déploiement, comptes à privilèges.', 'Bastion host, dedicated admin workstations, directory, deployment tools, privileged accounts.', 'Bastion-Host, dedizierte Admin-Arbeitsplätze, Verzeichnisdienst, Deployment-Werkzeuge, privilegierte Konten.', 'Bastión, puestos de administración dedicados, directorio, herramientas de despliegue, cuentas con privilegios.', 'Bastion, postazioni di amministrazione dedicate, directory, strumenti di distribuzione, account privilegiati.')),
  P('FLUX_INTERNES_DC', 'admin', 1,
    L('Flux internes au datacenter', 'Data-centre internal flows', 'Interne Flüsse im Rechenzentrum', 'Flujos internos del centro de datos', 'Flussi interni al datacenter'),
    L('Flux « est-ouest » entre serveurs, segmentation, micro-segmentation.', 'East-west flows between servers, segmentation, micro-segmentation.', '„Ost-West“-Flüsse zwischen Servern, Segmentierung, Mikrosegmentierung.', 'Flujos «este-oeste» entre servidores, segmentación, microsegmentación.', 'Flussi «est-ovest» tra server, segmentazione, microsegmentazione.')),
  P('SAUVEGARDE', 'admin', 2,
    L('Infrastructure de sauvegarde', 'Backup infrastructure', 'Backup-Infrastruktur', 'Infraestructura de copia de seguridad', 'Infrastruttura di backup'),
    L('Sauvegardes, copies hors ligne, restauration.', 'Backups, offline copies, restoration.', 'Sicherungen, Offline-Kopien, Wiederherstellung.', 'Copias de seguridad, copias fuera de línea, restauración.', 'Backup, copie offline, ripristino.')),
  P('SUPERVISION', 'admin', 2,
    L('Journalisation et supervision', 'Logging and monitoring', 'Protokollierung und Überwachung', 'Registro y supervisión', 'Registrazione e monitoraggio'),
    L('Collecte des journaux, SIEM, SOC interne ou externalisé.', 'Log collection, SIEM, in-house or outsourced SOC.', 'Log-Erfassung, SIEM, internes oder ausgelagertes SOC.', 'Recogida de registros, SIEM, SOC interno o externalizado.', 'Raccolta dei log, SIEM, SOC interno o esternalizzato.')),
  // ── Postes et usages ──────────────────────────────────────────────────────────────────────────
  P('BUREAUTIQUE', 'postes', 1,
    L('SI bureautique', 'Office IT', 'Büro-IT', 'SI ofimático', 'SI d’ufficio'),
    L('Postes de travail, messagerie, partage de fichiers, impression.', 'Workstations, e-mail, file sharing, printing.', 'Arbeitsplätze, E-Mail, Dateifreigabe, Druck.', 'Puestos de trabajo, correo, compartición de ficheros, impresión.', 'Postazioni di lavoro, posta elettronica, condivisione di file, stampa.')),
  P('SI_TPE', 'postes', 1,
    L('SI de très petite entreprise', 'Very small business IT', 'IT eines Kleinstunternehmens', 'SI de muy pequeña empresa', 'SI di microimpresa'),
    L('Peu ou pas de compétence interne, box internet, NAS, prestataire unique, comptes partagés.', 'Little or no in-house skills, consumer router, NAS, single provider, shared accounts.', 'Wenig oder keine interne Kompetenz, Consumer-Router, NAS, ein einziger Dienstleister, gemeinsame Konten.', 'Poca o ninguna competencia interna, router doméstico, NAS, proveedor único, cuentas compartidas.', 'Poche o nessuna competenze interne, router domestico, NAS, fornitore unico, account condivisi.')),
  P('IA_SERVICES', 'postes', 2,
    L('Usage de services d’IA', 'Use of AI services', 'Nutzung von KI-Diensten', 'Uso de servicios de IA', 'Uso di servizi di IA'),
    L('Assistants, IA générative, modèles hébergés ou en ligne.', 'Assistants, generative AI, hosted or online models.', 'Assistenten, generative KI, gehostete oder Online-Modelle.', 'Asistentes, IA generativa, modelos alojados o en línea.', 'Assistenti, IA generativa, modelli ospitati o online.')),
  // ── Sensibilité et systèmes particuliers ──────────────────────────────────────────────────────
  P('SI_SENSIBLE', 'sensibilite', 1,
    L('SI sensible', 'Sensitive IS', 'Sensibles IS', 'SI sensible', 'SI sensibile'),
    L('SI traitant des informations sensibles, soumis à homologation renforcée, cloisonné.', 'IS handling sensitive information, subject to reinforced accreditation, compartmentalised.', 'IS mit sensiblen Informationen, verstärkter Akkreditierung unterworfen, abgeschottet.', 'SI que trata información sensible, sometido a homologación reforzada, compartimentado.', 'SI che tratta informazioni sensibili, soggetto a omologazione rafforzata, compartimentato.')),
  P('SI_ISOLE', 'sensibilite', 2,
    L('SI isolé ou déconnecté', 'Isolated or disconnected IS', 'Isoliertes oder getrenntes IS', 'SI aislado o desconectado', 'SI isolato o disconnesso'),
    L('Réseau sans lien avec Internet, échanges par support amovible ou passerelle.', 'Network with no Internet link, exchanges through removable media or gateway.', 'Netz ohne Internetanbindung, Austausch über Wechselmedien oder Gateway.', 'Red sin enlace con Internet, intercambios mediante soporte extraíble o pasarela.', 'Rete senza collegamento a Internet, scambi tramite supporti rimovibili o gateway.')),
  P('SI_INDUSTRIEL', 'sensibilite', 2,
    L('Systèmes industriels et objets connectés', 'Industrial systems and connected objects', 'Industrielle Systeme und vernetzte Objekte', 'Sistemas industriales y objetos conectados', 'Sistemi industriali e oggetti connessi'),
    L('Automates, supervision industrielle, IoT, systèmes embarqués.', 'PLCs, industrial supervision, IoT, embedded systems.', 'SPS, industrielle Überwachung, IoT, eingebettete Systeme.', 'Autómatas, supervisión industrial, IoT, sistemas embebidos.', 'PLC, supervisione industriale, IoT, sistemi embedded.')),
  P('SI_PATRIMONIAL', 'sensibilite', 2,
    L('Patrimoine applicatif ancien', 'Legacy application estate', 'Alte Anwendungslandschaft', 'Patrimonio aplicativo antiguo', 'Patrimonio applicativo datato'),
    L('Grands systèmes, applications obsolètes, systèmes hors support.', 'Mainframes, obsolete applications, unsupported systems.', 'Großrechner, veraltete Anwendungen, nicht mehr unterstützte Systeme.', 'Grandes sistemas, aplicaciones obsoletas, sistemas fuera de soporte.', 'Grandi sistemi, applicazioni obsolete, sistemi fuori supporto.')),
]

const BY_CODE = new Map(ARCHI_PATTERNS.map(p => [p.code, p]))
export const LOT1_CODES: readonly string[] = ARCHI_PATTERNS.filter(p => p.lot === 1).map(p => p.code)

export const PATTERNS_MAX_DEFAULT = 12
export const PATTERNS_MAX_MIN = 1
export const PATTERNS_MAX_MAX = 24

export function isPatternCode(v: unknown): v is string { return typeof v === 'string' && BY_CODE.has(v) }
export function patternLabel(code: string, locale: Locale = 'fr'): string { return BY_CODE.get(code)?.label[IDX[locale] ?? 0] ?? code }
export function patternHelp(code: string, locale: Locale = 'fr'): string { return BY_CODE.get(code)?.help[IDX[locale] ?? 0] ?? '' }
export function familyLabel(id: PatternFamilyId, locale: Locale = 'fr'): string { return PATTERN_FAMILIES.find(f => f.id === id)?.label[IDX[locale] ?? 0] ?? id }

/** Patterns regroupés par famille (ordre du référentiel), pour la sélection par cases à cocher. */
export function patternsByFamily(): Array<{ family: (typeof PATTERN_FAMILIES)[number]; patterns: ArchiPattern[] }> {
  return PATTERN_FAMILIES.map(family => ({ family, patterns: ARCHI_PATTERNS.filter(p => p.family === family.id) }))
}

/** Plafond de sélection : entier de 1 à 24, défaut 12 (valeur invalide ⇒ défaut). */
export function clampPatternsMax(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return PATTERNS_MAX_DEFAULT
  return Math.min(PATTERNS_MAX_MAX, Math.max(PATTERNS_MAX_MIN, Math.floor(v)))
}

/**
 * Sélection assainie : codes connus, sans doublon, ordre conservé. `strict` : une liste plus longue que le plafond est
 * refusée (`patterns_too_many`, pour l'API) ; sinon elle est tronquée (affichage tolérant).
 */
export function normalizePatterns(input: unknown, opts: { max?: number; strict?: boolean } = {}): string[] {
  if (!Array.isArray(input)) return []
  const max = clampPatternsMax(opts.max ?? PATTERNS_MAX_DEFAULT)
  const out: string[] = []
  for (const v of input) if (isPatternCode(v) && !out.includes(v)) out.push(v)
  if (out.length > max) { if (opts.strict) throw new Error('patterns_too_many'); return out.slice(0, max) }
  return out
}

/**
 * Lecture prudente d'une cellule d'import : les codes stables sont préférés,
 * mais les libellés affichés dans les cinq langues sont aussi reconnus. Les
 * séparateurs sont explicites (virgule, point-virgule, barre ou retour ligne) ;
 * un texte qui ne correspond à aucun pattern est ignoré, jamais deviné.
 */
export function parseImportedPatterns(value: unknown): string[] {
  if (typeof value !== 'string') return []
  const canonical = (input: string) => input.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
  const byLabel = new Map<string, string>()
  for (const pattern of ARCHI_PATTERNS) for (const label of pattern.label) byLabel.set(canonical(label), pattern.code)
  const codes = value.split(/[;,|\n]/).map(part => {
    const candidate = part.trim().toUpperCase()
    return isPatternCode(candidate) ? candidate : byLabel.get(canonical(part))
  }).filter((code): code is string => Boolean(code))
  return normalizePatterns(codes, { max: PATTERNS_MAX_MAX })
}

/** Patterns d'une analyse (colonne JSON `patternsArchi`), assainis ; absente ⇒ []. */
export function patternsOf(a: { patternsArchi?: unknown } | null | undefined): string[] {
  return a ? normalizePatterns(a.patternsArchi, { max: PATTERNS_MAX_MAX }) : []
}
