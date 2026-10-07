// ─── Fichiers d'un projet 360 (schémas, documents d'architecture, documents projet) — PUR ─
// Stockés comme les documents de la GED (modèle Document, octets hors base, mêmes contrôles de taille / MIME /
// signature — lib/document) mais rattachés à l'analyse projet (Document.analyseId) : visibles des seules personnes
// qui accèdent au projet, exclus de la bibliothèque documentaire. Testé : fichiers-projet.test.ts.

export const FICHIER_PROJET_TYPES = ['SCHEMA', 'ARCHITECTURE', 'PROJET', 'AUTRE'] as const
export type FichierProjetType = (typeof FICHIER_PROJET_TYPES)[number]

export function nettoyerFichierProjet(meta: { type?: unknown; titre?: unknown }, fichierNom: string): { type: FichierProjetType; titre: string } {
  const type = FICHIER_PROJET_TYPES.includes(meta.type as FichierProjetType) ? meta.type as FichierProjetType : 'AUTRE'
  const titre = (typeof meta.titre === 'string' ? meta.titre.trim() : '') || fichierNom
  return { type, titre: titre.slice(0, 200) }
}
