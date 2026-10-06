// ─── Risques types : groupes et forme (PUR, sans dépendance) ──────────────────
// Partagé par le calcul du catalogue (lib/risque-exemples) et l'interface d'import, sans embarquer les packs
// sectoriels dans le code client.

export const GROUPES_RISQUES_TYPES = ['REGISTRE', 'SOUS_SECTEUR', 'ARCHITECTURE', 'SECTEUR', 'TRANSVERSE'] as const
export type GroupeRisqueType = (typeof GROUPES_RISQUES_TYPES)[number]
export interface RisqueType { groupe: GroupeRisqueType; intitule: string; description?: string; gravite: number; vraisemblance: number; domaine?: string; present: boolean }
