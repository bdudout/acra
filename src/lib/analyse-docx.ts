// ─── Export Word (.docx) d'une analyse de risques ───────────────────────────
// Rapport documentaire complet (même couverture d'objets que le PDF) : couverture,
// périmètre, valeurs métier, biens supports, sources de risque & objectifs,
// scénarios stratégiques, écosystème, risques & traitement, plan de mesures,
// conformité au socle, révisions. Généré avec la lib « docx » (JS pur).

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, AlignmentType, type ISectionOptions,
} from 'docx'

type Any = Record<string, unknown> // eslint-disable-line @typescript-eslint/no-explicit-any

const PRIMARY = '4338CA'
const INK = '111827'
const MUTED = '6B7280'
const WHITE = 'FFFFFF'

const asArr = (v: unknown): Any[] => (Array.isArray(v) ? (v as Any[]) : [])
const s = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))
const num = (v: unknown): number => (Number(v) || 0)

interface L {
  coverKicker: string; org: string; secteur: string; version: string; statut: string; generatedOn: string
  statutAnalyse: Record<string, string>; mentionLabels: Record<string, string>
  perimetre: string; valeursMetier: string; biensSupports: string
  srOv: string; thSource: string; thCat: string; thPert: string; thOv: string
  scenarios: string; thRisk: string; thG: string; thV: string; thLevel: string
  eco: string; thPP: string; thType: string; thMenace: string
  risques: string; thStrategy: string; thResidual: string
  plan: string; thMeasure: string; thMType: string; thPriority: string; thStatus: string; thOwner: string; thDue: string
  conf: string; thRef: string; confStatut: Record<string, string>
  revisions: string; thRevVersion: string; thRevDate: string; thRevNote: string
  strategies: Record<string, string>; statuses: Record<string, string>; empty: string; none: string
}

const FR: L = {
  coverKicker: 'Analyse de risques cyber — EBIOS Risk Manager', org: 'Organisation', secteur: 'Secteur', version: 'Version', statut: 'Statut', generatedOn: 'Généré le',
  statutAnalyse: { EN_COURS: 'En cours', SOUMIS: 'Soumis', APPROUVE: 'Approuvé', REJETE: 'Rejeté', TERMINE: 'Terminé', ARCHIVE: 'Archivé' },
  mentionLabels: { NON_PROTEGEE: 'Non protégée', SENSIBLE: 'Sensible', RESTREINTE: 'Diffusion restreinte', CONFIDENTIELLE: 'Confidentielle' },
  perimetre: 'Périmètre de l’étude', valeursMetier: 'Valeurs métier', biensSupports: 'Biens supports',
  srOv: 'Sources de risque & objectifs visés', thSource: 'Source', thCat: 'Catégorie', thPert: 'Pertinence', thOv: 'Objectifs visés',
  scenarios: 'Scénarios stratégiques', thRisk: 'Intitulé', thG: 'G', thV: 'V', thLevel: 'Niveau',
  eco: 'Écosystème — parties prenantes', thPP: 'Partie prenante', thType: 'Type', thMenace: 'Menace',
  risques: 'Risques & traitement', thStrategy: 'Stratégie', thResidual: 'Résiduel',
  plan: 'Plan de traitement', thMeasure: 'Mesure', thMType: 'Type', thPriority: 'Priorité', thStatus: 'Statut', thOwner: 'Responsable', thDue: 'Échéance',
  conf: 'Conformité au socle de sécurité', thRef: 'Référence', confStatut: { conforme: 'Conforme', partiel: 'Partiel', non_conforme: 'Non conforme', non_applicable: 'N/A' },
  revisions: 'Historique des révisions', thRevVersion: 'Version', thRevDate: 'Date', thRevNote: 'Note',
  strategies: { REDUIRE: 'Réduire', ACCEPTER: 'Accepter', TRANSFERER: 'Transférer', REFUSER: 'Refuser', SURVEILLER: 'Surveiller' },
  statuses: { A_FAIRE: 'À faire', EN_COURS: 'En cours', REALISE: 'Réalisé' }, empty: '—', none: 'Aucun élément.',
}

const EN: L = {
  coverKicker: 'Cyber risk analysis — EBIOS Risk Manager', org: 'Organisation', secteur: 'Sector', version: 'Version', statut: 'Status', generatedOn: 'Generated on',
  statutAnalyse: { EN_COURS: 'In progress', SOUMIS: 'Submitted', APPROUVE: 'Approved', REJETE: 'Rejected', TERMINE: 'Completed', ARCHIVE: 'Archived' },
  mentionLabels: { NON_PROTEGEE: 'Unrestricted', SENSIBLE: 'Sensitive', RESTREINTE: 'Restricted', CONFIDENTIELLE: 'Confidential' },
  perimetre: 'Study scope', valeursMetier: 'Business values', biensSupports: 'Supporting assets',
  srOv: 'Risk sources & targeted objectives', thSource: 'Source', thCat: 'Category', thPert: 'Relevance', thOv: 'Targeted objectives',
  scenarios: 'Strategic scenarios', thRisk: 'Title', thG: 'S', thV: 'L', thLevel: 'Level',
  eco: 'Ecosystem — stakeholders', thPP: 'Stakeholder', thType: 'Type', thMenace: 'Threat',
  risques: 'Risks & treatment', thStrategy: 'Strategy', thResidual: 'Residual',
  plan: 'Treatment plan', thMeasure: 'Measure', thMType: 'Type', thPriority: 'Priority', thStatus: 'Status', thOwner: 'Owner', thDue: 'Due',
  conf: 'Compliance with the security baseline', thRef: 'Reference', confStatut: { conforme: 'Compliant', partiel: 'Partial', non_conforme: 'Non-compliant', non_applicable: 'N/A' },
  revisions: 'Revision history', thRevVersion: 'Version', thRevDate: 'Date', thRevNote: 'Note',
  strategies: { REDUIRE: 'Reduce', ACCEPTER: 'Accept', TRANSFERER: 'Transfer', REFUSER: 'Refuse', SURVEILLER: 'Monitor' },
  statuses: { A_FAIRE: 'To do', EN_COURS: 'In progress', REALISE: 'Done' }, empty: '—', none: 'No item.',
}

const DE: L = {
  coverKicker: 'Cyber-Risikoanalyse — EBIOS Risk Manager', org: 'Organisation', secteur: 'Branche', version: 'Version', statut: 'Status', generatedOn: 'Erstellt am',
  statutAnalyse: { EN_COURS: 'In Bearbeitung', SOUMIS: 'Eingereicht', APPROUVE: 'Genehmigt', REJETE: 'Abgelehnt', TERMINE: 'Abgeschlossen', ARCHIVE: 'Archiviert' },
  mentionLabels: { NON_PROTEGEE: 'Nicht eingestuft', SENSIBLE: 'Sensibel', RESTREINTE: 'Eingeschränkt', CONFIDENTIELLE: 'Vertraulich' },
  perimetre: 'Untersuchungsumfang', valeursMetier: 'Geschäftswerte', biensSupports: 'Unterstützende Werte',
  srOv: 'Risikoquellen & angestrebte Ziele', thSource: 'Quelle', thCat: 'Kategorie', thPert: 'Relevanz', thOv: 'Angestrebte Ziele',
  scenarios: 'Strategische Szenarien', thRisk: 'Bezeichnung', thG: 'S', thV: 'W', thLevel: 'Niveau',
  eco: 'Ökosystem — Beteiligte', thPP: 'Beteiligter', thType: 'Typ', thMenace: 'Bedrohung',
  risques: 'Risiken & Behandlung', thStrategy: 'Strategie', thResidual: 'Rest',
  plan: 'Behandlungsplan', thMeasure: 'Maßnahme', thMType: 'Typ', thPriority: 'Priorität', thStatus: 'Status', thOwner: 'Verantwortlich', thDue: 'Fällig',
  conf: 'Konformität mit der Sicherheitsbasis', thRef: 'Referenz', confStatut: { conforme: 'Konform', partiel: 'Teilweise', non_conforme: 'Nicht konform', non_applicable: 'N/V' },
  revisions: 'Revisionshistorie', thRevVersion: 'Version', thRevDate: 'Datum', thRevNote: 'Notiz',
  strategies: { REDUIRE: 'Reduzieren', ACCEPTER: 'Akzeptieren', TRANSFERER: 'Übertragen', REFUSER: 'Ablehnen', SURVEILLER: 'Überwachen' },
  statuses: { A_FAIRE: 'Zu erledigen', EN_COURS: 'In Bearbeitung', REALISE: 'Erledigt' }, empty: '—', none: 'Kein Element.',
}

const ES: L = {
  coverKicker: 'Análisis de riesgos cibernéticos — EBIOS Risk Manager', org: 'Organización', secteur: 'Sector', version: 'Versión', statut: 'Estado', generatedOn: 'Generado el',
  statutAnalyse: { EN_COURS: 'En curso', SOUMIS: 'Enviado', APPROUVE: 'Aprobado', REJETE: 'Rechazado', TERMINE: 'Finalizado', ARCHIVE: 'Archivado' },
  mentionLabels: { NON_PROTEGEE: 'Sin clasificar', SENSIBLE: 'Sensible', RESTREINTE: 'Restringido', CONFIDENTIELLE: 'Confidencial' },
  perimetre: 'Alcance del estudio', valeursMetier: 'Valores de negocio', biensSupports: 'Activos de soporte',
  srOv: 'Fuentes de riesgo y objetivos', thSource: 'Fuente', thCat: 'Categoría', thPert: 'Pertinencia', thOv: 'Objetivos',
  scenarios: 'Escenarios estratégicos', thRisk: 'Título', thG: 'G', thV: 'P', thLevel: 'Nivel',
  eco: 'Ecosistema — partes interesadas', thPP: 'Parte interesada', thType: 'Tipo', thMenace: 'Amenaza',
  risques: 'Riesgos y tratamiento', thStrategy: 'Estrategia', thResidual: 'Residual',
  plan: 'Plan de tratamiento', thMeasure: 'Medida', thMType: 'Tipo', thPriority: 'Prioridad', thStatus: 'Estado', thOwner: 'Responsable', thDue: 'Vencimiento',
  conf: 'Conformidad con la base de seguridad', thRef: 'Referencia', confStatut: { conforme: 'Conforme', partiel: 'Parcial', non_conforme: 'No conforme', non_applicable: 'N/A' },
  revisions: 'Historial de revisiones', thRevVersion: 'Versión', thRevDate: 'Fecha', thRevNote: 'Nota',
  strategies: { REDUIRE: 'Reducir', ACCEPTER: 'Aceptar', TRANSFERER: 'Transferir', REFUSER: 'Rechazar', SURVEILLER: 'Vigilar' },
  statuses: { A_FAIRE: 'Por hacer', EN_COURS: 'En curso', REALISE: 'Hecho' }, empty: '—', none: 'Ningún elemento.',
}

const IT: L = {
  coverKicker: 'Analisi dei rischi cyber — EBIOS Risk Manager', org: 'Organizzazione', secteur: 'Settore', version: 'Versione', statut: 'Stato', generatedOn: 'Generato il',
  statutAnalyse: { EN_COURS: 'In corso', SOUMIS: 'Inviato', APPROUVE: 'Approvato', REJETE: 'Respinto', TERMINE: 'Completato', ARCHIVE: 'Archiviato' },
  mentionLabels: { NON_PROTEGEE: 'Non classificato', SENSIBLE: 'Sensibile', RESTREINTE: 'Riservato', CONFIDENTIELLE: 'Confidenziale' },
  perimetre: 'Perimetro dello studio', valeursMetier: 'Valori di business', biensSupports: 'Beni di supporto',
  srOv: 'Fonti di rischio e obiettivi', thSource: 'Fonte', thCat: 'Categoria', thPert: 'Pertinenza', thOv: 'Obiettivi',
  scenarios: 'Scenari strategici', thRisk: 'Titolo', thG: 'G', thV: 'P', thLevel: 'Livello',
  eco: 'Ecosistema — parti interessate', thPP: 'Parte interessata', thType: 'Tipo', thMenace: 'Minaccia',
  risques: 'Rischi e trattamento', thStrategy: 'Strategia', thResidual: 'Residuo',
  plan: 'Piano di trattamento', thMeasure: 'Misura', thMType: 'Tipo', thPriority: 'Priorità', thStatus: 'Stato', thOwner: 'Responsabile', thDue: 'Scadenza',
  conf: 'Conformità alla base di sicurezza', thRef: 'Riferimento', confStatut: { conforme: 'Conforme', partiel: 'Parziale', non_conforme: 'Non conforme', non_applicable: 'N/D' },
  revisions: 'Cronologia delle revisioni', thRevVersion: 'Versione', thRevDate: 'Data', thRevNote: 'Nota',
  strategies: { REDUIRE: 'Ridurre', ACCEPTER: 'Accettare', TRANSFERER: 'Trasferire', REFUSER: 'Rifiutare', SURVEILLER: 'Sorvegliare' },
  statuses: { A_FAIRE: 'Da fare', EN_COURS: 'In corso', REALISE: 'Fatto' }, empty: '—', none: 'Nessun elemento.',
}

function strings(locale: string): L {
  switch (locale) {
    case 'fr': return FR
    case 'de': return DE
    case 'es': return ES
    case 'it': return IT
    default: return EN
  }
}

const CELL_MARGINS = { top: 40, bottom: 40, left: 90, right: 90 }

function th(text: string): TableCell {
  return new TableCell({
    shading: { fill: PRIMARY }, margins: CELL_MARGINS,
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: WHITE, size: 18 })] })],
  })
}
function td(text: string, align?: (typeof AlignmentType)[keyof typeof AlignmentType], color?: string): TableCell {
  return new TableCell({
    margins: CELL_MARGINS,
    children: [new Paragraph({ alignment: align, children: [new TextRun({ text: text || '', size: 18, color: color ?? INK })] })],
  })
}

type Col = { header: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType] }
function dataTable(cols: Col[], rows: { text: string; color?: string }[][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: cols.map(c => th(c.header)) }),
      ...rows.map(r => new TableRow({ children: r.map((cell, i) => td(cell.text, cols[i]?.align, cell.color)) })),
    ],
  })
}

function heading(text: string): Paragraph {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 260, after: 120 }, children: [new TextRun({ text, color: PRIMARY, bold: true })] })
}

export async function renderAnalyseDocx(analyse: Any, config: Any | null, locale: string): Promise<Buffer> {
  void config
  const L = strings(locale)
  const dateLocale = locale === 'en' ? 'en-GB' : locale === 'de' ? 'de-DE' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : 'fr-FR'
  const fmtDate = (d: unknown): string => { const t = new Date(d as string); return isNaN(t.getTime()) ? '' : t.toLocaleDateString(dateLocale) }
  const cadrage = (analyse.cadrage as Any) ?? {}
  const R = (align: (typeof AlignmentType)[keyof typeof AlignmentType]) => align

  const children: (Paragraph | Table)[] = []

  // ── Couverture ──
  children.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: L.coverKicker.toUpperCase(), color: PRIMARY, bold: true, size: 18 })] }))
  children.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: s(analyse.nom) || 'Analyse' })] }))
  const metaLine: string[] = []
  if (analyse.organisation) metaLine.push(`${L.org} : ${s(analyse.organisation)}`)
  if (analyse.secteur) metaLine.push(`${L.secteur} : ${s(analyse.secteur)}`)
  metaLine.push(`${L.version} ${num(analyse.versionMajeure) || 1}.${num(analyse.versionMineure)}`)
  const statutLbl = L.statutAnalyse[s(analyse.statut)] ?? s(analyse.statut)
  if (statutLbl) metaLine.push(`${L.statut} : ${statutLbl}`)
  const mention = s(analyse.mentionProtection)
  if (mention && mention !== 'NON_PROTEGEE') metaLine.push(L.mentionLabels[mention] ?? mention)
  children.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: metaLine.join('   ·   '), color: MUTED, size: 20 })] }))
  children.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: `${L.generatedOn} ${new Date().toLocaleDateString(dateLocale)}`, color: MUTED, size: 18 })] }))

  // ── Périmètre ──
  const perimetre = s(cadrage.perimetre)
  if (perimetre) {
    children.push(heading(L.perimetre))
    children.push(new Paragraph({ children: [new TextRun({ text: perimetre, size: 20 })] }))
  }

  // ── Valeurs métier / Biens supports ──
  const vms = asArr(cadrage.valeursMetier)
  if (vms.length) {
    children.push(heading(`${L.valeursMetier} (${vms.length})`))
    vms.forEach(vm => children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: s(vm.nom), size: 20 })] })))
  }
  const biens = asArr(cadrage.biensSupports)
  if (biens.length) {
    children.push(heading(`${L.biensSupports} (${biens.length})`))
    biens.forEach(b => children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: s(b.nom), size: 20 })] })))
  }

  // ── Sources de risque & objectifs ──
  const srs = asArr(analyse.sourcesRisque).filter(x => x.retenu !== false)
  if (srs.length) {
    children.push(heading(L.srOv))
    children.push(dataTable(
      [{ header: L.thSource }, { header: L.thCat }, { header: L.thPert, align: R(AlignmentType.CENTER) }, { header: L.thOv }],
      srs.map(sr => [
        { text: s(sr.nom) },
        { text: s(sr.categorie) },
        { text: String(num(sr.pertinence) || '') },
        { text: asArr(sr.objectifsVises).map(o => s(o.nom)).join(', ') },
      ]),
    ))
  }

  // ── Scénarios stratégiques ──
  const scen = asArr(analyse.scenariosStrategiques).filter(x => x.retenu !== false)
  if (scen.length) {
    children.push(heading(L.scenarios))
    children.push(dataTable(
      [{ header: L.thRisk }, { header: L.thG, align: R(AlignmentType.CENTER) }, { header: L.thV, align: R(AlignmentType.CENTER) }, { header: L.thLevel, align: R(AlignmentType.CENTER) }],
      scen.map(sc => [
        { text: s(sc.nom) },
        { text: String(num(sc.gravite) || '') },
        { text: String(num(sc.vraisemblance) || '') },
        { text: String(num(sc.niveauRisque) || '') },
      ]),
    ))
  }

  // ── Écosystème ──
  const pps = asArr(analyse.partiesPrenantes)
  if (pps.length) {
    children.push(heading(L.eco))
    children.push(dataTable(
      [{ header: L.thPP }, { header: L.thType }, { header: L.thMenace, align: R(AlignmentType.CENTER) }],
      pps.map(pp => [
        { text: s(pp.nom) },
        { text: s(pp.type) },
        { text: ((num(pp.exposition) || 1) / (num(pp.fiabilite) || 1)).toFixed(2) },
      ]),
    ))
  }

  // ── Risques & traitement ──
  const risques = asArr(analyse.risques)
  if (risques.length) {
    children.push(heading(L.risques))
    children.push(dataTable(
      [{ header: L.thRisk }, { header: L.thG, align: R(AlignmentType.CENTER) }, { header: L.thV, align: R(AlignmentType.CENTER) }, { header: L.thLevel, align: R(AlignmentType.CENTER) }, { header: L.thStrategy }, { header: L.thResidual, align: R(AlignmentType.CENTER) }],
      risques.map((r, i) => [
        { text: `R${i + 1} · ${s(r.nom)}` },
        { text: String(num(r.gravite) || '') },
        { text: String(num(r.vraisemblance) || '') },
        { text: String(num(r.niveauRisque) || '') },
        { text: L.strategies[s(r.strategie)] ?? s(r.strategie) ?? L.empty },
        { text: r.niveauResiduel != null ? String(num(r.niveauResiduel)) : L.empty },
      ]),
    ))
  }

  // ── Plan de traitement ──
  const mesures = asArr(analyse.mesures)
  if (mesures.length) {
    children.push(heading(L.plan))
    children.push(dataTable(
      [{ header: L.thMeasure }, { header: L.thMType }, { header: L.thPriority, align: R(AlignmentType.CENTER) }, { header: L.thStatus }, { header: L.thOwner }, { header: L.thDue, align: R(AlignmentType.CENTER) }],
      mesures.map(m => [
        { text: s(m.nom) },
        { text: s(m.type) },
        { text: m.priorite != null ? `P${num(m.priorite)}` : L.empty },
        { text: L.statuses[s(m.statut)] ?? s(m.statut) ?? L.empty },
        { text: s(m.responsable) || L.empty },
        { text: m.echeance ? fmtDate(m.echeance) : L.empty },
      ]),
    ))
  }

  // ── Conformité socle ──
  const socle = asArr(cadrage.socleSecurite)
  if (socle.length) {
    children.push(heading(L.conf))
    children.push(dataTable(
      [{ header: L.thRef }, { header: L.thStatus }],
      socle.map(e => [
        { text: s(e.ref) || s(e.nom) },
        { text: L.confStatut[s(e.statut)] ?? s(e.statut) ?? L.empty },
      ]),
    ))
  }

  // ── Révisions ──
  const revisions = asArr(analyse.revisions)
  if (revisions.length) {
    children.push(heading(L.revisions))
    children.push(dataTable(
      [{ header: L.thRevVersion }, { header: L.thRevDate }, { header: L.thRevNote }],
      revisions.map(rev => [
        { text: `v${s(rev.version)}` },
        { text: fmtDate(rev.createdAt) },
        { text: s(rev.note) },
      ]),
    ))
  }

  const section: ISectionOptions = { properties: {}, children }
  const doc = new Document({
    creator: 'ACRA — Augmented Cyber Risk Analysis',
    title: s(analyse.nom) || 'Analyse',
    sections: [section],
  })
  return Packer.toBuffer(doc)
}
