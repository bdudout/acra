// ─── MCP — proposition d'import d'une PSSI (PUR) ──────────────────────────────
// Un assistant convertit une PSSI existante en : référentiel personnalisé de type PSSI (exigences structurées,
// utilisable comme référentiel de mesures et de conformité), document Markdown de la bibliothèque rattaché à ce
// référentiel, et suivi de conformité. Rien n'est créé avant qu'un administrateur accepte (ancre : l'organisation de la
// clé). Testé : mcp-pssi.test.ts.
import { cleanReferentielInput, slugifyCode, validateReferentielInput, type CleanReferentiel } from '@/lib/referentiel'

export const PSSI_TEXTE_MAX = 200_000
const MAX_EXIGENCES = 500

export interface PssiProposalPayload {
  referentiel: CleanReferentiel
  /** Texte de la PSSI (Markdown) ; à défaut, le document est reconstitué à partir des exigences. */
  texte: string | null
  /** Date du document (AAAA-MM-JJ). */
  date: string | null
  /** Ouvrir le suivi de conformité de ce référentiel à l'acceptation (défaut : oui). */
  suivreConformite: boolean
}

const txt = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export function sanitizePssiProposal(input: unknown): PssiProposalPayload {
  let o = (input && typeof input === 'object') ? input as Record<string, unknown> : {}
  // Payload déjà assaini (relu à l'acceptation) : on revient à la forme d'entrée pour le réassainir à l'identique.
  if (o.referentiel && typeof o.referentiel === 'object') {
    const r = o.referentiel as Record<string, unknown>
    o = { titre: r.nom, code: r.code, version: r.version, domaine: r.domaine, description: r.description, exigences: r.exigences, texte: o.texte, date: o.date, suivreConformite: o.suivreConformite }
  }
  const titre = txt(o.titre, 200)
  const version = txt(o.version, 40)
  const code = slugifyCode(o.code) || slugifyCode(`PSSI ${version || titre}`).slice(0, 40)
  const exigences = (Array.isArray(o.exigences) ? o.exigences : []).filter(e => e && typeof e === 'object' && txt((e as Record<string, unknown>).ref, 40)).slice(0, MAX_EXIGENCES)
  const referentiel = cleanReferentielInput({ code, nom: titre, type: 'PSSI', domaine: o.domaine ?? 'SECURITE_SI', version: version || null, description: txt(o.description, 2000) || null, exigences })
  const date = typeof o.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.date) && !Number.isNaN(Date.parse(o.date)) ? o.date : null
  return { referentiel, texte: txt(o.texte, PSSI_TEXTE_MAX) || null, date, suivreConformite: o.suivreConformite !== false }
}

/** Valide comme la création d'un référentiel, avec au moins une exigence. */
export function isPssiProposalValid(p: PssiProposalPayload): boolean {
  return validateReferentielInput(p.referentiel) === null && p.referentiel.exigences.length > 0
}

/** Document Markdown déposé dans la bibliothèque : texte de la PSSI, ou reconstitution par catégorie d'exigences. */
export function pssiDocument(p: PssiProposalPayload): { nom: string; contenu: string } {
  const r = p.referentiel
  const entete = [`# ${r.nom}`, '', [r.version ? `Version ${r.version}` : null, p.date].filter(Boolean).join(' · '), r.description ?? ''].filter((l, i) => i < 2 || l).join('\n')
  let corps = p.texte
  if (!corps) {
    const parCategorie = new Map<string, typeof r.exigences>()
    for (const e of r.exigences) parCategorie.set(e.categorie || 'Exigences', [...(parCategorie.get(e.categorie || 'Exigences') ?? []), e])
    corps = [...parCategorie.entries()].map(([cat, es]) => [`## ${cat}`, ...es.map(e => `- **${e.ref}** — ${e.nom}${e.description ? ` : ${e.description}` : ''}`)].join('\n')).join('\n\n')
  }
  return { nom: `${r.code}${r.version ? `-v${r.version.replace(/[^A-Za-z0-9.]/g, '')}` : ''}.md`, contenu: `${entete}\n\n${corps}\n` }
}
