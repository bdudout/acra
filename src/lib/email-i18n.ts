// ─── Gabarits d'e-mails localisés (tâches planifiées) ────────────────────────
// E-mails des tâches planifiées (synthèse des relances, tableau de bord mensuel)
// et des invitations, dans les 5 langues. Module SERVEUR
// pur (hors bundle client) : chaque fonction renvoie { subject, text } selon la
// langue du destinataire (User.locale), avec repli sur le français. Testé.

import { emailLayout } from './email-html'
import { getT } from './i18n'
import type { Indicateur, IndicateurCle, PointAttention, AttentionType } from './tableau-bord-mensuel'

/** Langue d'un e-mail localisé (une des 5 locales de l'app). */
export type EmailLocale = 'fr' | 'en' | 'de' | 'es' | 'it'
const LOCALES: EmailLocale[] = ['fr', 'en', 'de', 'es', 'it']

/** Message multipart : `text` sert de repli au `html`. */
export interface BuiltEmail { subject: string; text: string; html: string }

/** Normalise une valeur de langue quelconque vers une EmailLocale (repli 'fr'). */
export function emailLocale(l: string | null | undefined): EmailLocale {
  return l && (LOCALES as string[]).includes(l) ? (l as EmailLocale) : 'fr'
}

// ─── Diffusion d'un rapport validé (lot L2, suite) ──────────────────────────

export interface RapportDiffusionParams { titre: string; periode: string; lien: string }

const rapportLabels: Record<EmailLocale, { subject: (t: string) => string; heading: string; body: (t: string, p: string) => string; cta: string }> = {
  fr: { subject: t => `[ACRA] Rapport diffusé : ${t}`, heading: 'Rapport diffusé', body: (t, p) => `${t} — période ${p}`, cta: 'Consultez le rapport dans ACRA :' },
  en: { subject: t => `[ACRA] Report distributed: ${t}`, heading: 'Report distributed', body: (t, p) => `${t} — period ${p}`, cta: 'Open the report in ACRA:' },
  de: { subject: t => `[ACRA] Bericht verteilt: ${t}`, heading: 'Bericht verteilt', body: (t, p) => `${t} — Zeitraum ${p}`, cta: 'Öffnen Sie den Bericht in ACRA:' },
  es: { subject: t => `[ACRA] Informe difundido: ${t}`, heading: 'Informe difundido', body: (t, p) => `${t} — periodo ${p}`, cta: 'Abra el informe en ACRA:' },
  it: { subject: t => `[ACRA] Rapporto diffuso: ${t}`, heading: 'Rapporto diffuso', body: (t, p) => `${t} — periodo ${p}`, cta: 'Apri il rapporto in ACRA:' },
}

/** E-mail de diffusion d'un rapport : titre, période et lien (le contenu ne circule pas par e-mail). */
export function rapportDiffusionEmail(locale: string | null | undefined, p: RapportDiffusionParams): BuiltEmail {
  const L = rapportLabels[emailLocale(locale)]
  const quoi = L.body(p.titre, p.periode)
  return {
    subject: L.subject(p.titre),
    text: `${quoi}\n${L.cta} ${p.lien}\n`,
    html: emailLayout({ heading: L.heading, tone: 'warning', items: [{ label: p.titre, detail: quoi, tone: 'warning' }], paragraphs: [`${L.cta} ${p.lien}`], footer: 'ACRA' }),
  }
}

// ─── Rattachement à une organisation (T23) ───────────────────────────────────

/** Paramètres de l'e-mail d'invitation (mode INVITATION). */
export interface InvitationParams { orgNom: string; url: string; days: number }

const invitationLabels: Record<EmailLocale, { subject: (o: string) => string; heading: (o: string) => string; body: (o: string, d: number) => string; action: string; ignore: string }> = {
  fr: { subject: o => `[ACRA] Invitation à rejoindre « ${o} »`, heading: o => `Invitation à rejoindre « ${o} »`, body: (o, d) => `Vous êtes invité(e) à rejoindre l'organisation « ${o} » dans ACRA. Cette invitation est valable ${d} jours.`, action: 'Accepter l\'invitation', ignore: 'Si vous n\'attendiez pas cette invitation, ignorez ce message : rien ne sera fait sans votre accord.' },
  en: { subject: o => `[ACRA] Invitation to join "${o}"`, heading: o => `Invitation to join "${o}"`, body: (o, d) => `You have been invited to join the organisation "${o}" in ACRA. This invitation is valid for ${d} days.`, action: 'Accept the invitation', ignore: 'If you were not expecting this invitation, ignore this message: nothing will happen without your consent.' },
  de: { subject: o => `[ACRA] Einladung zu „${o}"`, heading: o => `Einladung zu „${o}"`, body: (o, d) => `Sie wurden eingeladen, der Organisation „${o}" in ACRA beizutreten. Diese Einladung ist ${d} Tage gültig.`, action: 'Einladung annehmen', ignore: 'Wenn Sie diese Einladung nicht erwartet haben, ignorieren Sie diese Nachricht: Ohne Ihre Zustimmung geschieht nichts.' },
  es: { subject: o => `[ACRA] Invitación para unirse a «${o}»`, heading: o => `Invitación para unirse a «${o}»`, body: (o, d) => `Le han invitado a unirse a la organización «${o}» en ACRA. Esta invitación es válida durante ${d} días.`, action: 'Aceptar la invitación', ignore: 'Si no esperaba esta invitación, ignore este mensaje: no se hará nada sin su consentimiento.' },
  it: { subject: o => `[ACRA] Invito a unirsi a «${o}»`, heading: o => `Invito a unirsi a «${o}»`, body: (o, d) => `Siete stati invitati a unirvi all'organizzazione «${o}» in ACRA. L'invito è valido per ${d} giorni.`, action: 'Accetta l\'invito', ignore: 'Se non vi aspettavate questo invito, ignorate il messaggio: nulla verrà fatto senza il vostro consenso.' },
}

/** E-mail d'invitation à rejoindre une organisation (texte + HTML). */
export function orgInvitationEmail(locale: string | null | undefined, p: InvitationParams): BuiltEmail {
  const L = invitationLabels[emailLocale(locale)]
  const text = `${L.body(p.orgNom, p.days)}\n\n${L.action} : ${p.url}\n\n${L.ignore}`
  const html = emailLayout({ heading: L.heading(p.orgNom), paragraphs: [L.body(p.orgNom, p.days), L.ignore], action: { label: L.action, url: p.url }, footer: 'ACRA' })
  return { subject: L.subject(p.orgNom), text, html }
}

/** Paramètres de l'e-mail d'information (mode DIRECT). */
export interface MemberAddedParams { orgNom: string; url: string }

const memberAddedLabels: Record<EmailLocale, { subject: (o: string) => string; body: (o: string) => string; action: string }> = {
  fr: { subject: o => `[ACRA] Vous avez été ajouté(e) à « ${o} »`, body: o => `Un administrateur vous a ajouté(e) à l'organisation « ${o} » dans ACRA.`, action: 'Ouvrir ACRA' },
  en: { subject: o => `[ACRA] You have been added to "${o}"`, body: o => `An administrator added you to the organisation "${o}" in ACRA.`, action: 'Open ACRA' },
  de: { subject: o => `[ACRA] Sie wurden zu „${o}" hinzugefügt`, body: o => `Ein Administrator hat Sie der Organisation „${o}" in ACRA hinzugefügt.`, action: 'ACRA öffnen' },
  es: { subject: o => `[ACRA] Le han añadido a «${o}»`, body: o => `Un administrador le ha añadido a la organización «${o}» en ACRA.`, action: 'Abrir ACRA' },
  it: { subject: o => `[ACRA] Siete stati aggiunti a «${o}»`, body: o => `Un amministratore vi ha aggiunti all'organizzazione «${o}» in ACRA.`, action: 'Apri ACRA' },
}

/** E-mail d'information : rattachement direct à une organisation (texte + HTML). */
export function memberAddedEmail(locale: string | null | undefined, p: MemberAddedParams): BuiltEmail {
  const L = memberAddedLabels[emailLocale(locale)]
  const text = `${L.body(p.orgNom)}\n\n${L.action} : ${p.url}`
  const html = emailLayout({ heading: L.subject(p.orgNom).replace('[ACRA] ', ''), paragraphs: [L.body(p.orgNom)], action: { label: L.action, url: p.url }, footer: 'ACRA' })
  return { subject: L.subject(p.orgNom), text, html }
}

// ─── Relances : un e-mail de synthèse par personne ───────────────────────────

export type RelanceCategorie = 'QUESTIONNAIRE' | 'PRECONISATION' | 'PLAN_ACTION'
  | 'CONSTAT_AUDIT' | 'CONTROLE_A_EXECUTER' | 'DEROGATION_EXPIRATION' | 'HOMOLOGATION_RENOUVELLEMENT'
  | 'CONTRAT_TIC' | 'TEST_RESILIENCE' | 'KRI_MESURE' | 'DOCUMENT_A_REVOIR' | 'CAMPAGNE_CONTROLE' | 'MISSION_AUDIT' | 'ANALYSE_ECHEANCE' | 'INVITATION'
  | 'ACCEPTATION_RISQUES'
  | 'SUPPRESSION_RISQUE'
  | 'AIPD_A_REALISER'
  | 'PLAN_ANNUEL_A_VALIDER'
  | 'PROPOSITION_MCP'
  | 'REVUE_SYSTEME_IA'
  | 'REVUE_TRAITEMENT'
  | 'REVUE_PROCESSUS'
  | 'REVUE_TIERS'
  // Décisions en attente : vérifications (2ᵉ et 3ᵉ lignes) et validations (RSSI, Risk Manager, direction métier).
  | 'PRECONISATION_A_VERIFIER' | 'CONSTAT_A_VERIFIER' | 'ANALYSE_A_APPROUVER' | 'PROJET360_A_APPROUVER'
  | 'DEROGATION_AVIS' | 'DEROGATION_DOUBLE_REGARD' | 'DEROGATION_VALIDATION'
export type RelanceEmailType = 'ECHEANCE_PROCHE' | 'EN_RETARD' | 'PERIODIQUE' | 'EN_ATTENTE'
/** Un élément relancé : catégorie, intitulé, type de relance, date (AAAA-MM-JJ) : échéance, ou début d'attente pour EN_ATTENTE. */
export interface RelanceItem { categorie: RelanceCategorie; intitule: string; type: RelanceEmailType; echeance: string | null
  /** Page de l'objet (chemin interne) ouverte par le lien de l'e-mail quand il est le premier listé (lib/relances-chemins). */
  chemin?: string }
/** Éléments d'une personne, toutes organisations confondues (le nom de l'organisation n'est affiché que s'il y en a plusieurs). */
export interface RelancesParams { items: (RelanceItem & { organisation: string })[]; url: string | null }

const relancesLabels: Record<EmailLocale, {
  subject: (n: number, o: string | null) => string; heading: (o: string | null) => string; intro: string; action: string
  categories: Record<RelanceCategorie, string>; etat: Record<RelanceEmailType, (d: string | null) => string>
}> = {
  fr: {
    subject: (n, o) => `[ACRA] ${n} élément(s) à traiter${o ? ` — ${o}` : ''}`, heading: o => (o ? `Vos relances — ${o}` : 'Vos relances'),
    intro: 'Les éléments suivants attendent une action ou une décision de votre part.', action: 'Ouvrir ACRA',
    categories: {
      CONTRAT_TIC: 'Contrat TIC arrivant à échéance', TEST_RESILIENCE: 'Test de résilience planifié', KRI_MESURE: 'KRI sans mesure récente', DOCUMENT_A_REVOIR: 'Document à revoir', CAMPAGNE_CONTROLE: 'Campagne de contrôle avec des contrôles non exécutés', MISSION_AUDIT: 'Mission d’audit planifiée', ANALYSE_ECHEANCE: 'Analyse de risques', INVITATION: 'Invitation non acceptée', ACCEPTATION_RISQUES: 'Risques résiduels à accepter',
      QUESTIONNAIRE: 'Questionnaire à répondre', PRECONISATION: 'Préconisation', PLAN_ACTION: 'Plan d’action',
      CONSTAT_AUDIT: 'Recommandation d’audit', CONTROLE_A_EXECUTER: 'Contrôle à exécuter', DEROGATION_EXPIRATION: 'Dérogation arrivant à expiration', HOMOLOGATION_RENOUVELLEMENT: 'Homologation à renouveler', SUPPRESSION_RISQUE: 'Suppression d’un risque de projet à valider', AIPD_A_REALISER: 'Analyse d’impact relative à la protection des données (AIPD) requise, non engagée', PLAN_ANNUEL_A_VALIDER: 'Plan annuel d’audit ou de contrôle à valider', PROPOSITION_MCP: 'Proposition d’un agent IA (MCP) à examiner', REVUE_SYSTEME_IA: 'Revue annuelle d’un système d’IA', REVUE_TRAITEMENT: 'Revue annuelle d’un traitement (registre RGPD)', REVUE_PROCESSUS: 'Revue annuelle d’un processus (BIA)', REVUE_TIERS: 'Revue annuelle d’un tiers',
      PRECONISATION_A_VERIFIER: 'Préconisation réalisée à vérifier', CONSTAT_A_VERIFIER: 'Recommandation d’audit réalisée à vérifier', ANALYSE_A_APPROUVER: 'Analyse à approuver', PROJET360_A_APPROUVER: 'Projet 360 à approuver',
      DEROGATION_AVIS: 'Dérogation : avis RSSI attendu', DEROGATION_DOUBLE_REGARD: 'Dérogation : double regard attendu', DEROGATION_VALIDATION: 'Dérogation : validation métier attendue',
    },
    etat: { ECHEANCE_PROCHE: d => `échéance le ${d}`, EN_RETARD: d => `en retard (échéance le ${d})`, PERIODIQUE: d => (d ? `ouvert, échéance le ${d}` : 'toujours ouvert'), EN_ATTENTE: d => (d ? `en attente depuis le ${d}` : 'en attente') },
  },
  en: {
    subject: (n, o) => `[ACRA] ${n} item(s) to handle${o ? ` — ${o}` : ''}`, heading: o => (o ? `Your reminders — ${o}` : 'Your reminders'),
    intro: 'The following items are awaiting an action or a decision from you.', action: 'Open ACRA',
    categories: {
      CONTRAT_TIC: 'ICT contract nearing its end date', TEST_RESILIENCE: 'Planned resilience test', KRI_MESURE: 'KRI without a recent measurement', DOCUMENT_A_REVOIR: 'Document to review', CAMPAGNE_CONTROLE: 'Control campaign with controls not performed', MISSION_AUDIT: 'Planned audit engagement', ANALYSE_ECHEANCE: 'Risk analysis', INVITATION: 'Invitation not accepted', ACCEPTATION_RISQUES: 'Residual risks to accept',
      QUESTIONNAIRE: 'Questionnaire to answer', PRECONISATION: 'Recommendation', PLAN_ACTION: 'Action plan',
      CONSTAT_AUDIT: 'Audit recommendation', CONTROLE_A_EXECUTER: 'Control to perform', DEROGATION_EXPIRATION: 'Waiver about to expire', HOMOLOGATION_RENOUVELLEMENT: 'Accreditation to renew', SUPPRESSION_RISQUE: 'Project risk deletion to approve', AIPD_A_REALISER: 'Data protection impact assessment (DPIA) required, not started', PLAN_ANNUEL_A_VALIDER: 'Annual audit or control plan to approve', PROPOSITION_MCP: 'AI agent (MCP) proposal to review', REVUE_SYSTEME_IA: 'Annual review of an AI system', REVUE_TRAITEMENT: 'Annual review of a processing activity (GDPR record)', REVUE_PROCESSUS: 'Annual review of a process (BIA)', REVUE_TIERS: 'Annual review of a third party',
      PRECONISATION_A_VERIFIER: 'Completed recommendation to verify', CONSTAT_A_VERIFIER: 'Completed audit recommendation to verify', ANALYSE_A_APPROUVER: 'Analysis to approve', PROJET360_A_APPROUVER: '360 project to approve',
      DEROGATION_AVIS: 'Waiver: CISO opinion expected', DEROGATION_DOUBLE_REGARD: 'Waiver: second review expected', DEROGATION_VALIDATION: 'Waiver: business approval expected',
    },
    etat: { ECHEANCE_PROCHE: d => `due on ${d}`, EN_RETARD: d => `overdue (due on ${d})`, PERIODIQUE: d => (d ? `open, due on ${d}` : 'still open'), EN_ATTENTE: d => (d ? `pending since ${d}` : 'pending') },
  },
  de: {
    subject: (n, o) => `[ACRA] ${n} offene(r) Eintrag/Einträge${o ? ` — ${o}` : ''}`, heading: o => (o ? `Ihre Erinnerungen — ${o}` : 'Ihre Erinnerungen'),
    intro: 'Die folgenden Einträge warten auf eine Aktion oder Entscheidung von Ihnen.', action: 'ACRA öffnen',
    categories: {
      CONTRAT_TIC: 'IKT-Vertrag läuft bald aus', TEST_RESILIENCE: 'Geplanter Resilienztest', KRI_MESURE: 'KRI ohne aktuelle Messung', DOCUMENT_A_REVOIR: 'Zu überprüfendes Dokument', CAMPAGNE_CONTROLE: 'Kontrollkampagne mit nicht durchgeführten Kontrollen', MISSION_AUDIT: 'Geplante Prüfung', ANALYSE_ECHEANCE: 'Risikoanalyse', INVITATION: 'Nicht angenommene Einladung', ACCEPTATION_RISQUES: 'Zu akzeptierende Restrisiken',
      QUESTIONNAIRE: 'Zu beantwortender Fragebogen', PRECONISATION: 'Empfehlung', PLAN_ACTION: 'Maßnahmenplan',
      CONSTAT_AUDIT: 'Prüfungsempfehlung', CONTROLE_A_EXECUTER: 'Durchzuführende Kontrolle', DEROGATION_EXPIRATION: 'Ausnahme läuft bald ab', HOMOLOGATION_RENOUVELLEMENT: 'Sicherheitsfreigabe zu erneuern', SUPPRESSION_RISQUE: 'Löschung eines Projektrisikos freizugeben', AIPD_A_REALISER: 'Datenschutz-Folgenabschätzung (DSFA) erforderlich, nicht begonnen', PLAN_ANNUEL_A_VALIDER: 'Jahresprüfungs- oder Kontrollplan freizugeben', PROPOSITION_MCP: 'Vorschlag eines KI-Agenten (MCP) zu prüfen', REVUE_SYSTEME_IA: 'Jährliche Überprüfung eines KI-Systems', REVUE_TRAITEMENT: 'Jährliche Überprüfung einer Verarbeitungstätigkeit (DSGVO-Verzeichnis)', REVUE_PROCESSUS: 'Jährliche Überprüfung eines Prozesses (BIA)', REVUE_TIERS: 'Jährliche Überprüfung eines Drittanbieters',
      PRECONISATION_A_VERIFIER: 'Umgesetzte Empfehlung zu prüfen', CONSTAT_A_VERIFIER: 'Umgesetzte Prüfungsempfehlung zu prüfen', ANALYSE_A_APPROUVER: 'Analyse zu genehmigen', PROJET360_A_APPROUVER: '360-Projekt zu genehmigen',
      DEROGATION_AVIS: 'Ausnahme: Stellungnahme des CISO erwartet', DEROGATION_DOUBLE_REGARD: 'Ausnahme: Zweitprüfung erwartet', DEROGATION_VALIDATION: 'Ausnahme: Freigabe durch den Fachbereich erwartet',
    },
    etat: { ECHEANCE_PROCHE: d => `fällig am ${d}`, EN_RETARD: d => `überfällig (fällig am ${d})`, PERIODIQUE: d => (d ? `offen, fällig am ${d}` : 'weiterhin offen'), EN_ATTENTE: d => (d ? `ausstehend seit ${d}` : 'ausstehend') },
  },
  es: {
    subject: (n, o) => `[ACRA] ${n} elemento(s) pendiente(s)${o ? ` — ${o}` : ''}`, heading: o => (o ? `Sus recordatorios — ${o}` : 'Sus recordatorios'),
    intro: 'Los siguientes elementos esperan una acción o una decisión por su parte.', action: 'Abrir ACRA',
    categories: {
      CONTRAT_TIC: 'Contrato TIC próximo a vencer', TEST_RESILIENCE: 'Prueba de resiliencia planificada', KRI_MESURE: 'KRI sin medición reciente', DOCUMENT_A_REVOIR: 'Documento por revisar', CAMPAGNE_CONTROLE: 'Campaña de control con controles no ejecutados', MISSION_AUDIT: 'Misión de auditoría planificada', ANALYSE_ECHEANCE: 'Análisis de riesgos', INVITATION: 'Invitación no aceptada', ACCEPTATION_RISQUES: 'Riesgos residuales por aceptar',
      QUESTIONNAIRE: 'Cuestionario por responder', PRECONISATION: 'Recomendación', PLAN_ACTION: 'Plan de acción',
      CONSTAT_AUDIT: 'Recomendación de auditoría', CONTROLE_A_EXECUTER: 'Control por ejecutar', DEROGATION_EXPIRATION: 'Excepción a punto de caducar', HOMOLOGATION_RENOUVELLEMENT: 'Homologación por renovar', SUPPRESSION_RISQUE: 'Eliminación de un riesgo de proyecto por validar', AIPD_A_REALISER: 'Evaluación de impacto relativa a la protección de datos (EIPD) requerida, no iniciada', PLAN_ANNUEL_A_VALIDER: 'Plan anual de auditoría o de control por validar', PROPOSITION_MCP: 'Propuesta de un agente de IA (MCP) por revisar', REVUE_SYSTEME_IA: 'Revisión anual de un sistema de IA', REVUE_TRAITEMENT: 'Revisión anual de una actividad de tratamiento (registro RGPD)', REVUE_PROCESSUS: 'Revisión anual de un proceso (BIA)', REVUE_TIERS: 'Revisión anual de un tercero',
      PRECONISATION_A_VERIFIER: 'Recomendación realizada por verificar', CONSTAT_A_VERIFIER: 'Recomendación de auditoría realizada por verificar', ANALYSE_A_APPROUVER: 'Análisis por aprobar', PROJET360_A_APPROUVER: 'Proyecto 360 por aprobar',
      DEROGATION_AVIS: 'Excepción: dictamen del RSSI pendiente', DEROGATION_DOUBLE_REGARD: 'Excepción: doble revisión pendiente', DEROGATION_VALIDATION: 'Excepción: validación de negocio pendiente',
    },
    etat: { ECHEANCE_PROCHE: d => `vence el ${d}`, EN_RETARD: d => `con retraso (vencía el ${d})`, PERIODIQUE: d => (d ? `abierto, vence el ${d}` : 'sigue abierto'), EN_ATTENTE: d => (d ? `pendiente desde el ${d}` : 'pendiente') },
  },
  it: {
    subject: (n, o) => `[ACRA] ${n} elemento/i da gestire${o ? ` — ${o}` : ''}`, heading: o => (o ? `I suoi promemoria — ${o}` : 'I suoi promemoria'),
    intro: 'I seguenti elementi attendono un’azione o una decisione da parte sua.', action: 'Apri ACRA',
    categories: {
      CONTRAT_TIC: 'Contratto TIC in scadenza', TEST_RESILIENCE: 'Test di resilienza pianificato', KRI_MESURE: 'KRI senza misurazione recente', DOCUMENT_A_REVOIR: 'Documento da rivedere', CAMPAGNE_CONTROLE: 'Campagna di controllo con controlli non eseguiti', MISSION_AUDIT: 'Missione di audit pianificata', ANALYSE_ECHEANCE: 'Analisi dei rischi', INVITATION: 'Invito non accettato', ACCEPTATION_RISQUES: 'Rischi residui da accettare',
      QUESTIONNAIRE: 'Questionario da compilare', PRECONISATION: 'Raccomandazione', PLAN_ACTION: 'Piano d’azione',
      CONSTAT_AUDIT: 'Raccomandazione di audit', CONTROLE_A_EXECUTER: 'Controllo da eseguire', DEROGATION_EXPIRATION: 'Deroga in scadenza', HOMOLOGATION_RENOUVELLEMENT: 'Omologazione da rinnovare', SUPPRESSION_RISQUE: 'Eliminazione di un rischio di progetto da approvare', AIPD_A_REALISER: 'Valutazione d’impatto sulla protezione dei dati (DPIA) richiesta, non avviata', PLAN_ANNUEL_A_VALIDER: 'Piano annuale di audit o di controllo da approvare', PROPOSITION_MCP: 'Proposta di un agente IA (MCP) da esaminare', REVUE_SYSTEME_IA: 'Revisione annuale di un sistema di IA', REVUE_TRAITEMENT: 'Revisione annuale di un’attività di trattamento (registro GDPR)', REVUE_PROCESSUS: 'Revisione annuale di un processo (BIA)', REVUE_TIERS: 'Revisione annuale di un terzo',
      PRECONISATION_A_VERIFIER: 'Raccomandazione attuata da verificare', CONSTAT_A_VERIFIER: 'Raccomandazione di audit attuata da verificare', ANALYSE_A_APPROUVER: 'Analisi da approvare', PROJET360_A_APPROUVER: 'Progetto 360 da approvare',
      DEROGATION_AVIS: 'Deroga: parere del CISO atteso', DEROGATION_DOUBLE_REGARD: 'Deroga: doppia revisione attesa', DEROGATION_VALIDATION: 'Deroga: validazione di business attesa',
    },
    etat: { ECHEANCE_PROCHE: d => `scadenza il ${d}`, EN_RETARD: d => `in ritardo (scadenza il ${d})`, PERIODIQUE: d => (d ? `aperto, scadenza il ${d}` : 'ancora aperto'), EN_ATTENTE: d => (d ? `in attesa dal ${d}` : 'in attesa') },
  },
}

/**
 * E-mail de synthèse des relances d'une personne (texte + HTML) : TOUS ses éléments en un seul
 * message, toutes organisations confondues. Une seule organisation : nommée dans l'objet ;
 * plusieurs : chaque ligne est préfixée par son organisation.
 */
export function relancesEmail(locale: string | null | undefined, p: RelancesParams): BuiltEmail {
  const L = relancesLabels[emailLocale(locale)]
  const organisations = [...new Set(p.items.map(x => x.organisation))]
  const seule = organisations.length === 1 ? organisations[0] || null : null
  const tone = (t: RelanceEmailType) => (t === 'EN_RETARD' ? ('danger' as const) : ('warning' as const))
  const lignes = p.items.map(x => ({
    label: `${!seule && x.organisation ? `${x.organisation} · ` : ''}${L.categories[x.categorie]} — ${x.intitule}`,
    detail: L.etat[x.type](x.echeance), tone: tone(x.type),
  }))
  const text = `${L.heading(seule)}\n\n${L.intro}\n${lignes.map(l => `• ${l.label} : ${l.detail}`).join('\n')}\n${p.url ? `\n${L.action} : ${p.url}\n` : ''}`
  const html = emailLayout({
    heading: L.heading(seule), tone: p.items.some(x => x.type === 'EN_RETARD') ? 'danger' : 'warning',
    paragraphs: [L.intro], items: lignes, ...(p.url ? { action: { label: L.action, url: p.url } } : {}), footer: 'ACRA',
  })
  return { subject: L.subject(p.items.length, seule), text, html }
}

// ─── Tableau de bord mensuel (RSSI, gestionnaires des risques) ──────────────


export interface TableauBordParams {
  /** Premier jour du mois couvert. */
  mois: Date
  sections: { organisation: string; indicateurs: Indicateur[]; attention: PointAttention[] }[]
  url: string | null
}

const tableauBordLabels: Record<EmailLocale, {
  subject: (m: string) => string; heading: (m: string) => string; intro: string; attentionTitre: string; rienASignaler: string; action: string
  niveau: (n: number) => string; date: Record<'echeance' | 'fin', (d: string) => string>
  indicateurs: Record<IndicateurCle, string>; attention: Record<AttentionType, string>
}> = {
  fr: {
    subject: m => `[ACRA] Tableau de bord — ${m}`, heading: m => `Tableau de bord — ${m}`,
    intro: 'L’essentiel du mois écoulé : indicateurs clés et points d’attention.', attentionTitre: 'Points d’attention', rienASignaler: 'Aucun point d’attention ce mois-ci.', action: 'Ouvrir le pilotage',
    niveau: n => `niveau ${n}`, date: { echeance: d => `échéance le ${d}`, fin: d => `fin le ${d}` },
    indicateurs: {
      risquesEleves: 'Risques élevés', horsAppetit: 'Hors appétit', plansEnRetard: 'Plans d’action en retard', incidentsMois: 'Incidents du mois', incidentsMajeurs: 'Incidents majeurs (DORA)',
      perteNetteMois: 'Perte nette du mois', tauxConformite: 'Contrôles conformes', anomaliesMois: 'Anomalies de contrôle', recosEnRetard: 'Recommandations d’audit en retard',
      constatsCritiques: 'Constats d’audit critiques', preconisationsEnRetard: 'Préconisations en retard', kriEnAlerte: 'KRI en alerte', derogationsAExpirer: 'Dérogations à expirer',
      derogationsExpirees: 'Dérogations expirées', decisionsEnAttente: 'Décisions en attente',
    },
    attention: {
      RISQUE_ELEVE: 'Risque élevé', RISQUE_HORS_APPETIT: 'Risque hors appétit', INCIDENT_MAJEUR: 'Incident majeur', PLAN_EN_RETARD: 'Plan d’action en retard', CONSTAT_CRITIQUE: 'Constat d’audit critique',
      RECO_EN_RETARD: 'Recommandation d’audit en retard', KRI_CRITIQUE: 'KRI critique', DEROGATION_EXPIREE: 'Dérogation expirée', DEROGATION_A_EXPIRER: 'Dérogation à expirer',
    },
  },
  en: {
    subject: m => `[ACRA] Dashboard — ${m}`, heading: m => `Dashboard — ${m}`,
    intro: 'The essentials of last month: key indicators and points of attention.', attentionTitre: 'Points of attention', rienASignaler: 'No point of attention this month.', action: 'Open the cockpit',
    niveau: n => `level ${n}`, date: { echeance: d => `due on ${d}`, fin: d => `ends on ${d}` },
    indicateurs: {
      risquesEleves: 'High risks', horsAppetit: 'Outside appetite', plansEnRetard: 'Overdue action plans', incidentsMois: 'Incidents this month', incidentsMajeurs: 'Major incidents (DORA)',
      perteNetteMois: 'Net loss this month', tauxConformite: 'Compliant controls', anomaliesMois: 'Control anomalies', recosEnRetard: 'Overdue audit recommendations',
      constatsCritiques: 'Critical audit findings', preconisationsEnRetard: 'Overdue recommendations', kriEnAlerte: 'KRIs in alert', derogationsAExpirer: 'Waivers expiring',
      derogationsExpirees: 'Expired waivers', decisionsEnAttente: 'Pending decisions',
    },
    attention: {
      RISQUE_ELEVE: 'High risk', RISQUE_HORS_APPETIT: 'Risk outside appetite', INCIDENT_MAJEUR: 'Major incident', PLAN_EN_RETARD: 'Overdue action plan', CONSTAT_CRITIQUE: 'Critical audit finding',
      RECO_EN_RETARD: 'Overdue audit recommendation', KRI_CRITIQUE: 'Critical KRI', DEROGATION_EXPIREE: 'Expired waiver', DEROGATION_A_EXPIRER: 'Waiver expiring',
    },
  },
  de: {
    subject: m => `[ACRA] Dashboard — ${m}`, heading: m => `Dashboard — ${m}`,
    intro: 'Das Wichtigste des vergangenen Monats: Kennzahlen und Hinweise.', attentionTitre: 'Hinweise', rienASignaler: 'Keine Hinweise in diesem Monat.', action: 'Steuerung öffnen',
    niveau: n => `Stufe ${n}`, date: { echeance: d => `fällig am ${d}`, fin: d => `endet am ${d}` },
    indicateurs: {
      risquesEleves: 'Hohe Risiken', horsAppetit: 'Außerhalb des Risikoappetits', plansEnRetard: 'Überfällige Maßnahmenpläne', incidentsMois: 'Vorfälle im Monat', incidentsMajeurs: 'Schwerwiegende Vorfälle (DORA)',
      perteNetteMois: 'Nettoverlust im Monat', tauxConformite: 'Konforme Kontrollen', anomaliesMois: 'Kontrollanomalien', recosEnRetard: 'Überfällige Prüfungsempfehlungen',
      constatsCritiques: 'Kritische Prüfungsfeststellungen', preconisationsEnRetard: 'Überfällige Empfehlungen', kriEnAlerte: 'KRI im Alarm', derogationsAExpirer: 'Bald ablaufende Ausnahmen',
      derogationsExpirees: 'Abgelaufene Ausnahmen', decisionsEnAttente: 'Ausstehende Entscheidungen',
    },
    attention: {
      RISQUE_ELEVE: 'Hohes Risiko', RISQUE_HORS_APPETIT: 'Risiko außerhalb des Appetits', INCIDENT_MAJEUR: 'Schwerwiegender Vorfall', PLAN_EN_RETARD: 'Überfälliger Maßnahmenplan', CONSTAT_CRITIQUE: 'Kritische Prüfungsfeststellung',
      RECO_EN_RETARD: 'Überfällige Prüfungsempfehlung', KRI_CRITIQUE: 'Kritischer KRI', DEROGATION_EXPIREE: 'Abgelaufene Ausnahme', DEROGATION_A_EXPIRER: 'Bald ablaufende Ausnahme',
    },
  },
  es: {
    subject: m => `[ACRA] Cuadro de mando — ${m}`, heading: m => `Cuadro de mando — ${m}`,
    intro: 'Lo esencial del mes pasado: indicadores clave y puntos de atención.', attentionTitre: 'Puntos de atención', rienASignaler: 'Ningún punto de atención este mes.', action: 'Abrir el pilotaje',
    niveau: n => `nivel ${n}`, date: { echeance: d => `vence el ${d}`, fin: d => `finaliza el ${d}` },
    indicateurs: {
      risquesEleves: 'Riesgos altos', horsAppetit: 'Fuera del apetito', plansEnRetard: 'Planes de acción con retraso', incidentsMois: 'Incidentes del mes', incidentsMajeurs: 'Incidentes graves (DORA)',
      perteNetteMois: 'Pérdida neta del mes', tauxConformite: 'Controles conformes', anomaliesMois: 'Anomalías de control', recosEnRetard: 'Recomendaciones de auditoría con retraso',
      constatsCritiques: 'Hallazgos de auditoría críticos', preconisationsEnRetard: 'Recomendaciones con retraso', kriEnAlerte: 'KRI en alerta', derogationsAExpirer: 'Excepciones por caducar',
      derogationsExpirees: 'Excepciones caducadas', decisionsEnAttente: 'Decisiones pendientes',
    },
    attention: {
      RISQUE_ELEVE: 'Riesgo alto', RISQUE_HORS_APPETIT: 'Riesgo fuera del apetito', INCIDENT_MAJEUR: 'Incidente grave', PLAN_EN_RETARD: 'Plan de acción con retraso', CONSTAT_CRITIQUE: 'Hallazgo de auditoría crítico',
      RECO_EN_RETARD: 'Recomendación de auditoría con retraso', KRI_CRITIQUE: 'KRI crítico', DEROGATION_EXPIREE: 'Excepción caducada', DEROGATION_A_EXPIRER: 'Excepción por caducar',
    },
  },
  it: {
    subject: m => `[ACRA] Cruscotto — ${m}`, heading: m => `Cruscotto — ${m}`,
    intro: 'L’essenziale del mese trascorso: indicatori chiave e punti di attenzione.', attentionTitre: 'Punti di attenzione', rienASignaler: 'Nessun punto di attenzione questo mese.', action: 'Apri il pilotaggio',
    niveau: n => `livello ${n}`, date: { echeance: d => `scadenza il ${d}`, fin: d => `termina il ${d}` },
    indicateurs: {
      risquesEleves: 'Rischi elevati', horsAppetit: 'Fuori propensione', plansEnRetard: 'Piani d’azione in ritardo', incidentsMois: 'Incidenti del mese', incidentsMajeurs: 'Incidenti gravi (DORA)',
      perteNetteMois: 'Perdita netta del mese', tauxConformite: 'Controlli conformi', anomaliesMois: 'Anomalie di controllo', recosEnRetard: 'Raccomandazioni di audit in ritardo',
      constatsCritiques: 'Rilievi di audit critici', preconisationsEnRetard: 'Raccomandazioni in ritardo', kriEnAlerte: 'KRI in allerta', derogationsAExpirer: 'Deroghe in scadenza',
      derogationsExpirees: 'Deroghe scadute', decisionsEnAttente: 'Decisioni in attesa',
    },
    attention: {
      RISQUE_ELEVE: 'Rischio elevato', RISQUE_HORS_APPETIT: 'Rischio fuori propensione', INCIDENT_MAJEUR: 'Incidente grave', PLAN_EN_RETARD: 'Piano d’azione in ritardo', CONSTAT_CRITIQUE: 'Rilievo di audit critico',
      RECO_EN_RETARD: 'Raccomandazione di audit in ritardo', KRI_CRITIQUE: 'KRI critico', DEROGATION_EXPIREE: 'Deroga scaduta', DEROGATION_A_EXPIRER: 'Deroga in scadenza',
    },
  },
}

/**
 * Tableau de bord mensuel d'une personne (texte + HTML) : une section par organisation, avec ses
 * indicateurs clés puis ses points d'attention (le plus grave d'abord). Données métier échappées.
 */
export function tableauBordEmail(locale: string | null | undefined, p: TableauBordParams): BuiltEmail {
  const loc = emailLocale(locale)
  const L = tableauBordLabels[loc]
  const mois = new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(p.mois)
  const nombre = new Intl.NumberFormat(loc)
  const valeur = (i: Indicateur) => `${nombre.format(i.valeur)}${i.unite ? ` ${i.unite}` : ''}`
  const detail = (a: PointAttention) => (a.niveau != null ? L.niveau(a.niveau)
    : a.date ? L.date[a.type.startsWith('DEROGATION') ? 'fin' : 'echeance'](a.date) : undefined)
  const sections = p.sections.map(s => ({
    heading: s.organisation,
    stats: s.indicateurs.map(i => ({ label: L.indicateurs[i.cle], value: valeur(i), tone: i.ton })),
    itemsTitle: L.attentionTitre,
    items: s.attention.map(a => ({ label: `${L.attention[a.type]} — ${a.intitule}`, detail: detail(a), tone: a.ton })),
    empty: L.rienASignaler,
  }))
  const text = [
    L.heading(mois), '', L.intro,
    ...p.sections.flatMap(s => ['', `■ ${s.organisation}`,
      ...s.indicateurs.map(i => `  ${L.indicateurs[i.cle]} : ${valeur(i)}`),
      ...(s.attention.length ? [`  ${L.attentionTitre} :`, ...s.attention.map(a => `  • ${L.attention[a.type]} — ${a.intitule}${detail(a) ? ` (${detail(a)})` : ''}`)] : [`  ${L.rienASignaler}`])]),
    ...(p.url ? ['', `${L.action} : ${p.url}`] : []),
  ].join('\n') + '\n'
  const html = emailLayout({
    heading: L.heading(mois), paragraphs: [L.intro], sections,
    tone: p.sections.some(s => s.attention.some(a => a.ton === 'danger')) ? 'danger' : 'neutral',
    ...(p.url ? { action: { label: L.action, url: p.url } } : {}), footer: 'ACRA',
  })
  return { subject: L.subject(mois), text, html }
}

// ─── Alertes DORA (déclaration des incidents majeurs, art. 19) ──────────────

/** `phase` = phase DORA ; sinon `regime*`/`phase*` = phase d'un régime de notification (libellés résolus dans la langue du destinataire). */
export interface AlerteDoraItem {
  organisation: string; incident: string; phase?: 'INITIALE' | 'INTERMEDIAIRE' | 'FINALE'; statut: 'A_FAIRE' | 'EN_RETARD'; echeance: Date
  regimeLabelKey?: string; regimeLabel?: string; phaseLabelKey?: string; phaseLabel?: string; phaseCode?: string
}
export interface AlertesDoraParams { items: AlerteDoraItem[]; url: string | null }

const alerteDoraLabels: Record<EmailLocale, {
  subject: (n: number) => string; heading: string; intro: string; action: string
  phases: Record<NonNullable<AlerteDoraItem['phase']>, string>; generic: { subject: (n: number) => string; heading: string; intro: string }; statut: Record<AlerteDoraItem['statut'], (d: string) => string>
}> = {
  fr: {
    subject: n => `[ACRA] URGENT — déclaration DORA : ${n} échéance(s)`, heading: 'Déclaration d’incident majeur (DORA)',
    intro: 'Les déclarations suivantes à l’autorité compétente arrivent à échéance ou sont en retard (DORA, art. 19).', action: 'Ouvrir les incidents',
    generic: { subject: n => `[ACRA] URGENT — déclarations d’incident : ${n} échéance(s)`, heading: 'Déclarations d’incident à effectuer', intro: 'Les déclarations suivantes (autorités, régulateurs, CERT/CSIRT) arrivent à échéance ou sont en retard.' },
    phases: { INITIALE: 'Notification initiale', INTERMEDIAIRE: 'Rapport intermédiaire', FINALE: 'Rapport final' },
    statut: { A_FAIRE: d => `à soumettre avant le ${d}`, EN_RETARD: d => `EN RETARD — échéance dépassée le ${d}` },
  },
  en: {
    subject: n => `[ACRA] URGENT — DORA reporting: ${n} deadline(s)`, heading: 'Major incident reporting (DORA)',
    intro: 'The following reports to the competent authority are due or overdue (DORA, Art. 19).', action: 'Open incidents',
    generic: { subject: n => `[ACRA] URGENT — incident reporting: ${n} deadline(s)`, heading: 'Incident reports to file', intro: 'The following reports (authorities, regulators, CERT/CSIRT) are due or overdue.' },
    phases: { INITIALE: 'Initial notification', INTERMEDIAIRE: 'Intermediate report', FINALE: 'Final report' },
    statut: { A_FAIRE: d => `to submit before ${d}`, EN_RETARD: d => `OVERDUE — deadline passed on ${d}` },
  },
  de: {
    subject: n => `[ACRA] DRINGEND — DORA-Meldung: ${n} Frist(en)`, heading: 'Meldung schwerwiegender Vorfälle (DORA)',
    intro: 'Die folgenden Meldungen an die zuständige Behörde sind fällig oder überfällig (DORA, Art. 19).', action: 'Vorfälle öffnen',
    generic: { subject: n => `[ACRA] DRINGEND — Vorfallmeldungen: ${n} Frist(en)`, heading: 'Zu erstattende Vorfallmeldungen', intro: 'Die folgenden Meldungen (Behörden, Aufsicht, CERT/CSIRT) sind fällig oder überfällig.' },
    phases: { INITIALE: 'Erstmeldung', INTERMEDIAIRE: 'Zwischenbericht', FINALE: 'Abschlussbericht' },
    statut: { A_FAIRE: d => `einzureichen vor ${d}`, EN_RETARD: d => `ÜBERFÄLLIG — Frist abgelaufen am ${d}` },
  },
  es: {
    subject: n => `[ACRA] URGENTE — notificación DORA: ${n} plazo(s)`, heading: 'Notificación de incidente grave (DORA)',
    intro: 'Las siguientes notificaciones a la autoridad competente vencen o están vencidas (DORA, art. 19).', action: 'Abrir los incidentes',
    generic: { subject: n => `[ACRA] URGENTE — notificaciones de incidentes: ${n} plazo(s)`, heading: 'Notificaciones de incidentes por presentar', intro: 'Las siguientes notificaciones (autoridades, reguladores, CERT/CSIRT) vencen o están vencidas.' },
    phases: { INITIALE: 'Notificación inicial', INTERMEDIAIRE: 'Informe intermedio', FINALE: 'Informe final' },
    statut: { A_FAIRE: d => `a presentar antes del ${d}`, EN_RETARD: d => `CON RETRASO — plazo vencido el ${d}` },
  },
  it: {
    subject: n => `[ACRA] URGENTE — notifica DORA: ${n} scadenza/e`, heading: 'Notifica di incidente grave (DORA)',
    intro: 'Le seguenti notifiche all’autorità competente sono in scadenza o in ritardo (DORA, art. 19).', action: 'Apri gli incidenti',
    generic: { subject: n => `[ACRA] URGENTE — notifiche di incidenti: ${n} scadenza/e`, heading: 'Notifiche di incidenti da presentare', intro: 'Le seguenti notifiche (autorità, regolatori, CERT/CSIRT) sono in scadenza o in ritardo.' },
    phases: { INITIALE: 'Notifica iniziale', INTERMEDIAIRE: 'Relazione intermedia', FINALE: 'Relazione finale' },
    statut: { A_FAIRE: d => `da presentare entro il ${d}`, EN_RETARD: d => `IN RITARDO — scadenza superata il ${d}` },
  },
}

/** E-mail URGENT des échéances DORA d'une personne (toutes organisations) : date et heure UTC de chaque échéance. */
export function alertesDoraEmail(locale: string | null | undefined, p: AlertesDoraParams): BuiltEmail {
  const L = alerteDoraLabels[emailLocale(locale)]
  const quand = (d: Date) => `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`
  const plusieurs = new Set(p.items.map(i => i.organisation)).size > 1
  const T = getT(locale ?? 'fr') as unknown as Record<string, unknown>
  const tr = (key?: string, fallback?: string) => (key ? (key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], T) as string | undefined) : undefined) ?? fallback ?? key ?? ''
  const mixte = p.items.some(i => !i.phase)
  const nomPhase = (i: AlerteDoraItem) => i.phase ? L.phases[i.phase] : `${tr(i.regimeLabelKey, i.regimeLabel)} — ${tr(i.phaseLabelKey, i.phaseLabel ?? i.phaseCode)}`
  const lignes = p.items.map(i => ({
    label: `${plusieurs ? `${i.organisation} · ` : ''}${nomPhase(i)} — ${i.incident}`,
    detail: L.statut[i.statut](quand(i.echeance)), tone: i.statut === 'EN_RETARD' ? ('danger' as const) : ('warning' as const),
  }))
  const heading = mixte ? L.generic.heading : L.heading
  const intro = mixte ? L.generic.intro : L.intro
  const text = `${heading}\n\n${intro}\n${lignes.map(l => `• ${l.label} : ${l.detail}`).join('\n')}\n${p.url ? `\n${L.action} : ${p.url}\n` : ''}`
  const html = emailLayout({ heading, tone: 'danger', paragraphs: [intro], items: lignes, ...(p.url ? { action: { label: L.action, url: p.url } } : {}), footer: 'ACRA' })
  return { subject: mixte ? L.generic.subject(p.items.length) : L.subject(p.items.length), text, html }
}
