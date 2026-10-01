// ─── Gabarits d'e-mails localisés (tâches planifiées) ────────────────────────
// E-mails des tâches planifiées (synthèse des relances, digest des dérogations)
// et des invitations, dans les 5 langues. Module SERVEUR
// pur (hors bundle client) : chaque fonction renvoie { subject, text } selon la
// langue du destinataire (User.locale), avec repli sur le français. Testé.

import { emailLayout } from './email-html'

/** Langue d'un e-mail localisé (une des 5 locales de l'app). */
export type EmailLocale = 'fr' | 'en' | 'de' | 'es' | 'it'
const LOCALES: EmailLocale[] = ['fr', 'en', 'de', 'es', 'it']

/** Message multipart : `text` sert de repli au `html`. */
export interface BuiltEmail { subject: string; text: string; html: string }

/** Normalise une valeur de langue quelconque vers une EmailLocale (repli 'fr'). */
export function emailLocale(l: string | null | undefined): EmailLocale {
  return l && (LOCALES as string[]).includes(l) ? (l as EmailLocale) : 'fr'
}

// Formulation « échéance » : dans X j / depuis X j (X = valeur absolue).
const echeancePhrase: Record<EmailLocale, (jours: number) => string> = {
  fr: j => (j < 0 ? `expirée depuis ${-j} j` : j === 0 ? "expire aujourd'hui" : `expire dans ${j} j`),
  en: j => (j < 0 ? `expired ${-j} day(s) ago` : j === 0 ? 'expires today' : `expires in ${j} day(s)`),
  de: j => (j < 0 ? `seit ${-j} Tag(en) abgelaufen` : j === 0 ? 'läuft heute ab' : `läuft in ${j} Tag(en) ab`),
  es: j => (j < 0 ? `caducada hace ${-j} día(s)` : j === 0 ? 'caduca hoy' : `caduca en ${j} día(s)`),
  it: j => (j < 0 ? `scaduta da ${-j} giorno/i` : j === 0 ? 'scade oggi' : `scade tra ${j} giorno/i`),
}

/** Une dérogation listée dans l'e-mail de digest (intitulé + jours restants). */
export interface DigestItem { intitule: string; joursRestants: number }
/** Paramètres de l'e-mail de digest des dérogations (compteurs par état + items). */
export interface DigestParams { orgNom: string; active: number; expireBientot: number; expiree: number; items: DigestItem[] }

const digestLabels: Record<EmailLocale, { subject: (org: string) => string; heading: (org: string) => string; active: string; soon: string; expired: string; toHandle: string }> = {
  fr: { subject: o => `[ACRA] Synthèse des dérogations — ${o}`, heading: o => `Synthèse des dérogations — ${o}`, active: 'Actives', soon: 'Bientôt expirées', expired: 'Expirées', toHandle: 'À traiter' },
  en: { subject: o => `[ACRA] Waivers summary — ${o}`, heading: o => `Waivers summary — ${o}`, active: 'Active', soon: 'Expiring soon', expired: 'Expired', toHandle: 'To handle' },
  de: { subject: o => `[ACRA] Ausnahmen-Übersicht — ${o}`, heading: o => `Ausnahmen-Übersicht — ${o}`, active: 'Aktiv', soon: 'Bald ablaufend', expired: 'Abgelaufen', toHandle: 'Zu bearbeiten' },
  es: { subject: o => `[ACRA] Resumen de excepciones — ${o}`, heading: o => `Resumen de excepciones — ${o}`, active: 'Activas', soon: 'Por caducar', expired: 'Caducadas', toHandle: 'A gestionar' },
  it: { subject: o => `[ACRA] Riepilogo deroghe — ${o}`, heading: o => `Riepilogo deroghe — ${o}`, active: 'Attive', soon: 'In scadenza', expired: 'Scadute', toHandle: 'Da gestire' },
}

/** E-mail de synthèse (digest) périodique des dérogations (texte + HTML). */
export function derogationDigestEmail(locale: string | null | undefined, p: DigestParams): BuiltEmail {
  const loc = emailLocale(locale)
  const L = digestLabels[loc]
  const lignes = p.items.map(x => `• ${x.intitule} — ${echeancePhrase[loc](x.joursRestants)}`).join('\n')
  const text = `${L.heading(p.orgNom)}\n\n`
    + `${L.active} : ${p.active}\n${L.soon} : ${p.expireBientot}\n${L.expired} : ${p.expiree}\n\n`
    + `${L.toHandle} :\n${lignes}\n`
  const html = emailLayout({
    heading: L.heading(p.orgNom),
    tone: p.expiree > 0 ? 'danger' : 'warning',
    stats: [
      { label: L.active, value: p.active, tone: 'success' },
      { label: L.soon, value: p.expireBientot, tone: 'warning' },
      { label: L.expired, value: p.expiree, tone: 'danger' },
    ],
    itemsTitle: L.toHandle,
    items: p.items.map(x => ({
      label: x.intitule,
      detail: echeancePhrase[loc](x.joursRestants),
      tone: x.joursRestants < 0 ? ('danger' as const) : ('warning' as const),
    })),
    footer: 'ACRA',
  })
  return { subject: L.subject(p.orgNom), text, html }
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
  | 'CONSTAT_AUDIT' | 'CONTROLE_A_EXECUTER' | 'DEROGATION_EXPIRATION'
  // Décisions en attente : vérifications (2ᵉ et 3ᵉ lignes) et validations (RSSI, Risk Manager, direction métier).
  | 'PRECONISATION_A_VERIFIER' | 'CONSTAT_A_VERIFIER' | 'ANALYSE_A_APPROUVER' | 'PROJET360_A_APPROUVER'
  | 'DEROGATION_AVIS' | 'DEROGATION_DOUBLE_REGARD' | 'DEROGATION_VALIDATION'
export type RelanceEmailType = 'ECHEANCE_PROCHE' | 'EN_RETARD' | 'PERIODIQUE' | 'EN_ATTENTE'
/** Un élément relancé : catégorie, intitulé, type de relance, date (AAAA-MM-JJ) : échéance, ou début d'attente pour EN_ATTENTE. */
export interface RelanceItem { categorie: RelanceCategorie; intitule: string; type: RelanceEmailType; echeance: string | null }
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
      QUESTIONNAIRE: 'Questionnaire à répondre', PRECONISATION: 'Préconisation', PLAN_ACTION: 'Plan d’action',
      CONSTAT_AUDIT: 'Recommandation d’audit', CONTROLE_A_EXECUTER: 'Contrôle à exécuter', DEROGATION_EXPIRATION: 'Dérogation arrivant à expiration',
      PRECONISATION_A_VERIFIER: 'Préconisation réalisée à vérifier', CONSTAT_A_VERIFIER: 'Recommandation d’audit réalisée à vérifier', ANALYSE_A_APPROUVER: 'Analyse à approuver', PROJET360_A_APPROUVER: 'Projet 360 à approuver',
      DEROGATION_AVIS: 'Dérogation : avis RSSI attendu', DEROGATION_DOUBLE_REGARD: 'Dérogation : double regard attendu', DEROGATION_VALIDATION: 'Dérogation : validation métier attendue',
    },
    etat: { ECHEANCE_PROCHE: d => `échéance le ${d}`, EN_RETARD: d => `en retard (échéance le ${d})`, PERIODIQUE: d => (d ? `ouvert, échéance le ${d}` : 'toujours ouvert'), EN_ATTENTE: d => (d ? `en attente depuis le ${d}` : 'en attente') },
  },
  en: {
    subject: (n, o) => `[ACRA] ${n} item(s) to handle${o ? ` — ${o}` : ''}`, heading: o => (o ? `Your reminders — ${o}` : 'Your reminders'),
    intro: 'The following items are awaiting an action or a decision from you.', action: 'Open ACRA',
    categories: {
      QUESTIONNAIRE: 'Questionnaire to answer', PRECONISATION: 'Recommendation', PLAN_ACTION: 'Action plan',
      CONSTAT_AUDIT: 'Audit recommendation', CONTROLE_A_EXECUTER: 'Control to perform', DEROGATION_EXPIRATION: 'Waiver about to expire',
      PRECONISATION_A_VERIFIER: 'Completed recommendation to verify', CONSTAT_A_VERIFIER: 'Completed audit recommendation to verify', ANALYSE_A_APPROUVER: 'Analysis to approve', PROJET360_A_APPROUVER: '360 project to approve',
      DEROGATION_AVIS: 'Waiver: CISO opinion expected', DEROGATION_DOUBLE_REGARD: 'Waiver: second review expected', DEROGATION_VALIDATION: 'Waiver: business approval expected',
    },
    etat: { ECHEANCE_PROCHE: d => `due on ${d}`, EN_RETARD: d => `overdue (due on ${d})`, PERIODIQUE: d => (d ? `open, due on ${d}` : 'still open'), EN_ATTENTE: d => (d ? `pending since ${d}` : 'pending') },
  },
  de: {
    subject: (n, o) => `[ACRA] ${n} offene(r) Eintrag/Einträge${o ? ` — ${o}` : ''}`, heading: o => (o ? `Ihre Erinnerungen — ${o}` : 'Ihre Erinnerungen'),
    intro: 'Die folgenden Einträge warten auf eine Aktion oder Entscheidung von Ihnen.', action: 'ACRA öffnen',
    categories: {
      QUESTIONNAIRE: 'Zu beantwortender Fragebogen', PRECONISATION: 'Empfehlung', PLAN_ACTION: 'Maßnahmenplan',
      CONSTAT_AUDIT: 'Prüfungsempfehlung', CONTROLE_A_EXECUTER: 'Durchzuführende Kontrolle', DEROGATION_EXPIRATION: 'Ausnahme läuft bald ab',
      PRECONISATION_A_VERIFIER: 'Umgesetzte Empfehlung zu prüfen', CONSTAT_A_VERIFIER: 'Umgesetzte Prüfungsempfehlung zu prüfen', ANALYSE_A_APPROUVER: 'Analyse zu genehmigen', PROJET360_A_APPROUVER: '360-Projekt zu genehmigen',
      DEROGATION_AVIS: 'Ausnahme: Stellungnahme des CISO erwartet', DEROGATION_DOUBLE_REGARD: 'Ausnahme: Zweitprüfung erwartet', DEROGATION_VALIDATION: 'Ausnahme: Freigabe durch den Fachbereich erwartet',
    },
    etat: { ECHEANCE_PROCHE: d => `fällig am ${d}`, EN_RETARD: d => `überfällig (fällig am ${d})`, PERIODIQUE: d => (d ? `offen, fällig am ${d}` : 'weiterhin offen'), EN_ATTENTE: d => (d ? `ausstehend seit ${d}` : 'ausstehend') },
  },
  es: {
    subject: (n, o) => `[ACRA] ${n} elemento(s) pendiente(s)${o ? ` — ${o}` : ''}`, heading: o => (o ? `Sus recordatorios — ${o}` : 'Sus recordatorios'),
    intro: 'Los siguientes elementos esperan una acción o una decisión por su parte.', action: 'Abrir ACRA',
    categories: {
      QUESTIONNAIRE: 'Cuestionario por responder', PRECONISATION: 'Recomendación', PLAN_ACTION: 'Plan de acción',
      CONSTAT_AUDIT: 'Recomendación de auditoría', CONTROLE_A_EXECUTER: 'Control por ejecutar', DEROGATION_EXPIRATION: 'Excepción a punto de caducar',
      PRECONISATION_A_VERIFIER: 'Recomendación realizada por verificar', CONSTAT_A_VERIFIER: 'Recomendación de auditoría realizada por verificar', ANALYSE_A_APPROUVER: 'Análisis por aprobar', PROJET360_A_APPROUVER: 'Proyecto 360 por aprobar',
      DEROGATION_AVIS: 'Excepción: dictamen del RSSI pendiente', DEROGATION_DOUBLE_REGARD: 'Excepción: doble revisión pendiente', DEROGATION_VALIDATION: 'Excepción: validación de negocio pendiente',
    },
    etat: { ECHEANCE_PROCHE: d => `vence el ${d}`, EN_RETARD: d => `con retraso (vencía el ${d})`, PERIODIQUE: d => (d ? `abierto, vence el ${d}` : 'sigue abierto'), EN_ATTENTE: d => (d ? `pendiente desde el ${d}` : 'pendiente') },
  },
  it: {
    subject: (n, o) => `[ACRA] ${n} elemento/i da gestire${o ? ` — ${o}` : ''}`, heading: o => (o ? `I suoi promemoria — ${o}` : 'I suoi promemoria'),
    intro: 'I seguenti elementi attendono un’azione o una decisione da parte sua.', action: 'Apri ACRA',
    categories: {
      QUESTIONNAIRE: 'Questionario da compilare', PRECONISATION: 'Raccomandazione', PLAN_ACTION: 'Piano d’azione',
      CONSTAT_AUDIT: 'Raccomandazione di audit', CONTROLE_A_EXECUTER: 'Controllo da eseguire', DEROGATION_EXPIRATION: 'Deroga in scadenza',
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
