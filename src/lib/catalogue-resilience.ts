/**
 * Plans de test de résilience MODÈLES (catalogue 1.6) pour le programme de tests DORA
 * (Règlement (UE) 2022/2554, art. 24-25 ; cf. tests-resilience.ts). Un modèle crée un test
 * PLANIFIÉ de l'année en cours, à qualifier : ni date, ni testeur, ni résultat, ni constat,
 * et AUCUNE présomption de fonction critique ou importante ni d'indépendance.
 * Le TLPT (art. 26) n'est jamais proposé : son périmètre et sa fréquence relèvent de l'autorité.
 * Incidents : aucun modèle — les typologies d'événement et de perte sont déjà un catalogue
 * éditable (incidents-config.ts) et un incident n'est jamais suggéré (spec § A.2).
 */
import type { CatalogueItem, Localized } from './sector-suggestions'

const l = (fr: string, en: string, de: string, es: string, it: string): Localized => ({ fr, en, de, es, it })
const t = (sector: CatalogueItem['sector'], key: string, title: Localized, processKey: string, testType: NonNullable<CatalogueItem['testType']>): CatalogueItem =>
  ({ key, sector, kind: 'RESILIENCE_TEST', title, processKey, testType })

export const RESILIENCE_TEST_TEMPLATES: CatalogueItem[] = [
  t('TRANSVERSAL', 'core.resilience.vulnerability-scan', l('Analyse de vulnérabilités des systèmes exposés sur Internet', 'Vulnerability scan of internet-facing systems', 'Schwachstellenscan der aus dem Internet erreichbaren Systeme', 'Análisis de vulnerabilidades de los sistemas expuestos a Internet', 'Scansione delle vulnerabilità dei sistemi esposti su Internet'), 'core.process.digital.patch', 'VULNERABILITY'),
  t('TRANSVERSAL', 'core.resilience.ransomware-restore', l('Exercice de reprise après rançongiciel : restauration des données essentielles', 'Ransomware recovery exercise: restoring essential data', 'Wiederanlaufübung nach Ransomware: Wiederherstellung wesentlicher Daten', 'Ejercicio de recuperación tras ransomware: restauración de los datos esenciales', 'Esercitazione di ripristino dopo ransomware: recupero dei dati essenziali'), 'core.process.digital.backup', 'SCENARIO'),
  t('TRANSVERSAL', 'core.resilience.network-segmentation', l('Évaluation du cloisonnement et des flux du réseau interne', 'Assessment of internal network segmentation and flows', 'Bewertung der Segmentierung und Datenflüsse des internen Netzes', 'Evaluación de la segmentación y los flujos de la red interna', 'Valutazione della segmentazione e dei flussi della rete interna'), 'core.process.digital', 'NETWORK_SECURITY'),
  t('TRANSVERSAL', 'core.resilience.pentest', l('Test d’intrusion d’une application exposée', 'Penetration test of an internet-facing application', 'Penetrationstest einer aus dem Internet erreichbaren Anwendung', 'Prueba de intrusión de una aplicación expuesta', 'Test di penetrazione di un’applicazione esposta'), 'core.process.digital', 'PENETRATION'),
  t('TRANSVERSAL', 'core.resilience.supplier-failure', l('Exercice de défaillance d’un prestataire TIC essentiel', 'Exercise simulating the failure of an essential ICT provider', 'Übung zum Ausfall eines wesentlichen IKT-Dienstleisters', 'Ejercicio de fallo de un proveedor TIC esencial', 'Esercitazione sul guasto di un fornitore TIC essenziale'), 'core.process.buy', 'SCENARIO'),
  t('TRANSVERSAL', 'core.resilience.physical-review', l('Revue de la sécurité physique des salles informatiques', 'Physical security review of server rooms', 'Überprüfung der physischen Sicherheit der Serverräume', 'Revisión de la seguridad física de las salas informáticas', 'Revisione della sicurezza fisica delle sale server'), 'core.process.digital', 'PHYSICAL_SECURITY'),
  t('TRANSVERSAL', 'core.resilience.source-code', l('Revue du code source d’une application développée en interne', 'Source code review of an in-house application', 'Quellcodeprüfung einer selbst entwickelten Anwendung', 'Revisión del código fuente de una aplicación desarrollada internamente', 'Revisione del codice sorgente di un’applicazione sviluppata internamente'), 'core.process.digital', 'SOURCE_CODE'),

  t('FINANCE', 'finance.resilience.payment-end-to-end', l('Test de bout en bout de la chaîne de paiement', 'End-to-end test of the payment chain', 'End-to-End-Test der Zahlungskette', 'Prueba de extremo a extremo de la cadena de pagos', 'Test end-to-end della catena dei pagamenti'), 'finance.process.payments', 'END_TO_END'),
  t('FINANCE', 'finance.resilience.channel-load', l('Test de performance des canaux bancaires numériques en pic de charge', 'Peak-load performance test of digital banking channels', 'Lasttest der digitalen Bankkanäle unter Spitzenlast', 'Prueba de rendimiento de los canales de banca digital en pico de carga', 'Test di prestazione dei canali bancari digitali nei picchi di carico'), 'finance.process.channels', 'PERFORMANCE'),
  t('ASSURANCE', 'assurance.resilience.claims-continuity', l('Exercice de continuité de la gestion des sinistres', 'Business continuity exercise for claims handling', 'Kontinuitätsübung für die Schadenbearbeitung', 'Ejercicio de continuidad de la gestión de siniestros', 'Esercitazione di continuità della gestione dei sinistri'), 'assurance.process.claims', 'SCENARIO'),
  t('ASSURANCE', 'assurance.resilience.broker-interface', l('Test de compatibilité des échanges avec les distributeurs', 'Compatibility test of data exchanges with distributors', 'Kompatibilitätstest des Datenaustauschs mit Vertriebspartnern', 'Prueba de compatibilidad de los intercambios con los distribuidores', 'Test di compatibilità degli scambi con i distributori'), 'assurance.process.brokers', 'COMPATIBILITY'),
]
