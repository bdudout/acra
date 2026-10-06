// ─── Risques présents par défaut dans tout projet 360 (PUR) ───────────────────
// Un projet porte presque toujours les mêmes risques de base (délais, budget, ressources, adhésion, RGPD, prestataire,
// sécurité, mise en service) : ils sont créés avec le projet — chacun avec une mesure à mettre en œuvre et un plan
// d'action (qualification avec l'expert compétent) —, supprimables un à un. L'administrateur de l'organisation
// en désactive et en ajoute dans Configuration › Projets (`OrganizationConfig.risquesProjetDefaut`, hérité).
// Marqués par `Risque.qualificationRuleId = "socle:<code>"` (pas de doublon, badge « par défaut »).
// Testé : projet360-socle.test.ts.

import type { Locale } from '@/lib/i18n'
import { isDomaine360, type Domaine360 } from '@/lib/projet360'
import type { MesureType } from '@/lib/risque-mesure'

type Tr = readonly [fr: string, en: string, de: string, es: string, it: string]
const L = (fr: string, en: string, de: string, es: string, it: string): Tr => [fr, en, de, es, it]
const IDX: Record<Locale, number> = { fr: 0, en: 1, de: 2, es: 3, it: 4 }

export const SOCLE_RULE_PREFIX = 'socle:'
export const SOCLE_MAX_AJOUTES = 30

/** Plan d'action créé avec le risque : la démarche à mener avec l'expert compétent (qualification par les bons acteurs). */
export interface PlanSocle { titre: Tr; description: Tr }
/** Mesure créée avec le risque (à mettre en œuvre) : le dispositif attendu pour réduire le risque. */
export interface MesureSocle { type: MesureType; nom: Tr }
export interface RisqueSocle { code: string; domaine: Domaine360; gravite: number; vraisemblance: number; intitule: Tr; mesure: MesureSocle; plan: PlanSocle }

export const RISQUES_PROJET_SOCLE: readonly RisqueSocle[] = [
  { code: 'PROJ_DELAIS', domaine: 'PROJECT', gravite: 3, vraisemblance: 3,
    intitule: L('Dérive du planning : le projet ne tient pas ses jalons', 'Schedule slippage: the project misses its milestones', 'Terminverzug: Das Projekt hält seine Meilensteine nicht ein', 'Desviación del calendario: el proyecto no cumple sus hitos', 'Slittamento della pianificazione: il progetto non rispetta le milestone'),
    mesure: { type: 'ORGANISATIONNELLE', nom: L('Comité de pilotage régulier avec suivi des jalons et des écarts', 'Regular steering committee tracking milestones and variances', 'Regelmäßiger Lenkungsausschuss mit Verfolgung von Meilensteinen und Abweichungen', 'Comité de dirección periódico con seguimiento de hitos y desviaciones', 'Comitato di pilotaggio periodico con monitoraggio di milestone e scostamenti') },
    plan: { titre: L('Valider le planning et le chemin critique avec le PMO ou le sponsor', 'Validate the schedule and critical path with the PMO or sponsor', 'Zeitplan und kritischen Pfad mit dem PMO oder dem Sponsor abstimmen', 'Validar el calendario y el camino crítico con la PMO o el patrocinador', 'Validare la pianificazione e il percorso critico con il PMO o lo sponsor'), description: L('Jalons, dépendances et marges revus avec le PMO ; critères de report décidés à l’avance.', 'Milestones, dependencies and buffers reviewed with the PMO; postponement criteria decided in advance.', 'Meilensteine, Abhängigkeiten und Puffer mit dem PMO geprüft; Kriterien für Verschiebungen vorab festgelegt.', 'Hitos, dependencias y márgenes revisados con la PMO; criterios de aplazamiento decididos de antemano.', 'Milestone, dipendenze e margini rivisti con il PMO; criteri di rinvio decisi in anticipo.') } },
  { code: 'PROJ_BUDGET', domaine: 'PROJECT', gravite: 3, vraisemblance: 2,
    intitule: L('Dépassement du budget du projet', 'Project budget overrun', 'Überschreitung des Projektbudgets', 'Sobrecoste del presupuesto del proyecto', 'Superamento del budget del progetto'),
    mesure: { type: 'ORGANISATIONNELLE', nom: L('Suivi budgétaire mensuel avec seuils d’alerte et réserve pour aléas', 'Monthly budget tracking with alert thresholds and a contingency reserve', 'Monatliche Budgetverfolgung mit Warnschwellen und Risikoreserve', 'Seguimiento presupuestario mensual con umbrales de alerta y reserva para imprevistos', 'Monitoraggio mensile del budget con soglie di allerta e riserva per imprevisti') },
    plan: { titre: L('Faire valider le budget et ses provisions par le contrôle de gestion', 'Have the budget and its contingencies approved by management control', 'Budget und Reserven vom Controlling freigeben lassen', 'Hacer validar el presupuesto y sus provisiones por el control de gestión', 'Far validare il budget e gli accantonamenti dal controllo di gestione'), description: L('Hypothèses de coût, provisions pour aléas et seuils d’alerte validés et suivis à chaque comité.', 'Cost assumptions, contingencies and alert thresholds approved and tracked at each steering committee.', 'Kostenannahmen, Risikoreserven und Warnschwellen freigegeben und in jedem Lenkungsausschuss verfolgt.', 'Hipótesis de coste, provisiones para imprevistos y umbrales de alerta validados y seguidos en cada comité.', 'Ipotesi di costo, accantonamenti per imprevisti e soglie di allerta validati e seguiti a ogni comitato.') } },
  { code: 'PROJ_RESSOURCES', domaine: 'PROJECT', gravite: 3, vraisemblance: 2,
    intitule: L('Indisponibilité ou départ de compétences clés du projet', 'Unavailability or departure of key project skills', 'Ausfall oder Weggang von Schlüsselkompetenzen des Projekts', 'Indisponibilidad o salida de competencias clave del proyecto', 'Indisponibilità o uscita di competenze chiave del progetto'),
    mesure: { type: 'ORGANISATIONNELLE', nom: L('Suppléance désignée et documentation partagée pour chaque compétence clé', 'Named back-up and shared documentation for each key skill', 'Benannte Vertretung und gemeinsame Dokumentation für jede Schlüsselkompetenz', 'Suplente designado y documentación compartida para cada competencia clave', 'Sostituto designato e documentazione condivisa per ogni competenza chiave') },
    plan: { titre: L('Identifier les compétences clés et leurs suppléants avec les managers concernés', 'Identify key skills and their back-ups with the managers concerned', 'Schlüsselkompetenzen und deren Vertretungen mit den zuständigen Führungskräften festlegen', 'Identificar las competencias clave y sus suplentes con los responsables afectados', 'Individuare le competenze chiave e i relativi sostituti con i responsabili interessati'), description: L('Liste des personnes indispensables, disponibilité confirmée par leur hiérarchie, suppléant désigné pour chacune.', 'List of indispensable people, availability confirmed by their managers, a back-up named for each.', 'Liste der unverzichtbaren Personen, Verfügbarkeit von den Vorgesetzten bestätigt, je eine Vertretung benannt.', 'Lista de personas indispensables, disponibilidad confirmada por su jerarquía, un suplente designado para cada una.', 'Elenco delle persone indispensabili, disponibilità confermata dai responsabili, un sostituto designato per ciascuna.') } },
  { code: 'PROJ_ADHESION', domaine: 'BUSINESS', gravite: 2, vraisemblance: 3,
    intitule: L('Adhésion insuffisante des utilisateurs, conduite du changement mal préparée', 'Insufficient user buy-in, poorly prepared change management', 'Unzureichende Akzeptanz bei den Nutzern, schlecht vorbereitetes Change-Management', 'Adhesión insuficiente de los usuarios, gestión del cambio mal preparada', 'Adesione insufficiente degli utenti, gestione del cambiamento mal preparata'),
    mesure: { type: 'ORGANISATIONNELLE', nom: L('Formation et accompagnement des utilisateurs avant la mise en service', 'User training and support before go-live', 'Schulung und Begleitung der Nutzer vor der Inbetriebnahme', 'Formación y acompañamiento de los usuarios antes de la puesta en servicio', 'Formazione e affiancamento degli utenti prima dell’avvio') },
    plan: { titre: L('Construire le plan de conduite du changement avec les représentants des métiers', 'Build the change management plan with business representatives', 'Change-Management-Plan mit Vertretern der Fachbereiche erstellen', 'Elaborar el plan de gestión del cambio con los representantes de negocio', 'Costruire il piano di gestione del cambiamento con i rappresentanti del business'), description: L('Utilisateurs clés associés dès la conception ; formation, communication et accompagnement planifiés.', 'Key users involved from design; training, communication and support planned.', 'Schlüsselnutzer ab der Konzeption eingebunden; Schulung, Kommunikation und Begleitung geplant.', 'Usuarios clave implicados desde el diseño; formación, comunicación y acompañamiento planificados.', 'Utenti chiave coinvolti fin dalla progettazione; formazione, comunicazione e affiancamento pianificati.') } },
  { code: 'PROJ_RGPD', domaine: 'BUSINESS', gravite: 3, vraisemblance: 2,
    intitule: L('Traitement de données personnelles non conforme au RGPD (registre, information des personnes, analyse d’impact)', 'Processing of personal data not compliant with the GDPR (records, information of data subjects, impact assessment)', 'Verarbeitung personenbezogener Daten nicht DSGVO-konform (Verzeichnis, Information der Betroffenen, Folgenabschätzung)', 'Tratamiento de datos personales no conforme con el RGPD (registro, información a los interesados, evaluación de impacto)', 'Trattamento di dati personali non conforme al GDPR (registro, informativa agli interessati, valutazione d’impatto)'),
    mesure: { type: 'ORGANISATIONNELLE', nom: L('Registre des activités de traitement et information des personnes concernées à jour avant la mise en production', 'Records of processing activities and information of data subjects up to date before go-live', 'Verzeichnis von Verarbeitungstätigkeiten und Information der betroffenen Personen vor der Inbetriebnahme aktualisiert', 'Registro de las actividades de tratamiento e información a los interesados actualizados antes de la puesta en producción', 'Registro delle attività di trattamento e informativa agli interessati aggiornati prima della messa in produzione') },
    plan: { titre: L('Faire qualifier le traitement de données personnelles par le DPO', 'Have the personal data processing assessed by the DPO', 'Verarbeitung personenbezogener Daten vom Datenschutzbeauftragten (DPO) bewerten lassen', 'Hacer evaluar el tratamiento de datos personales por el DPO', 'Far valutare il trattamento dei dati personali dal DPO'), description: L('Inscription au registre, information des personnes, base légale ; analyse d’impact si le DPO l’estime nécessaire.', 'Entry in the records, information of data subjects, legal basis; impact assessment if the DPO deems it necessary.', 'Eintrag ins Verzeichnis, Information der Betroffenen, Rechtsgrundlage; Folgenabschätzung, falls der DPO sie für nötig hält.', 'Inscripción en el registro, información a los interesados, base jurídica; evaluación de impacto si el DPO la considera necesaria.', 'Iscrizione nel registro, informativa agli interessati, base giuridica; valutazione d’impatto se il DPO la ritiene necessaria.') } },
  { code: 'PROJ_PRESTATAIRE', domaine: 'OUTSOURCING', gravite: 3, vraisemblance: 2,
    intitule: L('Défaillance d’un prestataire ou d’un fournisseur clé du projet', 'Failure of a key project provider or supplier', 'Ausfall eines wichtigen Dienstleisters oder Lieferanten des Projekts', 'Fallo de un proveedor o suministrador clave del proyecto', 'Inadempienza di un fornitore chiave del progetto'),
    mesure: { type: 'PREVENTIVE', nom: L('Clauses contractuelles de niveau de service, de sécurité et de réversibilité', 'Contract clauses on service levels, security and reversibility', 'Vertragsklauseln zu Service-Levels, Sicherheit und Reversibilität', 'Cláusulas contractuales de nivel de servicio, seguridad y reversibilidad', 'Clausole contrattuali su livelli di servizio, sicurezza e reversibilità') },
    plan: { titre: L('Faire valider les clauses du contrat par les achats et le juridique', 'Have the contract clauses approved by procurement and legal', 'Vertragsklauseln von Einkauf und Rechtsabteilung freigeben lassen', 'Hacer validar las cláusulas del contrato por compras y jurídico', 'Far validare le clausole del contratto da acquisti e ufficio legale'), description: L('Engagements de service, sécurité, réversibilité et continuité du prestataire vérifiés avant signature.', 'Provider service commitments, security, reversibility and continuity checked before signature.', 'Leistungszusagen, Sicherheit, Reversibilität und Kontinuität des Dienstleisters vor Unterzeichnung geprüft.', 'Compromisos de servicio, seguridad, reversibilidad y continuidad del proveedor verificados antes de la firma.', 'Impegni di servizio, sicurezza, reversibilità e continuità del fornitore verificati prima della firma.') } },
  { code: 'PROJ_SECURITE', domaine: 'CYBER', gravite: 3, vraisemblance: 2,
    intitule: L('Exigences de sécurité non prises en compte dans le projet (conception, tests, homologation)', 'Security requirements not addressed in the project (design, testing, accreditation)', 'Sicherheitsanforderungen im Projekt nicht berücksichtigt (Konzeption, Tests, Freigabe)', 'Requisitos de seguridad no tenidos en cuenta en el proyecto (diseño, pruebas, homologación)', 'Requisiti di sicurezza non considerati nel progetto (progettazione, test, omologazione)'),
    mesure: { type: 'TECHNIQUE', nom: L('Tests de sécurité (revue de configuration, test d’intrusion) avant la mise en service', 'Security testing (configuration review, penetration test) before go-live', 'Sicherheitstests (Konfigurationsprüfung, Penetrationstest) vor der Inbetriebnahme', 'Pruebas de seguridad (revisión de configuración, prueba de intrusión) antes de la puesta en servicio', 'Test di sicurezza (revisione della configurazione, penetration test) prima dell’avvio') },
    plan: { titre: L('Faire valider les exigences de sécurité et le besoin d’homologation par le RSSI', 'Have security requirements and the need for accreditation approved by the CISO', 'Sicherheitsanforderungen und Freigabebedarf vom CISO (RSSI) bestätigen lassen', 'Hacer validar los requisitos de seguridad y la necesidad de homologación por el CISO (RSSI)', 'Far validare i requisiti di sicurezza e la necessità di omologazione dal CISO (RSSI)'), description: L('Exigences intégrées à la conception, tests de sécurité prévus avant la mise en service, décision d’homologation si requise.', 'Requirements built into the design, security tests planned before go-live, accreditation decision if required.', 'Anforderungen in die Konzeption integriert, Sicherheitstests vor Inbetriebnahme geplant, Freigabeentscheidung falls erforderlich.', 'Requisitos integrados en el diseño, pruebas de seguridad previstas antes de la puesta en servicio, decisión de homologación si procede.', 'Requisiti integrati nella progettazione, test di sicurezza previsti prima dell’avvio, decisione di omologazione se richiesta.') } },
  { code: 'PROJ_MISE_EN_SERVICE', domaine: 'IT', gravite: 3, vraisemblance: 2,
    intitule: L('Mise en service perturbée : reprise de données incomplète ou retour arrière impossible', 'Disrupted go-live: incomplete data migration or no possible rollback', 'Gestörte Inbetriebnahme: unvollständige Datenübernahme oder kein Rückfall möglich', 'Puesta en servicio perturbada: migración de datos incompleta o vuelta atrás imposible', 'Messa in servizio disturbata: migrazione dei dati incompleta o ritorno indietro impossibile'),
    mesure: { type: 'TECHNIQUE', nom: L('Répétition de la bascule et procédure de retour arrière testée', 'Cut-over rehearsal and tested rollback procedure', 'Generalprobe der Umstellung und getestetes Rückfallverfahren', 'Ensayo de la migración y procedimiento de vuelta atrás probado', 'Prova generale del passaggio e procedura di ritorno indietro testata') },
    plan: { titre: L('Valider le plan de bascule et de retour arrière avec l’exploitation', 'Validate the cut-over and rollback plan with IT operations', 'Umstellungs- und Rückfallplan mit dem IT-Betrieb abstimmen', 'Validar el plan de migración y de vuelta atrás con explotación', 'Validare il piano di passaggio e di ritorno indietro con l’esercizio'), description: L('Reprise de données testée, critères de bascule et de retour arrière écrits, répétition avant la date cible.', 'Data migration tested, cut-over and rollback criteria written, rehearsal before the target date.', 'Datenübernahme getestet, Umstellungs- und Rückfallkriterien schriftlich festgelegt, Generalprobe vor dem Zieldatum.', 'Migración de datos probada, criterios de migración y de vuelta atrás escritos, ensayo antes de la fecha objetivo.', 'Migrazione dei dati testata, criteri di passaggio e di ritorno scritti, prova generale prima della data obiettivo.') } },
]
/** Risques proposés par le questionnaire 360 qui font double emploi avec un risque par défaut (même risque, autre libellé). */
export const SOCLE_EQUIVALENTS: Readonly<Record<string, readonly string[]>> = {
  PROJ_DELAIS: ['p360-derivePlanning'],
  PROJ_BUDGET: ['p360-depassementBudget'],
  PROJ_ADHESION: ['p360-adoption'],
  PROJ_PRESTATAIRE: ['p360-defaillancePrestataire'],
}
/** Règles du questionnaire 360 couvertes par ces risques par défaut (ruleIds « socle:<code> »). */
export function reglesEquivalentesSocle(socleRuleIds: readonly string[]): string[] {
  return socleRuleIds.flatMap(id => (id.startsWith(SOCLE_RULE_PREFIX) ? SOCLE_EQUIVALENTS[id.slice(SOCLE_RULE_PREFIX.length)] ?? [] : []))
}
const CODES = new Set(RISQUES_PROJET_SOCLE.map(r => r.code))

export interface RisqueSocleAjoute { id: string; intitule: string; domaine: Domaine360 | null; gravite: number; vraisemblance: number; plan?: string; mesure?: string }
export interface SocleConfig { desactives: string[]; ajoutes: RisqueSocleAjoute[] }

const borne = (v: unknown, max: number) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(1, n)) : 2
}

/** Configuration assainie : codes connus, risques ajoutés bornés (identifiant généré si absent), 30 au plus. */
export function sanitizeSocleConfig(input: unknown): SocleConfig {
  const o = input && typeof input === 'object' ? input as { desactives?: unknown; ajoutes?: unknown } : {}
  const desactives = [...new Set((Array.isArray(o.desactives) ? o.desactives : []).filter((c): c is string => typeof c === 'string' && CODES.has(c)))]
  const ajoutes: RisqueSocleAjoute[] = []
  const ids = new Set<string>()
  for (const [i, raw] of (Array.isArray(o.ajoutes) ? o.ajoutes : []).entries()) {
    if (!raw || typeof raw !== 'object') continue
    const a = raw as Record<string, unknown>
    const intitule = typeof a.intitule === 'string' ? a.intitule.trim().slice(0, 200) : ''
    if (!intitule) continue
    let id = typeof a.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(a.id) ? a.id : `r${i + 1}`
    while (ids.has(id)) id = `${id}_`
    ids.add(id)
    const plan = typeof a.plan === 'string' ? a.plan.trim().slice(0, 200) : ''
    const mesure = typeof a.mesure === 'string' ? a.mesure.trim().slice(0, 200) : ''
    ajoutes.push({ id, intitule, domaine: isDomaine360(a.domaine) ? a.domaine : null, gravite: borne(a.gravite, 5), vraisemblance: borne(a.vraisemblance, 5), ...(plan ? { plan } : {}), ...(mesure ? { mesure } : {}) })
    if (ajoutes.length >= SOCLE_MAX_AJOUTES) break
  }
  return { desactives, ajoutes }
}

export interface RisqueSocleResolu { ruleId: string; nom: string; domaine: Domaine360 | null; gravite: number; vraisemblance: number; plan: { titre: string; description: string | null } | null; mesure: { nom: string; type: MesureType } | null }

/** Risques par défaut effectifs pour une organisation : catalogue − désactivés + ajoutés, cotation bornée à l'échelle. */
export function risquesSocle(cfg: SocleConfig, locale: Locale, nbNiveaux: number): RisqueSocleResolu[] {
  const off = new Set(cfg.desactives)
  const i = IDX[locale] ?? 0
  return [
    ...RISQUES_PROJET_SOCLE.filter(r => !off.has(r.code)).map(r => ({ ruleId: `${SOCLE_RULE_PREFIX}${r.code}`, nom: r.intitule[i], domaine: r.domaine, gravite: Math.min(r.gravite, nbNiveaux), vraisemblance: Math.min(r.vraisemblance, nbNiveaux), plan: { titre: r.plan.titre[i], description: r.plan.description[i] }, mesure: { nom: r.mesure.nom[i], type: r.mesure.type } })),
    ...cfg.ajoutes.map(a => ({ ruleId: `${SOCLE_RULE_PREFIX}custom:${a.id}`, nom: a.intitule, domaine: a.domaine, gravite: Math.min(a.gravite, nbNiveaux), vraisemblance: Math.min(a.vraisemblance, nbNiveaux), plan: a.plan ? { titre: a.plan, description: null } : null, mesure: a.mesure ? { nom: a.mesure, type: 'ORGANISATIONNELLE' as const } : null })),
  ]
}

/** Sans doublon : une règle déjà présente dans le projet, ou un intitulé déjà saisi, n'est pas recréé. */
export function planSocle(risques: readonly RisqueSocleResolu[], existingRuleIds: readonly string[], existingTitles: readonly string[]): RisqueSocleResolu[] {
  const rules = new Set(existingRuleIds)
  const titres = new Set(existingTitles.map(t => t.trim().toLocaleLowerCase()))
  return risques.filter(r => !rules.has(r.ruleId) && !titres.has(r.nom.trim().toLocaleLowerCase()))
}

export const estRisqueSocle = (ruleId: string | null | undefined) => typeof ruleId === 'string' && ruleId.startsWith(SOCLE_RULE_PREFIX)
