// ─── Cohérence base ↔ stockage des documents et compte rendu des sauvegardes (PUR) ─────────────────────
// Profil multi-instance « ha » (docs/deploiement-haute-disponibilite.md § 3.4) : les documents vivent dans un bucket S3
// versionné, la base dans un service externe ; une sauvegarde n'est cohérente que si chaque document référencé par la base
// existe dans le bucket. Ce module :
//   - inventorie les clés de stockage référencées (Document.storageKey + pièces jointes `rapports[].storageKey` des campagnes
//     de contrôle et des missions d'audit) — MÊMES sources et MÊME tri (ordre d'octets, comme COLLATE "C") que la requête
//     `doc_keys` de scripts/acra-snapshot.sh, pour que l'empreinte consignée au manifeste soit comparable ;
//   - vérifie la présence de chaque clé (HEAD S3 / stat local) avec une concurrence bornée ;
//   - valide le compte rendu qu'envoie l'agent de sauvegarde (POST /api/cron/sauvegarde-base).
import { createHash } from 'node:crypto'
import { isSnapshotId } from '@/lib/snapshot'

/** Tables dont les lignes référencent un fichier du stockage (parité testée avec le script de sauvegarde). */
export const SOURCES_CLES = ['Document', 'CampagneControle', 'AuditMission'] as const

const compareOctets = (a: string, b: string) => Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))

/** Clés référencées, triées en ordre d'octets, sans doublon ni valeur vide. Un `rapports` qui n'est pas un tableau est ignoré. */
export function clesReferencees(src: { documents: { storageKey: string | null }[]; rapports: unknown[] }): string[] {
  const set = new Set<string>()
  for (const d of src.documents) if (typeof d.storageKey === 'string' && d.storageKey) set.add(d.storageKey)
  for (const liste of src.rapports) {
    if (!Array.isArray(liste)) continue
    for (const r of liste) {
      const k = r && typeof r === 'object' ? (r as { storageKey?: unknown }).storageKey : undefined
      if (typeof k === 'string' && k) set.add(k)
    }
  }
  return [...set].sort(compareOctets)
}

/** Nombre et empreinte SHA-256 de la liste (une clé par ligne, saut de ligne final) — identique au manifeste de sauvegarde. */
export function empreinteCles(cles: string[]): { nombre: number; sha256: string } {
  return { nombre: cles.length, sha256: createHash('sha256').update(cles.map(k => k + '\n').join(''), 'utf8').digest('hex') }
}

export interface ResultatPresence { verifies: number; presents: number; manquants: string[]; erreurs: number }

/** Vérifie la présence de chaque clé (`head` → null si absente, lève si le stockage ne répond pas), `concurrence` appels au plus. */
export async function verifierPresence(cles: string[], head: (k: string) => Promise<unknown | null>, concurrence = 8): Promise<ResultatPresence> {
  const manquants: string[] = []
  let presents = 0, erreurs = 0, i = 0
  const ouvrier = async () => {
    while (i < cles.length) {
      const k = cles[i++]
      try { if (await head(k)) presents++; else manquants.push(k) } catch { erreurs++ }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrence, cles.length)) }, ouvrier))
  return { verifies: cles.length, presents, manquants: manquants.sort(compareOctets), erreurs }
}

// ─── Compte rendu de l'agent de sauvegarde ────────────────────────────────────────────────────────────

export type RaisonSauvegarde = 'scheduled' | 'manual' | 'pre-update'
export type ControleDocuments = 'ok' | 'ecart' | 'non_execute'
export interface RapportSauvegarde {
  statut: 'OK' | 'ECHEC'; code: number; raison: RaisonSauvegarde
  pointId?: string; tiers?: string; controleDocuments?: ControleDocuments
}

/** Rapport `{ rapport: {…} }` validé (champs connus, valeurs fermées) ; tout autre corps → null. */
export function parseRapportSauvegarde(raw: unknown): RapportSauvegarde | null {
  const r = raw && typeof raw === 'object' ? (raw as { rapport?: unknown }).rapport : undefined
  if (!r || typeof r !== 'object') return null
  const o = r as Record<string, unknown>
  if (o.statut !== 'OK' && o.statut !== 'ECHEC') return null
  if (typeof o.code !== 'number' || !Number.isInteger(o.code) || o.code < 0 || o.code > 255) return null
  if (o.raison !== 'scheduled' && o.raison !== 'manual' && o.raison !== 'pre-update') return null
  const out: RapportSauvegarde = { statut: o.statut, code: o.code, raison: o.raison }
  if (isSnapshotId(o.pointId)) out.pointId = o.pointId
  if (typeof o.tiers === 'string' && /^(daily|weekly|monthly)(,(daily|weekly|monthly)){0,2}$/.test(o.tiers)) out.tiers = o.tiers
  if (o.controleDocuments === 'ok' || o.controleDocuments === 'ecart' || o.controleDocuments === 'non_execute') out.controleDocuments = o.controleDocuments
  return out
}

/**
 * Réponse de la tâche « sauvegarde-base » pour un rapport : un échec devient une réponse en erreur au code stable
 * (`sauvegarde_echec_<code>`), donc une exécution ECHEC au journal des tâches et une alerte TACHE_PLANIFIEE_ECHEC.
 * Le code 41 (sauvegarde faite ou en cours sur un autre hôte, profil ha) n'est pas un échec.
 */
export function reponseRapportSauvegarde(r: RapportSauvegarde): { status: number; body: Record<string, unknown> } {
  if (r.statut === 'OK' || r.code === 41) return { status: 200, body: { ok: true, ...r } }
  return { status: 502, body: { ok: false, error: `sauvegarde_echec_${r.code}`, ...r } }
}
