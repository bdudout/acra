/**
 * famille-risque-tic.ts — Axe « famille de risque TIC » du registre (RiskItem.familleRisqueTic). Module PUR.
 *
 * Axe DISTINCT de la taxonomie (catégories de Bâle par défaut ou taxonomie propre à l'organisation) :
 * un risque peut porter les deux. Cinq familles :
 *  - IT : risque informatique (exploitation, changement, obsolescence) ;
 *  - CYBER : cybersécurité (attaque, compromission, fuite) ;
 *  - CONTINUITE_METIER_TIC : continuité d'activité liée aux TIC, vue métier (BIA, RTO/RPO, tolérance d'impact) ;
 *  - CONTINUITE_IT : continuité informatique (PCA/PRA du système d'information) ;
 *  - TIERS_TIC : risque lié aux TIC induit par des prestataires tiers de services TIC
 *    (DORA — règlement (UE) 2022/2554, chapitre V ; NIS2 — directive (UE) 2022/2555, art. 21, § 2, point d).
 * Libellés : t.registre.familleTic (i18n ×5).
 */

export const FAMILLES_RISQUE_TIC = ['IT', 'CYBER', 'CONTINUITE_METIER_TIC', 'CONTINUITE_IT', 'TIERS_TIC'] as const
/** Code d'une famille de risque TIC. */
export type FamilleRisqueTic = (typeof FAMILLES_RISQUE_TIC)[number]

/** Vrai si `v` est un code de famille de risque TIC connu (sensible à la casse). */
export const isFamilleRisqueTic = (v: unknown): v is FamilleRisqueTic =>
  typeof v === 'string' && (FAMILLES_RISQUE_TIC as readonly string[]).includes(v)

/** Normalise une saisie : code connu (espaces retirés) ou null. */
export function cleanFamilleRisqueTic(v: unknown): FamilleRisqueTic | null {
  const s = typeof v === 'string' ? v.trim() : v
  return isFamilleRisqueTic(s) ? s : null
}

/** Famille déduite du domaine d'un risque Projet 360 (CYBER, IT, OUTSOURCING) ; les autres domaines → null. */
export function familleDepuisDomaine360(domaine: string | null | undefined): FamilleRisqueTic | null {
  switch (domaine) {
    case 'CYBER': return 'CYBER'
    case 'IT': return 'IT'
    case 'OUTSOURCING': return 'TIERS_TIC'
    default: return null
  }
}

/**
 * Famille des risques du catalogue concernés (clés de catalogue-risks / sector-suggestions).
 * Classement proposé, à revoir avec la revue métier ; une entrée absente n'a pas de famille TIC.
 */
export const FAMILLE_CATALOGUE: Record<string, FamilleRisqueTic> = {
  'core.risk.ransomware': 'CYBER', 'core.risk.data-leak': 'CYBER', 'core.risk.privileged-access': 'CYBER',
  'core.risk.leavers': 'CYBER', 'core.risk.unpatched': 'CYBER', 'core.risk.detection-gap': 'CYBER',
  'core.risk.it-outage': 'IT',
  'core.risk.backup-failure': 'CONTINUITE_IT',
  'core.risk.continuity-plan': 'CONTINUITE_METIER_TIC',
  'core.risk.supplier-contract': 'TIERS_TIC',
  'saas.risk.release': 'IT', 'saas.risk.integration': 'IT', 'telecom.risk.config-change': 'IT',
  'saas.risk.tenant-isolation': 'CYBER', 'saas.risk.secrets': 'CYBER', 'energie.risk.scada': 'CYBER',
  'saas.risk.tenant-restore': 'CONTINUITE_IT',
  'saas.risk.cloud-outage': 'TIERS_TIC',
}

/** Famille TIC d'une entrée du catalogue, ou null si elle n'en relève pas. */
export const familleCatalogue = (key: string): FamilleRisqueTic | null => FAMILLE_CATALOGUE[key] ?? null
