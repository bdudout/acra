// ─── Gabarit HTML partagé des e-mails ────────────────────────────────────────
// Primitives PURES pour composer des e-mails HTML cohérents et SÛRS :
//   • escapeHtml : toute donnée métier (intitulé de risque, nom d'organisation…)
//     est fournie par l'utilisateur → doit être échappée avant interpolation,
//     sinon injection HTML dans le message envoyé.
//   • emailLayout : mise en page à base de <table> + styles INLINE, seul format
//     fiable dans les clients de messagerie (Outlook ignore <style> et flexbox).
// Toujours accompagner le HTML d'une version `text` (repli, anti-spam).

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}

/** Échappe les caractères actifs HTML. À appliquer à TOUTE donnée non fiable. */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).replace(/[&<>"']/g, c => HTML_ESCAPES[c])
}

export type Tone = 'neutral' | 'warning' | 'danger' | 'success'

const TONE_COLOR: Record<Tone, string> = {
  neutral: '#4338CA', warning: '#D97706', danger: '#DC2626', success: '#16A34A',
}

export interface EmailStat { label: string; value: string | number; tone?: Tone }
export interface EmailItem { label: string; detail?: string; tone?: Tone }

/** Valeur à mettre en évidence en monospace (code MFA, mot de passe temporaire…). */
export interface EmailCode { value: string; label?: string }

export interface EmailLayoutInput {
  /** Titre affiché en tête (échappé automatiquement). */
  heading: string
  /** Paragraphes d'introduction (échappés). */
  paragraphs?: string[]
  /** Compteurs présentés en ligne. */
  stats?: EmailStat[]
  /** Bloc de code/secret mis en évidence. */
  code?: EmailCode
  /** Liste à puces (éléments à traiter). */
  items?: EmailItem[]
  /** Libellé de la liste. */
  itemsTitle?: string
  /** Pied de message (échappé). */
  footer?: string
  /** Couleur d'accent du titre. */
  tone?: Tone
}

/**
 * Construit le corps HTML complet d'un e-mail. Toutes les valeurs textuelles
 * sont échappées : l'appelant passe du texte brut, jamais du HTML.
 */
export function emailLayout(input: EmailLayoutInput): string {
  const accent = TONE_COLOR[input.tone ?? 'neutral']
  const parts: string[] = []

  parts.push(
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f9fafb;padding:24px 0">`,
    `<tr><td align="center">`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:8px;font-family:Helvetica,Arial,sans-serif;color:#111827">`,
    `<tr><td style="padding:24px">`,
    `<h1 style="margin:0 0 12px;font-size:18px;line-height:24px;color:${accent}">${escapeHtml(input.heading)}</h1>`,
  )

  for (const p of input.paragraphs ?? []) {
    parts.push(`<p style="margin:0 0 12px;font-size:14px;line-height:20px">${escapeHtml(p)}</p>`)
  }

  if (input.stats?.length) {
    parts.push(`<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 16px">`, `<tr>`)
    for (const st of input.stats) {
      const color = TONE_COLOR[st.tone ?? 'neutral']
      parts.push(
        `<td style="padding:8px 14px 8px 0">`,
        `<div style="font-size:11px;color:#6b7280">${escapeHtml(st.label)}</div>`,
        `<div style="font-size:20px;font-weight:bold;color:${color}">${escapeHtml(st.value)}</div>`,
        `</td>`,
      )
    }
    parts.push(`</tr></table>`)
  }

  if (input.code) {
    if (input.code.label) {
      parts.push(`<p style="margin:0 0 6px;font-size:13px">${escapeHtml(input.code.label)}</p>`)
    }
    parts.push(
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px">`,
      `<tr><td style="background-color:#f3f4f6;border:1px solid #e5e7eb;border-radius:6px;padding:12px 18px;font-family:'Courier New',Courier,monospace;font-size:20px;font-weight:bold;letter-spacing:2px;color:#111827">`,
      escapeHtml(input.code.value),
      `</td></tr></table>`,
    )
  }

  if (input.items?.length) {
    if (input.itemsTitle) {
      parts.push(`<p style="margin:0 0 6px;font-size:13px;font-weight:bold">${escapeHtml(input.itemsTitle)}</p>`)
    }
    parts.push(`<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px;font-size:13px">`)
    for (const it of input.items) {
      const color = TONE_COLOR[it.tone ?? 'neutral']
      const detail = it.detail
        ? `<span style="color:${color};white-space:nowrap">&nbsp;— ${escapeHtml(it.detail)}</span>`
        : ''
      parts.push(
        `<tr><td style="padding:5px 0;border-bottom:1px solid #f3f4f6;line-height:18px">`,
        `${escapeHtml(it.label)}${detail}`,
        `</td></tr>`,
      )
    }
    parts.push(`</table>`)
  }

  if (input.footer) {
    parts.push(`<p style="margin:16px 0 0;font-size:12px;color:#6b7280">${escapeHtml(input.footer)}</p>`)
  }

  parts.push(`</td></tr></table>`, `</td></tr></table>`)
  return parts.join('')
}
