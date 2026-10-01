// ─── Bibliothèque documentaire — logique pure ────────────────────────────────
// Métadonnées d'un document GRC (PSSI, stratégie, politique…) : validation,
// bornage taille/MIME, sécurisation du nom de fichier et clé de stockage. Les
// octets vivent hors base (cf. lib/document-storage.ts) ; seules les métadonnées
// sont en Postgres. Logique PURE et testée.

export const DOCUMENT_TYPES = ['PSSI', 'STRATEGIE', 'POLITIQUE', 'PROCEDURE', 'PREUVE', 'AUTRE'] as const
/** Type d'un document de la GED : PSSI, stratégie, politique, procédure, preuve ou autre. */
export type DocumentType = (typeof DOCUMENT_TYPES)[number]

// Portée : rattaché à un référentiel, à un risque, ou au niveau organisation.
export const DOCUMENT_PORTEES = ['REFERENTIEL', 'RISQUE', 'ORG'] as const
/** Portée de rattachement d'un document : référentiel, risque ou organisation. */
export type DocumentPortee = (typeof DOCUMENT_PORTEES)[number]

export const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024 // 25 Mo

// Formats bureautiques usuels d'une politique/stratégie. Pas d'exécutables/archives.
export const ALLOWED_DOCUMENT_MIME = new Set<string>([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'text/plain',
  'text/markdown',
  'text/csv',
  'image/png',
  'image/jpeg',
])

/** Vrai si le type MIME est dans l'allowlist des documents téléversables (ALLOWED_DOCUMENT_MIME). */
export function mimeAutorise(mime: unknown): boolean {
  return typeof mime === 'string' && ALLOWED_DOCUMENT_MIME.has(mime)
}

/**
 * Le contenu correspond-il au type MIME annoncé ? (audit 2026-09-30, N06 / CWE-434)
 * `file.type` est déclaré par le client : on contrôle la signature (octets magiques)
 * des formats binaires. Les formats texte ne doivent contenir ni NUL ni signature
 * d'exécutable/archive. Pur, sur les premiers octets.
 */
export function contentMatchesMime(mime: string, head: Uint8Array): boolean {
  const starts = (sig: number[], at = 0) => sig.every((b, i) => head[at + i] === b)
  const zip = starts([0x50, 0x4b, 0x03, 0x04])
  const ole = starts([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
  switch (mime) {
    case 'application/pdf': return Buffer.from(head.subarray(0, 1024)).includes('%PDF-')
    case 'image/png': return starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    case 'image/jpeg': return starts([0xff, 0xd8, 0xff])
    case 'application/msword':
    case 'application/vnd.ms-excel':
    case 'application/vnd.ms-powerpoint': return ole
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    case 'application/vnd.oasis.opendocument.text':
    case 'application/vnd.oasis.opendocument.spreadsheet':
    case 'application/vnd.oasis.opendocument.presentation': return zip
    case 'text/plain':
    case 'text/markdown':
    case 'text/csv': {
      if (head.includes(0)) return false
      const exe = starts([0x4d, 0x5a]) || starts([0x7f, 0x45, 0x4c, 0x46]) || zip || starts([0x25, 0x50, 0x44, 0x46])
      return !exe
    }
    default: return false
  }
}

const txt = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const txtOrNull = (v: unknown): string | null => (txt(v) ? txt(v) : null)

/**
 * Nettoie un nom de fichier fourni par l'utilisateur : retire tout chemin, ne
 * garde que des caractères sûrs, borne la longueur. JAMAIS utilisé pour composer
 * un chemin disque directement (cf. storageKeyFor) — c'est un libellé d'affichage
 * et le suffixe de la clé.
 */
export function sanitizeFilename(name: unknown): string {
  let base = txt(name)
  // Retire tout composant de chemin (slash avant/arrière).
  base = base.replace(/^.*[\\/]/, '')
  // Sépare le nom de l'extension pour préserver cette dernière.
  const dot = base.lastIndexOf('.')
  let stem = dot > 0 ? base.slice(0, dot) : base
  let ext = dot > 0 ? base.slice(dot + 1) : ''
  const clean = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  stem = clean(stem).slice(0, 100)
  ext = clean(ext).slice(0, 10).toLowerCase()
  if (!stem) stem = 'document'
  return ext ? `${stem}.${ext}` : stem
}

/** Renvoie un code d'erreur i18n, ou null si les métadonnées sont valides. */
export function validateDocumentMeta(body: {
  titre?: unknown; type?: unknown; portee?: unknown; referentielId?: unknown; risqueId?: unknown
  taille?: unknown; mime?: unknown
}): string | null {
  if (!txt(body.titre)) return 'titre_requis'
  if (body.type != null && !(DOCUMENT_TYPES as readonly string[]).includes(body.type as string)) return 'type_invalide'
  const portee = body.portee
  if (!(DOCUMENT_PORTEES as readonly string[]).includes(portee as string)) return 'portee_invalide'
  if (portee === 'REFERENTIEL' && !txt(body.referentielId)) return 'referentiel_requis'
  if (portee === 'RISQUE' && !txt(body.risqueId)) return 'risque_requis'
  if (body.taille != null) {
    const n = Number(body.taille)
    if (!Number.isFinite(n) || n <= 0) return 'fichier_vide'
    if (n > MAX_DOCUMENT_SIZE) return 'fichier_trop_gros'
  }
  if (body.mime != null && body.mime !== '' && !mimeAutorise(body.mime)) return 'mime_interdit'
  return null
}

/** Métadonnées de document normalisées (type/portée dans l'allowlist, textes trim), prêtes pour la persistance. */
export interface CleanDocumentMeta {
  titre: string
  type: DocumentType
  portee: DocumentPortee
  referentielId: string | null
  risqueId: string | null
  version: string | null
  description: string | null
  dateDocument: Date | null
  dateRevue: Date | null
}

function parseDate(v: unknown): Date | null {
  if (v == null || v === '') return null
  const d = new Date(v as string)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Normalise les métadonnées d'un document (type/portée dans l'allowlist avec défauts AUTRE/ORG, textes trim). */
export function cleanDocumentMeta(body: Record<string, unknown>): CleanDocumentMeta {
  const type: DocumentType = (DOCUMENT_TYPES as readonly string[]).includes(body.type as string) ? (body.type as DocumentType) : 'AUTRE'
  const portee: DocumentPortee = (DOCUMENT_PORTEES as readonly string[]).includes(body.portee as string) ? (body.portee as DocumentPortee) : 'ORG'
  return {
    titre: txt(body.titre),
    type,
    portee,
    // On ne conserve que la cible cohérente avec la portée.
    referentielId: portee === 'REFERENTIEL' ? txtOrNull(body.referentielId) : null,
    risqueId: portee === 'RISQUE' ? txtOrNull(body.risqueId) : null,
    version: txtOrNull(body.version),
    description: txtOrNull(body.description),
    dateDocument: parseDate(body.dateDocument),
    dateRevue: parseDate(body.dateRevue),
  }
}

/** Clé de stockage déterministe : basée sur les identifiants, jamais le chemin d'origine. */
export function storageKeyFor(organizationId: string, documentId: string, filename: unknown): string {
  return `${organizationId}/${documentId}/${sanitizeFilename(filename)}`
}
