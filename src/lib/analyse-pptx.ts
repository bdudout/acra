// ─── Export PowerPoint d'une analyse de risques (présentation managériale) ───
// Génère un jeu de diapositives destiné à un comité de direction : corps court et
// décisionnel (synthèse RAG, cartographie, top risques, plan de traitement) puis
// des ANNEXES détaillées (périmètre, valeurs métier, SR/OV, écosystème, scénarios,
// conformité, détail des risques). pptxgenjs = JS pur (pas de compilation react-pdf).
// Logique de sélection réutilisée du résumé exécutif PDF (execGlobalLevel, execTopRisks).

import PptxGenJS from 'pptxgenjs'
import { execGlobalLevel, execTopRisks, execMeasuresToEngage, type ExecLevel } from './pdf-exec-summary'
import { getRiskTier, type RiskTier } from './risk-scale'

type Any = Record<string, unknown> // eslint-disable-line @typescript-eslint/no-explicit-any

const C = {
  primary: '4338CA', ink: '111827', muted: '6B7280', white: 'FFFFFF', band: 'EEF2FF', line: 'E5E7EB',
  high: 'DC2626', medium: 'D97706', low: '16A34A', none: '9CA3AF',
  tierCritique: 'DC2626', tierEleve: 'EA580C', tierModere: 'D97706', tierFaible: '16A34A',
}
const tierHex: Record<RiskTier, string> = { critique: C.tierCritique, eleve: C.tierEleve, modere: C.tierModere, faible: C.tierFaible }
const levelHex: Record<ExecLevel, string> = { high: C.high, medium: C.medium, low: C.low, none: C.none }

interface L {
  coverKicker: string; org: string; secteur: string; version: string; generatedOn: string
  mentionLabels: Record<string, string>
  synthTitle: string; globalLevel: Record<ExecLevel, string>; globalLevelLead: string
  kpiRisks: string; kpiHigh: string; kpiMedium: string; kpiLow: string; kpiMeasures: string; kpiProgress: string
  topRisks: string; noRisks: string
  cartoTitle: string; cartoAxisG: string; cartoAxisV: string; cartoLegend: string
  treatTitle: string; thRisk: string; thLevel: string; thStrategy: string; thResidual: string
  planTitle: string; thMeasure: string; thPriority: string; thStatus: string; thOwner: string; thDue: string
  strategies: Record<string, string>; statuses: Record<string, string>
  annexKicker: string
  axPerimetre: string; axPerimetreTitle: string; axMissions: string; axVM: string; axBiens: string; axER: string
  axSrOv: string; axSource: string; axCat: string; axPert: string; axOv: string
  axEco: string; axPP: string; axType: string; axMenace: string
  axScen: string; axConf: string; axConfStatut: Record<string, string>; axConfNone: string
  axRisksDetail: string; empty: string
}

const FR: L = {
  coverKicker: 'Analyse de risques cyber — EBIOS Risk Manager', org: 'Organisation', secteur: 'Secteur', version: 'Version', generatedOn: 'Généré le',
  mentionLabels: { NON_PROTEGEE: 'Non protégée', SENSIBLE: 'Sensible', RESTREINTE: 'Diffusion restreinte', CONFIDENTIELLE: 'Confidentielle' },
  synthTitle: 'Synthèse pour la direction', globalLevel: { high: 'Élevé', medium: 'Moyen', low: 'Maîtrisé', none: 'Non évalué' }, globalLevelLead: 'Niveau de risque global',
  kpiRisks: 'Risques identifiés', kpiHigh: 'Élevés', kpiMedium: 'Moyens', kpiLow: 'Faibles', kpiMeasures: 'Mesures', kpiProgress: 'Avancement du traitement',
  topRisks: 'Risques prioritaires', noRisks: 'Aucun risque évalué.',
  cartoTitle: 'Cartographie des risques', cartoAxisG: 'Gravité →', cartoAxisV: 'Vraisemblance →', cartoLegend: 'Chaque case : score gravité × vraisemblance. Rn = risque.',
  treatTitle: 'Risques prioritaires & traitement', thRisk: 'Risque', thLevel: 'Niveau', thStrategy: 'Stratégie', thResidual: 'Résiduel',
  planTitle: 'Plan de traitement', thMeasure: 'Mesure', thPriority: 'Prio.', thStatus: 'Statut', thOwner: 'Responsable', thDue: 'Échéance',
  strategies: { REDUIRE: 'Réduire', ACCEPTER: 'Accepter', TRANSFERER: 'Transférer', REFUSER: 'Refuser', SURVEILLER: 'Surveiller' },
  statuses: { A_FAIRE: 'À faire', EN_COURS: 'En cours', REALISE: 'Réalisé' },
  annexKicker: 'Annexe',
  axPerimetre: 'Périmètre & valeurs métier', axPerimetreTitle: 'Périmètre de l’étude', axMissions: 'Missions', axVM: 'Valeurs métier', axBiens: 'Biens supports', axER: 'Événements redoutés',
  axSrOv: 'Sources de risque & objectifs visés', axSource: 'Source', axCat: 'Catégorie', axPert: 'Pert.', axOv: 'Objectifs visés',
  axEco: 'Écosystème — parties prenantes', axPP: 'Partie prenante', axType: 'Type', axMenace: 'Menace',
  axScen: 'Scénarios stratégiques', axConf: 'Conformité au socle de sécurité', axConfStatut: { conforme: 'Conforme', partiel: 'Partiel', non_conforme: 'Non conforme', non_applicable: 'N/A' }, axConfNone: 'Socle non renseigné.',
  axRisksDetail: 'Détail des risques', empty: '—',
}

const EN: L = {
  coverKicker: 'Cyber risk analysis — EBIOS Risk Manager', org: 'Organisation', secteur: 'Sector', version: 'Version', generatedOn: 'Generated on',
  mentionLabels: { NON_PROTEGEE: 'Unrestricted', SENSIBLE: 'Sensitive', RESTREINTE: 'Restricted', CONFIDENTIELLE: 'Confidential' },
  synthTitle: 'Executive summary', globalLevel: { high: 'High', medium: 'Medium', low: 'Controlled', none: 'Not assessed' }, globalLevelLead: 'Overall risk level',
  kpiRisks: 'Risks identified', kpiHigh: 'High', kpiMedium: 'Medium', kpiLow: 'Low', kpiMeasures: 'Measures', kpiProgress: 'Treatment progress',
  topRisks: 'Priority risks', noRisks: 'No assessed risk.',
  cartoTitle: 'Risk map', cartoAxisG: 'Severity →', cartoAxisV: 'Likelihood →', cartoLegend: 'Each cell: severity × likelihood score. Rn = risk.',
  treatTitle: 'Priority risks & treatment', thRisk: 'Risk', thLevel: 'Level', thStrategy: 'Strategy', thResidual: 'Residual',
  planTitle: 'Treatment plan', thMeasure: 'Measure', thPriority: 'Prio.', thStatus: 'Status', thOwner: 'Owner', thDue: 'Due',
  strategies: { REDUIRE: 'Reduce', ACCEPTER: 'Accept', TRANSFERER: 'Transfer', REFUSER: 'Refuse', SURVEILLER: 'Monitor' },
  statuses: { A_FAIRE: 'To do', EN_COURS: 'In progress', REALISE: 'Done' },
  annexKicker: 'Appendix',
  axPerimetre: 'Scope & business values', axPerimetreTitle: 'Study scope', axMissions: 'Missions', axVM: 'Business values', axBiens: 'Supporting assets', axER: 'Feared events',
  axSrOv: 'Risk sources & targeted objectives', axSource: 'Source', axCat: 'Category', axPert: 'Rel.', axOv: 'Targeted objectives',
  axEco: 'Ecosystem — stakeholders', axPP: 'Stakeholder', axType: 'Type', axMenace: 'Threat',
  axScen: 'Strategic scenarios', axConf: 'Compliance with the security baseline', axConfStatut: { conforme: 'Compliant', partiel: 'Partial', non_conforme: 'Non-compliant', non_applicable: 'N/A' }, axConfNone: 'Baseline not filled in.',
  axRisksDetail: 'Risk details', empty: '—',
}

function strings(locale: string): L { return locale === 'fr' ? FR : EN }

const asArr = (v: unknown): Any[] => (Array.isArray(v) ? (v as Any[]) : [])
const s = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))
const trunc = (v: string, n: number): string => (v.length > n ? v.slice(0, n - 1) + '…' : v)

/** Diapositive : bandeau de titre + numérotation (kicker « Annexe » optionnel). */
function slideHeader(pptx: PptxGenJS, title: string, kicker: string): PptxGenJS.Slide {
  const slide = pptx.addSlide()
  slide.background = { color: C.white }
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.9, fill: { color: C.band }, line: { type: 'none' } })
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.16, h: 0.9, fill: { color: C.primary }, line: { type: 'none' } })
  if (kicker) slide.addText(kicker.toUpperCase(), { x: 0.5, y: 0.12, w: 12, h: 0.24, fontSize: 10, color: C.primary, bold: true, charSpacing: 1 })
  slide.addText(title, { x: 0.5, y: kicker ? 0.34 : 0.22, w: 12.3, h: 0.5, fontSize: 22, bold: true, color: C.ink })
  return slide
}

/** Petite tuile de KPI (label + grand chiffre coloré). */
function kpiTile(slide: PptxGenJS.Slide, pptx: PptxGenJS, x: number, y: number, w: number, label: string, value: string | number, color: string) {
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h: 1.25, rectRadius: 0.06, fill: { color: 'F9FAFB' }, line: { color: C.line, width: 1 } })
  slide.addText(String(value), { x, y: y + 0.12, w, h: 0.6, align: 'center', fontSize: 30, bold: true, color })
  slide.addText(label, { x, y: y + 0.78, w, h: 0.35, align: 'center', fontSize: 10, color: C.muted })
}

export async function renderAnalysePptx(analyse: Any, config: Any | null, locale: string): Promise<Buffer> {
  const L = strings(locale)
  const dateLocale = locale === 'en' ? 'en-GB' : locale === 'de' ? 'de-DE' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : 'fr-FR'
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE' // 13.33 × 7.5
  pptx.author = 'ACRA — Augmented Cyber Risk Analysis'

  const cadrage = (analyse.cadrage as Any) ?? {}
  const risques = asArr(analyse.risques)
  const mesures = asArr(analyse.mesures)
  const now = new Date().toLocaleDateString(dateLocale)

  // ── 1. Couverture ──────────────────────────────────────────────────────────
  const cover = pptx.addSlide()
  cover.background = { color: C.primary }
  cover.addText(L.coverKicker.toUpperCase(), { x: 0.7, y: 1.6, w: 12, h: 0.4, fontSize: 12, color: 'C7D2FE', bold: true, charSpacing: 1 })
  cover.addText(s(analyse.nom) || 'Analyse', { x: 0.7, y: 2.1, w: 12, h: 1.4, fontSize: 40, bold: true, color: C.white })
  const meta: string[] = []
  if (analyse.organisation) meta.push(`${L.org} : ${s(analyse.organisation)}`)
  if (analyse.secteur) meta.push(`${L.secteur} : ${s(analyse.secteur)}`)
  cover.addText(meta.join('    ·    '), { x: 0.7, y: 3.7, w: 12, h: 0.4, fontSize: 14, color: 'E0E7FF' })
  const mention = s((analyse as Any).mentionProtection) || 'NON_PROTEGEE'
  if (mention !== 'NON_PROTEGEE') {
    cover.addShape(pptx.ShapeType.roundRect, { x: 0.7, y: 4.4, w: 3.2, h: 0.5, rectRadius: 0.25, fill: { color: 'FFFFFF' }, line: { type: 'none' } })
    cover.addText(L.mentionLabels[mention] ?? mention, { x: 0.7, y: 4.4, w: 3.2, h: 0.5, align: 'center', fontSize: 12, bold: true, color: C.primary })
  }
  cover.addText(`${L.generatedOn} ${now}`, { x: 0.7, y: 6.7, w: 12, h: 0.4, fontSize: 11, color: 'C7D2FE' })

  // ── 2. Synthèse pour la direction ────────────────────────────────────────
  {
    const slide = slideHeader(pptx, L.synthTitle, '')
    const level = execGlobalLevel(risques as { niveauRisque: number }[])
    // Bandeau RAG
    slide.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: 1.15, w: 12.33, h: 0.9, rectRadius: 0.06, fill: { color: levelHex[level] }, line: { type: 'none' } })
    slide.addText(L.globalLevelLead, { x: 0.8, y: 1.28, w: 6, h: 0.3, fontSize: 12, color: 'FFFFFF' })
    slide.addText(L.globalLevel[level], { x: 0.8, y: 1.5, w: 6, h: 0.5, fontSize: 24, bold: true, color: 'FFFFFF' })
    // KPI tiles
    const tiers = risques.map(r => getRiskTier(Number(r.niveauRisque) || 0))
    const nHigh = tiers.filter(t => t === 'critique' || t === 'eleve').length
    const nMed = tiers.filter(t => t === 'modere').length
    const nLow = tiers.filter(t => t === 'faible').length
    const done = mesures.filter(m => s(m.statut) === 'REALISE').length
    const progress = mesures.length ? Math.round((done / mesures.length) * 100) : 0
    const y = 2.35, w = 2.3, gap = 0.15
    kpiTile(slide, pptx, 0.5, y, w, L.kpiRisks, risques.length, C.ink)
    kpiTile(slide, pptx, 0.5 + (w + gap), y, w, L.kpiHigh, nHigh, C.high)
    kpiTile(slide, pptx, 0.5 + 2 * (w + gap), y, w, L.kpiMedium, nMed, C.medium)
    kpiTile(slide, pptx, 0.5 + 3 * (w + gap), y, w, L.kpiLow, nLow, C.low)
    kpiTile(slide, pptx, 0.5 + 4 * (w + gap), y, w, L.kpiProgress, `${progress}%`, C.primary)
    // Top 3 risques
    slide.addText(L.topRisks, { x: 0.5, y: 3.95, w: 12, h: 0.35, fontSize: 14, bold: true, color: C.ink })
    const top = execTopRisks(risques as { niveauRisque: number }[], 3) as Any[]
    if (top.length === 0) {
      slide.addText(L.noRisks, { x: 0.5, y: 4.35, w: 12, h: 0.4, fontSize: 12, italic: true, color: C.muted })
    } else {
      const items = top.map((r, i) => {
        const tier = getRiskTier(Number(r.niveauRisque) || 0)
        return { text: `${i + 1}. ${trunc(s(r.nom), 90)}   (${Number(r.niveauRisque) || 0})`, options: { bullet: false, color: tierHex[tier], fontSize: 13, breakLine: true, paraSpaceAfter: 6 } }
      })
      slide.addText(items, { x: 0.6, y: 4.35, w: 12.2, h: 2 })
    }
  }

  // ── 3. Cartographie des risques (heatmap) ────────────────────────────────
  {
    const slide = slideHeader(pptx, L.cartoTitle, '')
    const gravEch = asArr((config as Any)?.echelleGravite)
    const n = Math.min(6, Math.max(3, gravEch.length || 4))
    const gx = 1.6, gy = 1.5, cell = 0.95
    // Cellules : lignes = gravité (haut = fort), colonnes = vraisemblance
    for (let gi = 0; gi < n; gi++) {
      const g = n - gi // gravité de la ligne (haut = n)
      for (let vi = 0; vi < n; vi++) {
        const v = vi + 1
        const tier = getRiskTier(g * v)
        const x = gx + vi * cell, y = gy + gi * cell
        slide.addShape(pptx.ShapeType.rect, { x, y, w: cell, h: cell, fill: { color: tierHex[tier], transparency: 55 }, line: { color: C.white, width: 2 } })
        const refs = risques.map((r, idx) => ({ r, idx })).filter(({ r }) => (Number(r.gravite) || 0) === g && (Number(r.vraisemblance) || 0) === v)
        if (refs.length) slide.addText(refs.map(({ idx }) => `R${idx + 1}`).join(' '), { x, y, w: cell, h: cell, align: 'center', valign: 'middle', fontSize: 10, bold: true, color: C.ink })
      }
    }
    // Axes
    slide.addText(L.cartoAxisV, { x: gx, y: gy + n * cell + 0.05, w: n * cell, h: 0.3, align: 'center', fontSize: 11, color: C.muted })
    slide.addText(L.cartoAxisG, { x: gx - 1.4, y: gy, w: 1.3, h: n * cell, align: 'center', valign: 'middle', fontSize: 11, color: C.muted, rotate: 270 })
    slide.addText(L.cartoLegend, { x: gx + n * cell + 0.4, y: gy, w: 4.6, h: 2, fontSize: 11, color: C.muted })
  }

  // ── 4. Risques prioritaires & traitement ─────────────────────────────────
  {
    const slide = slideHeader(pptx, L.treatTitle, '')
    const head = [L.thRisk, L.thLevel, L.thStrategy, L.thResidual].map(t => ({ text: t, options: { bold: true, color: 'FFFFFF', fill: { color: C.primary }, fontSize: 11 } }))
    const top = execTopRisks(risques as { niveauRisque: number }[], 8) as Any[]
    const rows = top.map((r, i) => {
      const tier = getRiskTier(Number(r.niveauRisque) || 0)
      return [
        { text: `R${risques.indexOf(r) + 1 || i + 1} · ${trunc(s(r.nom), 60)}`, options: { fontSize: 10 } },
        { text: String(Number(r.niveauRisque) || 0), options: { fontSize: 10, bold: true, color: tierHex[tier], align: 'center' as const } },
        { text: (L.strategies[s(r.strategie)] ?? s(r.strategie)) || L.empty, options: { fontSize: 10 } },
        { text: r.niveauResiduel != null ? String(r.niveauResiduel) : L.empty, options: { fontSize: 10, align: 'center' as const } },
      ]
    })
    slide.addTable([head, ...(rows.length ? rows : [[{ text: L.noRisks, options: { colspan: 4, italic: true, color: C.muted } }]])], {
      x: 0.5, y: 1.2, w: 12.33, colW: [7.0, 1.6, 2.2, 1.53], border: { type: 'solid', color: C.line, pt: 1 }, valign: 'middle', rowH: 0.35,
    })
  }

  // ── 5. Plan de traitement ────────────────────────────────────────────────
  {
    const slide = slideHeader(pptx, L.planTitle, '')
    const head = [L.thMeasure, L.thPriority, L.thStatus, L.thOwner, L.thDue].map(t => ({ text: t, options: { bold: true, color: 'FFFFFF', fill: { color: C.primary }, fontSize: 11 } }))
    const list = execMeasuresToEngage(mesures as { statut?: string; priorite?: number }[], 10) as Any[]
    const rows = list.map(m => [
      { text: trunc(s(m.nom), 70), options: { fontSize: 10 } },
      { text: m.priorite != null ? `P${m.priorite}` : L.empty, options: { fontSize: 10, align: 'center' as const } },
      { text: (L.statuses[s(m.statut)] ?? s(m.statut)) || L.empty, options: { fontSize: 10 } },
      { text: trunc(s(m.responsable), 24) || L.empty, options: { fontSize: 10 } },
      { text: m.echeance ? new Date(m.echeance as string).toLocaleDateString(dateLocale) : L.empty, options: { fontSize: 10, align: 'center' as const } },
    ])
    slide.addTable([head, ...(rows.length ? rows : [[{ text: L.empty, options: { colspan: 5, italic: true, color: C.muted } }]])], {
      x: 0.5, y: 1.2, w: 12.33, colW: [5.6, 1.0, 1.9, 2.4, 1.43], border: { type: 'solid', color: C.line, pt: 1 }, valign: 'middle', rowH: 0.34,
    })
  }

  // ── ANNEXES ───────────────────────────────────────────────────────────────
  // A. Périmètre & valeurs métier
  {
    const slide = slideHeader(pptx, L.axPerimetre, L.annexKicker)
    let y = 1.2
    const perimetre = s(cadrage.perimetre)
    if (perimetre) { slide.addText(L.axPerimetreTitle, { x: 0.5, y, w: 12, h: 0.3, fontSize: 12, bold: true, color: C.primary }); y += 0.32; slide.addText(trunc(perimetre, 600), { x: 0.5, y, w: 12.3, h: 1.1, fontSize: 11, color: C.ink }); y += 1.2 }
    const vms = asArr(cadrage.valeursMetier)
    if (vms.length) {
      slide.addText(`${L.axVM} (${vms.length})`, { x: 0.5, y, w: 12, h: 0.3, fontSize: 12, bold: true, color: C.primary }); y += 0.32
      slide.addText(vms.slice(0, 8).map(vm => ({ text: s(vm.nom), options: { bullet: true, fontSize: 11, breakLine: true } })), { x: 0.6, y, w: 6, h: 2 })
    }
    const biens = asArr(cadrage.biensSupports)
    if (biens.length) {
      slide.addText(`${L.axBiens} (${biens.length})`, { x: 6.8, y: y, w: 6, h: 0.3, fontSize: 12, bold: true, color: C.primary })
      slide.addText(biens.slice(0, 8).map(b => ({ text: s(b.nom), options: { bullet: true, fontSize: 11, breakLine: true } })), { x: 6.9, y: y + 0.32, w: 6, h: 2 })
    }
  }

  // B. Sources de risque & objectifs visés
  {
    const slide = slideHeader(pptx, L.axSrOv, L.annexKicker)
    const srs = asArr(analyse.sourcesRisque).filter(sr => sr.retenu !== false)
    const head = [L.axSource, L.axCat, L.axPert, L.axOv].map(t => ({ text: t, options: { bold: true, color: 'FFFFFF', fill: { color: C.primary }, fontSize: 11 } }))
    const rows = srs.slice(0, 12).map(sr => [
      { text: trunc(s(sr.nom), 40), options: { fontSize: 10 } },
      { text: trunc(s(sr.categorie), 22), options: { fontSize: 10 } },
      { text: String(Number(sr.pertinence) || ''), options: { fontSize: 10, align: 'center' as const } },
      { text: trunc(asArr(sr.objectifsVises).map(o => s(o.nom)).join(', '), 90), options: { fontSize: 10 } },
    ])
    slide.addTable([head, ...(rows.length ? rows : [[{ text: L.empty, options: { colspan: 4, italic: true, color: C.muted } }]])], {
      x: 0.5, y: 1.2, w: 12.33, colW: [3.6, 2.4, 1.0, 5.33], border: { type: 'solid', color: C.line, pt: 1 }, valign: 'middle', rowH: 0.34,
    })
  }

  // C. Écosystème — parties prenantes (si présentes)
  {
    const pps = asArr(analyse.partiesPrenantes)
    if (pps.length) {
      const slide = slideHeader(pptx, L.axEco, L.annexKicker)
      const head = [L.axPP, L.axType, L.axMenace].map(t => ({ text: t, options: { bold: true, color: 'FFFFFF', fill: { color: C.primary }, fontSize: 11 } }))
      const rows = pps.slice(0, 14).map(pp => {
        const men = (Number(pp.exposition) || 1) / (Number(pp.fiabilite) || 1)
        return [
          { text: trunc(s(pp.nom), 46), options: { fontSize: 10 } },
          { text: trunc(s(pp.type), 22), options: { fontSize: 10 } },
          { text: men.toFixed(2), options: { fontSize: 10, align: 'center' as const } },
        ]
      })
      slide.addTable([head, ...rows], { x: 0.5, y: 1.2, w: 12.33, colW: [7.5, 3.0, 1.83], border: { type: 'solid', color: C.line, pt: 1 }, valign: 'middle', rowH: 0.34 })
    }
  }

  // D. Scénarios stratégiques
  {
    const scen = asArr(analyse.scenariosStrategiques).filter(x => x.retenu !== false)
    if (scen.length) {
      const slide = slideHeader(pptx, L.axScen, L.annexKicker)
      const head = [{ text: L.thRisk, options: { bold: true, color: 'FFFFFF', fill: { color: C.primary }, fontSize: 11 } }, { text: 'G', options: { bold: true, color: 'FFFFFF', fill: { color: C.primary }, fontSize: 11, align: 'center' as const } }, { text: 'V', options: { bold: true, color: 'FFFFFF', fill: { color: C.primary }, fontSize: 11, align: 'center' as const } }, { text: L.thLevel, options: { bold: true, color: 'FFFFFF', fill: { color: C.primary }, fontSize: 11, align: 'center' as const } }]
      const rows = scen.slice(0, 14).map(sc => {
        const tier = getRiskTier(Number(sc.niveauRisque) || 0)
        return [
          { text: trunc(s(sc.nom), 80), options: { fontSize: 10 } },
          { text: String(Number(sc.gravite) || ''), options: { fontSize: 10, align: 'center' as const } },
          { text: String(Number(sc.vraisemblance) || ''), options: { fontSize: 10, align: 'center' as const } },
          { text: String(Number(sc.niveauRisque) || ''), options: { fontSize: 10, bold: true, color: tierHex[tier], align: 'center' as const } },
        ]
      })
      slide.addTable([head, ...rows], { x: 0.5, y: 1.2, w: 12.33, colW: [9.33, 1.0, 1.0, 1.0], border: { type: 'solid', color: C.line, pt: 1 }, valign: 'middle', rowH: 0.34 })
    }
  }

  // E. Conformité au socle
  {
    const socle = asArr(cadrage.socleSecurite)
    if (socle.length) {
      const slide = slideHeader(pptx, L.axConf, L.annexKicker)
      const counts: Record<string, number> = {}
      socle.forEach(e => { const st = s(e.statut) || 'non_applicable'; counts[st] = (counts[st] ?? 0) + 1 })
      const y = 1.6, w = 2.7, gap = 0.2
      const order = ['conforme', 'partiel', 'non_conforme', 'non_applicable']
      const cols: Record<string, string> = { conforme: C.low, partiel: C.medium, non_conforme: C.high, non_applicable: C.none }
      order.forEach((st, i) => kpiTile(slide, pptx, 0.6 + i * (w + gap), y, w, L.axConfStatut[st] ?? st, counts[st] ?? 0, cols[st]))
    }
  }

  // F. Détail des risques (table complète)
  {
    const slide = slideHeader(pptx, L.axRisksDetail, L.annexKicker)
    const head = [L.thRisk, 'G', 'V', L.thLevel, L.thStrategy, L.thResidual].map((t, i) => ({ text: t, options: { bold: true, color: 'FFFFFF', fill: { color: C.primary }, fontSize: 10, align: (i === 0 ? 'left' : 'center') as 'left' | 'center' } }))
    const rows = risques.slice(0, 16).map((r, i) => {
      const tier = getRiskTier(Number(r.niveauRisque) || 0)
      return [
        { text: `R${i + 1} · ${trunc(s(r.nom), 60)}`, options: { fontSize: 9 } },
        { text: String(Number(r.gravite) || ''), options: { fontSize: 9, align: 'center' as const } },
        { text: String(Number(r.vraisemblance) || ''), options: { fontSize: 9, align: 'center' as const } },
        { text: String(Number(r.niveauRisque) || ''), options: { fontSize: 9, bold: true, color: tierHex[tier], align: 'center' as const } },
        { text: (L.strategies[s(r.strategie)] ?? s(r.strategie)) || L.empty, options: { fontSize: 9 } },
        { text: r.niveauResiduel != null ? String(r.niveauResiduel) : L.empty, options: { fontSize: 9, align: 'center' as const } },
      ]
    })
    slide.addTable([head, ...(rows.length ? rows : [[{ text: L.noRisks, options: { colspan: 6, italic: true, color: C.muted } }]])], {
      x: 0.5, y: 1.2, w: 12.33, colW: [6.83, 0.8, 0.8, 1.1, 1.8, 1.0], border: { type: 'solid', color: C.line, pt: 1 }, valign: 'middle', rowH: 0.3,
    })
  }

  const out = await pptx.write({ outputType: 'nodebuffer' })
  return out as Buffer
}
