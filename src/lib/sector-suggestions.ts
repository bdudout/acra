/**
 * Exemples métier proposés, jamais instanciés automatiquement. Les identifiants
 * sont stables entre langues et versions ; les libellés peuvent évoluer.
 * Aucune cotation, obligation réputée satisfaite ou contrepartie fictive.
 */
export const SECTOR_CODES = ['FINANCE', 'ASSURANCE', 'SANTE', 'PUBLIC', 'SAAS', 'INDUSTRIE', 'COMMERCE', 'SERVICES'] as const
export type SectorCode = (typeof SECTOR_CODES)[number]
export type CatalogueLocale = 'fr' | 'en' | 'de' | 'es' | 'it'
type Localized = Record<CatalogueLocale, string>
type CatalogueItem = {
  key: string
  sector: SectorCode | 'TRANSVERSAL'
  kind: 'PROCESS' | 'RISK'
  title: Localized
  parentKey?: string
  processKey?: string
}
export type SectorSuggestion = Omit<CatalogueItem, 'title'> & { title: string; packVersion: string }

const l = (fr: string, en: string, de: string, es: string, it: string): Localized => ({ fr, en, de, es, it })
const p = (key: string, sector: CatalogueItem['sector'], title: Localized, parentKey?: string): CatalogueItem => ({ key, sector, kind: 'PROCESS', title, parentKey })
const r = (key: string, sector: CatalogueItem['sector'], title: Localized, processKey: string): CatalogueItem => ({ key, sector, kind: 'RISK', title, processKey })

// Le socle transversal décrit des activités communes, pas une organisation idéale.
const TRANSVERSAL: CatalogueItem[] = [
  p('core.process.govern', 'TRANSVERSAL', l('Piloter les activités et les risques', 'Govern operations and risks', 'Betrieb und Risiken steuern', 'Dirigir actividades y riesgos', 'Governare attività e rischi')),
  p('core.process.finance', 'TRANSVERSAL', l('Gérer les finances et les paiements', 'Manage finance and payments', 'Finanzen und Zahlungen verwalten', 'Gestionar finanzas y pagos', 'Gestire finanze e pagamenti')),
  p('core.process.people', 'TRANSVERSAL', l('Gérer les collaborateurs', 'Manage people', 'Personal verwalten', 'Gestionar el personal', 'Gestire il personale')),
  p('core.process.buy', 'TRANSVERSAL', l('Acheter et piloter les fournisseurs', 'Buy and manage suppliers', 'Beschaffung und Lieferanten steuern', 'Comprar y gestionar proveedores', 'Acquistare e gestire fornitori')),
  p('core.process.digital', 'TRANSVERSAL', l('Exploiter les systèmes et les données', 'Operate systems and data', 'Systeme und Daten betreiben', 'Operar sistemas y datos', 'Gestire sistemi e dati')),
  p('core.process.deliver', 'TRANSVERSAL', l('Fournir les produits ou services', 'Deliver products or services', 'Produkte oder Dienste bereitstellen', 'Prestar productos o servicios', 'Erogare prodotti o servizi')),
  r('core.risk.payment-fraud', 'TRANSVERSAL', l('Un paiement est détourné après usurpation d’identité', 'A payment is diverted through impersonation', 'Eine Zahlung wird durch Identitätsmissbrauch umgeleitet', 'Un pago se desvía mediante suplantación de identidad', 'Un pagamento viene dirottato tramite furto di identità'), 'core.process.finance'),
  r('core.risk.ransomware', 'TRANSVERSAL', l('Un rançongiciel interrompt les activités essentielles', 'Ransomware disrupts essential operations', 'Ransomware unterbricht wesentliche Abläufe', 'Un ransomware interrumpe operaciones esenciales', 'Un ransomware interrompe le attività essenziali'), 'core.process.digital'),
  r('core.risk.supplier-outage', 'TRANSVERSAL', l('Un fournisseur essentiel devient indisponible', 'An essential supplier becomes unavailable', 'Ein wesentlicher Lieferant fällt aus', 'Un proveedor esencial deja de estar disponible', 'Un fornitore essenziale diventa indisponibile'), 'core.process.buy'),
  r('core.risk.data-leak', 'TRANSVERSAL', l('Des données sensibles sont divulguées', 'Sensitive data is disclosed', 'Vertrauliche Daten werden offengelegt', 'Se divulgan datos sensibles', 'Vengono divulgati dati sensibili'), 'core.process.digital'),
  r('core.risk.key-person', 'TRANSVERSAL', l('Une compétence clé devient indisponible sans relève', 'A key skill becomes unavailable without backup', 'Eine Schlüsselkompetenz fällt ohne Vertretung aus', 'Falta una competencia clave sin sustitución', 'Una competenza chiave manca senza sostituzione'), 'core.process.people'),
  r('core.risk.process-error', 'TRANSVERSAL', l('Une erreur de traitement affecte un service livré', 'A processing error affects a delivered service', 'Ein Bearbeitungsfehler beeinträchtigt eine Dienstleistung', 'Un error de proceso afecta a un servicio prestado', 'Un errore di processo compromette un servizio erogato'), 'core.process.deliver'),
]

const SECTOR_ITEMS: CatalogueItem[] = [
  // Finance : paiement, comptes, financement et relation client plutôt que conformité présumée.
  p('finance.process.payments', 'FINANCE', l('Exécuter les paiements', 'Execute payments', 'Zahlungen ausführen', 'Ejecutar pagos', 'Eseguire pagamenti'), 'core.process.deliver'),
  p('finance.process.accounts', 'FINANCE', l('Tenir les comptes clients', 'Maintain customer accounts', 'Kundenkonten führen', 'Mantener cuentas de clientes', 'Gestire i conti dei clienti'), 'core.process.deliver'),
  p('finance.process.credit', 'FINANCE', l('Octroyer et suivre les financements', 'Originate and monitor credit', 'Kredite vergeben und überwachen', 'Conceder y supervisar créditos', 'Erogare e monitorare finanziamenti'), 'core.process.deliver'),
  p('finance.process.channels', 'FINANCE', l('Exploiter les canaux bancaires numériques', 'Operate digital banking channels', 'Digitale Bankkanäle betreiben', 'Operar canales bancarios digitales', 'Gestire i canali bancari digitali'), 'core.process.digital'),
  r('finance.risk.payment-routing', 'FINANCE', l('Un paiement est envoyé au mauvais bénéficiaire', 'A payment reaches the wrong beneficiary', 'Eine Zahlung erreicht den falschen Empfänger', 'Un pago llega al beneficiario equivocado', 'Un pagamento raggiunge il beneficiario errato'), 'finance.process.payments'),
  r('finance.risk.account-takeover', 'FINANCE', l('Un compte client est pris en main frauduleusement', 'A customer account is taken over fraudulently', 'Ein Kundenkonto wird betrügerisch übernommen', 'Se toma el control fraudulento de una cuenta de cliente', 'Un conto cliente viene acquisito fraudolentemente'), 'finance.process.accounts'),
  r('finance.risk.credit-data', 'FINANCE', l('Une décision de financement repose sur des données erronées', 'A credit decision relies on incorrect data', 'Eine Kreditentscheidung beruht auf falschen Daten', 'Una decisión de crédito se basa en datos erróneos', 'Una decisione di credito si basa su dati errati'), 'finance.process.credit'),
  r('finance.risk.channel-outage', 'FINANCE', l('La banque en ligne devient indisponible', 'Digital banking becomes unavailable', 'Online-Banking ist nicht verfügbar', 'La banca en línea deja de estar disponible', 'La banca online non è disponibile'), 'finance.process.channels'),
  r('finance.risk.reconciliation', 'FINANCE', l('Des opérations ne sont pas rapprochées à temps', 'Transactions are not reconciled in time', 'Transaktionen werden nicht rechtzeitig abgeglichen', 'Las operaciones no se concilian a tiempo', 'Le operazioni non vengono riconciliate in tempo'), 'finance.process.payments'),

  p('assurance.process.underwrite', 'ASSURANCE', l('Souscrire et tarifer les contrats', 'Underwrite and price policies', 'Verträge zeichnen und tarifieren', 'Suscribir y tarificar pólizas', 'Sottoscrivere e prezzare polizze'), 'core.process.deliver'),
  p('assurance.process.claims', 'ASSURANCE', l('Gérer les sinistres et indemnisations', 'Handle claims and settlements', 'Schäden und Entschädigungen bearbeiten', 'Gestionar siniestros e indemnizaciones', 'Gestire sinistri e indennizzi'), 'core.process.deliver'),
  p('assurance.process.brokers', 'ASSURANCE', l('Animer les courtiers et distributeurs', 'Manage brokers and distributors', 'Makler und Vertriebspartner betreuen', 'Gestionar corredores y distribuidores', 'Gestire broker e distributori'), 'core.process.buy'),
  p('assurance.process.policy', 'ASSURANCE', l('Administrer les contrats en cours', 'Administer active policies', 'Laufende Verträge verwalten', 'Administrar pólizas vigentes', 'Amministrare polizze attive'), 'core.process.deliver'),
  r('assurance.risk.claim-fraud', 'ASSURANCE', l('Un sinistre frauduleux est indemnisé', 'A fraudulent claim is paid', 'Ein betrügerischer Schaden wird ausgezahlt', 'Se paga un siniestro fraudulento', 'Un sinistro fraudolento viene liquidato'), 'assurance.process.claims'),
  r('assurance.risk.claim-delay', 'ASSURANCE', l('Un sinistre légitime est traité trop tard', 'A valid claim is handled too late', 'Ein berechtigter Schaden wird zu spät bearbeitet', 'Un siniestro legítimo se tramita demasiado tarde', 'Un sinistro legittimo viene gestito troppo tardi'), 'assurance.process.claims'),
  r('assurance.risk.pricing', 'ASSURANCE', l('Une erreur de tarification déséquilibre un portefeuille', 'A pricing error harms a portfolio', 'Ein Tarifierungsfehler belastet ein Portfolio', 'Un error de tarificación perjudica la cartera', 'Un errore di prezzo danneggia il portafoglio'), 'assurance.process.underwrite'),
  r('assurance.risk.broker-data', 'ASSURANCE', l('Un distributeur transmet des données client inexactes', 'A distributor supplies inaccurate customer data', 'Ein Vertriebspartner liefert fehlerhafte Kundendaten', 'Un distribuidor envía datos inexactos de clientes', 'Un distributore invia dati cliente inesatti'), 'assurance.process.brokers'),
  r('assurance.risk.policy-change', 'ASSURANCE', l('Une modification de contrat n’est pas appliquée', 'A policy change is not applied', 'Eine Vertragsänderung wird nicht umgesetzt', 'No se aplica un cambio de póliza', 'Una modifica di polizza non viene applicata'), 'assurance.process.policy'),

  p('sante.process.care', 'SANTE', l('Prendre en charge les patients', 'Provide patient care', 'Patienten versorgen', 'Atender a los pacientes', 'Assistere i pazienti'), 'core.process.deliver'),
  p('sante.process.records', 'SANTE', l('Gérer les dossiers de santé', 'Manage health records', 'Gesundheitsakten verwalten', 'Gestionar historias clínicas', 'Gestire le cartelle cliniche'), 'core.process.digital'),
  p('sante.process.lab', 'SANTE', l('Réaliser les examens et résultats', 'Perform tests and report results', 'Untersuchungen durchführen und Ergebnisse melden', 'Realizar pruebas y comunicar resultados', 'Eseguire esami e comunicare risultati'), 'core.process.deliver'),
  p('sante.process.supply', 'SANTE', l('Approvisionner médicaments et dispositifs', 'Supply medicines and devices', 'Arzneimittel und Geräte bereitstellen', 'Suministrar medicamentos y dispositivos', 'Fornire farmaci e dispositivi'), 'core.process.buy'),
  r('sante.risk.patient-data', 'SANTE', l('Des données de santé de patients sont divulguées', 'Patient health data is disclosed', 'Gesundheitsdaten von Patienten werden offengelegt', 'Se divulgan datos de salud de pacientes', 'Vengono divulgati dati sanitari dei pazienti'), 'sante.process.records'),
  r('sante.risk.care-outage', 'SANTE', l('Une panne retarde la prise en charge', 'An outage delays patient care', 'Ein Ausfall verzögert die Versorgung', 'Una avería retrasa la atención', 'Un guasto ritarda l’assistenza'), 'sante.process.care'),
  r('sante.risk.result-error', 'SANTE', l('Un résultat d’examen est attribué au mauvais patient', 'A test result is assigned to the wrong patient', 'Ein Befund wird dem falschen Patienten zugeordnet', 'Un resultado se asigna al paciente equivocado', 'Un referto viene attribuito al paziente sbagliato'), 'sante.process.lab'),
  r('sante.risk.stockout', 'SANTE', l('Une rupture de stock perturbe les soins', 'A stockout disrupts care', 'Ein Lieferengpass beeinträchtigt die Versorgung', 'Una falta de existencias interrumpe la atención', 'Una carenza di scorte interrompe le cure'), 'sante.process.supply'),
  r('sante.risk.record-integrity', 'SANTE', l('Un dossier de santé est altéré ou incomplet', 'A health record is altered or incomplete', 'Eine Gesundheitsakte ist verändert oder unvollständig', 'Una historia clínica está alterada o incompleta', 'Una cartella clinica è alterata o incompleta'), 'sante.process.records'),

  p('public.process.citizens', 'PUBLIC', l('Rendre les services aux usagers', 'Deliver citizen services', 'Dienstleistungen für Bürger erbringen', 'Prestar servicios a la ciudadanía', 'Erogare servizi ai cittadini'), 'core.process.deliver'),
  p('public.process.grants', 'PUBLIC', l('Instruire les aides et subventions', 'Process grants and subsidies', 'Förderungen und Zuschüsse bearbeiten', 'Tramitar ayudas y subvenciones', 'Gestire aiuti e sovvenzioni'), 'core.process.finance'),
  p('public.process.identity', 'PUBLIC', l('Gérer les identités et accès des usagers', 'Manage citizen identities and access', 'Identitäten und Zugänge der Bürger verwalten', 'Gestionar identidades y accesos de usuarios', 'Gestire identità e accessi dei cittadini'), 'core.process.digital'),
  p('public.process.local', 'PUBLIC', l('Assurer la continuité des services territoriaux', 'Maintain local public services', 'Lokale öffentliche Dienste aufrechterhalten', 'Mantener servicios públicos locales', 'Mantenere i servizi pubblici locali'), 'core.process.deliver'),
  r('public.risk.portal-outage', 'PUBLIC', l('Un portail public devient indisponible', 'A public portal becomes unavailable', 'Ein Bürgerportal fällt aus', 'Un portal público deja de estar disponible', 'Un portale pubblico non è disponibile'), 'public.process.citizens'),
  r('public.risk.identity', 'PUBLIC', l('Une identité usager est usurpée', 'A citizen identity is impersonated', 'Eine Bürgeridentität wird missbraucht', 'Se suplanta la identidad de un usuario', 'L’identità di un cittadino viene usurpata'), 'public.process.identity'),
  r('public.risk.grant-error', 'PUBLIC', l('Une aide est versée à tort ou refusée à tort', 'A grant is paid or denied incorrectly', 'Eine Förderung wird falsch ausgezahlt oder verweigert', 'Una ayuda se paga o deniega erróneamente', 'Un contributo viene erogato o negato erroneamente'), 'public.process.grants'),
  r('public.risk.local-outage', 'PUBLIC', l('Une interruption prive les usagers d’un service local', 'An outage deprives citizens of a local service', 'Ein Ausfall entzieht Bürgern einen lokalen Dienst', 'Una interrupción priva a la ciudadanía de un servicio local', 'Un’interruzione priva i cittadini di un servizio locale'), 'public.process.local'),
  r('public.risk.case-leak', 'PUBLIC', l('Des dossiers administratifs sont divulgués', 'Administrative files are disclosed', 'Verwaltungsakten werden offengelegt', 'Se divulgan expedientes administrativos', 'Vengono divulgati fascicoli amministrativi'), 'public.process.citizens'),

  p('saas.process.build', 'SAAS', l('Développer et livrer le logiciel', 'Build and deliver software', 'Software entwickeln und ausliefern', 'Desarrollar y entregar software', 'Sviluppare e distribuire software'), 'core.process.deliver'),
  p('saas.process.host', 'SAAS', l('Héberger et exploiter la plateforme', 'Host and operate the platform', 'Plattform hosten und betreiben', 'Alojar y operar la plataforma', 'Ospitare e gestire la piattaforma'), 'core.process.digital'),
  p('saas.process.support', 'SAAS', l('Assister les clients et résoudre les incidents', 'Support customers and resolve incidents', 'Kunden unterstützen und Störungen beheben', 'Atender a clientes y resolver incidencias', 'Assistere i clienti e risolvere incidenti'), 'core.process.deliver'),
  p('saas.process.onboard', 'SAAS', l('Configurer et intégrer les nouveaux clients', 'Configure and onboard new customers', 'Neue Kunden einrichten und integrieren', 'Configurar e incorporar nuevos clientes', 'Configurare e integrare nuovi clienti'), 'core.process.deliver'),
  r('saas.risk.release', 'SAAS', l('Une mise en production interrompt des clients', 'A release disrupts customers', 'Ein Release unterbricht Kundendienste', 'Una versión interrumpe servicios a clientes', 'Un rilascio interrompe i servizi ai clienti'), 'saas.process.build'),
  r('saas.risk.tenant-isolation', 'SAAS', l('Les données d’un client deviennent visibles à un autre', 'One customer sees another customer’s data', 'Ein Kunde sieht Daten eines anderen Kunden', 'Un cliente ve datos de otro cliente', 'Un cliente vede i dati di un altro cliente'), 'saas.process.host'),
  r('saas.risk.cloud-outage', 'SAAS', l('Une dépendance cloud rend la plateforme indisponible', 'A cloud dependency makes the platform unavailable', 'Eine Cloud-Abhängigkeit legt die Plattform lahm', 'Una dependencia de nube deja inactiva la plataforma', 'Una dipendenza cloud rende indisponibile la piattaforma'), 'saas.process.host'),
  r('saas.risk.support-access', 'SAAS', l('Un accès de support expose des données client', 'Support access exposes customer data', 'Support-Zugriff legt Kundendaten offen', 'El acceso de soporte expone datos de clientes', 'L’accesso di supporto espone dati cliente'), 'saas.process.support'),
  r('saas.risk.integration', 'SAAS', l('Une intégration client échoue sans détection', 'A customer integration fails undetected', 'Eine Kundenintegration scheitert unbemerkt', 'Una integración de cliente falla sin detectarse', 'Un’integrazione cliente fallisce senza essere rilevata'), 'saas.process.onboard'),

  p('industrie.process.produce', 'INDUSTRIE', l('Produire et assembler', 'Manufacture and assemble', 'Produzieren und montieren', 'Producir y ensamblar', 'Produrre e assemblare'), 'core.process.deliver'),
  p('industrie.process.maintain', 'INDUSTRIE', l('Maintenir les équipements industriels', 'Maintain industrial equipment', 'Industrieanlagen instand halten', 'Mantener equipos industriales', 'Manutenere impianti industriali'), 'core.process.deliver'),
  p('industrie.process.quality', 'INDUSTRIE', l('Contrôler la qualité des produits', 'Control product quality', 'Produktqualität prüfen', 'Controlar la calidad del producto', 'Controllare la qualità dei prodotti'), 'core.process.deliver'),
  p('industrie.process.supply', 'INDUSTRIE', l('Planifier les approvisionnements', 'Plan supplies', 'Beschaffung planen', 'Planificar suministros', 'Pianificare gli approvvigionamenti'), 'core.process.buy'),
  r('industrie.risk.ot-stop', 'INDUSTRIE', l('Une panne ou intrusion arrête la production', 'An outage or intrusion stops production', 'Ein Ausfall oder Angriff stoppt die Produktion', 'Una avería o intrusión detiene la producción', 'Un guasto o attacco ferma la produzione'), 'industrie.process.produce'),
  r('industrie.risk.quality', 'INDUSTRIE', l('Un lot défectueux échappe au contrôle qualité', 'A defective batch passes quality checks', 'Eine fehlerhafte Charge besteht die Qualitätskontrolle', 'Un lote defectuoso supera el control de calidad', 'Un lotto difettoso supera il controllo qualità'), 'industrie.process.quality'),
  r('industrie.risk.spares', 'INDUSTRIE', l('Une pièce de rechange critique manque', 'A critical spare part is unavailable', 'Ein kritisches Ersatzteil fehlt', 'Falta una pieza de repuesto crítica', 'Manca un ricambio critico'), 'industrie.process.maintain'),
  r('industrie.risk.supplier', 'INDUSTRIE', l('Une rupture fournisseur bloque une ligne de production', 'A supplier disruption blocks a production line', 'Ein Lieferausfall blockiert eine Produktionslinie', 'Una interrupción del proveedor bloquea una línea', 'Un’interruzione del fornitore blocca una linea'), 'industrie.process.supply'),
  r('industrie.risk.traceability', 'INDUSTRIE', l('La traçabilité d’un lot devient incomplète', 'A batch loses traceability', 'Die Rückverfolgbarkeit einer Charge geht verloren', 'Se pierde la trazabilidad de un lote', 'Si perde la tracciabilità di un lotto'), 'industrie.process.quality'),

  p('commerce.process.sell', 'COMMERCE', l('Vendre et encaisser', 'Sell and collect payments', 'Verkaufen und Zahlungen einziehen', 'Vender y cobrar', 'Vendere e incassare'), 'core.process.deliver'),
  p('commerce.process.stock', 'COMMERCE', l('Gérer les stocks et réassorts', 'Manage inventory and replenishment', 'Bestände und Nachschub verwalten', 'Gestionar inventario y reposición', 'Gestire scorte e riordini'), 'core.process.buy'),
  p('commerce.process.ship', 'COMMERCE', l('Préparer et livrer les commandes', 'Prepare and deliver orders', 'Bestellungen vorbereiten und liefern', 'Preparar y entregar pedidos', 'Preparare e consegnare ordini'), 'core.process.deliver'),
  p('commerce.process.returns', 'COMMERCE', l('Traiter les retours et réclamations', 'Handle returns and complaints', 'Retouren und Beschwerden bearbeiten', 'Gestionar devoluciones y reclamaciones', 'Gestire resi e reclami'), 'core.process.deliver'),
  r('commerce.risk.checkout', 'COMMERCE', l('Une panne d’encaissement bloque les ventes', 'A checkout outage blocks sales', 'Ein Kassenausfall blockiert Verkäufe', 'Una avería de caja bloquea las ventas', 'Un guasto alle casse blocca le vendite'), 'commerce.process.sell'),
  r('commerce.risk.stock', 'COMMERCE', l('Un stock erroné provoque des ventes impossibles', 'Incorrect inventory causes unfulfillable sales', 'Falsche Bestände führen zu unerfüllbaren Verkäufen', 'Un inventario erróneo causa ventas imposibles', 'Scorte errate causano vendite non evadibili'), 'commerce.process.stock'),
  r('commerce.risk.delivery', 'COMMERCE', l('Des commandes sont livrées au mauvais destinataire', 'Orders are delivered to the wrong recipient', 'Bestellungen gehen an den falschen Empfänger', 'Se entregan pedidos al destinatario equivocado', 'Gli ordini sono consegnati al destinatario errato'), 'commerce.process.ship'),
  r('commerce.risk.customer-data', 'COMMERCE', l('Des données clients ou de paiement sont divulguées', 'Customer or payment data is disclosed', 'Kunden- oder Zahlungsdaten werden offengelegt', 'Se divulgan datos de clientes o pagos', 'Vengono divulgati dati clienti o di pagamento'), 'commerce.process.sell'),
  r('commerce.risk.returns', 'COMMERCE', l('Un retour client n’est pas traité correctement', 'A customer return is mishandled', 'Eine Kundenretoure wird falsch bearbeitet', 'Se gestiona mal una devolución', 'Un reso cliente viene gestito male'), 'commerce.process.returns'),

  p('services.process.contract', 'SERVICES', l('Contractualiser les missions clients', 'Contract customer engagements', 'Kundenaufträge vertraglich vereinbaren', 'Contratar encargos de clientes', 'Contrattualizzare incarichi cliente'), 'core.process.deliver'),
  p('services.process.perform', 'SERVICES', l('Réaliser les prestations', 'Perform customer services', 'Kundenleistungen erbringen', 'Prestar servicios al cliente', 'Erogare prestazioni ai clienti'), 'core.process.deliver'),
  p('services.process.bill', 'SERVICES', l('Facturer et suivre les encaissements', 'Bill and collect fees', 'Leistungen abrechnen und Zahlungen verfolgen', 'Facturar y cobrar honorarios', 'Fatturare e incassare compensi'), 'core.process.finance'),
  p('services.process.knowledge', 'SERVICES', l('Gérer les dossiers et connaissances', 'Manage cases and knowledge', 'Akten und Wissen verwalten', 'Gestionar expedientes y conocimiento', 'Gestire pratiche e conoscenza'), 'core.process.digital'),
  r('services.risk.deadline', 'SERVICES', l('Une échéance client importante est manquée', 'An important customer deadline is missed', 'Eine wichtige Kundenfrist wird versäumt', 'Se incumple un plazo importante del cliente', 'Si perde una scadenza importante del cliente'), 'services.process.perform'),
  r('services.risk.confidentiality', 'SERVICES', l('Un dossier client confidentiel est divulgué', 'A confidential customer file is disclosed', 'Eine vertrauliche Kundenakte wird offengelegt', 'Se divulga un expediente confidencial', 'Un fascicolo cliente riservato viene divulgato'), 'services.process.knowledge'),
  r('services.risk.scope', 'SERVICES', l('Une mission est réalisée hors du périmètre convenu', 'Work is delivered outside the agreed scope', 'Eine Leistung überschreitet den vereinbarten Umfang', 'Se presta un servicio fuera del alcance acordado', 'Una prestazione esce dal perimetro concordato'), 'services.process.contract'),
  r('services.risk.billing', 'SERVICES', l('Une prestation n’est pas facturée ou l’est deux fois', 'A service is not billed or is billed twice', 'Eine Leistung wird nicht oder doppelt abgerechnet', 'Un servicio no se factura o se factura dos veces', 'Una prestazione non viene fatturata o lo è due volte'), 'services.process.bill'),
  r('services.risk.expertise', 'SERVICES', l('Une expertise nécessaire manque pendant la mission', 'Needed expertise is unavailable during a project', 'Erforderliches Fachwissen fehlt während eines Auftrags', 'Falta experiencia necesaria durante un encargo', 'Manca una competenza necessaria durante l’incarico'), 'services.process.perform'),
]

export const CATALOGUE_PACK_VERSION = '1.0'

/** Jusqu'à trois activités déclarées ; aucune n'est déduite automatiquement. */
export function sanitizeSectorSelection(value: unknown): SectorCode[] | null {
  if (!Array.isArray(value) || value.length > 3 || value.some(code => typeof code !== 'string' || !SECTOR_CODES.includes(code as SectorCode))) return null
  return [...new Set(value as SectorCode[])]
}

/** Socle + pack choisi ; sans secteur, seul le socle est retourné. */
export function listSectorSuggestions(sector: SectorCode | null, locale: CatalogueLocale): SectorSuggestion[] {
  const items = sector ? [...TRANSVERSAL, ...SECTOR_ITEMS.filter(item => item.sector === sector)] : TRANSVERSAL
  return items.map(({ title, ...item }) => ({ ...item, title: title[locale], packVersion: CATALOGUE_PACK_VERSION }))
}

export function searchSectorSuggestions(sector: SectorCode | null, locale: CatalogueLocale, query: string): SectorSuggestion[] {
  const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
  const words = normalized(query).split(/\s+/).filter(Boolean)
  return listSectorSuggestions(sector, locale).filter(item => words.every(word => normalized(item.title).includes(word)))
}
