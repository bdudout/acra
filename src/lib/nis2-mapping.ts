/**
 * nis2-mapping.ts — Couverture des 10 mesures NIS2 (Art. 21 §2 a→j) par un
 * référentiel de mesures.
 *
 * NIS2 (transposée en droit français en oct. 2024) impose 10 mesures minimales de
 * gestion des risques. ACRA aligne les contrôles d'un référentiel sur ces mesures
 * par recouvrement de mots-clés (heuristique, pas de tag manuel sur les catalogues)
 * → affiche aux EEI/OSE quelles mesures Art. 21 sont couvertes. 100 % local.
 *
 * Module pur → testé unitairement (nis2-mapping.test.ts).
 */
import { getFrameworkControles } from '@/lib/frameworks-data'

export interface Nis2Measure {
  /** Lettre de l'Art. 21 §2 (a → j). */
  id: string
  /** Libellé court (FR, comme les contrôles de référentiel). */
  label: string
  /** Mots-clés (minuscules, sans accents) servant au recouvrement. */
  keywords: string[]
}

export const NIS2_ART21_MEASURES: Nis2Measure[] = [
  { id: 'a', label: "Analyse des risques et politique de sécurité des SI", keywords: ['risque', 'politique de securite', 'gouvernance', 'cadre de gestion', 'analyse de risque'] },
  { id: 'b', label: 'Gestion des incidents', keywords: ['incident', 'detection', 'notification', 'reponse aux incident', 'journalisation'] },
  { id: 'c', label: 'Continuité d’activité (sauvegarde, reprise, gestion de crise)', keywords: ['continuite', 'sauvegarde', 'reprise', 'restauration', 'crise', 'rto', 'rpo', 'pca', 'pra'] },
  { id: 'd', label: 'Sécurité de la chaîne d’approvisionnement', keywords: ['chaine d', 'fournisseur', 'prestataire', 'sous-traitant', 'supply chain', 'tiers', 'approvisionnement'] },
  { id: 'e', label: 'Sécurité de l’acquisition, du développement et de la maintenance (vulnérabilités)', keywords: ['developpement', 'acquisition', 'maintenance', 'vulnerabilite', 'changement', 'correctif', 'patch'] },
  { id: 'f', label: 'Évaluation de l’efficacité des mesures de gestion des risques', keywords: ['efficacite', 'audit', 'evaluation', 'supervision', 'revue', 'controle', 'indicateur'] },
  { id: 'g', label: 'Hygiène informatique de base et formation', keywords: ['hygiene', 'sensibilisation', 'formation'] },
  { id: 'h', label: 'Cryptographie et chiffrement', keywords: ['chiffrement', 'cryptographie', 'crypto'] },
  { id: 'i', label: 'Sécurité RH, contrôle d’accès et gestion des actifs', keywords: ['acces', 'habilitation', 'actif', 'inventaire', 'ressources humaines', 'privilege', 'identite'] },
  { id: 'j', label: 'Authentification multifacteur et communications sécurisées', keywords: ['multifacteur', 'mfa', 'authentification forte', 'communication securisee', 'authentification a deux'] },
]

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export interface Nis2Coverage {
  id: string
  label: string
  covered: boolean
  /** Références des contrôles du référentiel qui couvrent la mesure. */
  controls: string[]
}

/**
 * Couverture des 10 mesures NIS2 Art. 21 par les contrôles d'un référentiel.
 * Une mesure est « couverte » dès qu'au moins un contrôle correspond.
 */
export function nis2CoverageForFramework(frameworkId: string): Nis2Coverage[] {
  const controles = getFrameworkControles(frameworkId)
  return NIS2_ART21_MEASURES.map(m => {
    const matched = controles.filter(c => {
      const hay = normalize(`${c.nom ?? ''} ${c.description ?? ''}`)
      return m.keywords.some(k => hay.includes(k))
    })
    return { id: m.id, label: m.label, covered: matched.length > 0, controls: matched.map(c => c.ref) }
  })
}

/** Nombre de mesures NIS2 Art. 21 couvertes (0..10) par un référentiel. */
export function nis2CoveredCount(frameworkId: string): number {
  return nis2CoverageForFramework(frameworkId).filter(m => m.covered).length
}
