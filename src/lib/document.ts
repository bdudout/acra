// ─── Bibliothèque documentaire — logique pure ────────────────────────────────
// Métadonnées d'un document GRC (PSSI, stratégie, politique…) : validation,
// bornage taille/MIME, sécurisation du nom de fichier et clé de stockage. Les
// octets vivent hors base (cf. lib/document-storage.ts) ; seules les métadonnées
// sont en Postgres. Logique PURE et testée.

export const DOCUMENT_TYPES = ['PSSI', 'STRATEGIE', 'POLITIQUE', 'PROCEDURE', 'PREUVE', 'AUTRE'] as const
export type DocumentType = (typeof DOCUMENT_TYPES)[number]

// Portée : rattaché à un référentiel, à un risque, ou au niveau organisation.
export const DOCUMENT_PORTEES = ['REFERENTIEL', 'RISQUE', 'ORG'] as const
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

export function mimeAutorise(mime: unknown): boolean {
  return typeof mime === 'string' && ALLOWED_DOCUMENT_MIME.has(mime)
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
