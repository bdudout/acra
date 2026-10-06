// ─── Revue d'un projet 360 — format PRÉSENTATION (PPTX) ───────────────────────
// Diapositives pour un comité de projet ou des risques : titre, vision du projet, avancement sur les risques
// (indicateurs, répartition brut / actuel / résiduel par niveau, principaux risques, risques par catégorie),
// avancement des plans d'action (indicateurs, plans par statut) et plans par priorité (paginés, rien n'est tronqué).
// Données préparées et traduites par l'appelant (route /api/projets/[id]/export) ; libellés : t.projet360.
// pptxgenjs est du JS pur. Testé : projet-pptx.test.ts.

import PptxGenJS from 'pptxgenjs'
import type { Locale, Translations } from '@/lib/i18n'
import { patternLabel } from '@/lib/patterns-archi'
import type { IndicateursProjet } from '@/lib/projet-indicateurs'

const C = { primary: '4338CA', ink: '111827', muted: '6B7280', danger: 'DC2626', ok: '16A34A', warn: 'D97706', band: 'EEF2FF', white: 'FFFFFF', line: 'E5E7EB' }
const PLANS_PAR_DIAPO = 12

export interface ProjetPptxData {
  nom: string; statut: string; secteur: string | null; patterns: string[]; perimetre: string | null; objectifs: string | null
  /** Date de mise en service déjà formatée, ou null. */
  miseEnService: string | null
  analyses: string[]; dateGeneration: string
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
    objects: [{ line: { x: 0.5, y: 7.0, w: 12.33, h: 0, line: { color: C.line, width: 0.5 } } }],
    slideNumber: { x: 12.4, y: 7.05, color: C.muted, fontSize: 8 },
  })
  const titre = (s: PptxGenJS.Slide, texte: string) => {
    s.addText(texte, { x: 0.5, y: 0.35, w: 12.3, h: 0.6, fontSize: 22, bold: true, color: C.ink })
    s.addText(d.nom, { x: 0.5, y: 0.9, w: 12.3, h: 0.35, fontSize: 12, color: C.muted })
  }
  // Tuile d'indicateur : libellé, valeur (rouge / ambre si elle appelle une action), précision.
  const tuile = (s: PptxGenJS.Slide, x: number, y: number, label: string, valeur: string, couleur = C.ink, sous?: string) => {
    s.addShape('rect', { x, y, w: 2.3, h: 1.15, fill: { color: 'F9FAFB' }, line: { color: C.line, width: 0.75 } })
    s.addText(label, { x: x + 0.1, y: y + 0.05, w: 2.1, h: 0.35, fontSize: 10, color: C.muted })
    s.addText(valeur, { x: x + 0.1, y: y + 0.38, w: 2.1, h: 0.45, fontSize: 22, bold: true, color: couleur })
    if (sous) s.addText(sous, { x: x + 0.1, y: y + 0.8, w: 2.1, h: 0.3, fontSize: 8, color: C.muted })
  }
  const jours = d.plans.indicateurs.joursRestants
  const joursTxt = jours == null ? '' : (jours >= 0 ? L.jours : L.joursPasses).replace('{n}', String(Math.abs(jours)))

  // ── 1. Titre ────────────────────────────────────────────────────────────────
  const s1 = pptx.addSlide({ masterName: 'ACRA' })
  s1.addShape('rect', { x: 0, y: 0, w: 13.33, h: 2.6, fill: { color: C.band } })
  s1.addText(L.titre, { x: 0.6, y: 0.6, w: 12, h: 0.5, fontSize: 16, color: C.primary })
  s1.addText(d.nom, { x: 0.6, y: 1.1, w: 12, h: 1.0, fontSize: 32, bold: true, color: C.ink })
  s1.addText(`${d.statut}${d.secteur ? ` · ${d.secteur}` : ''}`, { x: 0.6, y: 3.0, w: 12, h: 0.4, fontSize: 14, color: C.muted })
  s1.addText(d.miseEnService ? L.miseEnServiceDans.replace('{date}', d.miseEnService).replace('{jours}', joursTxt) : `${L.miseEnService} : ${L.nonDefinie}`,
    { x: 0.6, y: 3.5, w: 12, h: 0.4, fontSize: 14, color: jours != null && jours < 0 ? C.danger : C.ink })
  s1.addText(L.genereLe.replace('{date}', d.dateGeneration), { x: 0.6, y: 6.4, w: 12, h: 0.3, fontSize: 10, color: C.muted })

  // ── 2. Vision du projet ─────────────────────────────────────────────────────
  const s2 = pptx.addSlide({ masterName: 'ACRA' })
  titre(s2, L.vision)
  const bloc = (x: number, y: number, w: number, h: number, label: string, texte: string) => {
    s2.addText(label, { x, y, w, h: 0.3, fontSize: 11, bold: true, color: C.primary })
    s2.addText(texte, { x, y: y + 0.3, w, h: h - 0.3, fontSize: 12, color: C.ink, valign: 'top', fit: 'shrink' })
  }
  bloc(0.5, 1.5, 6.0, 2.4, L.perimetre, d.perimetre || L.nonRenseigne)
  bloc(6.8, 1.5, 6.0, 2.4, L.objectifs, d.objectifs || L.nonRenseigne)
  bloc(0.5, 4.1, 4.0, 2.6, L.secteur, d.secteur || L.nonRenseigne)
  bloc(4.6, 4.1, 4.1, 2.6, L.architecture, d.patterns.length ? d.patterns.join('\n') : L.nonRenseigne)
  bloc(8.8, 4.1, 4.0, 2.6, L.analysesLiees, d.analyses.length ? d.analyses.join('\n') : L.aucun)

  // ── 3. Avancement sur les risques ───────────────────────────────────────────
  const s3 = pptx.addSlide({ masterName: 'ACRA' })
  titre(s3, L.risquesTitre)
  const r = d.risques
  tuile(s3, 0.5, 1.4, L.risques, String(r.total), C.ink, `${L.acceptables} ${r.acceptables}`)
  tuile(s3, 2.95, 1.4, L.aTraiter, String(r.aTraiter), r.aTraiter ? C.warn : C.ink)
  tuile(s3, 5.4, 1.4, L.sansPlan, String(r.sansPlan), r.sansPlan ? C.danger : C.ok)
  tuile(s3, 7.85, 1.4, L.reduction, r.reductionPct == null ? L.nd : `${r.reductionPct > 0 ? '-' : ''}${r.reductionPct} %`, C.primary)
  tuile(s3, 10.3, 1.4, L.horsAppetit, String(r.horsAppetit), r.horsAppetit ? C.danger : C.ok)
  if (r.paliers.length && r.total > 0) {
    s3.addText(L.repartition, { x: 0.5, y: 2.75, w: 6.3, h: 0.3, fontSize: 12, bold: true, color: C.ink })
    s3.addChart('bar', [
      { name: L.brut, labels: r.paliers.map(p => p.label), values: r.paliers.map(p => p.brut) },
      { name: L.actuel, labels: r.paliers.map(p => p.label), values: r.paliers.map(p => p.actuel) },
      { name: L.residuel, labels: r.paliers.map(p => p.label), values: r.paliers.map(p => p.residuel) },
    ], { x: 0.5, y: 3.05, w: 6.3, h: 3.7, barDir: 'col', barGrouping: 'clustered', chartColors: ['9CA3AF', 'F59E0B', '4338CA'], showLegend: true, legendPos: 'b', catAxisLabelFontSize: 9, valAxisLabelFontSize: 9, legendFontSize: 9 })
  } else {
    s3.addText(L.aucun, { x: 0.5, y: 3.1, w: 6.3, h: 0.4, fontSize: 12, italic: true, color: C.muted })
  }
  s3.addText(L.principaux, { x: 7.1, y: 2.75, w: 5.7, h: 0.3, fontSize: 12, bold: true, color: C.ink })
  s3.addText(r.principaux.length ? r.principaux.map(p => ({ text: `${p.nom} — ${p.palier} (${p.niveau})${p.domaine ? ` · ${p.domaine}` : ''}`, options: { bullet: true, color: hex(p.couleur), fontSize: 11, paraSpaceAfter: 4 } })) : [{ text: L.aucun, options: { italic: true, color: C.muted, fontSize: 11 } }],
    { x: 7.1, y: 3.05, w: 5.7, h: 2.0, valign: 'top' })
  s3.addText(L.parCategorie, { x: 7.1, y: 5.1, w: 5.7, h: 0.3, fontSize: 12, bold: true, color: C.ink })
  s3.addText(r.parDomaine.length ? r.parDomaine.map(x => `${x.label} : ${x.total}`).join('   ·   ') : L.aucun, { x: 7.1, y: 5.4, w: 5.7, h: 1.3, fontSize: 11, color: C.ink, valign: 'top' })

  // ── 4. Avancement des plans d'action ────────────────────────────────────────
  const s4 = pptx.addSlide({ masterName: 'ACRA' })
  titre(s4, L.plansTitre)
  const i = d.plans.indicateurs
  tuile(s4, 0.5, 1.4, L.avancement, i.avancement == null ? L.nd : `${i.avancement} %`, C.primary, L.avancementSous.replace('{faits}', String(i.faits)).replace('{total}', String(i.total)))
  tuile(s4, 2.95, 1.4, L.enRetard, String(i.enRetard), i.enRetard ? C.danger : C.ok)
  tuile(s4, 5.4, 1.4, L.echeanceProche, String(i.echeanceProche))
  tuile(s4, 7.85, 1.4, L.sansPorteur, String(i.sansPorteur), i.sansPorteur ? C.warn : C.ok)
  tuile(s4, 10.3, 1.4, L.sansEcheance, String(i.sansEcheance), i.sansEcheance ? C.warn : C.ok)
  if (i.total > 0) {
    s4.addText(L.statutsTitre, { x: 0.5, y: 2.8, w: 6, h: 0.3, fontSize: 12, bold: true, color: C.ink })
    s4.addChart('doughnut', [{ name: L.statutsTitre, labels: [L.statutAFaire, L.statutEnCours, L.statutFait], values: [i.aFaire, i.enCours, i.faits] }],
      { x: 0.5, y: 3.1, w: 6, h: 3.7, chartColors: ['9CA3AF', 'F59E0B', '16A34A'], showLegend: true, legendPos: 'r', showPercent: true, legendFontSize: 10, dataLabelFontSize: 9 })
  } else {
    s4.addText(L.aucunPlan, { x: 0.5, y: 3.1, w: 6, h: 0.6, fontSize: 12, italic: true, color: C.muted })
  }
  if (i.joursRestants != null) {
    s4.addText(`${L.miseEnService} : ${d.miseEnService ?? ''} (${joursTxt})`, { x: 7.1, y: 3.1, w: 5.7, h: 0.4, fontSize: 13, bold: true, color: i.joursRestants < 0 ? C.danger : C.ink })
    if (i.apresMes) s4.addText(L.plansApres.replace('{n}', String(i.apresMes)), { x: 7.1, y: 3.5, w: 5.7, h: 0.4, fontSize: 12, color: C.warn })
  }

  // ── 5+. Plans par priorité (paginés) ────────────────────────────────────────
  const liste = d.plans.liste
  const pages = Math.max(1, Math.ceil(liste.length / PLANS_PAR_DIAPO))
  const entete = [L.colPlan, L.colRisques, L.colPriorite, L.colEcheance, L.colStatut, L.colPorteur].map(text => ({ text, options: { bold: true, color: C.white, fill: { color: C.primary }, fontSize: 10 } }))
  for (let pg = 0; pg < pages; pg++) {
    const s = pptx.addSlide({ masterName: 'ACRA' })
    titre(s, pg === 0 ? L.listeTitre : L.suite.replace('{n}', `${pg + 1}/${pages}`))
    const lignes = liste.slice(pg * PLANS_PAR_DIAPO, (pg + 1) * PLANS_PAR_DIAPO)
    if (!lignes.length) { s.addText(L.aucunPlan, { x: 0.5, y: 1.5, w: 12.3, h: 0.5, fontSize: 12, italic: true, color: C.muted }); continue }
    s.addTable([entete, ...lignes.map(p => [
      { text: p.titre, options: { fontSize: 9, color: C.ink } },
      { text: p.risque, options: { fontSize: 9, color: C.muted } },
      { text: p.priorite, options: { fontSize: 9 } },
      { text: `${p.echeance}${p.enRetard ? ` · ${L.retard}` : ''}${p.apresMes ? ` · ${L.apresMes}` : ''}`, options: { fontSize: 9, color: p.enRetard ? C.danger : p.apresMes ? C.warn : C.ink } },
      { text: p.statut, options: { fontSize: 9 } },
      { text: p.porteur, options: { fontSize: 9 } },
    ])], { x: 0.5, y: 1.4, w: 12.3, colW: [4.2, 2.6, 1.1, 1.6, 1.2, 1.6], border: { type: 'solid', color: C.line, pt: 0.5 }, autoPage: false })
  }

  return await pptx.write({ outputType: 'nodebuffer' }) as Buffer
}

// ─── Données du support à partir de la vue du projet (lib/projet-vue.server) — PUR ─
// Statuts, priorités, catégories et architecture traduits ; dates au format de la langue ; plan signalé s'il est en
// retard ou prévu après la mise en service.

interface VueSource {
  nom: string; statut: string; secteur: string | null; patterns: string[]; perimetre: string | null; objectifs: string | null
  analyses: { id: string; nom: string }[]; miseEnService: string | null
  synthese: { total: number; aTraiter: number; acceptables: number; paliers: ProjetPptxData['risques']['paliers']
    principaux: { id?: string; nom: string; niveau: number; domaine: string | null; palier: { label: string; couleur: string } }[] }
  indicateurs: IndicateursProjet
}
interface PlanSource { titre: string; statut: string; priorite: string; echeance: string | null; porteur: string | null; risques: { id?: string; nom: string; niveau?: number }[]; enRetard: boolean }

export function donneesProjetPptx({ vue, plans, parDomaine, t, locale, now }: {
  vue: VueSource; plans: readonly PlanSource[]; parDomaine: readonly { domaine: string | null; total: number }[]; t: T; locale: string; now: Date
}): ProjetPptxData {
  const domaines = t.projet360.domaines as Record<string, string>
  const statuts = t.statusLabels as Record<string, string>
  const st = t.risquesDirects.plansStatuts as Record<string, string>
  const prio = t.risquesDirects.plansPriorites as Record<string, string>
  const date = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00.000Z` : iso).toLocaleDateString(locale, { timeZone: 'UTC' })
  const limite = vue.miseEnService ? new Date(`${vue.miseEnService}T23:59:59.999Z`).getTime() : null
  const ind = vue.indicateurs
  return {
    nom: vue.nom, statut: statuts[vue.statut] ?? vue.statut, secteur: vue.secteur,
    patterns: vue.patterns.map(c => patternLabel(c, locale as Locale)),
    perimetre: vue.perimetre, objectifs: vue.objectifs,
    miseEnService: vue.miseEnService ? date(vue.miseEnService) : null,
    analyses: vue.analyses.map(a => a.nom), dateGeneration: now.toLocaleDateString(locale, { timeZone: 'UTC' }),
    risques: {
      total: vue.synthese.total, aTraiter: vue.synthese.aTraiter, acceptables: vue.synthese.acceptables,
      sansPlan: ind.risquesATraiterSansPlan, reductionPct: ind.reductionPct, horsAppetit: ind.residuelsHorsAppetit,
      paliers: vue.synthese.paliers,
      principaux: vue.synthese.principaux.map(r => ({ nom: r.nom, niveau: r.niveau, palier: r.palier.label, couleur: r.palier.couleur, domaine: r.domaine ? domaines[r.domaine] ?? r.domaine : null })),
      parDomaine: parDomaine.map(x => ({ label: x.domaine ? domaines[x.domaine] ?? x.domaine : '—', total: x.total })),
    },
    plans: {
      indicateurs: { ...ind.plans, apresMes: ind.miseEnService?.plansApres ?? 0, joursRestants: ind.miseEnService?.joursRestants ?? null },
      liste: plans.map(p => ({
        titre: p.titre, risque: p.risques.map(r => r.nom).join(', ') || '—', priorite: prio[p.priorite] ?? p.priorite,
        echeance: p.echeance ? date(p.echeance) : '—', statut: st[p.statut] ?? p.statut, porteur: p.porteur?.trim() || '—', enRetard: p.enRetard,
        apresMes: limite != null && p.statut !== 'FAIT' && !!p.echeance && new Date(p.echeance).getTime() > limite,
      })),
    },
  }
}
