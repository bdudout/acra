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

// Les libellés du contrôle permanent (L3) et de l'audit (L4) vivent dans des sous-blocs dédiés
// (`…Ctl`, `…Aud`) : repli après les libellés communs.
const SUFFIXES = ['', 'Ctl', 'Aud'] as const
const premier = (tr: Traducteur, base: string, cle: string): string | undefined => {
  for (const suf of SUFFIXES) { const v = tr(`rapports.${base}${suf}.${cle}`); if (v !== undefined) return v }
  return undefined
}
export const titreSection = (id: string, tr: Traducteur): string => premier(tr, 'sections', id) ?? id
export const libelleKpi = (cle: string, tr: Traducteur): string => premier(tr, 'kpis', cle) ?? cle
export const libelleColonne = (cle: string, tr: Traducteur): string => {
  const direct = tr(cle)
  if (direct !== undefined) return direct
  const court = cle.replace('rapports.cols.', '')
  return premier(tr, 'cols', court) ?? cle
}

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

// ─── Modèle plat pour le PDF serveur ─────────────────────────────────────────

export interface DocumentRapport {
  titre: string; sousTitre: string; intro?: string
  sections: { titre: string; kpis: { label: string; valeur: string; alerte: boolean }[]; tables: { colonnes: string[]; lignes: string[][] }[]; textes: string[] }[]
}

/** Édition → document plat (textes résolus, prêt à rendre) : le gabarit PDF ne connaît ni i18n ni blocs. */
export function contenuVersDocument(c: RapportContenu, tr: Traducteur, locale: string, meta: { titre: string; gabaritIntro?: string }): DocumentRapport {
  return {
    titre: meta.titre,
    sousTitre: `${c.periode.debut} → ${c.periode.fin}`,
    ...(meta.gabaritIntro ? { intro: meta.gabaritIntro } : {}),
    sections: c.sections.map(s => {
      const out: DocumentRapport['sections'][number] = { titre: titreSection(s.id, tr), kpis: [], tables: [], textes: [] }
      for (const b of s.blocs as Bloc[]) {
        if (b.type === 'kpis') for (const k of b.items) out.kpis.push({ label: libelleKpi(k.cle, tr), valeur: String(formaterKpi(k, c.deviseReference, locale, tr)), alerte: !!k.alerte })
        else if (b.type === 'tableau') out.tables.push({ colonnes: b.colonnes.map(x => libelleColonne(x, tr)), lignes: b.lignes.map(l => l.map(x => String(resoudreCellule(x, tr)))) })
        else out.textes.push(tr(b.cle) ?? b.cle)
      }
      return out
    }),
  }
}
