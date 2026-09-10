// ─── Jonction Tiers (écosystème EBIOS) ↔ Registre TIC (DORA art. 28) ─────────
// Les deux registres décrivent le MÊME tiers réel sous deux angles :
//   • PartiePrenante (écosystème) → risque : exposition/fiabilité/menace, criticité
//     « dangerosité » Club EBIOS, consolidée par nom (ConsolidatedTier) ;
//   • ArrangementTic (registre TIC) → contractuel/réglementaire : service TIC,
//     criticité FCI (DORA), LEI, sous-traitance.
// Il n'existe pas d'entité tiers canonique : la CLÉ DE JONCTION est le NOM
// normalisé du prestataire (normalizeTierName), déjà utilisé par la consolidation.
// Ce module PUR relie les deux sens sans écrire ni dupliquer — étape vers une
// future entité `Tier` canonique. Cf. [[acra-tiers-consolidation]].

import { normalizeTierName, type ConsolidatedTier } from './tiers'
import type { ArrangementTic } from './registre-tic'

/** Résumé TIC attaché à un tiers (un prestataire peut avoir plusieurs arrangements). */
export interface TicResume {
  reference: string
  criticite: string
  typeService: string
}
export interface TierAvecTic extends ConsolidatedTier {
  tic: TicResume[]
  estTic: boolean // le tiers figure au registre TIC (au moins un arrangement)
}

/** Résumé écosystème (pire cas) attaché à un arrangement TIC. */
export interface EcoResume {
  menace: number
  zone: string
  critique: boolean
  occurrences: number
}
export interface ArrangementAvecEcosysteme extends ArrangementTic {
  ecosysteme: EcoResume | null
}

/** Index des arrangements par nom de prestataire normalisé (liste par clé). */
function indexArrangements(arrangements: ArrangementTic[]): Map<string, ArrangementTic[]> {
  const m = new Map<string, ArrangementTic[]>()
  for (const a of arrangements) {
    const k = normalizeTierName(a.prestataireNom)
    if (!k) continue
    const g = m.get(k)
    if (g) g.push(a); else m.set(k, [a])
  }
  return m
}

/**
 * Index des tiers consolidés par clé, en retenant le PIRE CAS quand plusieurs
 * entrées partagent la même clé normalisée (menace la plus élevée, critique OU).
 */
function indexTiersWorstCase(tiers: ConsolidatedTier[]): Map<string, EcoResume> {
  const m = new Map<string, EcoResume>()
  for (const t of tiers) {
    const k = t.key || normalizeTierName(t.nom)
    if (!k) continue
    const cur = m.get(k)
    const eco: EcoResume = { menace: t.menace, zone: t.zone, critique: t.critique, occurrences: t.occurrences }
    if (!cur || eco.menace > cur.menace) {
      m.set(k, { ...eco, critique: eco.critique || (cur?.critique ?? false) })
    } else if (eco.critique && !cur.critique) {
      m.set(k, { ...cur, critique: true })
    }
  }
  return m
}

/** Enrichit chaque tiers consolidé de ses arrangements TIC (par nom normalisé). */
export function joinTiersToTic(tiers: ConsolidatedTier[], arrangements: ArrangementTic[]): TierAvecTic[] {
  const index = indexArrangements(arrangements)
  return tiers.map((t) => {
    const k = t.key || normalizeTierName(t.nom)
    const matches = index.get(k) ?? []
    return {
      ...t,
      tic: matches.map((a) => ({ reference: a.reference, criticite: a.criticite, typeService: a.typeService })),
      estTic: matches.length > 0,
    }
  })
}

/** Enrichit chaque arrangement TIC du profil de risque écosystème du tiers (pire cas). */
export function joinArrangementsToEcosysteme(arrangements: ArrangementTic[], tiers: ConsolidatedTier[]): ArrangementAvecEcosysteme[] {
  const index = indexTiersWorstCase(tiers)
  return arrangements.map((a) => ({
    ...a,
    ecosysteme: index.get(normalizeTierName(a.prestataireNom)) ?? null,
  }))
}
