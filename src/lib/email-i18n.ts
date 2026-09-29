// ─── Gabarits d'e-mails localisés (tâches planifiées) ────────────────────────
// Copie des e-mails de cron (dérogations) dans les 5 langues. Module SERVEUR
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

/** Paramètres de l'e-mail d'expiration proche d'une dérogation (intitulé + jours restants). */
export interface ExpiryParams { intitule: string; jours: number }

const expiryTpl: Record<EmailLocale, (p: ExpiryParams, quand: string) => { subject: string; text: string }> = {
  fr: (p, q) => ({
    subject: `[ACRA] Dérogation « ${p.intitule} » — ${q}`,
    text: `La dérogation « ${p.intitule} » ${q}.\nMerci de la prolonger, la clôturer ou la traiter dans ACRA.`,
  }),
  en: (p, q) => ({
    subject: `[ACRA] Waiver "${p.intitule}" — ${q}`,
    text: `The waiver "${p.intitule}" ${q}.\nPlease extend, close or handle it in ACRA.`,
  }),
  de: (p, q) => ({
    subject: `[ACRA] Ausnahme „${p.intitule}" — ${q}`,
    text: `Die Ausnahme „${p.intitule}" ${q}.\nBitte verlängern, schließen oder in ACRA bearbeiten.`,
  }),
  es: (p, q) => ({
    subject: `[ACRA] Excepción «${p.intitule}» — ${q}`,
    text: `La excepción «${p.intitule}» ${q}.\nRenuévela, ciérrala o gestiónala en ACRA.`,
  }),
  it: (p, q) => ({
    subject: `[ACRA] Deroga «${p.intitule}» — ${q}`,
    text: `La deroga «${p.intitule}» ${q}.\nProrogala, chiudila o gestiscila in ACRA.`,
  }),
}

// Titre et invitation à agir de la version HTML (le texte reste le repli).
const expiryHtmlLabels: Record<EmailLocale, { heading: string; cta: string }> = {
  fr: { heading: 'Dérogation à traiter', cta: 'Prolongez, clôturez ou traitez cette dérogation dans ACRA.' },
  en: { heading: 'Waiver requires attention', cta: 'Extend, close or handle this waiver in ACRA.' },
  de: { heading: 'Ausnahme erfordert Aufmerksamkeit', cta: 'Verlängern, schließen oder in ACRA bearbeiten.' },
  es: { heading: 'Excepción a gestionar', cta: 'Renueve, cierre o gestione esta excepción en ACRA.' },
  it: { heading: 'Deroga da gestire', cta: 'Proroga, chiudi o gestisci questa deroga in ACRA.' },
}

/** E-mail d'alerte individuelle d'expiration d'une dérogation (texte + HTML). */
export function derogationExpiryEmail(locale: string | null | undefined, p: ExpiryParams): BuiltEmail {
  const loc = emailLocale(locale)
  const quand = echeancePhrase[loc](p.jours)
  const { subject, text } = expiryTpl[loc](p, quand)
  const L = expiryHtmlLabels[loc]
  const html = emailLayout({
    heading: L.heading,
    tone: p.jours < 0 ? 'danger' : 'warning',
    // Intitulé et échéance passés en TEXTE BRUT : emailLayout les échappe.
    items: [{ label: p.intitule, detail: quand, tone: p.jours < 0 ? 'danger' : 'warning' }],
    paragraphs: [L.cta],
    footer: 'ACRA',
  })
  return { subject, text, html }
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

// ─── Rappel d'échéance de contrôle permanent (M3) ────────────────────────────

export interface ControleEcheanceParams {
  intitule: string
  echeance: string
  enRetard: boolean
  responsable: string | null
}

const controleLabels: Record<EmailLocale, {
  subjectDu: (i: string) => string; subjectRetard: (i: string) => string
  headingDu: string; headingRetard: string
  due: (d: string) => string; late: (d: string) => string
  owner: string; cta: string
}> = {
  fr: {
    subjectDu: i => `[ACRA] Contrôle à exécuter : ${i}`, subjectRetard: i => `[ACRA] Contrôle en retard : ${i}`,
    headingDu: 'Contrôle à exécuter', headingRetard: 'Contrôle en retard',
    due: d => `échéance au ${d}`, late: d => `échéance dépassée depuis le ${d}`,
    owner: 'Responsable', cta: 'Enregistrez son exécution dans ACRA.',
  },
  en: {
    subjectDu: i => `[ACRA] Control due: ${i}`, subjectRetard: i => `[ACRA] Control overdue: ${i}`,
    headingDu: 'Control due', headingRetard: 'Control overdue',
    due: d => `due on ${d}`, late: d => `overdue since ${d}`,
    owner: 'Owner', cta: 'Record its execution in ACRA.',
  },
  de: {
    subjectDu: i => `[ACRA] Kontrolle fällig: ${i}`, subjectRetard: i => `[ACRA] Kontrolle überfällig: ${i}`,
    headingDu: 'Kontrolle fällig', headingRetard: 'Kontrolle überfällig',
    due: d => `fällig am ${d}`, late: d => `überfällig seit ${d}`,
    owner: 'Verantwortlich', cta: 'Erfassen Sie die Ausführung in ACRA.',
  },
  es: {
    subjectDu: i => `[ACRA] Control por ejecutar: ${i}`, subjectRetard: i => `[ACRA] Control vencido: ${i}`,
    headingDu: 'Control por ejecutar', headingRetard: 'Control vencido',
    due: d => `vence el ${d}`, late: d => `vencido desde el ${d}`,
    owner: 'Responsable', cta: 'Registre su ejecución en ACRA.',
  },
  it: {
    subjectDu: i => `[ACRA] Controllo da eseguire: ${i}`, subjectRetard: i => `[ACRA] Controllo in ritardo: ${i}`,
    headingDu: 'Controllo da eseguire', headingRetard: 'Controllo in ritardo',
    due: d => `scadenza il ${d}`, late: d => `scaduto dal ${d}`,
    owner: 'Responsabile', cta: "Registra la sua esecuzione in ACRA.",
  },
}

/** E-mail de rappel d'échéance d'un contrôle permanent (texte + HTML). */
export function controleEcheanceEmail(locale: string | null | undefined, p: ControleEcheanceParams): BuiltEmail {
  const loc = emailLocale(locale)
  const L = controleLabels[loc]
  const quand = p.enRetard ? L.late(p.echeance) : L.due(p.echeance)
  const subject = p.enRetard ? L.subjectRetard(p.intitule) : L.subjectDu(p.intitule)
  const text = `${p.intitule} — ${quand}.\n`
    + (p.responsable ? `${L.owner} : ${p.responsable}\n` : '')
    + L.cta
  const html = emailLayout({
    heading: p.enRetard ? L.headingRetard : L.headingDu,
    tone: p.enRetard ? 'danger' : 'warning',
    items: [{ label: p.intitule, detail: quand, tone: p.enRetard ? 'danger' : 'warning' }],
    paragraphs: [p.responsable ? `${L.owner} : ${p.responsable}` : L.cta, ...(p.responsable ? [L.cta] : [])],
    footer: 'ACRA',
  })
  return { subject, text, html }
}

// ─── Rappels d'audit interne (lot L4, suite) ────────────────────────────────

export interface AuditRappelParams { intitule: string; mission: string; type: 'ECHEANCE_PROCHE' | 'EN_RETARD' | 'A_VERIFIER'; echeance: string | null }

const auditLabels: Record<EmailLocale, { subject: Record<AuditRappelParams['type'], (i: string) => string>; heading: Record<AuditRappelParams['type'], string>; body: Record<AuditRappelParams['type'], (d: string | null) => string>; mission: string; cta: string }> = {
  fr: { subject: { ECHEANCE_PROCHE: i => `[ACRA] Recommandation à échéance proche : ${i}`, EN_RETARD: i => `[ACRA] Recommandation en retard : ${i}`, A_VERIFIER: i => `[ACRA] Recommandation à vérifier : ${i}` },
    heading: { ECHEANCE_PROCHE: 'Échéance proche', EN_RETARD: 'Recommandation en retard', A_VERIFIER: 'Vérification attendue' },
    body: { ECHEANCE_PROCHE: d => `échéance le ${d}`, EN_RETARD: d => `en retard depuis le ${d}`, A_VERIFIER: () => 'déclarée réalisée, en attente de vérification par l’audit' },
    mission: 'Mission', cta: 'Consultez le suivi dans ACRA.' },
  en: { subject: { ECHEANCE_PROCHE: i => `[ACRA] Recommendation due soon: ${i}`, EN_RETARD: i => `[ACRA] Recommendation overdue: ${i}`, A_VERIFIER: i => `[ACRA] Recommendation to verify: ${i}` },
    heading: { ECHEANCE_PROCHE: 'Due soon', EN_RETARD: 'Recommendation overdue', A_VERIFIER: 'Verification expected' },
    body: { ECHEANCE_PROCHE: d => `due on ${d}`, EN_RETARD: d => `overdue since ${d}`, A_VERIFIER: () => 'declared as implemented, awaiting verification by audit' },
    mission: 'Engagement', cta: 'Check the follow-up in ACRA.' },
  de: { subject: { ECHEANCE_PROCHE: i => `[ACRA] Empfehlung bald fällig: ${i}`, EN_RETARD: i => `[ACRA] Empfehlung überfällig: ${i}`, A_VERIFIER: i => `[ACRA] Empfehlung zu prüfen: ${i}` },
    heading: { ECHEANCE_PROCHE: 'Bald fällig', EN_RETARD: 'Empfehlung überfällig', A_VERIFIER: 'Prüfung erwartet' },
    body: { ECHEANCE_PROCHE: d => `fällig am ${d}`, EN_RETARD: d => `überfällig seit ${d}`, A_VERIFIER: () => 'als umgesetzt gemeldet, Prüfung durch die Revision ausstehend' },
    mission: 'Prüfung', cta: 'Sehen Sie die Nachverfolgung in ACRA.' },
  es: { subject: { ECHEANCE_PROCHE: i => `[ACRA] Recomendación con vencimiento próximo: ${i}`, EN_RETARD: i => `[ACRA] Recomendación vencida: ${i}`, A_VERIFIER: i => `[ACRA] Recomendación por verificar: ${i}` },
    heading: { ECHEANCE_PROCHE: 'Vencimiento próximo', EN_RETARD: 'Recomendación vencida', A_VERIFIER: 'Verificación pendiente' },
    body: { ECHEANCE_PROCHE: d => `vence el ${d}`, EN_RETARD: d => `vencida desde el ${d}`, A_VERIFIER: () => 'declarada como realizada, pendiente de verificación por auditoría' },
    mission: 'Misión', cta: 'Consulte el seguimiento en ACRA.' },
  it: { subject: { ECHEANCE_PROCHE: i => `[ACRA] Raccomandazione in scadenza: ${i}`, EN_RETARD: i => `[ACRA] Raccomandazione in ritardo: ${i}`, A_VERIFIER: i => `[ACRA] Raccomandazione da verificare: ${i}` },
    heading: { ECHEANCE_PROCHE: 'Scadenza vicina', EN_RETARD: 'Raccomandazione in ritardo', A_VERIFIER: 'Verifica attesa' },
    body: { ECHEANCE_PROCHE: d => `scadenza il ${d}`, EN_RETARD: d => `in ritardo dal ${d}`, A_VERIFIER: () => 'dichiarata realizzata, in attesa di verifica da parte dell’audit' },
    mission: 'Incarico', cta: 'Consulta il monitoraggio in ACRA.' },
}

/** E-mail de rappel d'une recommandation d'audit (texte + HTML). */
export function auditRappelEmail(locale: string | null | undefined, p: AuditRappelParams): BuiltEmail {
  const L = auditLabels[emailLocale(locale)]
  const quand = L.body[p.type](p.echeance)
  const tone = p.type === 'EN_RETARD' ? 'danger' : 'warning'
  const text = `${p.intitule} — ${quand}.\n${L.mission} : ${p.mission}\n${L.cta}`
  const html = emailLayout({ heading: L.heading[p.type], tone, items: [{ label: p.intitule, detail: quand, tone }], paragraphs: [`${L.mission} : ${p.mission}`, L.cta], footer: 'ACRA' })
  return { subject: L.subject[p.type](p.intitule), text, html }
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
