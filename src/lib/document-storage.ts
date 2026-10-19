// ─── Stockage des documents — interface + adaptateur volume local ────────────
// Les octets des documents vivent HORS base. Une interface `DocumentStorage`
// (put/get/delete) découple le métier du backend :
//   - DÉFAUT : volume local (dossier configurable, monté en volume Docker en prod
//     mono-serveur) — zéro dépendance ;
//   - MULTI-INSTANCE : stockage objet S3 compatible (souverain, versionné, chiffré) —
//     adaptateur lib/document-storage-s3.ts, chargé quand DOCUMENT_STORAGE=s3.
// Sélection par variable d'environnement. Aucune URL publique : l'accès passe
// toujours par une route authentifiée qui lit via get().

import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises'
import path from 'node:path'

/** Interface de stockage de documents (put/get/delete par clé) ; implémentée par le volume local et l'adaptateur S3. */
export interface DocumentStorage {
  put(key: string, bytes: Buffer, mime?: string): Promise<void>
  get(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
}

// ── Adaptateur volume local ──────────────────────────────────────────────────

/** Adaptateur de stockage documentaire sur volume local ; résout les clés sous `baseDir` et refuse toute évasion de chemin. */
export function localStorage(baseDir: string): DocumentStorage {
  const root = path.resolve(baseDir)

  // Résout la clé SOUS la racine et refuse toute évasion de chemin (défense en
  // profondeur — les clés sont déjà normalisées par storageKeyFor).
  const resolveSafe = (key: string): string => {
    const p = path.resolve(root, key)
    if (p !== root && !p.startsWith(root + path.sep)) throw new Error('chemin_hors_racine')
    return p
  }

  return {
    async put(key, bytes) {
      const p = resolveSafe(key)
      await mkdir(path.dirname(p), { recursive: true })
      await writeFile(p, bytes)
    },
    async get(key) {
      return readFile(resolveSafe(key))
    },
    async delete(key) {
      try { await unlink(resolveSafe(key)) } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
      }
    },
  }
}

// ── Fabrique ─────────────────────────────────────────────────────────────────

let cached: DocumentStorage | null = null

/** Backend de stockage effectif (mémoïsé). Volume local par défaut. */
export async function getDocumentStorage(): Promise<DocumentStorage> {
  if (cached) return cached
  const backend = (process.env.DOCUMENT_STORAGE ?? 'local').toLowerCase()

  if (backend === 's3') {
    // Adaptateur S3 compatible (lib/document-storage-s3.ts, sans dépendance), chargé à la demande.
    // Une configuration incomplète lève une erreur nommant la variable manquante : jamais de repli
    // silencieux sur le disque local (en multi-instance, chaque instance aurait ses propres fichiers).
    const mod = await import('./document-storage-s3')
    cached = mod.s3Storage()
    return cached
  }

  const dir = process.env.DOCUMENT_STORAGE_DIR || path.join(process.cwd(), '.data', 'documents')
  cached = localStorage(dir)
  return cached
}

/** Réinitialise le cache (tests). */
export function resetDocumentStorageCache(): void { cached = null }
