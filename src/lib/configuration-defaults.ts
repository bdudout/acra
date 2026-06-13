export const DEFAULT_ECHELLE_GRAVITE_4 = [
  { niveau: 1, label: 'Mineure',    description: "Conséquences négligeables pour l'organisation. Aucun impact opérationnel.", couleur: '#22c55e' },
  { niveau: 2, label: 'Limitée',   description: 'Conséquences significatives mais limitées. Fonctionnement en mode dégradé.', couleur: '#f59e0b' },
  { niveau: 3, label: 'Importante', description: 'Conséquences importantes. Forte dégradation, fonctionnement très dégradé.', couleur: '#f97316' },
  { niveau: 4, label: 'Critique',   description: "Conséquences désastreuses, survie de l'organisation menacée.", couleur: '#ef4444' },
]

export const DEFAULT_ECHELLE_GRAVITE_5 = [
  { niveau: 1, label: 'Mineure',        description: 'Conséquences négligeables. Aucun impact opérationnel.', couleur: '#22c55e' },
  { niveau: 2, label: 'Significative',  description: 'Conséquences significatives mais limitées. Mode dégradé.', couleur: '#84cc16' },
  { niveau: 3, label: 'Grave',          description: 'Conséquences importantes. Forte dégradation, mode très dégradé.', couleur: '#f59e0b' },
  { niveau: 4, label: 'Critique',       description: "Conséquences désastreuses, survie de l'organisation menacée.", couleur: '#ef4444' },
  { niveau: 5, label: 'Catastrophique', description: "Conséquences sectorielles ou régaliennes au-delà de l'organisation.", couleur: '#7f1d1d' },
]

export const DEFAULT_ECHELLE_VRAISEMBLANCE_4 = [
  { niveau: 1, label: 'Minime',       description: "L'événement ne devrait pas se produire. Précédents rares ou inexistants.", couleur: '#22c55e' },
  { niveau: 2, label: 'Significative', description: "L'événement pourrait se produire. Quelques précédents connus.", couleur: '#f59e0b' },
  { niveau: 3, label: 'Forte',        description: "L'événement devrait se produire. Précédents fréquents dans le secteur.", couleur: '#f97316' },
  { niveau: 4, label: 'Maximale',     description: "L'événement se produira certainement. Attaques en cours connues.", couleur: '#ef4444' },
]

export const DEFAULT_ECHELLE_VRAISEMBLANCE_5 = [
  { niveau: 1, label: 'Très improbable', description: "L'événement ne devrait pas se produire. Aucun précédent.", couleur: '#22c55e' },
  { niveau: 2, label: 'Minime',          description: "L'événement ne devrait pas se produire. Précédents rares.", couleur: '#84cc16' },
  { niveau: 3, label: 'Significative',   description: "L'événement pourrait se produire. Quelques précédents.", couleur: '#f59e0b' },
  { niveau: 4, label: 'Forte',           description: "L'événement devrait se produire. Précédents fréquents.", couleur: '#ef4444' },
  { niveau: 5, label: 'Maximale',        description: "L'événement se produira certainement.", couleur: '#7f1d1d' },
]

// Seuils alignés sur getNiveauRisqueLabel (source historique utilisée par les
// listes, le dashboard et la page risques) pour garantir la cohérence
// matrice ↔ listes : Faible 1-3, Modéré 4-7, Élevé 8-11, Critique 12+.
export const DEFAULT_SEUILS_MATRICE = [
  { scoreMin: 1,  scoreMax: 3,  label: 'Faible',   couleur: '#22c55e' },
  { scoreMin: 4,  scoreMax: 7,  label: 'Modéré',   couleur: '#f59e0b' },
  { scoreMin: 8,  scoreMax: 11, label: 'Élevé',    couleur: '#f97316' },
  { scoreMin: 12, scoreMax: 25, label: 'Critique',  couleur: '#ef4444' },
]

export function buildDefaultConfig(nbNiveaux: number) {
  return {
    nbNiveaux,
    echelleGravite:       nbNiveaux === 5 ? DEFAULT_ECHELLE_GRAVITE_5       : DEFAULT_ECHELLE_GRAVITE_4,
    echelleVraisemblance: nbNiveaux === 5 ? DEFAULT_ECHELLE_VRAISEMBLANCE_5 : DEFAULT_ECHELLE_VRAISEMBLANCE_4,
    seuilsMatrice:        DEFAULT_SEUILS_MATRICE,
  }
}
