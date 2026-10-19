// ─── Tableau de bord : statut affiché et indicateurs des analyses ─────────────
// Recette n° 62 : statut RÉEL de chaque analyse (pas « En cours » pour tout ce qui n'est pas
// TERMINE) et analyses approuvées comptées avec les terminées. Libellés : `t.statusLabels[cle]`.

export type StatutAnalyseAffiche = 'EN_COURS' | 'SOUMIS' | 'APPROUVE' | 'REJETE' | 'TERMINE'
export type TonStatut = 'encours' | 'soumis' | 'finalise' | 'rejete'

const TONS: Record<StatutAnalyseAffiche, TonStatut> = {
  EN_COURS: 'encours', SOUMIS: 'soumis', APPROUVE: 'finalise', REJETE: 'rejete', TERMINE: 'finalise',
}

/** Classes de badge par teinte (statiques, hors i18n). */
export const CLASSES_TON: Record<TonStatut, string> = {
  encours:  'bg-orange-100 text-orange-700',
  soumis:   'bg-blue-100 text-blue-700',
  finalise: 'bg-green-100 text-green-700',
  rejete:   'bg-red-100 text-red-700',
}

/** Statut à afficher (clé de `t.statusLabels`) et sa teinte ; statut inconnu → EN_COURS. */
export function statutAnalyseAffiche(statut: string | null | undefined): { cle: StatutAnalyseAffiche; ton: TonStatut } {
  const cle = (statut && statut in TONS ? statut : 'EN_COURS') as StatutAnalyseAffiche
  return { cle, ton: TONS[cle] }
}

/** Analyse arrivée au bout du cycle : approuvée ou terminée. */
export function estFinalisee(statut: string | null | undefined): boolean {
  return statut === 'APPROUVE' || statut === 'TERMINE'
}

/** Compteurs des KPI (« En cours » = EN_COURS, comme le filtre `?filter=en_cours` de la liste). */
export function compterStatutsAnalyses(analyses: { statut: string | null }[]) {
  const n = (s: string) => analyses.filter(a => a.statut === s).length
  return {
    total: analyses.length,
    enCours: n('EN_COURS'),
    soumises: n('SOUMIS'),
    approuvees: n('APPROUVE'),
    rejetees: n('REJETE'),
    terminees: n('TERMINE'),
    finalisees: analyses.filter(a => estFinalisee(a.statut)).length,
  }
}
