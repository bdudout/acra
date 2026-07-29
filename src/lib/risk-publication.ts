// ─── Socle GRC — M1 : publication ACRA → registre canonique ──────────────────
// Convertit les risques d'une analyse EBIOS RM approuvée en entrées de RiskItem
// (provenance ACRA, traçabilité vers le risque source). Logique PURE : la couche
// API gère le périmètre, l'upsert et l'idempotence (clé provenance+source).

export interface AcraRisqueSource {
  id: string
  nom: string
  description: string | null
  gravite: number
  vraisemblance: number
  graviteResiduelle: number | null
  vraisemblanceResiduelle: number | null
}

export interface AcraAnalyseSource {
  id: string
  nom: string
  organisation: string | null
}

export interface PublishedRiskItem {
  intitule: string
  description: string | null
  entite: string | null
  graviteInherente: number | null
  vraisemblanceInherente: number | null
  graviteResiduelle: number | null
  vraisemblanceResiduelle: number | null
  statut: string
  provenance: 'ACRA'
  sourceType: 'analyse'
  sourceId: string // id du risque ACRA (clé d'idempotence, unique par risque)
}

// Clampe une cote dans [1, 5] (le registre cote sur 5, ACRA sur 4) ; null passe.
function cote(n: number | null | undefined): number | null {
  if (n == null || Number.isNaN(n)) return null
  return Math.max(1, Math.min(5, Math.round(n)))
}

// Un risque ACRA dont le résiduel est renseigné est considéré « traité »,
// sinon « évalué » (il a une cotation inhérente). Cf. RISK_STATUTS.
export function mapRisqueToRiskItem(risque: AcraRisqueSource, analyse: AcraAnalyseSource): PublishedRiskItem {
  const gr = cote(risque.graviteResiduelle)
  const vr = cote(risque.vraisemblanceResiduelle)
  const traite = gr != null && vr != null
  return {
    intitule: risque.nom,
    description: risque.description ?? null,
    entite: analyse.organisation ?? null,
    graviteInherente: cote(risque.gravite),
    vraisemblanceInherente: cote(risque.vraisemblance),
    graviteResiduelle: gr,
    vraisemblanceResiduelle: vr,
    statut: traite ? 'TRAITE' : 'EVALUE',
    provenance: 'ACRA',
    sourceType: 'analyse',
    sourceId: risque.id,
  }
}

export function mapAnalyseRisques(risques: AcraRisqueSource[], analyse: AcraAnalyseSource): PublishedRiskItem[] {
  return risques.map(r => mapRisqueToRiskItem(r, analyse))
}
