// ─── Packs comités — assemblage de la donnée d'un dossier de comité ──────────
// Un « pack comité » consolide, pour une réunion de gouvernance (comité des
// risques, de conformité, incidents…), les indicateurs clés des modules actifs
// et remonte des points d'alerte. PURE et testée ; le PDF ne fait que rendre.
// Les libellés restent au template (i18n) : ce module ne produit que des CLÉS.

export const COMITE_TYPES = ['RISQUES', 'CONFORMITE', 'INCIDENTS'] as const
export type ComiteType = (typeof COMITE_TYPES)[number]

export interface ComiteConsolide {
  risques?: { total: number; eleve: number; moyen: number; faible: number; nonCote: number }
  actions?: { total: number; faits: number; enRetard: number; tauxAvancement: number }
  appetit?: { horsAppetit: number; dansAppetit: number; evalues: number }
  incidents?: { total: number; ouverts: number; perteNette: number }
  controles?: { tauxConformite: number | null; anomalies: number }
  audit?: { critiques: number; recosEnRetard: number }
  regulateur?: { echues: number; sous30j: number }
  kri?: { enAlerte: number; critique: number }
  dora?: { majeurs: number; evalues: number }
}

export interface ComiteModules {
  risques: boolean; appetit: boolean; incidents: boolean; controles: boolean
  audit: boolean; regulateur: boolean; kri: boolean; dora: boolean
}

export interface ComiteMetric { key: string; value: number | string; alerte?: boolean }
export interface ComiteSection { id: string; metrics: ComiteMetric[] }
export interface ComiteHighlight { key: string; niveau: 'alerte' | 'info'; value: number }
export interface ComitePack {
  type: ComiteType
  sections: ComiteSection[]
  highlights: ComiteHighlight[]
}

const CONFORMITE_SEUIL = 80

/** Ordre canonique des sections, réordonné selon le type de comité (priorité). */
const ORDRE_BASE = ['risques', 'appetit', 'incidents', 'controles', 'audit', 'regulateur', 'kri', 'dora'] as const

function ordrePourType(type: ComiteType): readonly string[] {
  if (type === 'CONFORMITE') return ['controles', 'audit', 'regulateur', 'risques', 'appetit', 'kri', 'incidents', 'dora']
  if (type === 'INCIDENTS') return ['incidents', 'dora', 'regulateur', 'kri', 'risques', 'controles', 'audit', 'appetit']
  return ORDRE_BASE
}

export function buildComitePack(type: ComiteType, c: ComiteConsolide, m: ComiteModules): ComitePack {
  const sectionsById = new Map<string, ComiteSection>()

  if (m.risques && c.risques) {
    const metrics: ComiteMetric[] = [
      { key: 'total', value: c.risques.total },
      { key: 'eleve', value: c.risques.eleve, alerte: c.risques.eleve > 0 },
      { key: 'moyen', value: c.risques.moyen },
      { key: 'faible', value: c.risques.faible },
      { key: 'nonCote', value: c.risques.nonCote },
    ]
    if (c.actions) {
      metrics.push(
        { key: 'actionsTotal', value: c.actions.total },
        { key: 'avancement', value: `${c.actions.tauxAvancement}%` },
        { key: 'actionsEnRetard', value: c.actions.enRetard, alerte: c.actions.enRetard > 0 },
      )
    }
    sectionsById.set('risques', { id: 'risques', metrics })
  }

  if (m.appetit && c.appetit) {
    sectionsById.set('appetit', { id: 'appetit', metrics: [
      { key: 'horsAppetit', value: c.appetit.horsAppetit, alerte: c.appetit.horsAppetit > 0 },
      { key: 'dansAppetit', value: c.appetit.dansAppetit },
      { key: 'evalues', value: c.appetit.evalues },
    ] })
  }

  if (m.incidents && c.incidents) {
    sectionsById.set('incidents', { id: 'incidents', metrics: [
      { key: 'total', value: c.incidents.total },
      { key: 'ouverts', value: c.incidents.ouverts, alerte: c.incidents.ouverts > 0 },
      { key: 'perteNette', value: c.incidents.perteNette },
    ] })
  }

  if (m.controles && c.controles) {
    const taux = c.controles.tauxConformite
    sectionsById.set('controles', { id: 'controles', metrics: [
      { key: 'tauxConformite', value: taux == null ? '—' : `${taux}%`, alerte: taux != null && taux < CONFORMITE_SEUIL },
      { key: 'anomalies', value: c.controles.anomalies, alerte: c.controles.anomalies > 0 },
    ] })
  }

  if (m.audit && c.audit) {
    sectionsById.set('audit', { id: 'audit', metrics: [
      { key: 'critiques', value: c.audit.critiques, alerte: c.audit.critiques > 0 },
      { key: 'recosEnRetard', value: c.audit.recosEnRetard, alerte: c.audit.recosEnRetard > 0 },
    ] })
  }

  if (m.regulateur && c.regulateur) {
    sectionsById.set('regulateur', { id: 'regulateur', metrics: [
      { key: 'echues', value: c.regulateur.echues, alerte: c.regulateur.echues > 0 },
      { key: 'sous30j', value: c.regulateur.sous30j },
    ] })
  }

  if (m.kri && c.kri) {
    sectionsById.set('kri', { id: 'kri', metrics: [
      { key: 'enAlerte', value: c.kri.enAlerte, alerte: c.kri.enAlerte > 0 },
      { key: 'critique', value: c.kri.critique, alerte: c.kri.critique > 0 },
    ] })
  }

  if (m.dora && c.dora) {
    sectionsById.set('dora', { id: 'dora', metrics: [
      { key: 'majeurs', value: c.dora.majeurs, alerte: c.dora.majeurs > 0 },
      { key: 'evalues', value: c.dora.evalues },
    ] })
  }

  const sections: ComiteSection[] = ordrePourType(type)
    .map(id => sectionsById.get(id))
    .filter((s): s is ComiteSection => s != null)

  // Points d'alerte (uniquement pour les modules actifs).
  const highlights: ComiteHighlight[] = []
  const push = (cond: boolean, key: string, niveau: 'alerte' | 'info', value: number) => {
    if (cond) highlights.push({ key, niveau, value })
  }
  if (m.appetit && c.appetit) push(c.appetit.horsAppetit > 0, 'horsAppetit', 'alerte', c.appetit.horsAppetit)
  if (m.risques && c.actions) push(c.actions.enRetard > 0, 'actionsEnRetard', 'alerte', c.actions.enRetard)
  if (m.controles && c.controles && c.controles.tauxConformite != null) push(c.controles.tauxConformite < CONFORMITE_SEUIL, 'conformiteFaible', 'alerte', c.controles.tauxConformite)
  if (m.audit && c.audit) push(c.audit.critiques > 0, 'constatsCritiques', 'alerte', c.audit.critiques)
  if (m.regulateur && c.regulateur) push(c.regulateur.echues > 0, 'regulateurEchu', 'alerte', c.regulateur.echues)
  if (m.kri && c.kri) push(c.kri.critique > 0, 'kriCritique', 'alerte', c.kri.critique)
  if (m.dora && c.dora) push(c.dora.majeurs > 0, 'doraMajeurs', 'alerte', c.dora.majeurs)
  if (m.incidents && c.incidents) push(c.incidents.ouverts > 0, 'incidentsOuverts', 'info', c.incidents.ouverts)

  return { type, sections, highlights }
}
