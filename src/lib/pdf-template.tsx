/**
 * pdf-template.tsx — Server-side PDF report using @react-pdf/renderer
 *
 * ⚠️ N'utilise AUCUN Fragment JSX (`<View>`) : sous le runtime JSX automatique de SWC
 * (build Next), un Fragment passé comme enfant n'est pas aplati par le
 * réconciliateur de @react-pdf/renderer → « React error #31 ». On regroupe via
 * <View> (équivalent visuel, compatible sauts de page).
 *
 * This file replaces the former client-side jsPDF implementation.
 * It renders entirely on the server (in the /api/export route) and
 * returns a binary stream — no browser APIs required.
 *
 * Report structure (mirrors the former jsPDF output):
 *   Page 1  — Cover page
 *   Page 2  — Executive summary (KPIs, risk distribution, top-5 table, action plan)
 *   Page 3+ — Atelier 1 (Cadrage)
 *   Page 4+ — Atelier 2 (Sources de risque)
 *   Page 5+ — Atelier 3 (Scénarios stratégiques)
 *   Page 6+ — Atelier 4 (Scénarios opérationnels)
 *   Page 7+ — Atelier 5 (Traitement du risque)
 *   Last    — Annexe (méthodologie, échelles, matrice)
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  renderToBuffer,
  Svg,
  G,
  Circle,
  Line,
  Path,
} from '@react-pdf/renderer'
import { getRiskTier } from '@/lib/risk-scale'
import { execGlobalLevel, execTopRisks, execMeasuresToEngage } from '@/lib/pdf-exec-summary'
import { recommendedFrameworksForSector } from '@/lib/frameworks-data'
import { reportUsageNotes } from '@/lib/regulatory-guidance'
import { isClassified } from '@/lib/classification'
import { normalizeMentionProtection, isProtectedMention } from '@/lib/mention-protection'
import { etatSocleFromEntry } from '@/lib/socle-etat'
import { normalizeCategorieMesure } from '@/lib/mesure-categorie'
import { hasCadrageContexte, isNonEmptyText } from '@/lib/pdf-guards'
import { getPdfStrings, type PdfStrings } from '@/lib/pdf-i18n'
import {
  layoutStakeholders,
  stakeholderRef,
  zoneRadii,
  sectorSpans,
  polarToXY,
  menace,
  zoneOf,
  fiabiliteLevel,
  expositionLevel,
  type EcosystemZone,
} from '@/lib/ecosystem-radar'

// ─── Colour palette ────────────────────────────────────────────────────────────
const C = {
  indigo:   '#4338CA',
  teal:     '#0D9488',
  purple:   '#7C3AED',
  orange:   '#EA580C',
  red:      '#DC2626',
  green:    '#16A34A',
  yellow:   '#CA8A04',
  sky:      '#0284C7',
  darkGray: '#374151',
  gray800:  '#1F2937',
  gray500:  '#6B7280',
  gray200:  '#E5E7EB',
  gray100:  '#F3F4F6',
  white:    '#FFFFFF',
}

function riskColor(score: number): string {
  if (score >= 12) return C.red
  if (score >= 8)  return C.orange
  if (score >= 4)  return C.yellow
  return C.green
}
function riskLabel(score: number, tp: PdfStrings): string {
  if (score >= 12) return tp.risk.critique
  if (score >= 8)  return tp.risk.eleve
  if (score >= 4)  return tp.risk.modere
  return tp.risk.faible
}
// ─── Échelles : valeurs par défaut (repli si la config n'est pas fournie) ───────
const DEFAULT_GRAVITE = [
  { niveau: 1, label: 'Négligeable', description: "Impact minimal, ne remet pas en cause les activités essentielles de l'organisation." },
  { niveau: 2, label: 'Limité',      description: "Impact notable mais l'organisation peut faire face sans mesures exceptionnelles." },
  { niveau: 3, label: 'Important',   description: "Impact significatif nécessitant des moyens exceptionnels pour y faire face." },
  { niveau: 4, label: 'Critique',    description: "Impact vital pouvant menacer la survie ou la continuité de l'organisation." },
]
const DEFAULT_VRAIS = [
  { niveau: 1, label: 'Minime',       description: "Scénario très peu probable : l'attaquant a peu de moyens, de motivation ou d'opportunité." },
  { niveau: 2, label: 'Significatif', description: "Scénario possible mais peu fréquent : conditions d'attaque partiellement réunies." },
  { niveau: 3, label: 'Fort',         description: "Scénario probable : l'attaquant dispose des capacités et motivations suffisantes." },
  { niveau: 4, label: 'Maximal',      description: "Scénario très probable ou quasiment certain : toutes conditions d'attaque réunies." },
]
const DEFAULT_SEUILS = [
  { scoreMin: 1,  scoreMax: 3,  label: 'Faible',   couleur: C.green },
  { scoreMin: 4,  scoreMax: 7,  label: 'Modéré',   couleur: C.yellow },
  { scoreMin: 8,  scoreMax: 11, label: 'Élevé',    couleur: C.orange },
  { scoreMin: 12, scoreMax: 25, label: 'Critique', couleur: C.red },
]

/** Couleur d'une cellule de matrice selon les seuils configurés (repli : riskColor). */
function matrixColor(score: number, seuils: any[]): string {
  for (const s of seuils) if (score >= s.scoreMin && score <= s.scoreMax) return s.couleur || riskColor(score)
  return riskColor(score)
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    paddingTop: 14, paddingBottom: 24, paddingHorizontal: 14,
    fontFamily: 'Helvetica', fontSize: 9, color: C.gray800,
  },
  // Page-level banner (full-width, bleeds into padding)
  banner: {
    marginTop: -14, marginHorizontal: -14,
    paddingVertical: 6, paddingHorizontal: 14,
    marginBottom: 10,
  },
  bannerTitle: { color: C.white, fontSize: 11, fontFamily: 'Helvetica-Bold' },
  // Section title bar
  sectionBar: {
    paddingVertical: 3, paddingHorizontal: 5,
    marginBottom: 5, marginTop: 6,
  },
  sectionBarText: { color: C.white, fontSize: 9.5, fontFamily: 'Helvetica-Bold' },
  // Table
  tableHeaderRow: { flexDirection: 'row' },
  tableRow:       { flexDirection: 'row', borderBottomWidth: 0.4, borderBottomColor: C.gray200 },
  tableAltRow:    { flexDirection: 'row', borderBottomWidth: 0.4, borderBottomColor: C.gray200, backgroundColor: C.gray100 },
  tableHeaderCell:{ flex: 1, padding: 3, fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.white },
  tableCell:      { flex: 1, padding: 3, fontSize: 7.5, color: C.gray800 },
  tableCellBold:  { flex: 1, padding: 3, fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.gray800 },
  tableWrap:      { marginBottom: 8, borderWidth: 0.4, borderColor: C.gray200 },
  // KPI card
  kpiRow:   { flexDirection: 'row', gap: 4, marginBottom: 8 },
  kpiCard:  { flex: 1, borderRadius: 2, paddingVertical: 6, paddingHorizontal: 4, alignItems: 'center' },
  kpiVal:   { fontSize: 17, fontFamily: 'Helvetica-Bold', color: C.white },
  kpiLbl:   { fontSize: 6.5, color: C.white, textAlign: 'center', marginTop: 2 },
  // Text helpers
  h2:       { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.gray800, marginBottom: 4 },
  body:     { fontSize: 8.5, color: C.gray800, marginBottom: 3, lineHeight: 1.4 },
  small:    { fontSize: 7.5, color: C.gray500, lineHeight: 1.4 },
  italic:   { fontSize: 8.5, fontFamily: 'Helvetica-Oblique', color: C.gray500 },
  label:    { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.gray800 },
  // Highlight box
  hintBox:  { backgroundColor: '#EEF2FF', borderRadius: 2, padding: '5 6', marginBottom: 8 },
  hintText: { fontSize: 8.5, color: C.indigo, lineHeight: 1.4 },
  // Footer
  footer:   { position: 'absolute', bottom: 8, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.3, borderTopColor: C.gray100, paddingTop: 3 },
  footerTxt:{ fontSize: 7, color: C.gray500 },
})

// ─── Reusable components ───────────────────────────────────────────────────────

/** Full-width page-top banner */
function Banner({ title, color }: { title: string; color: string }) {
  return (
    <View style={[s.banner, { backgroundColor: color }]}>
      <Text style={s.bannerTitle}>{title}</Text>
    </View>
  )
}

/** Coloured section subtitle bar */
function SectionBar({ title, color }: { title: string; color: string }) {
  return (
    <View style={[s.sectionBar, { backgroundColor: color }]}>
      <Text style={s.sectionBarText}>{title}</Text>
    </View>
  )
}

/** Mention de protection à afficher (label §3.2) ; '' si l'analyse est non protégée. */
function mentionMarking(analyse: any, tp: PdfStrings): string { // eslint-disable-line @typescript-eslint/no-explicit-any
  const m = normalizeMentionProtection(analyse?.mentionProtection)
  return isProtectedMention(m) ? (tp.cover.mentions[m] ?? '') : ''
}

/** Footer rendered on every page */
function Footer({ nom, date, tp, mention }: { nom: string; date: string; tp: PdfStrings; mention?: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerTxt}>EBIOS RM — {nom}</Text>
      <Text style={s.footerTxt}>{mention ? mention.toUpperCase() : `${tp.footer.confidential} ${date}`}</Text>
      <Text style={s.footerTxt} render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => tp.footer.page(pageNumber, totalPages)} />
    </View>
  )
}

interface TableProps {
  headers: string[]
  rows: (string | { text: string; color?: string; bold?: boolean })[][]
  color: string
  /** Optional per-column flex values (defaults to 1 for all) */
  colFlex?: number[]
}

/** Generic table with coloured header row */
function DataTable({ headers, rows, color, colFlex }: TableProps) {
  return (
    <View style={s.tableWrap} wrap={false}>
      {/* Header */}
      <View style={[s.tableHeaderRow, { backgroundColor: color }]}>
        {headers.map((h, i) => (
          <Text key={i} style={[s.tableHeaderCell, colFlex ? { flex: colFlex[i] } : {}]}>{h}</Text>
        ))}
      </View>
      {/* Body */}
      {rows.map((row, ri) => (
        <View key={ri} style={ri % 2 === 0 ? s.tableRow : s.tableAltRow} wrap={false}>
          {row.map((cell, ci) => {
            const isObj = typeof cell === 'object'
            const text  = isObj ? cell.text : cell
            const color_ = isObj ? cell.color : undefined
            const bold  = isObj ? cell.bold  : false
            return (
              <Text
                key={ci}
                style={[
                  bold ? s.tableCellBold : s.tableCell,
                  colFlex ? { flex: colFlex[ci] } : {},
                  color_ ? { color: color_ } : {},
                ]}
              >
                {text}
              </Text>
            )
          })}
        </View>
      ))}
    </View>
  )
}

// ─── Cover page ────────────────────────────────────────────────────────────────

function CoverPage({ analyse, date, tp }: { analyse: any; date: string; tp: PdfStrings }) {
  const statut = analyse.statut === 'TERMINE' ? tp.cover.statutTermine
               : analyse.statut === 'APPROUVE' ? tp.cover.statutApprouve
               : tp.cover.statutEnCours
  const mention = normalizeMentionProtection(analyse.mentionProtection)
  const mentionProtected = isProtectedMention(mention)

  return (
    <Page size="A4" style={s.page}>
      {/* Marquage de protection du document (label EBIOS RM §3.2), bandeau pleine largeur
          en tête (bleed). paddingTop généreux pour ne pas rogner le texte au bord de page ;
          marginBottom:14 compense le marginTop:-14 du bandeau indigo qui suit. */}
      {mentionProtected ? (
        <View style={{ backgroundColor: C.red, marginTop: -14, marginHorizontal: -14, marginBottom: 14, paddingTop: 8, paddingBottom: 5, paddingHorizontal: 14, alignItems: 'center' }}>
          <Text style={{ color: C.white, fontSize: 8.5, fontFamily: 'Helvetica-Bold', letterSpacing: 1 }}>
            {(tp.cover.mentions[mention] ?? '').toUpperCase()}
          </Text>
        </View>
      ) : null}

      {/* Top banner */}
      <View style={[s.banner, { backgroundColor: C.indigo, paddingVertical: 18 }]}>
        <Text style={{ color: C.white, fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>
          {tp.cover.title}
        </Text>
        <Text style={{ color: '#C7D2FE', fontSize: 11 }}>
          {tp.cover.method}
        </Text>
        <Text style={{ color: '#C7D2FE', fontSize: 9, marginTop: 2 }}>
          {tp.cover.iso}
        </Text>
        <Text style={{ color: '#A5B4FC', fontSize: 8, position: 'absolute', top: 10, right: 14 }}>
          {tp.cover.generatedOn} {date}
        </Text>
      </View>

      {/* Analyse details */}
      <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 8 }}>{analyse.nom}</Text>

      {analyse.organisation ? (
        <Text style={{ fontSize: 9, color: C.gray500, marginBottom: 3 }}>{tp.cover.organisation} : {analyse.organisation}</Text>
      ) : null}
      {analyse.secteur ? (
        <Text style={{ fontSize: 9, color: C.gray500, marginBottom: 3 }}>{tp.cover.secteur} : {analyse.secteur}</Text>
      ) : null}
      {analyse.cadrage?.tailleAnalyse && analyse.cadrage.tailleAnalyse !== 'STANDARD' && tp.cover.profils[analyse.cadrage.tailleAnalyse] ? (
        <Text style={{ fontSize: 9, color: C.gray500, marginBottom: 3 }}>{tp.cover.profilLabel} : {tp.cover.profils[analyse.cadrage.tailleAnalyse]}</Text>
      ) : null}
      {analyse.qualification?.statutReglementaire && tp.cover.statutsReg[analyse.qualification.statutReglementaire] ? (
        <Text style={{ fontSize: 9, color: C.gray500, marginBottom: 3 }}>{tp.cover.statutRegLabel} : {tp.cover.statutsReg[analyse.qualification.statutReglementaire]}</Text>
      ) : null}
      <Text style={{ fontSize: 9, color: mentionProtected ? C.red : C.gray500, marginBottom: 3 }}>{tp.cover.mentionLabel} : {tp.cover.mentions[mention] ?? ''}</Text>
      <Text style={{ fontSize: 9, color: C.gray500, marginBottom: 3 }}>{tp.cover.statut} : {statut}</Text>
      <Text style={{ fontSize: 9, color: C.gray500, marginBottom: 3 }}>
        {tp.cover.createdOn} : {new Date(analyse.createdAt).toLocaleDateString(tp.dateLocale)}
      </Text>
      <Text style={{ fontSize: 9, color: C.gray500, marginBottom: 3 }}>
        {tp.cover.updatedOn} : {new Date(analyse.updatedAt).toLocaleDateString(tp.dateLocale)}
      </Text>

      {/* Separator */}
      <View style={{ borderTopWidth: 0.5, borderTopColor: C.indigo, marginTop: 12 }} />

      <Footer nom={analyse.nom} date={date} tp={tp} mention={mentionMarking(analyse, tp)} />
    </Page>
  )
}

// ─── Executive summary page ────────────────────────────────────────────────────

// Matrice des risques (grille react-pdf) avec les risques positionnés (R1, R2…).
// `points` = [{ ref, g, v }] ; la couleur de cellule suit les seuils configurés.
function RiskMatrixPdf({ points, config, title, color }: { points: { ref: string; g: number; v: number }[]; config?: any; title: string; color: string }) {
  const gravite: any[] = config?.echelleGravite?.length ? config.echelleGravite : DEFAULT_GRAVITE
  const vrais: any[]   = config?.echelleVraisemblance?.length ? config.echelleVraisemblance : DEFAULT_VRAIS
  const seuils: any[]  = config?.seuilsMatrice?.length ? config.seuilsMatrice : DEFAULT_SEUILS
  const gravValues  = [...gravite].map((g: any) => g.niveau).sort((a, b) => b - a)
  const vraisValues = [...vrais].map((v: any) => v.niveau).sort((a, b) => a - b)
  return (
    <View>
      <SectionBar title={title} color={color} />
      <View style={{ flexDirection: 'row', marginLeft: 20, marginBottom: 2 }}>
        {vraisValues.map(v => (
          <View key={v} style={{ flex: 1, alignItems: 'center' }}><Text style={{ fontSize: 6, color: C.gray500 }}>V{v}</Text></View>
        ))}
      </View>
      {gravValues.map(g => (
        <View key={g} style={{ flexDirection: 'row', alignItems: 'stretch', marginBottom: 1 }}>
          <View style={{ width: 20, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 3 }}>
            <Text style={{ fontSize: 6, color: C.gray500 }}>G{g}</Text>
          </View>
          {vraisValues.map(v => {
            const inCell = points.filter(p => p.g === g && p.v === v)
            return (
              <View key={v} style={{ flex: 1, minHeight: 19, backgroundColor: matrixColor(g * v, seuils), marginHorizontal: 1, borderRadius: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', padding: 1 }}>
                {inCell.map(p => (
                  <Text key={p.ref} style={{ fontSize: 6, color: C.white, fontFamily: 'Helvetica-Bold', marginHorizontal: 1 }}>{p.ref}</Text>
                ))}
              </View>
            )
          })}
        </View>
      ))}
    </View>
  )
}

// ─── Résumé exécutif non technique (issue #76) ──────────────────────────────────
function ExecutiveSummaryPage({ analyse, date, tp }: { analyse: any; date: string; tp: PdfStrings }) {
  const risques = analyse.risques || []
  const mesures = analyse.mesures || []

  // Niveau de risque global (couleur + libellé non technique)
  const levelKey = execGlobalLevel(risques)
  const levelColor = levelKey === 'high' ? C.red : levelKey === 'medium' ? C.orange : levelKey === 'low' ? C.green : C.gray500
  const top3 = execTopRisks(risques)
  const topMeasures = execMeasuresToEngage(mesures)

  return (
    <Page size="A4" style={s.page}>
      <Banner title={tp.execSummary.banner} color={C.indigo} />
      <Text style={s.body}>{tp.execSummary.intro}</Text>

      {/* Niveau de risque global */}
      <View style={{ backgroundColor: levelColor, borderRadius: 3, padding: 12, marginBottom: 12 }}>
        <Text style={{ fontSize: 8, color: C.white }}>{tp.execSummary.globalLabel}</Text>
        <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', color: C.white, marginVertical: 2 }}>{tp.execSummary.levels[levelKey]}</Text>
        <Text style={{ fontSize: 9, color: C.white, lineHeight: 1.4 }}>{tp.execSummary.levelTexts[levelKey]}</Text>
      </View>

      {/* 3 principaux risques (langage clair) */}
      <Text style={s.h2}>{tp.execSummary.topRisksTitle}</Text>
      {top3.length > 0 ? top3.map((r: any, i: number) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: riskColor(r.niveauRisque), marginRight: 6 }} />
          <Text style={{ fontSize: 9, color: C.gray800, flex: 1 }}>{r.nom}</Text>
          <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: riskColor(r.niveauRisque) }}>{riskLabel(r.niveauRisque, tp)}</Text>
        </View>
      )) : <Text style={s.italic}>{tp.execSummary.noRisk}</Text>}

      {/* 5 premières actions à engager */}
      <Text style={[s.h2, { marginTop: 12 }]}>{tp.execSummary.topMeasuresTitle}</Text>
      {topMeasures.length > 0 ? topMeasures.map((m: any, i: number) => (
        <View key={i} style={{ flexDirection: 'row', marginBottom: 4 }}>
          <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.indigo, width: 14 }}>{i + 1}.</Text>
          <Text style={{ fontSize: 9, color: C.gray800, flex: 1 }}>{m.nom || m.mesure || m.description}</Text>
        </View>
      )) : <Text style={s.italic}>{tp.execSummary.noMeasure}</Text>}

      <Footer nom={analyse.nom} date={date} tp={tp} mention={mentionMarking(analyse, tp)} />
    </Page>
  )
}

function SummaryPage({ analyse, date, config, tp }: { analyse: any; date: string; config?: any; tp: PdfStrings }) {
  const risques          = analyse.risques       || []
  const mesures          = analyse.mesures        || []
  const critiques        = risques.filter((r: any) => getRiskTier(r.niveauRisque) === 'critique')
  const residuelsReduits = risques.filter((r: any) =>
    r.niveauResiduel != null && r.niveauResiduel < r.niveauRisque,
  )
  const mesuresRealisees = mesures.filter((m: any) => m.statut === 'REALISE')
  const mesuresEnCours   = mesures.filter((m: any) => m.statut === 'EN_COURS')
  const mesuresP1        = mesures.filter((m: any) => m.priorite === 1)
  const elevees          = risques.filter((r: any) => getRiskTier(r.niveauRisque) === 'eleve')

  let conclusion = ''
  if (risques.length === 0) {
    conclusion = tp.summary.conclNone
  } else if (critiques.length > 0) {
    conclusion = tp.summary.conclCritiques(risques.length, critiques.length, mesuresP1.length)
  } else if (elevees.length > 0) {
    conclusion = tp.summary.conclEleves(risques.length, elevees.length, mesures.length)
  } else {
    conclusion = tp.summary.conclModeres(risques.length, mesures.length)
  }

  const top5 = [...risques].sort((a: any, b: any) => b.niveauRisque - a.niveauRisque).slice(0, 5)

  // Notes de valorisation (DORA art. 8 / homologation SSI / II 901) — issues #70/#74/#103
  const hasClassifiedVm = ((analyse.cadrage?.valeursMetier as any[]) ?? []).some(vm => isClassified(vm?.classification))
  const usageNotes = reportUsageNotes(
    recommendedFrameworksForSector(analyse.secteur, analyse.cadrage?.tailleAnalyse, analyse.sousSecteur, analyse.qualification?.statutReglementaire, analyse.qualification?.entiteFinanciereAgreee),
    analyse.secteur,
    hasClassifiedVm,
  )

  const statutsMesures = [
    { label: tp.summary.statutRealise, count: mesuresRealisees.length, color: C.green },
    { label: tp.summary.statutEnCours, count: mesuresEnCours.length,   color: C.indigo },
    { label: tp.summary.statutAFaire,  count: mesures.filter((m: any) => m.statut === 'A_FAIRE').length,  color: C.orange },
    { label: tp.summary.statutReporte, count: mesures.filter((m: any) => m.statut === 'REPORTE').length, color: C.gray500 },
  ].filter(s => s.count > 0)

  // Risques numérotés R1, R2… (par score brut décroissant) — refs communes aux 2 matrices
  const numbered = [...risques].sort((a: any, b: any) => b.niveauRisque - a.niveauRisque).map((r: any, i: number) => ({ ...r, ref: `R${i + 1}` }))
  const grossPts = numbered.map((r: any) => ({ ref: r.ref, g: r.gravite, v: r.vraisemblance }))
  const residualPts = numbered
    .filter((r: any) => r.graviteResiduelle != null && r.vraisemblanceResiduelle != null)
    .map((r: any) => ({ ref: r.ref, g: r.graviteResiduelle, v: r.vraisemblanceResiduelle }))

  return (
    <Page size="A4" style={s.page} wrap>
      <Banner title={tp.summary.banner} color={C.indigo} />

      {/* Intro text */}
      <Text style={s.body}>{tp.summary.intro}</Text>

      {/* Conclusion highlight */}
      <View style={s.hintBox}>
        <Text style={s.hintText}>{conclusion}</Text>
      </View>

      {/* KPIs */}
      <View style={s.kpiRow}>
        <View style={[s.kpiCard, { backgroundColor: C.indigo }]}>
          <Text style={s.kpiVal}>{risques.length}</Text>
          <Text style={s.kpiLbl}>{tp.summary.kpiRisques(risques.length)}</Text>
        </View>
        <View style={[s.kpiCard, { backgroundColor: C.red }]}>
          <Text style={s.kpiVal}>{critiques.length}</Text>
          <Text style={s.kpiLbl}>{tp.summary.kpiCritiques(critiques.length)}</Text>
        </View>
        <View style={[s.kpiCard, { backgroundColor: C.green }]}>
          <Text style={s.kpiVal}>{residuelsReduits.length}</Text>
          <Text style={s.kpiLbl}>{tp.summary.kpiReduits(residuelsReduits.length)}</Text>
        </View>
        <View style={[s.kpiCard, { backgroundColor: C.teal }]}>
          <Text style={s.kpiVal}>{mesuresRealisees.length}</Text>
          <Text style={s.kpiLbl}>{tp.summary.kpiRealisees(mesuresRealisees.length)}</Text>
        </View>
      </View>

      {/* Vue d'ensemble visuelle : matrices brute & résiduelle + radar écosystème */}
      {risques.length > 0 && (
        <View wrap={false} style={{ marginBottom: 6 }}>
          <View style={{ flexDirection: 'row', gap: 14 }}>
            <View style={{ flex: 1 }}>
              <RiskMatrixPdf points={grossPts} config={config} title={tp.summary.matrixBrute} color={C.indigo} />
            </View>
            <View style={{ flex: 1 }}>
              <RiskMatrixPdf points={residualPts} config={config} title={tp.summary.matrixResiduelle} color={C.green} />
            </View>
          </View>
        </View>
      )}
      {(analyse.partiesPrenantes || []).length > 0 && (
        <View wrap={false} style={{ marginBottom: 6 }}>
          <SectionBar title={tp.summary.ecoMapTitle} color={C.teal} />
          <EcosystemRadarPdf parties={analyse.partiesPrenantes} withList tp={tp} />
        </View>
      )}

      {/* Risk distribution */}
      {risques.length > 0 && (
        <View>
          <Text style={s.h2}>{tp.summary.distribTitle}</Text>
          {[
            { label: tp.summary.distribCritique, count: critiques.length },
            { label: tp.summary.distribEleve,    count: elevees.length },
            { label: tp.summary.distribModere,   count: risques.filter((r: any) => getRiskTier(r.niveauRisque) === 'modere').length },
            { label: tp.summary.distribFaible,   count: risques.filter((r: any) => getRiskTier(r.niveauRisque) === 'faible').length },
          ].map((n, i) => {
            const colors_ = [C.red, C.orange, C.yellow, C.green]
            const pct = risques.length > 0 ? n.count / risques.length : 0
            return (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ fontSize: 7.5, width: 70, color: C.gray800 }}>{n.label}</Text>
                <View style={{ flex: 1, height: 6, backgroundColor: C.gray100, borderRadius: 1, marginHorizontal: 4 }}>
                  {pct > 0 && (
                    <View style={{ width: `${Math.round(pct * 100)}%`, height: 6, backgroundColor: colors_[i], borderRadius: 1 }} />
                  )}
                </View>
                <Text style={{ fontSize: 7, color: C.gray500, width: 14, textAlign: 'right' }}>{n.count}</Text>
              </View>
            )
          })}
        </View>
      )}

      {/* Top 5 risks */}
      {top5.length > 0 && (
        <View>
          <Text style={[s.h2, { marginTop: 6 }]}>{tp.summary.top5Title}</Text>
          <DataTable
            color={C.gray800}
            headers={tp.summary.top5Headers}
            colFlex={[3, 1.2, 1.2, 1.5, 1.5]}
            rows={top5.map((r: any) => [
              r.nom,
              `${r.niveauRisque}/16`,
              { text: riskLabel(r.niveauRisque, tp), color: riskColor(r.niveauRisque), bold: true },
              r.strategie.replace(/_/g, ' '),
              r.niveauResiduel != null ? `${r.niveauResiduel}/16 (${riskLabel(r.niveauResiduel, tp)})` : '—',
            ])}
          />
        </View>
      )}

      {/* Action plan summary */}
      {mesures.length > 0 ? (
        <View>
          <Text style={[s.h2, { marginTop: 6 }]}>{tp.summary.actionTitle}</Text>
          <View style={{ flexDirection: 'row', gap: 4, marginBottom: 6 }}>
            {statutsMesures.map((sm, i) => (
              <View key={i} style={[s.kpiCard, { backgroundColor: sm.color }]}>
                <Text style={s.kpiVal}>{sm.count}</Text>
                <Text style={s.kpiLbl}>{sm.label}</Text>
              </View>
            ))}
          </View>
          {mesuresRealisees.length > 0 && (
            <Text style={s.small}>
              {tp.summary.taux(Math.round((mesuresRealisees.length / mesures.length) * 100), mesuresRealisees.length, mesures.length, mesuresEnCours.length)}
            </Text>
          )}
        </View>
      ) : (
        <Text style={s.italic}>{tp.summary.noMesure}</Text>
      )}

      {/* Notes de valorisation du rapport (DORA art. 8 / homologation SSI) */}
      {usageNotes.length > 0 && (
        <View style={s.hintBox}>
          <Text style={[s.hintText, { fontFamily: 'Helvetica-Bold', marginBottom: 2 }]}>{tp.summary.usageTitle}</Text>
          {usageNotes.includes('doraArt8') && <Text style={s.hintText}>• {tp.summary.usageDoraArt8}</Text>}
          {usageNotes.includes('homologationSSI') && <Text style={s.hintText}>• {tp.summary.usageHomologSSI}</Text>}
          {usageNotes.includes('homologationII901') && <Text style={s.hintText}>• {tp.summary.usageHomologII901}</Text>}
          {usageNotes.includes('orsaSolva2') && <Text style={s.hintText}>• {tp.summary.usageOrsaSolva2}</Text>}
        </View>
      )}

      <Footer nom={analyse.nom} date={date} tp={tp} mention={mentionMarking(analyse, tp)} />
    </Page>
  )
}

// ─── Atelier 1 — Cadrage ───────────────────────────────────────────────────────

function Atelier1Page({ analyse, date, tp }: { analyse: any; date: string; tp: PdfStrings }) {
  const cadrage = analyse.cadrage
  if (!cadrage) return null

  const valeursMetier: any[]      = cadrage.valeursMetier      || []
  const biensSupports: any[]      = cadrage.biensSupports      || []
  const evenementsRedoutes: any[] = cadrage.evenementsRedoutes || []
  const socleSecurite: any[]      = cadrage.socleSecurite      || []
  const referentiels: any[]       = cadrage.referentiels       || []
  const etatSocleColor: Record<string, string> = { APPLIQUE: C.green, PARTIEL: C.orange, NON_APPLIQUE: C.red }

  return (
    <Page size="A4" style={s.page} wrap>
      <Banner title={tp.a1.banner} color={C.teal} />

      {hasCadrageContexte(cadrage) ? (
        <View>
          <Text style={[s.label, { color: C.teal, marginBottom: 3 }]}>{tp.a1.perimetre}</Text>
          {isNonEmptyText(cadrage.perimetre) ? <Text style={s.body}>{cadrage.perimetre}</Text> : null}
          {isNonEmptyText(cadrage.objectifsEtude) ? (
            <View>
              <Text style={s.label}>{tp.a1.objectifs}</Text>
              <Text style={s.body}>{cadrage.objectifsEtude}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {valeursMetier.length > 0 && (() => {
        // Colonne « Classification » (IGI-1300) ajoutée seulement si au moins une
        // valeur métier est classifiée (≠ NP) — rapport propre sinon (backlog #28).
        const classif = (v: any): string => (v?.classification && v.classification !== 'NP') ? v.classification : ''
        const hasClassif = valeursMetier.some((v: any) => classif(v))
        const headers = hasClassif ? [...tp.a1.vmHeaders, tp.a1.classifHeader] : tp.a1.vmHeaders
        const colFlex = hasClassif ? [1.4, 0.9, 2.3, 1.4, 1.1] : [1.5, 1, 2.5, 1.5]
        return (
        <View>
          <SectionBar title={`${tp.a1.vm} (${valeursMetier.length})`} color={C.teal} />
          <DataTable
            color={C.teal}
            headers={headers}
            colFlex={colFlex}
            rows={valeursMetier.map((v: any) => {
              const base = [v.nom || '—', v.type || '—', v.description || '—', v.responsable || '—']
              return hasClassif ? [...base, classif(v) ? (tp.a1.classifications[classif(v)] ?? classif(v)) : '—'] : base
            })}
          />
        </View>
        )
      })()}

      {biensSupports.length > 0 && (() => {
        // Lien N‑N bien support ↔ valeurs métier (issue #1) : affiche les VM liées
        // pour mettre en évidence les biens transverses (multi-VM = critiques).
        const vmNameById = new Map<string, string>(valeursMetier.map((v: any) => [v.id, v.nom]))
        const vmLinks = (b: any): string => {
          const ids: string[] = Array.isArray(b.valeurMetierIds)
            ? b.valeurMetierIds
            : (b.valeurMetierId ? [b.valeurMetierId] : [])
          const noms = ids.map(id => vmNameById.get(id)).filter(Boolean)
          return noms.length ? noms.join(', ') : '—'
        }
        return (
          <View>
            <SectionBar title={`${tp.a1.bs} (${biensSupports.length})`} color={C.teal} />
            <DataTable
              color={C.teal}
              headers={tp.a1.bsHeaders}
              colFlex={[1.5, 1, 2.2, 1.8]}
              rows={biensSupports.map((b: any) => [b.nom || '—', b.type || '—', b.description || '—', vmLinks(b)])}
            />
          </View>
        )
      })()}

      {evenementsRedoutes.length > 0 && (
        <View>
          <SectionBar title={`${tp.a1.er} (${evenementsRedoutes.length})`} color={C.teal} />
          <DataTable
            color={C.teal}
            headers={tp.a1.erHeaders}
            colFlex={[3, 3, 1]}
            rows={evenementsRedoutes.map((e: any) => [
              e.description || '—',
              Array.isArray(e.impacts) ? e.impacts.join(', ') : (e.impacts || '—'),
              {
                text: e.gravite ? `${e.gravite}/4` : '—',
                color: e.gravite ? riskColor(e.gravite * 3) : C.gray800,
                bold: !!e.gravite,
              },
            ])}
          />
        </View>
      )}

      {referentiels.length > 0 && (
        <View>
          <SectionBar title={`${tp.a1.referentielsSocle} (${referentiels.length})`} color={C.teal} />
          <DataTable
            color={C.teal}
            headers={tp.a1.referentielsHeaders}
            colFlex={[2, 1.4, 2.6]}
            rows={referentiels.map((r: any) => {
              const etat = etatSocleFromEntry(r)
              return [
                r.nom || '—',
                { text: tp.a1.socleEtats[etat] ?? etat, color: etatSocleColor[etat], bold: true },
                r.ecarts || '—',
              ]
            })}
          />
        </View>
      )}

      {socleSecurite.length > 0 && (
        <View>
          <SectionBar title={`${tp.a1.socle} (${socleSecurite.length})`} color={C.teal} />
          <DataTable
            color={C.teal}
            headers={tp.a1.socleHeaders}
            colFlex={[3.5, 1.5, 1]}
            rows={socleSecurite.map((m: any) => [
              m.mesure || m.nom || '—',
              m.source || m.referentiel || '—',
              (m.statut || '—').replace(/_/g, ' '),
            ])}
          />
        </View>
      )}

      {!cadrage.perimetre && !cadrage.objectifsEtude && valeursMetier.length === 0 && biensSupports.length === 0 && evenementsRedoutes.length === 0 && socleSecurite.length === 0 && (
        <Text style={s.italic}>{tp.a1.empty}</Text>
      )}

      <Footer nom={analyse.nom} date={date} tp={tp} mention={mentionMarking(analyse, tp)} />
    </Page>
  )
}

// ─── Atelier 2 — Sources de risque ────────────────────────────────────────────

function Atelier2Page({ analyse, date, tp }: { analyse: any; date: string; tp: PdfStrings }) {
  const sources  = analyse.sourcesRisque || []
  const retained = sources.filter((s: any) => s.retenu)
  const excluded = sources.filter((s: any) => !s.retenu)
  // Ne pas produire une page quasi-vide si l'atelier n'a pas de données (issue #63)
  if (sources.length === 0) return null

  return (
    <Page size="A4" style={s.page} wrap>
      <Banner title={tp.a2.banner} color={C.orange} />

      {sources.length === 0 ? (
        <Text style={s.italic}>{tp.a2.empty}</Text>
      ) : (
        <View>
          {retained.length > 0 && (
            <View>
              <SectionBar title={`${tp.a2.retenues} (${retained.length})`} color={C.orange} />
              <DataTable
                color={C.orange}
                headers={tp.a2.headers}
                colFlex={[3, 2, 1, 1, 1, 1]}
                rows={retained.map((sr: any) => [
                  sr.nom,
                  sr.categorie.replace(/_/g, ' '),
                  `${sr.pertinence}/4`,
                  sr.motivation ? `${sr.motivation}/4` : '—',
                  sr.ressources  ? `${sr.ressources}/4`  : '—',
                  sr.activite    ? `${sr.activite}/4`    : '—',
                ])}
              />
            </View>
          )}

          {excluded.length > 0 && (
            <View>
              <SectionBar title={`${tp.a2.ecartees} (${excluded.length})`} color={C.gray500} />
              <DataTable
                color={C.gray500}
                headers={tp.a2.headersShort}
                colFlex={[3, 2, 1]}
                rows={excluded.map((sr: any) => [
                  sr.nom,
                  sr.categorie.replace(/_/g, ' '),
                  `${sr.pertinence}/4`,
                ])}
              />
            </View>
          )}
        </View>
      )}

      <Footer nom={analyse.nom} date={date} tp={tp} mention={mentionMarking(analyse, tp)} />
    </Page>
  )
}

// ─── Écosystème (Atelier 3) — radar de menace + tableau parties prenantes ──────

const ZONE_PDF: Record<EcosystemZone, { fill: string }> = {
  danger:   { fill: C.orange },
  controle: { fill: C.yellow },
  veille:   { fill: C.green },
}
const zoneLabel = (z: EcosystemZone, tp: PdfStrings): string =>
  z === 'danger' ? tp.eco.danger : z === 'controle' ? tp.eco.controle : tp.eco.veille
// Point : couleur = fiabilité (0..3 rouge→vert) · rayon = exposition (0..3 croissant).
const FIAB_PDF = [C.red, C.orange, C.yellow, C.green]
const EXPO_PDF = [3.5, 4.5, 5.5, 7]
const STAR_PDF = '#F59E0B' // tiers critique

// Chemin SVG d'une étoile à 5 branches centrée (cx,cy), rayon extérieur R.
function starPath(cx: number, cy: number, R: number): string {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const ang = (-90 + i * 36) * Math.PI / 180
    const rad = i % 2 === 0 ? R : R * 0.45
    pts.push(`${(cx + rad * Math.cos(ang)).toFixed(2)},${(cy + rad * Math.sin(ang)).toFixed(2)}`)
  }
  return `M${pts.join(' L')} Z`
}

// Radar SVG (primitives @react-pdf) — réutilise la MÊME géométrie que la vue web
// (src/lib/ecosystem-radar.ts) : rayon = menace (centre = max), zones danger/contrôle/veille.
function EcosystemRadarPdf({ parties, withList = false, tp }: { parties: any[]; withList?: boolean; tp: PdfStrings }) {
  const CXr = 138, CYr = 132, R = 116   // radar agrandi
  const geom = { cx: CXr, cy: CYr, rMax: R }
  // PDF = vue de synthèse : on n'affiche que les PP de rang 1 (recommandation du guide).
  const rang1 = parties.filter((p: any) => (p.rang ?? 1) <= 1)
  const input = rang1.map((p: any) => ({
    id: p.id, nom: p.nom, nomCourt: p.nomCourt ?? undefined, type: p.type, exposition: p.exposition, fiabilite: p.fiabilite,
    dependance: p.dependance, penetration: p.penetration, maturite: p.maturite, confiance: p.confiance,
    critique: p.critique,
  }))
  const pts = layoutStakeholders(input, geom)
  const rings = zoneRadii(R)
  // Secteurs proportionnels au nombre de PP (alignés sur le radar HTML).
  const spans = sectorSpans(rang1)
  const counts: Record<EcosystemZone, number> = {
    danger:   pts.filter(p => p.zone === 'danger').length,
    controle: pts.filter(p => p.zone === 'controle').length,
    veille:   pts.filter(p => p.zone === 'veille').length,
  }
  const sectorLabel = (ty: string) => (tp.partyTypes[ty] || ty)
  const short = (s: string) => (s.length > 16 ? s.slice(0, 15) + '…' : s)
  // Libellé de secteur sur 2 lignes (mots équilibrés) si trop long.
  const wrapLbl = (s: string): string[] => {
    if (s.length <= 16) return [s]
    const w = s.split(' ')
    if (w.length === 1) return [s]
    let cut = 1, best = Infinity
    for (let i = 1; i < w.length; i++) {
      const d = Math.abs(w.slice(0, i).join(' ').length - w.slice(i).join(' ').length)
      if (d < best) { best = d; cut = i }
    }
    return [w.slice(0, cut).join(' '), w.slice(cut).join(' ')]
  }

  return (
    <View style={{ alignItems: 'center', marginBottom: 8 }}>
      {/* Radar centré, plus grand */}
      <Svg width={CXr * 2} height={CYr * 2 + 6}>
        {/* 3 anneaux : veille=vert (bord) → contrôle=jaune → danger=orange (centre) */}
        <Circle cx={CXr} cy={CYr} r={rings.rim}      fill={C.green}  fillOpacity={0.10} stroke={C.green}  strokeOpacity={0.30} />
        <Circle cx={CXr} cy={CYr} r={rings.controle} fill={C.yellow} fillOpacity={0.16} stroke={C.yellow} strokeOpacity={0.40} />
        <Circle cx={CXr} cy={CYr} r={rings.danger}   fill={C.orange} fillOpacity={0.18} stroke={C.orange} strokeOpacity={0.45} />
        {spans.length > 1 && (
          <G>
            {spans.map((s) => {
              const [bx, by] = polarToXY(R, s.startDeg, CXr, CYr)
              return <Line key={s.type} x1={CXr} y1={CYr} x2={bx} y2={by} stroke={C.gray500} strokeOpacity={0.25} strokeWidth={0.5} />
            })}
          </G>
        )}
        {/* Libellés de catégorie (centre du secteur, sur 2 lignes si besoin) — alignés sur le radar HTML */}
        {spans.map((s) => {
          const [lx, ly] = polarToXY(R + 8, s.centerDeg, CXr, CYr)
          const lines = wrapLbl(sectorLabel(s.type))
          const anchor = Math.abs(lx - CXr) < 6 ? 'middle' : lx < CXr ? 'end' : 'start'
          return (
            <G key={`s-${s.type}`}>
              {lines.map((ln, j) => (
                <Text key={j} x={lx} y={ly - (lines.length - 1) * 3.5 + j * 7} fill={C.gray500}
                  textAnchor={anchor} style={{ fontSize: 6 }}>
                  {ln}
                </Text>
              ))}
            </G>
          )
        })}
        {pts.map(p => {
          const baseR = EXPO_PDF[expositionLevel(p.exposition)]
          return (
            <G key={p.id}>
              <Circle cx={p.x} cy={p.y} r={baseR}
                fill={FIAB_PDF[fiabiliteLevel(p.fiabilite)]} stroke={C.white} strokeWidth={1} />
              {p.critique && <Path d={starPath(p.x, p.y, baseR * 1.15)} fill={STAR_PDF} stroke={C.white} strokeWidth={0.4} />}
            </G>
          )
        })}
        {pts.map(p => (
          <Text key={`l-${p.id}`} x={p.x + EXPO_PDF[expositionLevel(p.exposition)] + 2} y={p.y + 2.5} fill={C.gray800}
            style={{ fontSize: 6, fontFamily: 'Helvetica-Bold' }}>
            {p.nomCourt || p.ref}
          </Text>
        ))}
      </Svg>

      {/* Légende SOUS le radar (alignée sur le radar HTML) */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
        {(['danger', 'controle', 'veille'] as EcosystemZone[]).map(z => (
          <View key={z} style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 6, marginVertical: 1 }}>
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: ZONE_PDF[z].fill, marginRight: 4 }} />
            <Text style={{ fontSize: 7.5, color: C.gray800 }}>{zoneLabel(z, tp)} ({counts[z]})</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 6 }}>
          {FIAB_PDF.map((c, i) => <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c, marginRight: 1.5 }} />)}
          <Text style={{ fontSize: 7, color: C.gray500, marginLeft: 2 }}>{tp.eco.legendFiab}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 6 }}>
          {EXPO_PDF.map((rr, i) => <View key={i} style={{ width: rr * 1.3, height: rr * 1.3, borderRadius: rr, backgroundColor: C.gray500, marginRight: 1.5 }} />)}
          <Text style={{ fontSize: 7, color: C.gray500, marginLeft: 2 }}>{tp.eco.legendExpo}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 6 }}>
          <Text style={{ fontSize: 8, color: STAR_PDF, marginRight: 2 }}>★</Text>
          <Text style={{ fontSize: 7, color: C.gray500 }}>{tp.eco.legendCritique}</Text>
        </View>
      </View>

      {/* Liste réf → nom (synthèse exécutive : sinon on ne sait pas ce qu'est T1, T2…) */}
      {withList && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, width: '100%' }}>
          {pts.map(p => (
            <View key={`r-${p.id}`} style={{ flexDirection: 'row', width: '50%', paddingRight: 8, marginBottom: 2 }}>
              <Text style={{ fontSize: 7, color: C.gray800, fontFamily: 'Helvetica-Bold', width: 54 }}>{p.nomCourt || p.ref}</Text>
              <Text style={{ fontSize: 7, color: C.gray500, flex: 1 }}>{short(p.nom)}{p.critique ? ' ★' : ''}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

// ─── Atelier 3 — Scénarios stratégiques ───────────────────────────────────────

function Atelier3Page({ analyse, date, tp }: { analyse: any; date: string; tp: PdfStrings }) {
  const scenarios = analyse.scenariosStrategiques || []
  const retained  = scenarios.filter((s: any) => s.retenu)
  const excluded  = scenarios.filter((s: any) => !s.retenu)
  // Page omise si ni scénario ni partie prenante (issue #63)
  if (scenarios.length === 0 && (analyse.partiesPrenantes || []).length === 0) return null

  return (
    <Page size="A4" style={s.page} wrap>
      <Banner title={tp.a3.banner} color={C.purple} />

      {scenarios.length === 0 ? (
        <Text style={s.italic}>{tp.a3.empty}</Text>
      ) : (
        <View>
          {retained.length > 0 && (
            <View>
              <SectionBar title={`${tp.a3.retenus} (${retained.length})`} color={C.purple} />
              <DataTable
                color={C.purple}
                headers={tp.a3.headers}
                colFlex={[3, 2, 1.2, 1, 1, 1.2]}
                rows={retained.map((ss: any) => {
                  const sr = (analyse.sourcesRisque || []).find((x: any) => x.id === ss.sourceRisqueId)
                  return [
                    ss.nom,
                    sr?.nom || ss.sourceRisqueId || '—',
                    `${ss.vraisemblance}/4`,
                    `${ss.gravite}/4`,
                    `${ss.niveauRisque}/16`,
                    { text: riskLabel(ss.niveauRisque, tp), color: riskColor(ss.niveauRisque), bold: true },
                  ]
                })}
              />
            </View>
          )}

          {excluded.length > 0 && (
            <View>
              <SectionBar title={`${tp.a3.ecartes} (${excluded.length})`} color={C.gray500} />
              <DataTable
                color={C.gray500}
                headers={tp.a3.headersShort}
                colFlex={[4, 1.2, 1, 1]}
                rows={excluded.map((ss: any) => [
                  ss.nom,
                  `${ss.vraisemblance}/4`,
                  `${ss.gravite}/4`,
                  `${ss.niveauRisque}/16`,
                ])}
              />
            </View>
          )}
        </View>
      )}

      {(analyse.partiesPrenantes || []).length > 0 && (
        <View>
          <SectionBar title={`${tp.a3.ppTitle} (${analyse.partiesPrenantes.length})`} color={C.teal} />
          <EcosystemRadarPdf parties={analyse.partiesPrenantes} tp={tp} />
          <DataTable
            color={C.teal}
            headers={tp.a3.ppHeaders}
            colFlex={[0.55, 2.4, 1.5, 0.6, 0.6, 0.6, 0.6, 0.7, 0.7, 0.85, 1.2, 0.6]}
            rows={analyse.partiesPrenantes.map((pp: any, i: number) => {
              const dep = Number(pp.dependance ?? 2), pen = Number(pp.penetration ?? 2)
              const mat = Number(pp.maturite ?? 3), conf = Number(pp.confiance ?? 3)
              const exposition = pp.exposition ?? dep * pen
              const fiabilite  = pp.fiabilite ?? mat * conf
              const m = menace(exposition, fiabilite)
              const z = zoneOf(m)
              const fmt = (v: number) => Number.isInteger(v) ? String(v) : v.toFixed(1)
              return [
                { text: stakeholderRef(i), bold: true },
                pp.nom,
                tp.partyTypes[pp.type] || pp.type,
                fmt(dep),
                fmt(pen),
                fmt(mat),
                fmt(conf),
                fmt(exposition),
                fmt(fiabilite),
                m.toFixed(2),
                { text: zoneLabel(z, tp), color: ZONE_PDF[z].fill, bold: true },
                pp.critique ? { text: '★', color: STAR_PDF, bold: true } : '—',
              ]
            })}
          />
        </View>
      )}

      <Footer nom={analyse.nom} date={date} tp={tp} mention={mentionMarking(analyse, tp)} />
    </Page>
  )
}

// ─── Atelier 4 — Scénarios opérationnels ──────────────────────────────────────

function Atelier4Page({ analyse, date, tp }: { analyse: any; date: string; tp: PdfStrings }) {
  const scenarios = analyse.scenariosOperationnels || []
  // Page omise si aucun scénario opérationnel (issue #63)
  if (scenarios.length === 0) return null

  return (
    <Page size="A4" style={s.page} wrap>
      <Banner title={tp.a4.banner} color={C.sky} />

      {scenarios.length === 0 ? (
        <Text style={s.italic}>{tp.a4.empty}</Text>
      ) : (
        <View>
          <SectionBar title={`${scenarios.length === 1 ? tp.a4.titleSing : tp.a4.titlePlur} (${scenarios.length})`} color={C.sky} />
          <DataTable
            color={C.sky}
            headers={tp.a4.headers}
            colFlex={[3, 2.5, 1.2, 1, 1]}
            rows={scenarios.map((so: any) => {
              const ss    = (analyse.scenariosStrategiques || []).find((x: any) => x.id === so.scenarioStrategiqueId)
              const score = so.vraisemblance * so.gravite
              return [
                so.nom,
                ss?.nom || '—',
                `${so.vraisemblance}/4`,
                `${so.gravite}/4`,
                { text: `${score}/16`, color: riskColor(score), bold: true },
              ]
            })}
          />

          {/* Sequences of elementary actions if present */}
          {scenarios.some((so: any) => so.actionsElementaires?.length > 0) && (
            <View>
              <SectionBar title={tp.a4.aeDetail} color={C.sky} />
              {scenarios
                .filter((so: any) => so.actionsElementaires?.length > 0)
                .map((so: any) => (
                  <View key={so.id} style={{ marginBottom: 6 }}>
                    <Text style={[s.label, { color: C.sky, marginBottom: 2 }]}>▸ {so.nom}</Text>
                    <DataTable
                      color={C.sky}
                      headers={tp.a4.aeHeaders}
                      rows={so.actionsElementaires.map((a: any) => [
                        a.nom || '—', a.type || '—', a.bienSupport || '—', a.vulnerabilite || '—',
                      ])}
                    />
                  </View>
                ))}
            </View>
          )}
        </View>
      )}

      <Footer nom={analyse.nom} date={date} tp={tp} mention={mentionMarking(analyse, tp)} />
    </Page>
  )
}

// ─── Atelier 5 — Traitement du risque ─────────────────────────────────────────

function Atelier5Page({ analyse, date, tp }: { analyse: any; date: string; tp: PdfStrings }) {
  const risques  = analyse.risques  || []
  const mesures  = analyse.mesures  || []
  const sorted   = [...risques].sort((a: any, b: any) => b.niveauRisque - a.niveauRisque)
  const sortedM  = [...mesures].sort((a: any, b: any) => a.priorite - b.priorite)
  // Page omise si ni risque ni mesure (issue #63)
  if (risques.length === 0 && mesures.length === 0) return null

  return (
    <Page size="A4" style={s.page} wrap>
      <Banner title={tp.a5.banner} color={C.red} />

      {risques.length === 0 ? (
        <Text style={s.italic}>{tp.a5.risquesEmpty}</Text>
      ) : (
        <View>
          <SectionBar title={`${risques.length === 1 ? tp.a5.risquesTitleSing : tp.a5.risquesTitlePlur} (${risques.length})`} color={C.red} />
          <DataTable
            color={C.red}
            headers={tp.a5.risquesHeaders}
            colFlex={[3, 0.7, 0.7, 1.2, 1.2, 1.5, 1.5]}
            rows={sorted.map((r: any) => [
              r.nom,
              String(r.gravite),
              String(r.vraisemblance),
              { text: `${r.niveauRisque}/16`, bold: true },
              { text: riskLabel(r.niveauRisque, tp), color: riskColor(r.niveauRisque), bold: true },
              r.strategie.replace(/_/g, ' '),
              r.niveauResiduel != null
                ? `${r.niveauResiduel}/16 (${riskLabel(r.niveauResiduel, tp)})`
                : '—',
            ])}
          />
        </View>
      )}

      <SectionBar title={tp.a5.planTitle} color={C.green} />
      {mesures.length === 0 ? (
        <Text style={s.italic}>{tp.a5.mesuresEmpty}</Text>
      ) : (
        <DataTable
          color={C.green}
          headers={tp.a5.mesuresHeaders}
          colFlex={[2.6, 1.2, 1.2, 0.8, 1.1, 1.4, 1.1, 1.1]}
          rows={sortedM.map((m: any) => [
            m.nom,
            tp.a5.mesureCategories[normalizeCategorieMesure(m.categorieEbios)] ?? '—',
            m.type || '—',
            {
              text: `P${m.priorite}`,
              color: m.priorite === 1 ? C.red : m.priorite === 2 ? C.orange : C.gray800,
              bold: m.priorite <= 2,
            },
            {
              text: m.statut.replace(/_/g, ' '),
              color: m.statut === 'REALISE' ? C.green : m.statut === 'EN_COURS' ? C.indigo : C.gray800,
            },
            m.responsable || '—',
            m.entite || '—',
            m.echeance ? new Date(m.echeance).toLocaleDateString(tp.dateLocale) : '—',
          ])}
        />
      )}

      <Footer nom={analyse.nom} date={date} tp={tp} mention={mentionMarking(analyse, tp)} />
    </Page>
  )
}

// ─── Appendix page ─────────────────────────────────────────────────────────────

function AnnexePage({ analyse, date, config, tp }: { analyse: any; date: string; config?: any; tp: PdfStrings }) {
  // Échelles : config de l'organisation si présente, sinon valeurs par défaut localisées
  const gravite: any[] = config?.echelleGravite?.length ? config.echelleGravite
    : tp.annexe.defaultGravite.map((g, i) => ({ niveau: i + 1, label: g.label, description: g.description }))
  const vrais: any[]   = config?.echelleVraisemblance?.length ? config.echelleVraisemblance
    : tp.annexe.defaultVrais.map((v, i) => ({ niveau: i + 1, label: v.label, description: v.description }))
  const seuils: any[]  = config?.seuilsMatrice?.length ? config.seuilsMatrice : [
    { scoreMin: 1, scoreMax: 3, label: tp.risk.faible, couleur: C.green },
    { scoreMin: 4, scoreMax: 7, label: tp.risk.modere, couleur: C.yellow },
    { scoreMin: 8, scoreMax: 11, label: tp.risk.eleve, couleur: C.orange },
    { scoreMin: 12, scoreMax: 25, label: tp.risk.critique, couleur: C.red },
  ]
  // Matrice : lignes = gravité décroissante, colonnes = vraisemblance croissante
  const gravValues  = [...gravite].map(g => g.niveau).sort((a, b) => b - a)
  const vraisValues = [...vrais].map(v => v.niveau).sort((a, b) => a - b)
  const nb = Math.max(gravValues.length, vraisValues.length)
  const maxScore = nb * nb

  return (
    <Page size="A4" style={s.page} wrap>
      <Banner title={tp.annexe.banner} color={C.darkGray} />

      {/* 1. Méthode */}
      <SectionBar title={tp.annexe.methodeTitle} color={C.darkGray} />
      <Text style={s.body}>{tp.annexe.methodeIntro}</Text>
      <Text style={[s.body, { marginTop: 2 }]}>{tp.annexe.ateliers}</Text>
      <Text style={[s.body, { marginTop: 2 }]}>{tp.annexe.formule(nb, maxScore)}</Text>

      {/* 2. Échelle gravité */}
      <SectionBar title={tp.annexe.graviteTitle} color={C.teal} />
      <DataTable
        color={C.teal}
        headers={tp.annexe.scaleHeaders}
        colFlex={[0.8, 1.5, 5]}
        rows={gravite.map((g: any) => [String(g.niveau), g.label || '—', g.description || '—'])}
      />

      {/* 3. Échelle vraisemblance */}
      <SectionBar title={tp.annexe.vraisTitle} color={C.orange} />
      <DataTable
        color={C.orange}
        headers={tp.annexe.scaleHeaders}
        colFlex={[0.8, 1.5, 5]}
        rows={vrais.map((v: any) => [String(v.niveau), v.label || '—', v.description || '—'])}
      />

      {/* 4. Risk matrix */}
      <SectionBar title={tp.annexe.matriceTitle} color={C.indigo} />
      <View style={{ marginBottom: 8 }}>
        {/* Column headers */}
        <View style={{ flexDirection: 'row', marginLeft: 60, marginBottom: 2 }}>
          {vraisValues.map(v => (
            <View key={v} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 7, color: C.gray500 }}>V={v}</Text>
            </View>
          ))}
        </View>
        {/* Matrix rows */}
        {gravValues.map(g => (
          <View key={g} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 1 }}>
            <View style={{ width: 60, alignItems: 'flex-end', paddingRight: 4 }}>
              <Text style={{ fontSize: 7, color: C.gray500 }}>G={g}</Text>
            </View>
            {vraisValues.map(v => {
              const score = g * v
              return (
                <View key={v} style={{ flex: 1, height: 18, backgroundColor: matrixColor(score, seuils), marginHorizontal: 1, borderRadius: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 9, color: C.white, fontFamily: 'Helvetica-Bold' }}>{score}</Text>
                </View>
              )
            })}
          </View>
        ))}
        {/* Legend */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, marginLeft: 60, flexWrap: 'wrap' }}>
          {seuils.map((sObj: any, i: number) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <View style={{ width: 8, height: 8, backgroundColor: sObj.couleur || riskColor(sObj.scoreMin), borderRadius: 1 }} />
              <Text style={{ fontSize: 7, color: C.gray800 }}>{`${sObj.scoreMin}-${sObj.scoreMax} ${(sObj.label || '').toUpperCase()}`}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 5. Stratégies */}
      <SectionBar title={tp.annexe.strategiesTitle} color={C.purple} />
      <DataTable
        color={C.purple}
        headers={tp.annexe.strategiesHeaders}
        colFlex={[1.5, 6]}
        rows={tp.annexe.strategies.map(([name, desc]) => [name, desc])}
      />

      <Footer nom={analyse.nom} date={date} tp={tp} mention={mentionMarking(analyse, tp)} />
    </Page>
  )
}

// ─── Root Document ─────────────────────────────────────────────────────────────

export interface AnalysePDFProps {
  analyse: any
  /** Configuration des échelles (gravité/vraisemblance/matrice). Repli sur les défauts. */
  config?: any
  /** Locale du rapport (fr par défaut). */
  locale?: string
}

export function AnalysePDF({ analyse, config, locale }: AnalysePDFProps) {
  const tp = getPdfStrings(locale)
  const date = new Date().toLocaleDateString(tp.dateLocale)

  return (
    <Document
      title={`EBIOS RM — ${analyse.nom}`}
      author="ACRA — Augmented Cyber Risk Analysis"
      subject={tp.docSubject}
      creator="ACRA"
      producer="@react-pdf/renderer"
    >
      <CoverPage   analyse={analyse} date={date} tp={tp} />
      <ExecutiveSummaryPage analyse={analyse} date={date} tp={tp} />
      <SummaryPage analyse={analyse} date={date} config={config} tp={tp} />
      {analyse.cadrage && <Atelier1Page analyse={analyse} date={date} tp={tp} />}
      <Atelier2Page analyse={analyse} date={date} tp={tp} />
      <Atelier3Page analyse={analyse} date={date} tp={tp} />
      <Atelier4Page analyse={analyse} date={date} tp={tp} />
      <Atelier5Page analyse={analyse} date={date} tp={tp} />
      <AnnexePage   analyse={analyse} date={date} config={config} tp={tp} />
    </Document>
  )
}

/**
 * Rend le PDF en Buffer. Doit vivre DANS ce module pour que la création de
 * l'élément (JSX) et renderToBuffer partagent la même instance React/react-pdf
 * que les primitives <Document>/<Text> — sinon « React error #31 » au runtime
 * (élément non reconnu) sous le bundle serveur de Next.
 */
export function renderAnalysePDF(analyse: any, config?: any, locale?: string): Promise<Buffer> {
  return renderToBuffer(<AnalysePDF analyse={analyse} config={config} locale={locale} />)
}
