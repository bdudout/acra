// ─── Activations rangées par menu de navigation (PUR) ─────────────────────────
// Les fonctionnalités de l'organisation (Configuration) et la politique d'instance (Administration › Instance) sont
// présentées sous les menus de la barre de navigation, dans le même ordre (cf. lib/navigation), pour qu'un administrateur
// retrouve chaque module là où il apparaît. Les réglages transverses vont dans « Général ». Testé : fonctionnalites-menus.test.ts.
import type { GovernableModule } from './module-policy'

export type MenuFonctionnalite = 'pilotage' | 'analyses' | 'registre' | 'controleAudit' | 'conformite' | 'reglementaire' | 'general'
export const MENUS_FONCTIONNALITES: MenuFonctionnalite[] = ['pilotage', 'analyses', 'registre', 'controleAudit', 'conformite', 'reglementaire', 'general']

const MENU_DU_CHAMP: Record<string, MenuFonctionnalite> = {
  // Pilotage : appétence (RAS / RAD) et KRI.
  kriActive: 'pilotage', appetenceActive: 'pilotage',
  // Gestion des risques : déroulé des analyses et projets 360.
  qualificationActive: 'analyses', qualificationObligatoire: 'analyses', conseilsAteliersActive: 'analyses',
  acceptationRisquesActive: 'analyses', gelApresAcceptationActive: 'analyses', interdireAutoApprobation: 'analyses', projets360Active: 'analyses',
  // Registres : risques, campagnes RCSA, incidents, IA, registre du sous-traitant (RGPD).
  registreRisquesActive: 'registre', campagnesRcsaActive: 'registre', incidentsActive: 'registre', registreIaActive: 'registre', ropaSousTraitantActive: 'registre',
  // Contrôle & audit.
  controlePermanentActive: 'controleAudit', auditInterneActive: 'controleAudit',
  // Conformité : référentiels, dérogations, maturité, homologations, revues d'habilitations.
  conformiteActive: 'conformite', derogationsActive: 'conformite', profilsOperationnelsActive: 'conformite',
  homologationsActive: 'conformite', recertificationActive: 'conformite',
  // Réglementaire : DORA et rapports.
  reglementaireActive: 'reglementaire', rapportsGrcActive: 'reglementaire',
  // Général : organisation des rôles et accès des assistants.
  petiteStructure: 'general', secondeLigneActive: 'general', mcpActive: 'general',
}

/** Menu d'un champ de configuration (`<module>Active`…) ; inconnu ⇒ « Général ». */
export function menuDuChamp(champ: string): MenuFonctionnalite {
  return MENU_DU_CHAMP[champ] ?? 'general'
}

/** Menu d'un module gouverné par la politique d'instance (son champ est `<module>Active`). */
export function menuDuModule(m: GovernableModule): MenuFonctionnalite {
  return menuDuChamp(`${m}Active`)
}

/** Regroupe des éléments par menu, dans l'ordre des menus ; l'ordre interne est conservé, les groupes vides omis. */
export function grouperParMenu<T>(items: T[], menuDe: (item: T) => MenuFonctionnalite): { menu: MenuFonctionnalite; items: T[] }[] {
  return MENUS_FONCTIONNALITES
    .map(menu => ({ menu, items: items.filter(i => menuDe(i) === menu) }))
    .filter(g => g.items.length > 0)
}
