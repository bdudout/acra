// ─── Revue d'un projet 360 — format PRÉSENTATION (PPTX) ───────────────────────
// Support de comité, pensé pour être lu en deux minutes : couverture, SYNTHÈSE EXÉCUTIVE (météo du chef de projet,
// chiffres clés, points d'attention, principaux risques), vision du projet, cartographies des risques actuelle et
// résiduelle (cartes de chaleur à l'échelle de l'organisation), avancement sur les risques, avancement des plans
// (statuts, courbe des plans restants face à la cible) et plans par priorité (paginés, rien n'est tronqué).
// Données préparées et traduites par donneesProjetPptx (pur) ; rendu pptxgenjs (JS pur). Testé : projet-pptx.test.ts.

import PptxGenJS from 'pptxgenjs'
import type { Locale, Translations } from '@/lib/i18n'
import { patternLabel } from '@/lib/patterns-archi'
import { buildRiskMatrixModel, type ScaleConfig } from '@/lib/risk-scale'
import type { IndicateursProjet } from '@/lib/projet-indicateurs'

const C = {
  primary: '4338CA', primaryDark: '312E81', ink: '111827', muted: '6B7280', danger: 'DC2626', ok: '16A34A', warn: 'D97706',
  band: 'EEF2FF', white: 'FFFFFF', line: 'E5E7EB', softRed: 'FEE2E2', softAmber: 'FEF3C7', softGreen: 'DCFCE7', softBlue: 'E0E7FF',
}
const METEO_COULEUR: Record<string, string> = { SOLEIL: 'F59E0B', SOLEIL_NUAGE: 'FBBF24', NUAGE: '6B7280', ORAGE: 'DC2626' }
const METEO_SYMBOLE: Record<string, string> = { SOLEIL: '☀', SOLEIL_NUAGE: '⛅', NUAGE: '☁', ORAGE: '⛈' }
const PLANS_PAR_DIAPO = 12

export interface MatricePptx { titre: string; colonnes: string[]; lignes: string[]; cellules: { couleur: string; n: number }[][] }

export interface ProjetPptxData {
  nom: string; statut: string; secteur: string | null; patterns: string[]; perimetre: string | null; objectifs: string | null
  /** Date de mise en service déjà formatée, ou null. */
  miseEnService: string | null
  analyses: string[]; dateGeneration: string
  meteo: { code: string | null; label: string }
  pointsAttention: string[]
  matrices: MatricePptx[]
  restants: { categories: string[]; prevu: number[]; cible: number[]; aujourdhui: number } | null
  risques: {
    total: number; aTraiter: number; acceptables: number; sansPlan: number; reductionPct: number | null; horsAppetit: number
    paliers: { label: string; couleur: string; brut: number; actuel: number; residuel: number }[]
    principaux: { nom: string; niveau: number; palier: string; couleur: string; domaine: string | null }[]
    parDomaine: { label: string; total: number }[]
  }
  plans: {
    indicateurs: { total: number; faits: number; enCours: number; aFaire: number; avancement: number | null; enRetard: number
      echeanceProche: number; sansPorteur: number; sansEcheance: number; apresMes: number; joursRestants: number | null }
    liste: { titre: string; risque: string; priorite: string; echeance: string; statut: string; porteur: string; enRetard: boolean; apresMes: boolean }[]
  }
}

type T = Translations
/** Libellés du support, tirés du dictionnaire de la langue (t.projet360 : pptx, presentation, plansPriorite). */
export function labelsProjetPptx(t: T) {
  const x = t.projet360.pptx, pr = t.projet360.presentation, pp = t.projet360.plansPriorite, st = t.risquesDirects.plansStatuts as Record<string, string>
  return {
    ...x, secteur: pr.secteur, architecture: pr.patterns, perimetre: pr.perimetre, objectifs: pr.objectifs, nonRenseigne: pr.nonRenseigne,
    analysesLiees: pr.analysesLiees, miseEnService: pr.miseEnService, nonDefinie: pr.nonDefinie, jours: pr.jours, joursPasses: pr.joursPasses,
    risques: pr.risques, aTraiter: pr.aTraiter, acceptables: pr.acceptables, sansPlan: pr.sansPlan, reduction: pr.reduction, horsAppetit: pr.horsAppetit,
    repartition: pr.repartition, brut: pr.brut, actuel: pr.actuel, residuel: pr.residuel, principaux: pr.principaux,
    avancement: pr.avancement, avancementSous: pr.avancementSous, enRetard: pr.enRetard, echeanceProche: pr.echeanceProche,
    sansPorteur: pr.sansPorteur, sansEcheance: pr.sansEcheance, plansApres: pr.plansApres, nd: pr.nd,
    meteoTitre: pr.meteoTitre, plansRestants: pr.plansRestants, prevu: pr.prevu, cible: pr.cible, aujourdhui: pr.aujourdhui,
    colPlan: pp.colPlan, colRisques: pp.colRisques, colPriorite: pp.colPriorite, colEcheance: pp.colEcheance, colStatut: pp.colStatut, colPorteur: pp.colPorteur,
    retard: pp.enRetard, apresMes: pp.apresMes, aucunPlan: pp.aucun,
    statutAFaire: st.A_FAIRE ?? 'A_FAIRE', statutEnCours: st.EN_COURS ?? 'EN_COURS', statutFait: st.FAIT ?? 'FAIT',
  }
}
export type ProjetPptxLabels = ReturnType<typeof labelsProjetPptx>

const hex = (c: string) => c.replace('#', '').toUpperCase()

export async function renderProjetPptx(d: ProjetPptxData, L: ProjetPptxLabels): Promise<Buffer> {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE' // 13.33 x 7.5 in
  pptx.defineSlideMaster({
    title: 'ACRA', background: { color: C.white },
    objects: [
      { rect: { x: 0, y: 0, w: 13.33, h: 0.12, fill: { color: C.primary } } },
      { line: { x: 0.5, y: 7.0, w: 12.33, h: 0, line: { color: C.line, width: 0.5 } } },
    ],
    slideNumber: { x: 12.4, y: 7.05, color: C.muted, fontSize: 8 },
  })
  const titre = (s: PptxGenJS.Slide, texte: string) => {
    s.addText(texte, { x: 0.5, y: 0.3, w: 12.3, h: 0.6, fontSize: 24, bold: true, color: C.primaryDark })
    s.addText(d.nom, { x: 0.5, y: 0.85, w: 12.3, h: 0.35, fontSize: 12, color: C.muted })
  }
  // Tuile d'indicateur colorée : fond doux selon l'état (alerte, vigilance, bon, neutre).
  const tuile = (s: PptxGenJS.Slide, x: number, y: number, w: number, label: string, valeur: string, etat: 'alerte' | 'vigilance' | 'ok' | 'neutre', sous?: string) => {
    const fond = { alerte: C.softRed, vigilance: C.softAmber, ok: C.softGreen, neutre: C.softBlue }[etat]
    const couleur = { alerte: C.danger, vigilance: C.warn, ok: C.ok, neutre: C.primary }[etat]
    s.addShape('roundRect', { x, y, w, h: 1.3, fill: { color: fond }, line: { color: fond }, rectRadius: 0.08 })
    s.addText(label, { x: x + 0.15, y: y + 0.08, w: w - 0.3, h: 0.35, fontSize: 10, color: C.ink })
    s.addText(valeur, { x: x + 0.15, y: y + 0.4, w: w - 0.3, h: 0.55, fontSize: 28, bold: true, color: couleur })
    if (sous) s.addText(sous, { x: x + 0.15, y: y + 0.93, w: w - 0.3, h: 0.3, fontSize: 8, color: C.muted })
  }
  const i = d.plans.indicateurs, r = d.risques
  const jours = i.joursRestants
  const joursTxt = jours == null ? '' : (jours >= 0 ? L.jours : L.joursPasses).replace('{n}', String(Math.abs(jours)))
  const meteoCouleur = d.meteo.code ? METEO_COULEUR[d.meteo.code] ?? C.muted : C.muted

  // ── 1. Couverture ──────────────────────────────────────────────────────────
  const s1 = pptx.addSlide()
  s1.background = { color: C.primaryDark }
  s1.addShape('rect', { x: 0, y: 5.6, w: 13.33, h: 1.9, fill: { color: C.primary } })
  s1.addText(L.titre, { x: 0.7, y: 0.9, w: 11.9, h: 0.5, fontSize: 16, color: 'C7D2FE' })
  s1.addText(d.nom, { x: 0.7, y: 1.5, w: 11.9, h: 1.6, fontSize: 40, bold: true, color: C.white, valign: 'top', fit: 'shrink' })
  s1.addText(`${d.statut}${d.secteur ? ` · ${d.secteur}` : ''}`, { x: 0.7, y: 3.3, w: 11.9, h: 0.4, fontSize: 15, color: 'E0E7FF' })
  s1.addText([
    { text: `${d.meteo.code ? METEO_SYMBOLE[d.meteo.code] ?? '' : ''} `, options: { fontSize: 22, color: meteoCouleur } },
    { text: d.meteo.label, options: { fontSize: 15, color: C.white, bold: true } },
  ], { x: 0.7, y: 3.9, w: 11.9, h: 0.5 })
  s1.addText(d.miseEnService ? L.miseEnServiceDans.replace('{date}', d.miseEnService).replace('{jours}', joursTxt) : `${L.miseEnService} : ${L.nonDefinie}`,
    { x: 0.7, y: 5.85, w: 11.9, h: 0.45, fontSize: 16, bold: true, color: C.white })
  s1.addText(L.genereLe.replace('{date}', d.dateGeneration), { x: 0.7, y: 6.5, w: 11.9, h: 0.3, fontSize: 10, color: 'C7D2FE' })

  // ── 2. Synthèse exécutive ──────────────────────────────────────────────────
  const s2 = pptx.addSlide({ masterName: 'ACRA' })
  titre(s2, L.syntheseTitre)
  s2.addShape('roundRect', { x: 0.5, y: 1.4, w: 3.4, h: 2.75, fill: { color: 'F9FAFB' }, line: { color: meteoCouleur, width: 2 }, rectRadius: 0.1 })
  s2.addText(L.meteoTitre, { x: 0.7, y: 1.5, w: 3.0, h: 0.35, fontSize: 11, color: C.muted })
  s2.addText(d.meteo.code ? METEO_SYMBOLE[d.meteo.code] ?? '' : '—', { x: 0.7, y: 1.85, w: 3.0, h: 1.2, fontSize: 64, color: meteoCouleur, align: 'center' })
  s2.addText(d.meteo.label, { x: 0.7, y: 3.1, w: 3.0, h: 0.5, fontSize: 13, bold: true, color: meteoCouleur, align: 'center', fit: 'shrink' })
  s2.addText(d.miseEnService ? `${L.miseEnService} : ${d.miseEnService} (${joursTxt})` : `${L.miseEnService} : ${L.nonDefinie}`, { x: 0.7, y: 3.6, w: 3.0, h: 0.4, fontSize: 10, color: C.ink, align: 'center', fit: 'shrink' })
  const kx = 4.15, kw = 2.05, kg = 0.13
  tuile(s2, kx, 1.4, kw, L.avancement, i.avancement == null ? L.nd : `${i.avancement} %`, i.avancement == null ? 'neutre' : i.avancement >= 75 ? 'ok' : i.avancement >= 30 ? 'vigilance' : 'neutre', L.avancementSous.replace('{faits}', String(i.faits)).replace('{total}', String(i.total)))
  tuile(s2, kx + (kw + kg), 1.4, kw, L.enRetard, String(i.enRetard), i.enRetard ? 'alerte' : 'ok')
  tuile(s2, kx + 2 * (kw + kg), 1.4, kw, L.sansPlan, String(r.sansPlan), r.sansPlan ? 'alerte' : 'ok')
  tuile(s2, kx + 3 * (kw + kg), 1.4, kw, L.horsAppetit, String(r.horsAppetit), r.horsAppetit ? 'alerte' : 'ok')
  s2.addText(L.pointsAttention, { x: kx, y: 2.85, w: 8.6, h: 0.35, fontSize: 13, bold: true, color: C.primaryDark })
  s2.addText(d.pointsAttention.length
    ? d.pointsAttention.map(p => ({ text: p, options: { bullet: { code: '25A0' }, color: C.ink, fontSize: 12, paraSpaceAfter: 4 } }))
    : [{ text: L.aucunPoint, options: { color: C.ok, fontSize: 12, italic: true } }], { x: kx, y: 3.2, w: 8.6, h: 1.0, valign: 'top', fit: 'shrink' })
  s2.addText(L.principaux, { x: 0.5, y: 4.4, w: 12.3, h: 0.35, fontSize: 13, bold: true, color: C.primaryDark })
  if (r.principaux.length) {
    r.principaux.slice(0, 5).forEach((p, k) => {
      const y = 4.8 + k * 0.42
      s2.addShape('rect', { x: 0.5, y, w: 0.12, h: 0.32, fill: { color: hex(p.couleur) }, line: { color: hex(p.couleur) } })
      s2.addText(p.nom, { x: 0.75, y, w: 8.6, h: 0.32, fontSize: 11, color: C.ink, fit: 'shrink' })
      s2.addText(`${p.palier} · ${p.niveau}${p.domaine ? ` · ${p.domaine}` : ''}`, { x: 9.4, y, w: 3.4, h: 0.32, fontSize: 10, color: hex(p.couleur), bold: true, align: 'right' })
    })
  } else s2.addText(L.aucun, { x: 0.5, y: 4.8, w: 12.3, h: 0.4, fontSize: 11, italic: true, color: C.muted })

  // ── 3. Vision du projet ────────────────────────────────────────────────────
  const s3 = pptx.addSlide({ masterName: 'ACRA' })
  titre(s3, L.vision)
  const bloc = (x: number, y: number, w: number, h: number, label: string, texte: string, couleur: string) => {
    s3.addShape('rect', { x, y, w: 0.08, h, fill: { color: couleur }, line: { color: couleur } })
    s3.addText(label, { x: x + 0.2, y, w: w - 0.2, h: 0.32, fontSize: 12, bold: true, color: couleur })
    s3.addText(texte, { x: x + 0.2, y: y + 0.35, w: w - 0.2, h: h - 0.35, fontSize: 12, color: C.ink, valign: 'top', fit: 'shrink' })
  }
  bloc(0.5, 1.45, 6.0, 2.4, L.perimetre, d.perimetre || L.nonRenseigne, C.primary)
  bloc(6.8, 1.45, 6.0, 2.4, L.objectifs, d.objectifs || L.nonRenseigne, C.ok)
  bloc(0.5, 4.1, 4.0, 2.6, L.secteur, d.secteur || L.nonRenseigne, C.warn)
  bloc(4.65, 4.1, 4.0, 2.6, L.architecture, d.patterns.length ? d.patterns.join('\n') : L.nonRenseigne, '7C3AED')
  bloc(8.8, 4.1, 4.0, 2.6, L.analysesLiees, d.analyses.length ? d.analyses.join('\n') : L.aucun, C.danger)

  // ── 4. Cartographies des risques (actuel, résiduel) ────────────────────────
  const s4 = pptx.addSlide({ masterName: 'ACRA' })
  titre(s4, L.cartographie.replace('{etape}', d.matrices.map(m => m.titre).join(' / ')))
  d.matrices.slice(0, 2).forEach((m, k) => {
    const ox = 0.5 + k * 6.45, oy = 1.45, lw = 1.45, cw = (6.0 - lw) / Math.max(1, m.colonnes.length), ch = 4.4 / Math.max(1, m.lignes.length)
    s4.addText(m.titre, { x: ox, y: oy, w: 6.0, h: 0.4, fontSize: 14, bold: true, color: C.primaryDark, align: 'center' })
    m.lignes.forEach((lib, v) => {
      s4.addText(lib, { x: ox, y: oy + 0.45 + v * ch, w: lw - 0.05, h: ch, fontSize: 8, color: C.muted, align: 'right', valign: 'middle', fit: 'shrink' })
      m.colonnes.forEach((_, g) => {
        const cell = m.cellules[v]?.[g] ?? { couleur: '#E5E7EB', n: 0 }
        s4.addShape('rect', { x: ox + lw + g * cw, y: oy + 0.45 + v * ch, w: cw, h: ch, fill: { color: hex(cell.couleur), transparency: cell.n ? 0 : 70 }, line: { color: C.white, width: 1.5 } })
        if (cell.n) s4.addText(String(cell.n), { x: ox + lw + g * cw, y: oy + 0.45 + v * ch, w: cw, h: ch, fontSize: 18, bold: true, color: C.white, align: 'center', valign: 'middle' })
      })
    })
    m.colonnes.forEach((lib, g) => s4.addText(lib, { x: ox + lw + g * cw, y: oy + 0.5 + m.lignes.length * ch, w: cw, h: 0.4, fontSize: 8, color: C.muted, align: 'center', fit: 'shrink' }))
    s4.addText(`↑ ${L.axeVraisemblance}   → ${L.axeGravite}`, { x: ox, y: oy + 0.95 + m.lignes.length * ch, w: 6.0, h: 0.3, fontSize: 9, color: C.muted, align: 'center' })
  })

  // ── 5. Avancement sur les risques ──────────────────────────────────────────
  const s5 = pptx.addSlide({ masterName: 'ACRA' })
  titre(s5, L.risquesTitre)
  const w5 = 2.35
  tuile(s5, 0.5, 1.4, w5, L.risques, String(r.total), 'neutre', `${L.acceptables} ${r.acceptables}`)
  tuile(s5, 0.5 + (w5 + 0.14), 1.4, w5, L.aTraiter, String(r.aTraiter), r.aTraiter ? 'vigilance' : 'ok')
  tuile(s5, 0.5 + 2 * (w5 + 0.14), 1.4, w5, L.sansPlan, String(r.sansPlan), r.sansPlan ? 'alerte' : 'ok')
  tuile(s5, 0.5 + 3 * (w5 + 0.14), 1.4, w5, L.reduction, r.reductionPct == null ? L.nd : `${r.reductionPct > 0 ? '-' : ''}${r.reductionPct} %`, r.reductionPct && r.reductionPct > 0 ? 'ok' : 'neutre')
  tuile(s5, 0.5 + 4 * (w5 + 0.14), 1.4, w5, L.horsAppetit, String(r.horsAppetit), r.horsAppetit ? 'alerte' : 'ok')
  if (r.paliers.length && r.total > 0) {
    s5.addText(L.repartition, { x: 0.5, y: 2.9, w: 7.4, h: 0.3, fontSize: 12, bold: true, color: C.primaryDark })
    s5.addChart('bar', r.paliers.map(p => ({ name: p.label, labels: [L.brut, L.actuel, L.residuel], values: [p.brut, p.actuel, p.residuel] })),
      { x: 0.5, y: 3.2, w: 7.4, h: 3.6, barDir: 'col', barGrouping: 'stacked', chartColors: r.paliers.map(p => hex(p.couleur)), showLegend: true, legendPos: 'b', catAxisLabelFontSize: 10, valAxisLabelFontSize: 9, legendFontSize: 9, showValue: true, dataLabelFontSize: 9, dataLabelColor: C.white })
  } else s5.addText(L.aucun, { x: 0.5, y: 3.2, w: 7.4, h: 0.4, fontSize: 12, italic: true, color: C.muted })
  s5.addText(L.parCategorie, { x: 8.2, y: 2.9, w: 4.6, h: 0.3, fontSize: 12, bold: true, color: C.primaryDark })
  if (r.parDomaine.length) {
    s5.addChart('doughnut', [{ name: L.parCategorie, labels: r.parDomaine.map(x => x.label), values: r.parDomaine.map(x => x.total) }],
      { x: 8.2, y: 3.2, w: 4.6, h: 3.6, chartColors: ['4338CA', 'F59E0B', '16A34A', 'DC2626', '7C3AED', '0EA5E9', '6B7280'], showLegend: true, legendPos: 'b', legendFontSize: 9, showPercent: false, showValue: true, dataLabelFontSize: 9 })
  } else s5.addText(L.aucun, { x: 8.2, y: 3.2, w: 4.6, h: 0.4, fontSize: 12, italic: true, color: C.muted })

  // ── 6. Avancement des plans d'action ───────────────────────────────────────
  const s6 = pptx.addSlide({ masterName: 'ACRA' })
  titre(s6, L.plansTitre)
  tuile(s6, 0.5, 1.4, w5, L.avancement, i.avancement == null ? L.nd : `${i.avancement} %`, 'neutre', L.avancementSous.replace('{faits}', String(i.faits)).replace('{total}', String(i.total)))
  tuile(s6, 0.5 + (w5 + 0.14), 1.4, w5, L.enRetard, String(i.enRetard), i.enRetard ? 'alerte' : 'ok')
  tuile(s6, 0.5 + 2 * (w5 + 0.14), 1.4, w5, L.echeanceProche, String(i.echeanceProche), i.echeanceProche ? 'vigilance' : 'neutre')
  tuile(s6, 0.5 + 3 * (w5 + 0.14), 1.4, w5, L.sansPorteur, String(i.sansPorteur), i.sansPorteur ? 'vigilance' : 'ok')
  tuile(s6, 0.5 + 4 * (w5 + 0.14), 1.4, w5, L.sansEcheance, String(i.sansEcheance), i.sansEcheance ? 'vigilance' : 'ok')
  if (i.total > 0) {
    s6.addText(L.statutsTitre, { x: 0.5, y: 2.9, w: 4.3, h: 0.3, fontSize: 12, bold: true, color: C.primaryDark })
    s6.addChart('doughnut', [{ name: L.statutsTitre, labels: [L.statutAFaire, L.statutEnCours, L.statutFait], values: [i.aFaire, i.enCours, i.faits] }],
      { x: 0.5, y: 3.2, w: 4.3, h: 3.6, chartColors: ['9CA3AF', 'F59E0B', '16A34A'], showLegend: true, legendPos: 'b', showPercent: true, legendFontSize: 9, dataLabelFontSize: 9 })
  } else s6.addText(L.aucunPlan, { x: 0.5, y: 3.2, w: 4.3, h: 0.6, fontSize: 12, italic: true, color: C.muted })
  if (d.restants) {
    s6.addText(L.plansRestants, { x: 5.1, y: 2.9, w: 7.7, h: 0.3, fontSize: 12, bold: true, color: C.primaryDark })
    s6.addChart('line', [
      { name: L.prevu, labels: d.restants.categories, values: d.restants.prevu },
      { name: L.cible, labels: d.restants.categories, values: d.restants.cible },
    ], { x: 5.1, y: 3.2, w: 7.7, h: 3.2, chartColors: ['4338CA', '9CA3AF'], lineSize: 3, lineDataSymbol: 'circle', lineDataSymbolSize: 6, showLegend: true, legendPos: 'b', legendFontSize: 9, catAxisLabelFontSize: 9, valAxisLabelFontSize: 9, valAxisMinVal: 0 })
    s6.addText(`${L.aujourdhui} : ${d.restants.aujourdhui} / ${i.total}${i.apresMes ? ` · ${L.plansApres.replace('{n}', String(i.apresMes))}` : ''}`,
      { x: 5.1, y: 6.45, w: 7.7, h: 0.35, fontSize: 11, bold: true, color: i.apresMes ? C.warn : C.ink })
  }

  // ── 7+. Plans par priorité (paginés) ───────────────────────────────────────
  const liste = d.plans.liste
  const pages = Math.max(1, Math.ceil(liste.length / PLANS_PAR_DIAPO))
  const entete = [L.colPlan, L.colRisques, L.colPriorite, L.colEcheance, L.colStatut, L.colPorteur].map(text => ({ text, options: { bold: true, color: C.white, fill: { color: C.primary }, fontSize: 10 } }))
  for (let pg = 0; pg < pages; pg++) {
    const s = pptx.addSlide({ masterName: 'ACRA' })
    titre(s, pg === 0 ? L.listeTitre : L.suite.replace('{n}', `${pg + 1}/${pages}`))
    const lignes = liste.slice(pg * PLANS_PAR_DIAPO, (pg + 1) * PLANS_PAR_DIAPO)
    if (!lignes.length) { s.addText(L.aucunPlan, { x: 0.5, y: 1.5, w: 12.3, h: 0.5, fontSize: 12, italic: true, color: C.muted }); continue }
    s.addTable([entete, ...lignes.map((p, k) => {
      const fond = { fill: { color: k % 2 ? 'F9FAFB' : C.white } }
      return [
        { text: p.titre, options: { fontSize: 9, color: C.ink, ...fond } },
        { text: p.risque, options: { fontSize: 9, color: C.muted, ...fond } },
        { text: p.priorite, options: { fontSize: 9, ...fond } },
        { text: `${p.echeance}${p.enRetard ? ` · ${L.retard}` : ''}${p.apresMes ? ` · ${L.apresMes}` : ''}`, options: { fontSize: 9, bold: p.enRetard || p.apresMes, color: p.enRetard ? C.danger : p.apresMes ? C.warn : C.ink, ...fond } },
        { text: p.statut, options: { fontSize: 9, ...fond } },
        { text: p.porteur, options: { fontSize: 9, color: p.porteur === '—' ? C.warn : C.ink, ...fond } },
      ]
    })], { x: 0.5, y: 1.4, w: 12.3, colW: [4.2, 2.6, 1.1, 1.6, 1.2, 1.6], border: { type: 'solid', color: C.line, pt: 0.5 }, autoPage: false })
  }

  return await pptx.write({ outputType: 'nodebuffer' }) as Buffer
}

// ─── Données du support à partir de la vue du projet (lib/projet-vue.server) — PUR ─
// Statuts, priorités, catégories et architecture traduits ; dates au format de la langue ; plan signalé s'il est en
// retard ou prévu après la mise en service ; cartographies actuelle et résiduelle à l'échelle de l'organisation ;
// courbe des plans restants (jalons, cible interpolée) ; points d'attention (ce qui appelle une décision).

type GV = { g: number; v: number }
interface VueSource {
  nom: string; statut: string; secteur: string | null; patterns: string[]; perimetre: string | null; objectifs: string | null
  analyses: { id: string; nom: string }[]; miseEnService: string | null
  synthese: { total: number; aTraiter: number; acceptables: number; paliers: ProjetPptxData['risques']['paliers']
    principaux: { id?: string; nom: string; niveau: number; domaine: string | null; palier: { label: string; couleur: string } }[] }
  indicateurs: IndicateursProjet
  matrice?: { brut: GV; actuel: GV; residuel: GV }[]
  scale?: Partial<ScaleConfig> | null
  meteo?: { valeur: string | null; le: string | null }
  restants?: { total: number; fin: string; prevu: { date: string; restants: number }[]; cible: { date: string; restants: number }[]; aujourdhui: { date: string; restants: number } } | null
}
interface PlanSource { titre: string; statut: string; priorite: string; echeance: string | null; porteur: string | null; risques: { id?: string; nom: string; niveau?: number }[]; enRetard: boolean }

export function donneesProjetPptx({ vue, plans, parDomaine, t, locale, now }: {
  vue: VueSource; plans: readonly PlanSource[]; parDomaine: readonly { domaine: string | null; total: number }[]; t: T; locale: string; now: Date
}): ProjetPptxData {
  const domaines = t.projet360.domaines as Record<string, string>
  const statuts = t.statusLabels as Record<string, string>
  const st = t.risquesDirects.plansStatuts as Record<string, string>
  const prio = t.risquesDirects.plansPriorites as Record<string, string>
  const pr = t.projet360.presentation
  const meteos = pr.meteo as Record<string, string>
  const trL = (l: string) => (t.scaleDefaults as Record<string, string>)[l] ?? l
  const date = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00.000Z` : iso).toLocaleDateString(locale, { timeZone: 'UTC' })
  const jourMois = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
  const limite = vue.miseEnService ? new Date(`${vue.miseEnService}T23:59:59.999Z`).getTime() : null
  const ind = vue.indicateurs

  // Cartographies : effectifs par case, lignes de la vraisemblance la plus haute à la plus basse.
  const modele = buildRiskMatrixModel(vue.scale ?? null)
  const matrice = (etape: 'actuel' | 'residuel', titre: string): MatricePptx => ({
    titre,
    colonnes: modele.graviteLevels.map(g => trL(g.label)),
    lignes: modele.cells.map(ligne => trL(modele.vraisemblanceLevels.find(v => v.niveau === ligne[0]?.vraisemblance)?.label ?? '')),
    cellules: modele.cells.map(ligne => ligne.map(c => ({ couleur: c.couleur, n: (vue.matrice ?? []).filter(r => r[etape].g === c.gravite && r[etape].v === c.vraisemblance).length }))),
  })

  // Plans restants : prévu aux jalons, cible interpolée linéairement, point final à la mise en service.
  let restants: ProjetPptxData['restants'] = null
  if (vue.restants) {
    const R = vue.restants
    const t0 = new Date(R.cible[0].date).getTime(), t1 = new Date(R.cible[1].date).getTime(), total = R.cible[0].restants
    const dates = [...R.prevu.map(p => p.date), ...(R.prevu.some(p => p.date === R.fin) ? [] : [R.fin])]
    const prevuA = (iso: string) => [...R.prevu].reverse().find(p => new Date(p.date).getTime() <= new Date(iso).getTime())?.restants ?? total
    const cibleA = (iso: string) => Math.max(0, Math.round(total * (1 - (new Date(iso).getTime() - t0) / Math.max(1, t1 - t0)) * 10) / 10)
    restants = { categories: dates.map(jourMois), prevu: dates.map(prevuA), cible: dates.map(cibleA), aujourdhui: R.aujourdhui.restants }
  }

  const listePlans = plans.map(p => ({
    titre: p.titre, risque: p.risques.map(r => r.nom).join(', ') || '—', priorite: prio[p.priorite] ?? p.priorite,
    echeance: p.echeance ? date(p.echeance) : '—', statut: st[p.statut] ?? p.statut, porteur: p.porteur?.trim() || '—', enRetard: p.enRetard,
    apresMes: limite != null && p.statut !== 'FAIT' && !!p.echeance && new Date(p.echeance).getTime() > limite,
  }))

  // Points d'attention : uniquement ce qui appelle une décision, du plus grave au moins grave.
  const point = (label: string, n: number) => `${label} : ${n}`
  const pointsAttention = [
    ...(ind.miseEnService && ind.miseEnService.joursRestants < 0 ? [`${pr.indMiseEnService} : ${pr.joursPasses.replace('{n}', String(-ind.miseEnService.joursRestants))}`] : []),
    ...(ind.plans.enRetard ? [point(pr.enRetard, ind.plans.enRetard)] : []),
    ...(ind.residuelsHorsAppetit ? [point(pr.horsAppetit, ind.residuelsHorsAppetit)] : []),
    ...(ind.risquesATraiterSansPlan ? [point(pr.sansPlan, ind.risquesATraiterSansPlan)] : []),
    ...(ind.miseEnService?.plansApres ? [pr.plansApres.replace('{n}', String(ind.miseEnService.plansApres))] : []),
    ...(ind.plans.sansPorteur ? [point(pr.sansPorteur, ind.plans.sansPorteur)] : []),
  ]

  return {
    nom: vue.nom, statut: statuts[vue.statut] ?? vue.statut, secteur: vue.secteur,
    patterns: vue.patterns.map(c => patternLabel(c, locale as Locale)),
    perimetre: vue.perimetre, objectifs: vue.objectifs,
    miseEnService: vue.miseEnService ? date(vue.miseEnService) : null,
    analyses: vue.analyses.map(a => a.nom), dateGeneration: now.toLocaleDateString(locale, { timeZone: 'UTC' }),
    meteo: { code: vue.meteo?.valeur ?? null, label: vue.meteo?.valeur ? meteos[vue.meteo.valeur] ?? vue.meteo.valeur : t.projet360.pptx.meteoNonRenseignee },
    pointsAttention,
    matrices: [matrice('actuel', pr.actuel), matrice('residuel', pr.residuel)],
    restants,
    risques: {
      total: vue.synthese.total, aTraiter: vue.synthese.aTraiter, acceptables: vue.synthese.acceptables,
      sansPlan: ind.risquesATraiterSansPlan, reductionPct: ind.reductionPct, horsAppetit: ind.residuelsHorsAppetit,
      paliers: vue.synthese.paliers,
      principaux: vue.synthese.principaux.map(r => ({ nom: r.nom, niveau: r.niveau, palier: r.palier.label, couleur: r.palier.couleur, domaine: r.domaine ? domaines[r.domaine] ?? r.domaine : null })),
      parDomaine: parDomaine.map(x => ({ label: x.domaine ? domaines[x.domaine] ?? x.domaine : '—', total: x.total })),
    },
    plans: {
      indicateurs: { ...ind.plans, apresMes: ind.miseEnService?.plansApres ?? 0, joursRestants: ind.miseEnService?.joursRestants ?? null },
      liste: listePlans,
    },
  }
}
