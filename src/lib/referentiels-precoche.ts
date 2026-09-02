// ─── Référentiels pré-cochés selon le secteur — cœur pur ─────────────────────
// À l'ouverture d'un Atelier 1 vierge, on pré-sélectionne les référentiels du
// socle de l'organisation qui correspondent aux cadres RECOMMANDÉS pour le
// secteur de l'analyse (ISO 27001, NIS2, DORA…). L'utilisateur peut décocher.

export interface OrgReferentiel { nom: string; description?: string | null; code?: string | null }
export interface PrecheckedRef { nom: string; code: string | null; applicable: boolean; ecarts: string; etatApplication: string }

/** Normalise un nom de référentiel : minuscules, sans espaces ni ponctuation. */
const norm = (s: string): string => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Référentiels de l'org à pré-cocher : ceux dont le `nom` correspond à un cadre
 * recommandé pour le secteur. La comparaison est **tolérante aux suffixes de
 * version** (« ISO/IEC 27001 » ↔ « ISO/IEC 27001:2022 », « CIS Controls » ↔
 * « CIS Controls v8 ») via un préfixe sur les noms normalisés. Retourne des
 * entrées prêtes pour l'état `referentiels` de l'atelier (applicable=true).
 */
export function precheckReferentiels(recommendedNoms: string[], orgReferentiels: OrgReferentiel[]): PrecheckedRef[] {
  const recs = (recommendedNoms ?? []).map(norm).filter(n => n.length >= 3)
  if (recs.length === 0) return []
  const seen = new Set<string>()
  const out: PrecheckedRef[] = []
  for (const r of orgReferentiels ?? []) {
    const on = norm(r?.nom ?? '')
    if (on.length < 3 || seen.has(on)) continue
    if (recs.some(rn => rn === on || rn.startsWith(on) || on.startsWith(rn))) {
      seen.add(on)
      out.push({ nom: r.nom, code: r.code ?? null, applicable: true, ecarts: '', etatApplication: 'APPLIQUE' })
    }
  }
  return out
}
