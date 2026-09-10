// ─── Socle de risques par défaut (registre GRC) ──────────────────────────────
// Catalogue de risques « bonnes pratiques » alignés sur la taxonomie Bâle des 7
// catégories de risque opérationnel — pensés d'abord pour le secteur financier
// mais formulés de façon assez générique pour convenir à toute entreprise.
// C'est un POINT DE DÉPART : chaque risque est éditable/complétable ensuite
// (cotation, processus, entité, mesures). Contenu FR (comme les autres
// catalogues socle) ; l'utilisateur ajuste. Pur → testable, importé via l'API.

export interface RiskItemSeed {
  intitule: string
  description: string
  taxonomieCode: string // BALE_1..BALE_7
  proprietaire: string // fonction responsable (générique, à préciser)
}

export function buildRegistreDefaut(): RiskItemSeed[] {
  return [
    // BALE_1 — Fraude interne
    { taxonomieCode: 'BALE_1', proprietaire: 'Direction des risques',
      intitule: 'Détournement d’actifs ou de fonds par un collaborateur',
      description: 'Un collaborateur détourne des fonds, des biens ou des données à son profit (abus de position, falsification, collusion) en contournant les contrôles internes.' },
    { taxonomieCode: 'BALE_1', proprietaire: 'Contrôle interne',
      intitule: 'Contournement des contrôles internes / abus d’habilitations',
      description: 'Utilisation abusive de droits d’accès étendus ou de séparations de tâches insuffisantes pour réaliser ou masquer des opérations irrégulières.' },

    // BALE_2 — Fraude externe
    { taxonomieCode: 'BALE_2', proprietaire: 'RSSI',
      intitule: 'Cyberattaque (rançongiciel, hameçonnage, intrusion)',
      description: 'Compromission du système d’information par un tiers malveillant (rançongiciel, hameçonnage, exploitation de vulnérabilité) entraînant vol, chiffrement ou destruction de données.' },
    { taxonomieCode: 'BALE_2', proprietaire: 'Direction financière',
      intitule: 'Fraude au paiement / faux fournisseur / faux président',
      description: 'Détournement de virements par usurpation d’identité (faux ordre de virement, changement de RIB fournisseur, ingénierie sociale du dirigeant).' },

    // BALE_3 — Pratiques en matière d’emploi et sécurité du travail
    { taxonomieCode: 'BALE_3', proprietaire: 'Direction des ressources humaines',
      intitule: 'Perte de compétences clés / dépendance à un homme-clé',
      description: 'Départ, indisponibilité ou concentration du savoir sur une personne clé sans relève ni documentation, fragilisant une activité critique.' },
    { taxonomieCode: 'BALE_3', proprietaire: 'Direction des ressources humaines',
      intitule: 'Non-conformité au droit social / santé-sécurité au travail',
      description: 'Manquement aux obligations sociales (durée du travail, sécurité, harcèlement) exposant à un contentieux prud’homal ou une sanction administrative.' },

    // BALE_4 — Clients, produits et pratiques commerciales
    { taxonomieCode: 'BALE_4', proprietaire: 'Délégué à la protection des données',
      intitule: 'Manquement à la protection des données personnelles (RGPD)',
      description: 'Traitement de données personnelles non conforme (base légale, information, sécurité, durée de conservation) exposant à une violation et à une sanction CNIL.' },
    { taxonomieCode: 'BALE_4', proprietaire: 'Direction de la conformité',
      intitule: 'Défaut de conseil, information ou pratique commerciale trompeuse',
      description: 'Commercialisation d’un produit/service inadapté ou insuffisamment expliqué au client (défaut de conseil, clauses abusives), source de litige et d’atteinte à la réputation.' },
    { taxonomieCode: 'BALE_4', proprietaire: 'Direction de la conformité',
      intitule: 'Non-conformité LCB-FT / sanctions et gel des avoirs',
      description: 'Défaillance des dispositifs de vigilance (connaissance client, filtrage des sanctions, déclaration de soupçon) exposant à un risque pénal et réglementaire.' },

    // BALE_5 — Dommages aux actifs corporels
    { taxonomieCode: 'BALE_5', proprietaire: 'Services généraux',
      intitule: 'Sinistre affectant les locaux (incendie, dégât des eaux, catastrophe)',
      description: 'Événement physique (incendie, inondation, événement naturel) rendant indisponibles des locaux ou des équipements essentiels à l’activité.' },

    // BALE_6 — Interruption d’activité et pannes de systèmes
    { taxonomieCode: 'BALE_6', proprietaire: 'DSI',
      intitule: 'Indisponibilité majeure du système d’information',
      description: 'Panne, saturation ou erreur d’exploitation rendant indisponibles des applications critiques au-delà du délai acceptable (RTO), interrompant l’activité.' },
    { taxonomieCode: 'BALE_6', proprietaire: 'Direction des achats',
      intitule: 'Défaillance d’un prestataire ou fournisseur critique (cloud, TIC)',
      description: 'Interruption, faillite ou manquement d’un prestataire externalisé essentiel (hébergeur, éditeur SaaS, sous-traitant) sans solution de repli (DORA art. 28).' },
    { taxonomieCode: 'BALE_6', proprietaire: 'Responsable PCA',
      intitule: 'Absence ou inefficacité du plan de continuité d’activité',
      description: 'Plan de continuité/reprise (PCA/PRA) inexistant, obsolète ou jamais testé, empêchant la reprise des activités essentielles dans les délais visés.' },

    // BALE_7 — Exécution, livraison et gestion des processus
    { taxonomieCode: 'BALE_7', proprietaire: 'Direction des opérations',
      intitule: 'Erreur de saisie ou de traitement dans un processus opérationnel',
      description: 'Erreur humaine ou de paramétrage lors de l’exécution d’un processus (saisie, rapprochement, paramètre) générant une perte financière ou une réclamation client.' },
    { taxonomieCode: 'BALE_7', proprietaire: 'Direction comptable et financière',
      intitule: 'Défaut de fiabilité de l’information comptable et financière',
      description: 'Insuffisance de la piste d’audit ou des contrôles comptables entraînant une information financière erronée ou un retard de clôture/reporting.' },
    { taxonomieCode: 'BALE_7', proprietaire: 'Direction juridique',
      intitule: 'Défaut de maîtrise contractuelle ou obligation réglementaire manquée',
      description: 'Contrat mal suivi (échéance, réversibilité, clause de responsabilité) ou obligation réglementaire non respectée, exposant à un litige ou une sanction.' },
  ]
}
