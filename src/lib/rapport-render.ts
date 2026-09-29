/**
 * rapport-render.ts — Rendu d'une édition (lot L2). Module PUR : résolution des clés
 * i18n, formatage des indicateurs, mise à plat en feuilles (export Excel/CSV). Les
 * éditions stockent des clés ; la langue du lecteur est appliquée à l'affichage.
 */

import type { Bloc, Cellule, Kpi, RapportContenu } from './rapport-model'

export type Traducteur = (cle: string) => string | undefined

export function resoudreCellule(c: Cellule, tr: Traducteur): string | number {
  if (c === null) return ''
  if (typeof c === 'object') return tr(c.k) ?? c.k
  return c
}

export const titreSection = (id: string, tr: Traducteur): string => tr(`rapports.sections.${id}`) ?? id
export const libelleKpi = (cle: string, tr: Traducteur): string => tr(`rapports.kpis.${cle}`) ?? cle
export const libelleColonne = (cle: string, tr: Traducteur): string => tr(cle) ?? cle

export function formaterKpi(k: Kpi, devise: string, locale: string, tr?: Traducteur): string | number {
  if (typeof k.valeur === 'string') return tr?.(`rapports.niveaux.${k.valeur}`) ?? k.valeur
  switch (k.unite) {
    case 'devise': return new Intl.NumberFormat(locale, { style: 'currency', currency: devise, maximumFractionDigits: 0 }).format(k.valeur)
    case 'jours': return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(k.valeur)} ${tr?.('rapports.jours') ?? 'j'}`
    case 'pct': return `${k.valeur} %`
    default: return k.valeur
  }
}

export interface FeuilleExport { nom: string; lignes: (string | number)[][] }

/** Une feuille par section : KPI en paires libellé/valeur, tableaux avec en-têtes traduits. */
export function contenuVersFeuilles(c: RapportContenu, tr: Traducteur, locale: string): FeuilleExport[] {
  return c.sections.map(s => {
    const lignes: (string | number)[][] = []
    for (const b of s.blocs as Bloc[]) {
      if (b.type === 'kpis') for (const k of b.items) lignes.push([libelleKpi(k.cle, tr), formaterKpi(k, c.deviseReference, locale, tr)])
      else if (b.type === 'tableau') {
        lignes.push(b.colonnes.map(x => libelleColonne(x, tr)))
        for (const l of b.lignes) lignes.push(l.map(x => resoudreCellule(x, tr)))
      } else lignes.push([tr(b.cle) ?? b.cle])
    }
    return { nom: titreSection(s.id, tr).slice(0, 31), lignes }
  })
}
