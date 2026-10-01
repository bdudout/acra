/**
 * gabarits.ts — Gabarits sectoriels (lot L5). Module PUR.
 *
 * Un gabarit applique EN UN CLIC un ensemble cohérent de réglages de départ : modules activés, régimes
 * de notification, vocabulaire, rapports mis en avant. Rien n'est verrouillé : tout reste modifiable
 * ensuite. L'aperçu (`planGabarit`) liste uniquement ce qui changerait. Les libellés (nom, description)
 * sont traduits (i18n `personnalisation.gabarits`). Les régimes sont désignés par leur code de catalogue ;
 * aucun contenu réglementaire n'est porté ici.
 */

import type { Vocabulaire } from './vocabulaire'
import type { SectorCode } from './sector-suggestions'

export type ModuleKey = 'registreRisquesActive' | 'incidentsActive' | 'controlePermanentActive' | 'auditInterneActive' | 'kriActive' | 'reglementaireActive' | 'secondeLigneActive'
export const MODULE_KEYS: ModuleKey[] = ['registreRisquesActive', 'incidentsActive', 'controlePermanentActive', 'auditInterneActive', 'kriActive', 'reglementaireActive', 'secondeLigneActive']

export interface Gabarit {
  id: string
  modules: Record<ModuleKey, boolean>
  regimesActifs: string[]
  vocabulaire?: Vocabulaire
  /** Rapports mis en avant (information ; tous restent générables si le module est actif). */
  rapports: string[]
  /** Secteurs d'activité proposés au catalogue de suggestions ; appliqués seulement si l'organisation n'en a déclaré aucun. */
  secteurs?: SectorCode[]
}

const m = (o: Partial<Record<ModuleKey, boolean>>): Record<ModuleKey, boolean> =>
  ({ registreRisquesActive: false, incidentsActive: false, controlePermanentActive: false, auditInterneActive: false, kriActive: false, reglementaireActive: false, secondeLigneActive: true, ...o })

export const GABARITS: Gabarit[] = [
  { id: 'BANQUE', modules: m({ registreRisquesActive: true, incidentsActive: true, controlePermanentActive: true, auditInterneActive: true, kriActive: true, reglementaireActive: true }),
    regimesActifs: ['RGPD_33', 'INTERNE'], rapports: ['R-PER-2', 'R-CTL-2', 'R-AUD-1', 'R-AUD-3', 'R-GRC-3'], secteurs: ['FINANCE'] },
  { id: 'ASSURANCE', modules: m({ registreRisquesActive: true, incidentsActive: true, controlePermanentActive: true, auditInterneActive: true, kriActive: true, reglementaireActive: true }),
    regimesActifs: ['RGPD_33', 'INTERNE'], rapports: ['R-CTL-2', 'R-AUD-3', 'R-GRC-3'], secteurs: ['ASSURANCE'] },
  { id: 'NIS2', modules: m({ registreRisquesActive: true, incidentsActive: true, controlePermanentActive: true }),
    regimesActifs: ['NIS2', 'RGPD_33'], rapports: ['R-INC-1', 'R-GRC-3'] },
  { id: 'SANTE', modules: m({ registreRisquesActive: true, incidentsActive: true, controlePermanentActive: true }),
    regimesActifs: ['RGPD_33', 'INTERNE'], vocabulaire: { incident: { fr: 'Événements indésirables' } }, rapports: ['R-INC-1', 'R-GRC-3'], secteurs: ['SANTE'] },
  { id: 'PUBLIC', modules: m({ registreRisquesActive: true, incidentsActive: true }),
    regimesActifs: ['RGPD_33', 'INTERNE'], rapports: ['R-GRC-3'], secteurs: ['PUBLIC'] },
  { id: 'PME', modules: m({ incidentsActive: true, secondeLigneActive: false }),
    regimesActifs: ['RGPD_33'], rapports: ['R-GRC-3'] },
  { id: 'SAAS', modules: m({ registreRisquesActive: true, incidentsActive: true, controlePermanentActive: true }),
    regimesActifs: ['RGPD_33'], rapports: ['R-CTL-1', 'R-CTL-2'], secteurs: ['SAAS'] },
  { id: 'CABINET', modules: m({ registreRisquesActive: true, incidentsActive: true, controlePermanentActive: true, auditInterneActive: true }),
    regimesActifs: [], rapports: ['R-GRC-3'], secteurs: ['SERVICES'] },
]

export const gabaritParId = (id: string): Gabarit | null => GABARITS.find(g => g.id === id) ?? null

export interface EtatOrg { modules: Partial<Record<ModuleKey, boolean>>; regimesActifs: string[]; vocabulaire: Vocabulaire; secteurs?: string[] }
export interface Changement { type: 'MODULE' | 'REGIME' | 'VOCAB' | 'SECTEUR'; cle: string; avant: boolean | string | null; apres: boolean | string | null }
export interface PlanGabarit {
  changements: Changement[]
  patch: { modules: Record<ModuleKey, boolean>; regimesActifs: string[]; vocabulaire: Vocabulaire; secteurs: SectorCode[] | null }
}

const CATALOGUE_REGIMES_CODES = ['NIS2', 'RGPD_33', 'INTERNE']

/**
 * Aperçu d'application : modules (état exact du gabarit), régimes de catalogue (actifs = ceux du gabarit),
 * vocabulaire (ajouté seulement là où l'organisation n'a rien personnalisé), secteurs d'activité (seulement si
 * l'organisation n'en a aucun). Ne liste que les différences.
 */
export function planGabarit(id: string, courant: EtatOrg): PlanGabarit | null {
  const g = gabaritParId(id)
  if (!g) return null
  const changements: Changement[] = []
  for (const k of MODULE_KEYS) {
    const avant = courant.modules[k] ?? false
    if (avant !== g.modules[k]) changements.push({ type: 'MODULE', cle: k, avant, apres: g.modules[k] })
  }
  for (const r of CATALOGUE_REGIMES_CODES) {
    const avant = courant.regimesActifs.includes(r); const apres = g.regimesActifs.includes(r)
    if (avant !== apres) changements.push({ type: 'REGIME', cle: r, avant, apres })
  }
  const vocabulaire: Vocabulaire = { ...courant.vocabulaire }
  for (const [terme, labels] of Object.entries(g.vocabulaire ?? {}) as [keyof Vocabulaire, Record<string, string>][]) {
    if (courant.vocabulaire[terme]) continue // déjà personnalisé : jamais écrasé
    vocabulaire[terme] = labels
    for (const [lang, label] of Object.entries(labels)) changements.push({ type: 'VOCAB', cle: `${terme}:${lang}`, avant: null, apres: label })
  }
  // Secteurs : proposés seulement à une organisation qui n'en a déclaré aucun (jamais d'écrasement).
  const secteurs = !(courant.secteurs?.length) && g.secteurs?.length ? g.secteurs : null
  for (const code of secteurs ?? []) changements.push({ type: 'SECTEUR', cle: code, avant: null, apres: true })
  return { changements, patch: { modules: g.modules, regimesActifs: g.regimesActifs, vocabulaire, secteurs } }
}
