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
} from '@react-pdf/renderer'
import { getRiskTier } from '@/lib/risk-scale'
import {
  layoutStakeholders,
  zoneRadii,
  presentTypes,
  polarToXY,
  menace,
  zoneOf,
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
function riskLabel(score: number): string {
  if (score >= 12) return 'Critique'
  if (score >= 8)  return 'Élevé'
  if (score >= 4)  return 'Modéré'
  return 'Faible'
}
/** Pluralisation française : renvoie sg si n === 1, pl sinon. */
function p(n: number, sg: string, pl: string): string {
  return n === 1 ? sg : pl
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

/** Footer rendered on every page */
function Footer({ nom, date }: { nom: string; date: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerTxt}>EBIOS RM — {nom}</Text>
      <Text style={s.footerTxt}>Confidentiel — généré le {date}</Text>
      <Text style={s.footerTxt} render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Page ${pageNumber} / ${totalPages}`} />
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

function CoverPage({ analyse, date }: { analyse: any; date: string }) {
  const statut = analyse.statut === 'TERMINE' ? 'Terminée'
               : analyse.statut === 'APPROUVE' ? 'Approuvée'
               : 'En cours'

  return (
    <Page size="A4" style={s.page}>
      {/* Top banner */}
      <View style={[s.banner, { backgroundColor: C.indigo, paddingVertical: 18 }]}>
        <Text style={{ color: C.white, fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>
          ANALYSE DE RISQUES
        </Text>
        <Text style={{ color: '#C7D2FE', fontSize: 11 }}>
          EBIOS Risk Manager — Méthode ANSSI
        </Text>
        <Text style={{ color: '#C7D2FE', fontSize: 9, marginTop: 2 }}>
          Compatible ISO/IEC 27005
        </Text>
        <Text style={{ color: '#A5B4FC', fontSize: 8, position: 'absolute', top: 10, right: 14 }}>
          Généré le {date}
        </Text>
      </View>

      {/* Analyse details */}
      <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 8 }}>{analyse.nom}</Text>

      {analyse.organisation ? (
        <Text style={{ fontSize: 9, color: C.gray500, marginBottom: 3 }}>Organisation : {analyse.organisation}</Text>
      ) : null}
      {analyse.secteur ? (
        <Text style={{ fontSize: 9, color: C.gray500, marginBottom: 3 }}>Secteur : {analyse.secteur}</Text>
      ) : null}
      <Text style={{ fontSize: 9, color: C.gray500, marginBottom: 3 }}>Statut : {statut}</Text>
      <Text style={{ fontSize: 9, color: C.gray500, marginBottom: 3 }}>
        Créée le : {new Date(analyse.createdAt).toLocaleDateString('fr-FR')}
      </Text>
      <Text style={{ fontSize: 9, color: C.gray500, marginBottom: 3 }}>
        Mise à jour : {new Date(analyse.updatedAt).toLocaleDateString('fr-FR')}
      </Text>

      {/* Separator */}
      <View style={{ borderTopWidth: 0.5, borderTopColor: C.indigo, marginTop: 12 }} />

      <Footer nom={analyse.nom} date={date} />
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

function SummaryPage({ analyse, date, config }: { analyse: any; date: string; config?: any }) {
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
    conclusion = "L'analyse n'a pas encore identifié de risques formalisés. Les ateliers de travail sont en cours."
  } else if (critiques.length > 0) {
    conclusion = `L'analyse a identifié ${risques.length} ${p(risques.length, 'risque', 'risques')}, dont ${critiques.length} de niveau CRITIQUE nécessitant une action immédiate.` +
      (mesuresP1.length > 0 ? ` ${mesuresP1.length} ${p(mesuresP1.length, 'mesure prioritaire (P1) a été définie', 'mesures prioritaires (P1) ont été définies')} pour y répondre.` : '')
  } else if (elevees.length > 0) {
    conclusion = `L'analyse a identifié ${risques.length} ${p(risques.length, 'risque', 'risques')}, dont ${elevees.length} de niveau ÉLEVÉ à traiter en priorité.` +
      (mesures.length > 0 ? ` ${mesures.length} ${p(mesures.length, 'mesure de sécurité a été définie', 'mesures de sécurité ont été définies')}.` : '')
  } else {
    conclusion = `L'analyse a identifié ${risques.length} ${p(risques.length, 'risque', 'risques')} de niveaux modérés à faibles.` +
      (mesures.length > 0 ? ` ${mesures.length} ${p(mesures.length, 'mesure de sécurité a été définie', 'mesures de sécurité ont été définies')}.` : '')
  }

  const top5 = [...risques].sort((a: any, b: any) => b.niveauRisque - a.niveauRisque).slice(0, 5)

  const statutsMesures = [
    { label: 'Réalisé',  count: mesuresRealisees.length, color: C.green },
    { label: 'En cours', count: mesuresEnCours.length,   color: C.indigo },
    { label: 'À faire',  count: mesures.filter((m: any) => m.statut === 'A_FAIRE').length,  color: C.orange },
    { label: 'Reporté',  count: mesures.filter((m: any) => m.statut === 'REPORTE').length, color: C.gray500 },
  ].filter(s => s.count > 0)

  // Risques numérotés R1, R2… (par score brut décroissant) — refs communes aux 2 matrices
  const numbered = [...risques].sort((a: any, b: any) => b.niveauRisque - a.niveauRisque).map((r: any, i: number) => ({ ...r, ref: `R${i + 1}` }))
  const grossPts = numbered.map((r: any) => ({ ref: r.ref, g: r.gravite, v: r.vraisemblance }))
  const residualPts = numbered
    .filter((r: any) => r.graviteResiduelle != null && r.vraisemblanceResiduelle != null)
    .map((r: any) => ({ ref: r.ref, g: r.graviteResiduelle, v: r.vraisemblanceResiduelle }))

  return (
    <Page size="A4" style={s.page} wrap>
      <Banner title="SYNTHÈSE EXÉCUTIVE" color={C.indigo} />

      {/* Intro text */}
      <Text style={s.body}>
        Cette synthèse présente les résultats de l'analyse de risques réalisée selon la méthode EBIOS Risk Manager
        (ANSSI), compatible ISO/IEC 27005. L'objectif est d'identifier les menaces pesant sur l'organisation,
        d'évaluer leur impact potentiel et de définir un plan d'action pour les traiter.
      </Text>

      {/* Conclusion highlight */}
      <View style={s.hintBox}>
        <Text style={s.hintText}>{conclusion}</Text>
      </View>

      {/* KPIs */}
      <View style={s.kpiRow}>
        <View style={[s.kpiCard, { backgroundColor: C.indigo }]}>
          <Text style={s.kpiVal}>{risques.length}</Text>
          <Text style={s.kpiLbl}>{p(risques.length, 'Risque identifié', 'Risques identifiés')}</Text>
        </View>
        <View style={[s.kpiCard, { backgroundColor: C.red }]}>
          <Text style={s.kpiVal}>{critiques.length}</Text>
          <Text style={s.kpiLbl}>{p(critiques.length, 'Risque critique', 'Risques critiques')}</Text>
        </View>
        <View style={[s.kpiCard, { backgroundColor: C.green }]}>
          <Text style={s.kpiVal}>{residuelsReduits.length}</Text>
          <Text style={s.kpiLbl}>{p(residuelsReduits.length, 'Risque réduit', 'Risques réduits')}</Text>
        </View>
        <View style={[s.kpiCard, { backgroundColor: C.teal }]}>
          <Text style={s.kpiVal}>{mesuresRealisees.length}</Text>
          <Text style={s.kpiLbl}>{p(mesuresRealisees.length, 'Mesure réalisée', 'Mesures réalisées')}</Text>
        </View>
      </View>

      {/* Vue d'ensemble visuelle : matrices brute & résiduelle + radar écosystème */}
      {risques.length > 0 && (
        <View wrap={false} style={{ marginBottom: 6 }}>
          <View style={{ flexDirection: 'row', gap: 14 }}>
            <View style={{ flex: 1 }}>
              <RiskMatrixPdf points={grossPts} config={config} title="Matrice des risques bruts" color={C.indigo} />
            </View>
            <View style={{ flex: 1 }}>
              <RiskMatrixPdf points={residualPts} config={config} title="Matrice des risques résiduels" color={C.green} />
            </View>
          </View>
        </View>
      )}
      {(analyse.partiesPrenantes || []).length > 0 && (
        <View wrap={false} style={{ marginBottom: 6 }}>
          <SectionBar title="Écosystème — radar de menace" color={C.teal} />
          <EcosystemRadarPdf parties={analyse.partiesPrenantes} />
        </View>
      )}

      {/* Risk distribution */}
      {risques.length > 0 && (
        <View>
          <Text style={s.h2}>Répartition des risques initiaux</Text>
          {[
            { label: 'Critique (>=12)', count: critiques.length },
            { label: 'Élevé (8-11)',    count: elevees.length },
            { label: 'Modéré (4-7)',    count: risques.filter((r: any) => getRiskTier(r.niveauRisque) === 'modere').length },
            { label: 'Faible (1-3)',    count: risques.filter((r: any) => getRiskTier(r.niveauRisque) === 'faible').length },
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
          <Text style={[s.h2, { marginTop: 6 }]}>Top 5 des risques les plus élevés</Text>
          <DataTable
            color={C.gray800}
            headers={['Risque', 'Score initial', 'Niveau', 'Stratégie', 'Score résiduel']}
            colFlex={[3, 1.2, 1.2, 1.5, 1.5]}
            rows={top5.map((r: any) => [
              r.nom,
              `${r.niveauRisque}/16`,
              { text: riskLabel(r.niveauRisque), color: riskColor(r.niveauRisque), bold: true },
              r.strategie.replace(/_/g, ' '),
              r.niveauResiduel != null ? `${r.niveauResiduel}/16 (${riskLabel(r.niveauResiduel)})` : '—',
            ])}
          />
        </View>
      )}

      {/* Action plan summary */}
      {mesures.length > 0 ? (
        <View>
          <Text style={[s.h2, { marginTop: 6 }]}>Avancement du plan d'action</Text>
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
              Taux de réalisation : {Math.round((mesuresRealisees.length / mesures.length) * 100)}%
              ({mesuresRealisees.length} sur {mesures.length} mesures réalisées).
              {mesuresEnCours.length > 0 ? ` ${mesuresEnCours.length} ${p(mesuresEnCours.length, 'mesure en cours de déploiement', 'mesures en cours de déploiement')}.` : ''}
            </Text>
          )}
        </View>
      ) : (
        <Text style={s.italic}>Aucune mesure de sécurité définie dans cette analyse.</Text>
      )}

      <Footer nom={analyse.nom} date={date} />
    </Page>
  )
}

// ─── Atelier 1 — Cadrage ───────────────────────────────────────────────────────

function Atelier1Page({ analyse, date }: { analyse: any; date: string }) {
  const cadrage = analyse.cadrage
  if (!cadrage) return null

  const valeursMetier: any[]      = cadrage.valeursMetier      || []
  const biensSupports: any[]      = cadrage.biensSupports      || []
  const evenementsRedoutes: any[] = cadrage.evenementsRedoutes || []
  const socleSecurite: any[]      = cadrage.socleSecurite      || []

  return (
    <Page size="A4" style={s.page} wrap>
      <Banner title="ATELIER 1 — CADRAGE ET SOCLE DE SÉCURITÉ" color={C.teal} />

      {(cadrage.perimetre || cadrage.objectifsEtude) && (
        <View>
          <Text style={[s.label, { color: C.teal, marginBottom: 3 }]}>Périmètre de l'étude</Text>
          {cadrage.perimetre && <Text style={s.body}>{cadrage.perimetre}</Text>}
          {cadrage.objectifsEtude && (
            <View>
              <Text style={s.label}>Objectifs :</Text>
              <Text style={s.body}>{cadrage.objectifsEtude}</Text>
            </View>
          )}
        </View>
      )}

      {valeursMetier.length > 0 && (
        <View>
          <SectionBar title={`Valeurs métier FM1 (${valeursMetier.length})`} color={C.teal} />
          <DataTable
            color={C.teal}
            headers={['Nom', 'Type', 'Description', 'Responsable']}
            colFlex={[1.5, 1, 2.5, 1.5]}
            rows={valeursMetier.map((v: any) => [v.nom || '—', v.type || '—', v.description || '—', v.responsable || '—'])}
          />
        </View>
      )}

      {biensSupports.length > 0 && (
        <View>
          <SectionBar title={`Biens supports (${biensSupports.length})`} color={C.teal} />
          <DataTable
            color={C.teal}
            headers={['Nom', 'Type', 'Description']}
            colFlex={[1.5, 1, 3]}
            rows={biensSupports.map((b: any) => [b.nom || '—', b.type || '—', b.description || '—'])}
          />
        </View>
      )}

      {evenementsRedoutes.length > 0 && (
        <View>
          <SectionBar title={`Événements redoutés (${evenementsRedoutes.length})`} color={C.teal} />
          <DataTable
            color={C.teal}
            headers={['Description', 'Impacts', 'Gravité']}
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

      {socleSecurite.length > 0 && (
        <View>
          <SectionBar title={`Socle de sécurité (${socleSecurite.length})`} color={C.teal} />
          <DataTable
            color={C.teal}
            headers={['Mesure', 'Source / Référentiel', 'Statut']}
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
        <Text style={s.italic}>Le cadrage n'a pas encore été complété.</Text>
      )}

      <Footer nom={analyse.nom} date={date} />
    </Page>
  )
}

// ─── Atelier 2 — Sources de risque ────────────────────────────────────────────

function Atelier2Page({ analyse, date }: { analyse: any; date: string }) {
  const sources  = analyse.sourcesRisque || []
  const retained = sources.filter((s: any) => s.retenu)
  const excluded = sources.filter((s: any) => !s.retenu)

  return (
    <Page size="A4" style={s.page} wrap>
      <Banner title="ATELIER 2 — SOURCES DE RISQUE" color={C.orange} />

      {sources.length === 0 ? (
        <Text style={s.italic}>Aucune source de risque définie dans cette analyse.</Text>
      ) : (
        <View>
          {retained.length > 0 && (
            <View>
              <SectionBar title={`Sources retenues (${retained.length})`} color={C.orange} />
              <DataTable
                color={C.orange}
                headers={['Source de risque', 'Catégorie', 'Pertinence', 'Motivation', 'Ressources', 'Activité']}
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
              <SectionBar title={`Sources écartées (${excluded.length})`} color={C.gray500} />
              <DataTable
                color={C.gray500}
                headers={['Source de risque', 'Catégorie', 'Pertinence']}
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

      <Footer nom={analyse.nom} date={date} />
    </Page>
  )
}

// ─── Écosystème (Atelier 3) — radar de menace + tableau parties prenantes ──────

const ZONE_PDF: Record<EcosystemZone, { fill: string; label: string }> = {
  danger:   { fill: C.red,    label: 'Danger' },
  controle: { fill: C.yellow, label: 'Contrôle' },
  veille:   { fill: C.green,  label: 'Veille' },
}

const TYPE_LABELS_FR: Record<string, string> = {
  FOURNISSEUR: 'Fournisseur', CLIENT: 'Client', PARTENAIRE: 'Partenaire',
  PRESTATAIRE: 'Prestataire', SOUS_TRAITANT: 'Sous-traitant',
  ORGANISME_REGULATION: 'Organisme de régulation', AUTRE: 'Autre',
}

// Radar SVG (primitives @react-pdf) — réutilise la MÊME géométrie que la vue web
// (src/lib/ecosystem-radar.ts) : rayon = menace (centre = max), zones danger/contrôle/veille.
function EcosystemRadarPdf({ parties }: { parties: any[] }) {
  const CXr = 100, CYr = 100, R = 88
  const geom = { cx: CXr, cy: CYr, rMax: R }
  const pts = layoutStakeholders(
    parties.map((p: any) => ({ id: p.id, nom: p.nom, type: p.type, exposition: p.exposition, fiabilite: p.fiabilite })),
    geom,
  )
  const rings = zoneRadii(R)
  const types = presentTypes(parties)
  const sectorW = 360 / Math.max(1, types.length)
  const counts = {
    danger:   pts.filter(p => p.zone === 'danger').length,
    controle: pts.filter(p => p.zone === 'controle').length,
    veille:   pts.filter(p => p.zone === 'veille').length,
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
      <Svg width={CXr * 2} height={CYr * 2}>
        <Circle cx={CXr} cy={CYr} r={rings.rim}      fill={C.green}  fillOpacity={0.10} stroke={C.green}  strokeOpacity={0.30} />
        <Circle cx={CXr} cy={CYr} r={rings.controle} fill={C.yellow} fillOpacity={0.16} stroke={C.yellow} strokeOpacity={0.40} />
        <Circle cx={CXr} cy={CYr} r={rings.danger}   fill={C.red}    fillOpacity={0.18} stroke={C.red}    strokeOpacity={0.45} />
        {types.length > 1 && (
          <G>
            {types.map((ty, i) => {
              const [bx, by] = polarToXY(R, (i - 0.5) * sectorW, CXr, CYr)
              return <Line key={ty} x1={CXr} y1={CYr} x2={bx} y2={by} stroke={C.gray500} strokeOpacity={0.25} strokeWidth={0.5} />
            })}
          </G>
        )}
        {pts.map(p => (
          <Circle key={p.id} cx={p.x} cy={p.y} r={4.5}
            fill={ZONE_PDF[p.zone].fill} stroke={C.white} strokeWidth={1} />
        ))}
      </Svg>

      <View style={{ marginLeft: 16 }}>
        {(['danger', 'controle', 'veille'] as EcosystemZone[]).map(z => (
          <View key={z} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ZONE_PDF[z].fill, marginRight: 6 }} />
            <Text style={{ fontSize: 8.5, color: C.gray800, width: 70 }}>{ZONE_PDF[z].label}</Text>
            <Text style={{ fontSize: 8.5, color: C.gray500 }}>{counts[z]}</Text>
          </View>
        ))}
        <Text style={{ fontSize: 7, color: C.gray500, marginTop: 4, width: 150 }}>
          Rayon = niveau de menace · centre = menace maximale
        </Text>
      </View>
    </View>
  )
}

// ─── Atelier 3 — Scénarios stratégiques ───────────────────────────────────────

function Atelier3Page({ analyse, date }: { analyse: any; date: string }) {
  const scenarios = analyse.scenariosStrategiques || []
  const retained  = scenarios.filter((s: any) => s.retenu)
  const excluded  = scenarios.filter((s: any) => !s.retenu)

  return (
    <Page size="A4" style={s.page} wrap>
      <Banner title="ATELIER 3 — SCÉNARIOS STRATÉGIQUES" color={C.purple} />

      {scenarios.length === 0 ? (
        <Text style={s.italic}>Aucun scénario stratégique défini dans cette analyse.</Text>
      ) : (
        <View>
          {retained.length > 0 && (
            <View>
              <SectionBar title={`Scénarios retenus (${retained.length})`} color={C.purple} />
              <DataTable
                color={C.purple}
                headers={['Scénario', 'Source de risque', 'Vraisemblance', 'Gravité', 'Score', 'Niveau']}
                colFlex={[3, 2, 1.2, 1, 1, 1.2]}
                rows={retained.map((ss: any) => {
                  const sr = (analyse.sourcesRisque || []).find((x: any) => x.id === ss.sourceRisqueId)
                  return [
                    ss.nom,
                    sr?.nom || ss.sourceRisqueId || '—',
                    `${ss.vraisemblance}/4`,
                    `${ss.gravite}/4`,
                    `${ss.niveauRisque}/16`,
                    { text: riskLabel(ss.niveauRisque), color: riskColor(ss.niveauRisque), bold: true },
                  ]
                })}
              />
            </View>
          )}

          {excluded.length > 0 && (
            <View>
              <SectionBar title={`Scénarios écartés (${excluded.length})`} color={C.gray500} />
              <DataTable
                color={C.gray500}
                headers={['Scénario', 'Vraisemblance', 'Gravité', 'Score']}
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
          <SectionBar title={`Écosystème — parties prenantes (${analyse.partiesPrenantes.length})`} color={C.teal} />
          <EcosystemRadarPdf parties={analyse.partiesPrenantes} />
          <DataTable
            color={C.teal}
            headers={['Partie prenante', 'Type', 'Exposition', 'Fiabilité', 'Menace', 'Zone']}
            colFlex={[3, 2, 1.2, 1.2, 1, 1.3]}
            rows={analyse.partiesPrenantes.map((pp: any) => {
              const m = menace(pp.exposition, pp.fiabilite)
              const z = zoneOf(m)
              return [
                pp.nom,
                TYPE_LABELS_FR[pp.type] || pp.type,
                `${pp.exposition}/4`,
                `${pp.fiabilite}/4`,
                `${m}/16`,
                { text: ZONE_PDF[z].label, color: ZONE_PDF[z].fill, bold: true },
              ]
            })}
          />
        </View>
      )}

      <Footer nom={analyse.nom} date={date} />
    </Page>
  )
}

// ─── Atelier 4 — Scénarios opérationnels ──────────────────────────────────────

function Atelier4Page({ analyse, date }: { analyse: any; date: string }) {
  const scenarios = analyse.scenariosOperationnels || []

  return (
    <Page size="A4" style={s.page} wrap>
      <Banner title="ATELIER 4 — SCÉNARIOS OPÉRATIONNELS" color={C.sky} />

      {scenarios.length === 0 ? (
        <Text style={s.italic}>Aucun scénario opérationnel défini dans cette analyse.</Text>
      ) : (
        <View>
          <SectionBar title={`${p(scenarios.length, 'Scénario opérationnel', 'Scénarios opérationnels')} (${scenarios.length})`} color={C.sky} />
          <DataTable
            color={C.sky}
            headers={['Scénario opérationnel', 'Scénario stratégique', 'Vraisemblance', 'Gravité', 'Score']}
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
              <SectionBar title="Détail des actions élémentaires" color={C.sky} />
              {scenarios
                .filter((so: any) => so.actionsElementaires?.length > 0)
                .map((so: any) => (
                  <View key={so.id} style={{ marginBottom: 6 }}>
                    <Text style={[s.label, { color: C.sky, marginBottom: 2 }]}>▸ {so.nom}</Text>
                    <DataTable
                      color={C.sky}
                      headers={['Action élémentaire', 'Type', 'Bien support', 'Vulnérabilité']}
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

      <Footer nom={analyse.nom} date={date} />
    </Page>
  )
}

// ─── Atelier 5 — Traitement du risque ─────────────────────────────────────────

function Atelier5Page({ analyse, date }: { analyse: any; date: string }) {
  const risques  = analyse.risques  || []
  const mesures  = analyse.mesures  || []
  const sorted   = [...risques].sort((a: any, b: any) => b.niveauRisque - a.niveauRisque)
  const sortedM  = [...mesures].sort((a: any, b: any) => a.priorite - b.priorite)

  return (
    <Page size="A4" style={s.page} wrap>
      <Banner title="ATELIER 5 — TRAITEMENT DU RISQUE" color={C.red} />

      {risques.length === 0 ? (
        <Text style={s.italic}>Aucun risque identifié dans cette analyse.</Text>
      ) : (
        <View>
          <SectionBar title={`${p(risques.length, 'Risque identifié', 'Risques identifiés')} (${risques.length})`} color={C.red} />
          <DataTable
            color={C.red}
            headers={['Risque', 'G', 'V', 'Score initial', 'Niveau', 'Stratégie', 'Score résiduel']}
            colFlex={[3, 0.7, 0.7, 1.2, 1.2, 1.5, 1.5]}
            rows={sorted.map((r: any) => [
              r.nom,
              String(r.gravite),
              String(r.vraisemblance),
              { text: `${r.niveauRisque}/16`, bold: true },
              { text: riskLabel(r.niveauRisque), color: riskColor(r.niveauRisque), bold: true },
              r.strategie.replace(/_/g, ' '),
              r.niveauResiduel != null
                ? `${r.niveauResiduel}/16 (${riskLabel(r.niveauResiduel)})`
                : '—',
            ])}
          />
        </View>
      )}

      <SectionBar title="Plan d'action — Mesures de sécurité" color={C.green} />
      {mesures.length === 0 ? (
        <Text style={s.italic}>Aucune mesure de sécurité définie dans cette analyse.</Text>
      ) : (
        <DataTable
          color={C.green}
          headers={['Mesure', 'Type', 'Priorité', 'Statut', 'Responsable', 'Entité', 'Échéance']}
          colFlex={[3, 1.5, 0.8, 1.2, 1.5, 1.2, 1.2]}
          rows={sortedM.map((m: any) => [
            m.nom,
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
            m.echeance ? new Date(m.echeance).toLocaleDateString('fr-FR') : '—',
          ])}
        />
      )}

      <Footer nom={analyse.nom} date={date} />
    </Page>
  )
}

// ─── Appendix page ─────────────────────────────────────────────────────────────

function AnnexePage({ analyse, date, config }: { analyse: any; date: string; config?: any }) {
  // Échelles : config de l'organisation si présente, sinon valeurs par défaut
  const gravite: any[] = config?.echelleGravite?.length ? config.echelleGravite : DEFAULT_GRAVITE
  const vrais: any[]   = config?.echelleVraisemblance?.length ? config.echelleVraisemblance : DEFAULT_VRAIS
  const seuils: any[]  = config?.seuilsMatrice?.length ? config.seuilsMatrice : DEFAULT_SEUILS
  // Matrice : lignes = gravité décroissante, colonnes = vraisemblance croissante
  const gravValues  = [...gravite].map(g => g.niveau).sort((a, b) => b - a)
  const vraisValues = [...vrais].map(v => v.niveau).sort((a, b) => a - b)
  const nb = Math.max(gravValues.length, vraisValues.length)
  const maxScore = nb * nb

  return (
    <Page size="A4" style={s.page} wrap>
      <Banner title="ANNEXE — MÉTHODOLOGIE ET RÉFÉRENTIEL DE COTATION" color={C.darkGray} />

      {/* 1. Méthode */}
      <SectionBar title="1. Méthode EBIOS Risk Manager (EBIOS RM)" color={C.darkGray} />
      <Text style={s.body}>
        EBIOS Risk Manager est la méthode officielle de l'ANSSI (Agence Nationale de la Sécurité des
        Systèmes d'Information) pour apprécier et traiter les risques numériques. Elle est compatible
        avec la norme ISO/IEC 27005.
      </Text>
      <Text style={[s.body, { marginTop: 2 }]}>
        L'analyse se déroule en 5 ateliers : {'\n'}
        • Atelier 1 — Cadrage et socle de sécurité : périmètre, valeurs métier, biens supports, événements redoutés.{'\n'}
        • Atelier 2 — Sources de risque : identification et évaluation des acteurs malveillants.{'\n'}
        • Atelier 3 — Scénarios stratégiques : chemins d'attaque ciblant les valeurs métier via l'écosystème.{'\n'}
        • Atelier 4 — Scénarios opérationnels : déclinaison technique des chemins d'attaque retenus.{'\n'}
        • Atelier 5 — Traitement du risque : cotation finale, stratégies de traitement, plan d'action.
      </Text>
      <Text style={[s.body, { marginTop: 2 }]}>
        Le niveau de risque est calculé par la formule : Niveau = Gravité × Vraisemblance (max {nb}×{nb} = {maxScore}).
      </Text>

      {/* 2. Échelle gravité */}
      <SectionBar title="2. Échelle de gravité (impact)" color={C.teal} />
      <DataTable
        color={C.teal}
        headers={['Valeur', 'Niveau', 'Signification']}
        colFlex={[0.8, 1.5, 5]}
        rows={gravite.map((g: any) => [String(g.niveau), g.label || '—', g.description || '—'])}
      />

      {/* 3. Échelle vraisemblance */}
      <SectionBar title="3. Échelle de vraisemblance (probabilité)" color={C.orange} />
      <DataTable
        color={C.orange}
        headers={['Valeur', 'Niveau', 'Signification']}
        colFlex={[0.8, 1.5, 5]}
        rows={vrais.map((v: any) => [String(v.niveau), v.label || '—', v.description || '—'])}
      />

      {/* 4. Risk matrix */}
      <SectionBar title="4. Matrice de cotation (Gravité × Vraisemblance)" color={C.indigo} />
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
      <SectionBar title="5. Stratégies de traitement des risques" color={C.purple} />
      <DataTable
        color={C.purple}
        headers={['Stratégie', 'Description']}
        colFlex={[1.5, 6]}
        rows={[
          ['Réduire',    'Mettre en place des mesures de sécurité pour abaisser le niveau du risque à un niveau acceptable.'],
          ['Accepter',   "Le risque est jugé acceptable en l'état (niveau faible ou coût de traitement supérieur au bénéfice)."],
          ['Transférer', 'Reporter le risque sur un tiers (assurance cyber, sous-traitant, clause contractuelle).'],
          ['Refuser',    "L'activité ou le système portant le risque est abandonné ou modifié en profondeur."],
          ['Surveiller', 'Le risque est suivi sans traitement immédiat : réévaluation périodique prévue.'],
        ]}
      />

      <Footer nom={analyse.nom} date={date} />
    </Page>
  )
}

// ─── Root Document ─────────────────────────────────────────────────────────────

export interface AnalysePDFProps {
  analyse: any
  /** Configuration des échelles (gravité/vraisemblance/matrice). Repli sur les défauts. */
  config?: any
}

export function AnalysePDF({ analyse, config }: AnalysePDFProps) {
  const date = new Date().toLocaleDateString('fr-FR')

  return (
    <Document
      title={`EBIOS RM — ${analyse.nom}`}
      author="ACRA — Augmented Cyber Risk Analysis"
      subject="Rapport d'analyse de risques EBIOS RM"
      creator="ACRA"
      producer="@react-pdf/renderer"
    >
      <CoverPage   analyse={analyse} date={date} />
      <SummaryPage analyse={analyse} date={date} config={config} />
      {analyse.cadrage && <Atelier1Page analyse={analyse} date={date} />}
      <Atelier2Page analyse={analyse} date={date} />
      <Atelier3Page analyse={analyse} date={date} />
      <Atelier4Page analyse={analyse} date={date} />
      <Atelier5Page analyse={analyse} date={date} />
      <AnnexePage   analyse={analyse} date={date} config={config} />
    </Document>
  )
}

/**
 * Rend le PDF en Buffer. Doit vivre DANS ce module pour que la création de
 * l'élément (JSX) et renderToBuffer partagent la même instance React/react-pdf
 * que les primitives <Document>/<Text> — sinon « React error #31 » au runtime
 * (élément non reconnu) sous le bundle serveur de Next.
 */
export function renderAnalysePDF(analyse: any, config?: any): Promise<Buffer> {
  return renderToBuffer(<AnalysePDF analyse={analyse} config={config} />)
}
