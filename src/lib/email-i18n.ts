// ─── Gabarits d'e-mails localisés (tâches planifiées) ────────────────────────
// Copie des e-mails de cron (dérogations) dans les 5 langues. Module SERVEUR
// pur (hors bundle client) : chaque fonction renvoie { subject, text } selon la
// langue du destinataire (User.locale), avec repli sur le français. Testé.

import { emailLayout } from './email-html'

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

export interface DigestItem { intitule: string; joursRestants: number }
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
