// ─── Garde d'archive XLSX avant décompression (PUR) ──────────────────────────
// ExcelJS (JSZip) décompresse TOUT le classeur en mémoire avant que la route ne
// plafonne feuilles/lignes : un xlsx de 9 Mo (sous la limite d'envoi) bloquait
// l'event loop ~15 s (constat d'audit 2026-09-28). On lit donc d'abord l'annuaire
// central du zip — sans rien décompresser — et on refuse une taille décompressée
// annoncée excessive, trop d'entrées, ou le zip64 (tailles masquées).
// Défense en profondeur : JSZip rejette ensuite une entrée dont la taille réelle
// diffère de l'annonce ; les routes appliquent aussi une limite de débit.

/** Taille décompressée maximale acceptée (somme des entrées). */
export const XLSX_MAX_UNCOMPRESSED_BYTES = 40 * 1024 * 1024
/** Nombre maximal d'entrées dans l'archive (feuilles, styles, médias…). */
export const XLSX_MAX_ENTRIES = 2000

export type XlsxArchiveCheck =
  | { ok: true; entries: number; uncompressed: number }
  | { ok: false; reason: 'NOT_ZIP' | 'TOO_MANY_ENTRIES' | 'TOO_LARGE_UNCOMPRESSED' | 'ZIP64_UNSUPPORTED' }

const EOCD_SIG = 0x06054b50
const CDH_SIG = 0x02014b50

/** Inspecte l'annuaire central d'un zip et applique les plafonds. */
export function checkXlsxArchive(
  buf: Uint8Array,
  limits: { maxUncompressed?: number; maxEntries?: number } = {},
): XlsxArchiveCheck {
  const maxUncompressed = limits.maxUncompressed ?? XLSX_MAX_UNCOMPRESSED_BYTES
  const maxEntries = limits.maxEntries ?? XLSX_MAX_ENTRIES
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  // Fin d'annuaire central : dans les 22 + 65 535 derniers octets (commentaire max).
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === EOCD_SIG) { eocd = i; break }
  }
  if (eocd < 0) return { ok: false, reason: 'NOT_ZIP' }
  const total = view.getUint16(eocd + 10, true)
  const cdOffset = view.getUint32(eocd + 16, true)
  if (total === 0xffff || cdOffset === 0xffffffff) return { ok: false, reason: 'ZIP64_UNSUPPORTED' }
  if (total > maxEntries) return { ok: false, reason: 'TOO_MANY_ENTRIES' }
  let off = cdOffset
  let uncompressed = 0
  for (let n = 0; n < total; n++) {
    if (off + 46 > buf.length || view.getUint32(off, true) !== CDH_SIG) return { ok: false, reason: 'NOT_ZIP' }
    const size = view.getUint32(off + 24, true)
    if (size === 0xffffffff) return { ok: false, reason: 'ZIP64_UNSUPPORTED' }
    uncompressed += size
    if (uncompressed > maxUncompressed) return { ok: false, reason: 'TOO_LARGE_UNCOMPRESSED' }
    off += 46 + view.getUint16(off + 28, true) + view.getUint16(off + 30, true) + view.getUint16(off + 32, true)
  }
  return { ok: true, entries: total, uncompressed }
}
