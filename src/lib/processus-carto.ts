/**
 * processus-carto.ts — Processus de cartographie des risques (PUR).
 *
 * Explique comment la cartographie est construite et tenue à jour (identification,
 * évaluation, traitement, suivi et revue, communication — démarche ISO 31000:2018),
 * avec un texte par défaut traduit (i18n) que la gouvernance de l'organisation peut
 * personnaliser étape par étape (OrganizationConfig.processusCartographie, hérité
 * dans l'arbre d'organisations), et la périodicité de revue de la cartographie.
 */

export const ETAPES_CARTO = ['identification', 'evaluation', 'traitement', 'suivi', 'communication'] as const
export type EtapeCarto = (typeof ETAPES_CARTO)[number]
export const PERIODICITES = ['TRIMESTRIELLE', 'SEMESTRIELLE', 'ANNUELLE'] as const
export type Periodicite = (typeof PERIODICITES)[number]
const MOIS: Record<Periodicite, number> = { TRIMESTRIELLE: 3, SEMESTRIELLE: 6, ANNUELLE: 12 }

export interface EtapeCartoTexte { key: EtapeCarto; titre: string; description: string; responsable?: string; frequence?: string }
export interface ProcessusCarto { introduction?: string; periodicite: Periodicite; etapes: EtapeCartoTexte[] }

const txt = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)
const isEtape = (v: unknown): v is EtapeCarto => typeof v === 'string' && (ETAPES_CARTO as readonly string[]).includes(v)
const isPeriodicite = (v: unknown): v is Periodicite => typeof v === 'string' && (PERIODICITES as readonly string[]).includes(v)

/** Personnalisation saisie : étapes connues seulement, textes bornés ; défaut ANNUELLE. */
export function sanitizeProcessusCarto(input: unknown): ProcessusCarto {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const etapes: EtapeCartoTexte[] = []
  const seen = new Set<string>()
  for (const raw of Array.isArray(o.etapes) ? o.etapes : []) {
    if (!raw || typeof raw !== 'object') continue
    const e = raw as Record<string, unknown>
    if (!isEtape(e.key) || seen.has(e.key)) continue
    seen.add(e.key)
    const out: EtapeCartoTexte = { key: e.key, titre: txt(e.titre, 120) ?? '', description: txt(e.description, 2000) ?? '' }
    const responsable = txt(e.responsable, 120); if (responsable) out.responsable = responsable
    const frequence = txt(e.frequence, 80); if (frequence) out.frequence = frequence
    etapes.push(out)
  }
  const introduction = txt(o.introduction, 3000)
  return { ...(introduction ? { introduction } : {}), periodicite: isPeriodicite(o.periodicite) ? o.periodicite : 'ANNUELLE', etapes }
}

/** Processus effectif : défaut traduit surchargé étape par étape (champ vide = défaut). */
export function resolveProcessusCarto(custom: unknown, defaults: { key: EtapeCarto; titre: string; description: string }[]): ProcessusCarto {
  const c = sanitizeProcessusCarto(custom)
  const byKey = new Map(c.etapes.map(e => [e.key, e]))
  return {
    ...(c.introduction ? { introduction: c.introduction } : {}),
    periodicite: c.periodicite,
    etapes: ETAPES_CARTO.map(key => {
      const d = defaults.find(x => x.key === key) ?? { key, titre: key, description: '' }
      const e = byKey.get(key)
      return { ...d, ...(e ? { titre: e.titre || d.titre, description: e.description || d.description, ...(e.responsable ? { responsable: e.responsable } : {}), ...(e.frequence ? { frequence: e.frequence } : {}) } : {}) }
    }),
  }
}

/** Date de la prochaine revue : dernière mise à jour + périodicité. */
export function prochaineRevue(derniere: Date, periodicite: Periodicite): Date {
  const d = new Date(derniere)
  d.setUTCMonth(d.getUTCMonth() + MOIS[periodicite])
  return d
}

/** Statut de revue : jamais faite, à jour, bientôt (< 30 jours), en retard. */
export function statutRevue(derniere: Date | null, periodicite: Periodicite, now: Date): 'JAMAIS' | 'A_JOUR' | 'BIENTOT' | 'EN_RETARD' {
  if (!derniere) return 'JAMAIS'
  const next = prochaineRevue(derniere, periodicite).getTime()
  if (now.getTime() > next) return 'EN_RETARD'
  return next - now.getTime() < 30 * 86_400_000 ? 'BIENTOT' : 'A_JOUR'
}
