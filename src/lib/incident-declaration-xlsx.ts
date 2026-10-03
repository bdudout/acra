// ─── Export Excel d'une déclaration d'incident (DORA : tableau des champs de l'ITS ; autres régimes : fiche) ─────────────────
// Module SERVEUR (ExcelJS). Aide à la déclaration : le fichier se relit, se complète et se copie vers le canal de l'autorité ;
// il n'est pas au format de dépôt. Toute chaîne est neutralisée contre l'injection de formule (CWE-1236).
import ExcelJS from 'exceljs'
import { sanitizeForSpreadsheet as S } from './spreadsheet-safe'
import { doraFieldRows, itsDatetime, RGPD_FIELDS, type DeclarationIncident, type DeclarationContext, type Declaration, type DeclarationValue, type DoraStage } from './incident-declaration'

export type ExportLang = 'fr' | 'en' | 'de' | 'es' | 'it'
export type DeclarationExport =
  | { kind: 'DORA'; stage: DoraStage; declaration: Declaration }
  | { kind: 'REGIME'; code: string; label?: string; autorite?: string; phase: { code: string; label?: string }; echeance: Date | null; soumisLe: Date | null; reference?: string; declaration?: Declaration }

const L: Record<ExportLang, Record<string, string>> = {
  fr: { readme: 'Lisez-moi', stage_INITIAL: 'Notification initiale', stage_INTERMEDIATE: 'Rapport intermédiaire', stage_FINAL: 'Rapport final', decl: 'Déclaration', no: 'N°', field: 'Champ', type: 'Type', mandatory: 'Obligatoire', condition: 'Condition', value: 'Valeur', status: 'Statut', allowed: 'Valeurs admises',
    FILLED: 'Renseigné', MISSING: 'À compléter', TO_CHECK: 'À examiner (conditionnel)', all: 'Oui (toutes étapes)', 'intermediate+': 'Oui (dès l’intermédiaire)', final: 'Oui (final)', conditional: 'Conditionnel',
    title: 'Aide à la déclaration d’incident', incident: 'Incident', reference: 'Référence', org: 'Organisation', regime: 'Régime', authority: 'Autorité', phase: 'Phase', deadline: 'Échéance (UTC)', state: 'État', submitted: 'Déposée le (UTC)', notSubmitted: 'Non déposée', ackRef: 'Référence de l’accusé', generated: 'Généré le (UTC)', detected: 'Détecté le (UTC)', occurred: 'Survenu le (UTC)', statusInc: 'Statut de l’incident', description: 'Description',
    notice: 'Aide à la déclaration : ce fichier n’a pas été transmis et n’est pas au format de dépôt. Le canal, le schéma et le format sont fixés par l’autorité compétente (en France pour DORA : ACPR, OneGate, rapport DORA_IR au format JSON validé par le schéma officiel). Vérifier chaque champ avant dépôt.',
    source: 'Source des champs DORA : règlement d’exécution (UE) 2025/302, annexe II (glossaire de données) ; délais : règlement délégué (UE) 2025/301, art. 5.', legend: 'Statut : « À compléter » = champ obligatoire à cette étape sans valeur ; « À examiner » = champ conditionnel (voir la condition). Montants en milliers d’unités de la devise de déclaration ; dates en UTC.' },
  en: { readme: 'Read me', stage_INITIAL: 'Initial notification', stage_INTERMEDIATE: 'Intermediate report', stage_FINAL: 'Final report', decl: 'Report', no: 'No.', field: 'Field', type: 'Type', mandatory: 'Mandatory', condition: 'Condition', value: 'Value', status: 'Status', allowed: 'Allowed values',
    FILLED: 'Filled', MISSING: 'To complete', TO_CHECK: 'To review (conditional)', all: 'Yes (all stages)', 'intermediate+': 'Yes (from intermediate)', final: 'Yes (final)', conditional: 'Conditional',
    title: 'Incident reporting aid', incident: 'Incident', reference: 'Reference', org: 'Organisation', regime: 'Regime', authority: 'Authority', phase: 'Phase', deadline: 'Deadline (UTC)', state: 'Status', submitted: 'Filed on (UTC)', notSubmitted: 'Not filed', ackRef: 'Acknowledgement reference', generated: 'Generated on (UTC)', detected: 'Detected on (UTC)', occurred: 'Occurred on (UTC)', statusInc: 'Incident status', description: 'Description',
    notice: 'Reporting aid: this file has not been transmitted and is not in the filing format. The channel, schema and format are set by the competent authority (in France for DORA: ACPR, OneGate, DORA_IR report in JSON validated against the official schema). Check every field before filing.',
    source: 'DORA field source: Implementing Regulation (EU) 2025/302, Annex II (data glossary); time limits: Delegated Regulation (EU) 2025/301, Art. 5.', legend: 'Status: “To complete” = field mandatory at this stage without a value; “To review” = conditional field (see the condition). Amounts in thousands of units of the reporting currency; dates in UTC.' },
  de: { readme: 'Hinweise', stage_INITIAL: 'Erstmeldung', stage_INTERMEDIATE: 'Zwischenbericht', stage_FINAL: 'Abschlussbericht', decl: 'Meldung', no: 'Nr.', field: 'Feld', type: 'Typ', mandatory: 'Pflicht', condition: 'Bedingung', value: 'Wert', status: 'Status', allowed: 'Zulässige Werte',
    FILLED: 'Ausgefüllt', MISSING: 'Zu ergänzen', TO_CHECK: 'Zu prüfen (bedingt)', all: 'Ja (alle Phasen)', 'intermediate+': 'Ja (ab Zwischenbericht)', final: 'Ja (Abschluss)', conditional: 'Bedingt',
    title: 'Hilfe zur Vorfallmeldung', incident: 'Vorfall', reference: 'Referenz', org: 'Organisation', regime: 'Regelwerk', authority: 'Behörde', phase: 'Phase', deadline: 'Frist (UTC)', state: 'Status', submitted: 'Eingereicht am (UTC)', notSubmitted: 'Nicht eingereicht', ackRef: 'Referenz der Eingangsbestätigung', generated: 'Erstellt am (UTC)', detected: 'Erkannt am (UTC)', occurred: 'Eingetreten am (UTC)', statusInc: 'Vorfallstatus', description: 'Beschreibung',
    notice: 'Meldehilfe: Diese Datei wurde nicht übermittelt und hat nicht das Einreichungsformat. Kanal, Schema und Format legt die zuständige Behörde fest (in Frankreich für DORA: ACPR, OneGate, Bericht DORA_IR als JSON gemäß offiziellem Schema). Jedes Feld vor der Einreichung prüfen.',
    source: 'Quelle der DORA-Felder: Durchführungsverordnung (EU) 2025/302, Anhang II (Datenglossar); Fristen: Delegierte Verordnung (EU) 2025/301, Art. 5.', legend: 'Status: „Zu ergänzen“ = in dieser Phase verpflichtendes Feld ohne Wert; „Zu prüfen“ = bedingtes Feld (siehe Bedingung). Beträge in Tausend Einheiten der Meldewährung; Zeitangaben in UTC.' },
  es: { readme: 'Léame', stage_INITIAL: 'Notificación inicial', stage_INTERMEDIATE: 'Informe intermedio', stage_FINAL: 'Informe final', decl: 'Notificación', no: 'N.º', field: 'Campo', type: 'Tipo', mandatory: 'Obligatorio', condition: 'Condición', value: 'Valor', status: 'Estado', allowed: 'Valores admitidos',
    FILLED: 'Rellenado', MISSING: 'Por completar', TO_CHECK: 'Por examinar (condicional)', all: 'Sí (todas las fases)', 'intermediate+': 'Sí (desde el intermedio)', final: 'Sí (final)', conditional: 'Condicional',
    title: 'Ayuda a la notificación de incidentes', incident: 'Incidente', reference: 'Referencia', org: 'Organización', regime: 'Régimen', authority: 'Autoridad', phase: 'Fase', deadline: 'Plazo (UTC)', state: 'Estado', submitted: 'Presentada el (UTC)', notSubmitted: 'No presentada', ackRef: 'Referencia del acuse', generated: 'Generado el (UTC)', detected: 'Detectado el (UTC)', occurred: 'Ocurrido el (UTC)', statusInc: 'Estado del incidente', description: 'Descripción',
    notice: 'Ayuda a la notificación: este archivo no se ha transmitido y no está en el formato de presentación. El canal, el esquema y el formato los fija la autoridad competente (en Francia para DORA: ACPR, OneGate, informe DORA_IR en JSON validado con el esquema oficial). Compruebe cada campo antes de presentar.',
    source: 'Fuente de los campos DORA: Reglamento de Ejecución (UE) 2025/302, anexo II (glosario de datos); plazos: Reglamento Delegado (UE) 2025/301, art. 5.', legend: 'Estado: «Por completar» = campo obligatorio en esta fase sin valor; «Por examinar» = campo condicional (véase la condición). Importes en miles de unidades de la moneda de notificación; fechas en UTC.' },
  it: { readme: 'Leggimi', stage_INITIAL: 'Notifica iniziale', stage_INTERMEDIATE: 'Relazione intermedia', stage_FINAL: 'Relazione finale', decl: 'Notifica', no: 'N.', field: 'Campo', type: 'Tipo', mandatory: 'Obbligatorio', condition: 'Condizione', value: 'Valore', status: 'Stato', allowed: 'Valori ammessi',
    FILLED: 'Compilato', MISSING: 'Da completare', TO_CHECK: 'Da esaminare (condizionale)', all: 'Sì (tutte le fasi)', 'intermediate+': 'Sì (dall’intermedia)', final: 'Sì (finale)', conditional: 'Condizionale',
    title: 'Ausilio alla notifica di incidenti', incident: 'Incidente', reference: 'Riferimento', org: 'Organizzazione', regime: 'Regime', authority: 'Autorità', phase: 'Fase', deadline: 'Scadenza (UTC)', state: 'Stato', submitted: 'Depositata il (UTC)', notSubmitted: 'Non depositata', ackRef: 'Riferimento della ricevuta', generated: 'Generato il (UTC)', detected: 'Rilevato il (UTC)', occurred: 'Verificatosi il (UTC)', statusInc: 'Stato dell’incidente', description: 'Descrizione',
    notice: 'Ausilio alla notifica: questo file non è stato trasmesso e non è nel formato di deposito. Canale, schema e formato sono fissati dall’autorità competente (in Francia per DORA: ACPR, OneGate, rapporto DORA_IR in JSON convalidato con lo schema ufficiale). Verificare ogni campo prima del deposito.',
    source: 'Fonte dei campi DORA: Regolamento di esecuzione (UE) 2025/302, allegato II (glossario dei dati); termini: Regolamento delegato (UE) 2025/301, art. 5.', legend: 'Stato: «Da completare» = campo obbligatorio in questa fase senza valore; «Da esaminare» = campo condizionale (vedere la condizione). Importi in migliaia di unità della valuta di segnalazione; date in UTC.' },
}

const show = (v: DeclarationValue | undefined): string | number => v === undefined ? '' : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : Array.isArray(v) ? S(v.join('; ')) : typeof v === 'number' ? v : S(v)
const head = (row: ExcelJS.Row) => row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } }; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.alignment = { vertical: 'middle', wrapText: true } })

// Rubriques de l'art. 33 § 3 du RGPD (formulation proche du texte officiel ; vérifier sur EUR-Lex avant dépôt).
const RG: Record<ExportLang, { sheet: string; todo: string; label: Record<string, string> }> = {
  fr: { sheet: 'RGPD art. 33 § 3', todo: 'À compléter', label: { nature: 'Nature de la violation de données à caractère personnel', categoriesPersonnes: 'Catégories de personnes concernées', nbPersonnes: 'Nombre approximatif de personnes concernées', categoriesDonnees: 'Catégories d’enregistrements de données concernés', nbEnregistrements: 'Nombre approximatif d’enregistrements concernés', dpo: 'Nom et coordonnées du délégué à la protection des données ou autre point de contact', consequences: 'Conséquences probables de la violation', mesures: 'Mesures prises ou proposées pour remédier à la violation et atténuer ses conséquences', retardMotif: 'Motifs du retard (notification au-delà de 72 heures)' } },
  en: { sheet: 'GDPR Art. 33(3)', todo: 'To complete', label: { nature: 'Nature of the personal data breach', categoriesPersonnes: 'Categories of data subjects concerned', nbPersonnes: 'Approximate number of data subjects concerned', categoriesDonnees: 'Categories of personal data records concerned', nbEnregistrements: 'Approximate number of personal data records concerned', dpo: 'Name and contact details of the data protection officer or other contact point', consequences: 'Likely consequences of the personal data breach', mesures: 'Measures taken or proposed to address the breach and mitigate its possible adverse effects', retardMotif: 'Reasons for the delay (notification after 72 hours)' } },
  de: { sheet: 'DSGVO Art. 33 Abs. 3', todo: 'Zu ergänzen', label: { nature: 'Art der Verletzung des Schutzes personenbezogener Daten', categoriesPersonnes: 'Kategorien der betroffenen Personen', nbPersonnes: 'Ungefähre Zahl der betroffenen Personen', categoriesDonnees: 'Kategorien der betroffenen personenbezogenen Datensätze', nbEnregistrements: 'Ungefähre Zahl der betroffenen personenbezogenen Datensätze', dpo: 'Name und Kontaktdaten des Datenschutzbeauftragten oder einer sonstigen Anlaufstelle', consequences: 'Wahrscheinliche Folgen der Verletzung', mesures: 'Ergriffene oder vorgeschlagene Maßnahmen zur Behebung und Abmilderung', retardMotif: 'Gründe für die Verzögerung (Meldung nach mehr als 72 Stunden)' } },
  es: { sheet: 'RGPD art. 33.3', todo: 'Por completar', label: { nature: 'Naturaleza de la violación de la seguridad de los datos personales', categoriesPersonnes: 'Categorías de interesados afectados', nbPersonnes: 'Número aproximado de interesados afectados', categoriesDonnees: 'Categorías de registros de datos personales afectados', nbEnregistrements: 'Número aproximado de registros de datos personales afectados', dpo: 'Nombre y datos de contacto del delegado de protección de datos u otro punto de contacto', consequences: 'Posibles consecuencias de la violación', mesures: 'Medidas adoptadas o propuestas para poner remedio y mitigar los posibles efectos negativos', retardMotif: 'Motivos del retraso (notificación pasadas 72 horas)' } },
  it: { sheet: 'GDPR art. 33 par. 3', todo: 'Da completare', label: { nature: 'Natura della violazione dei dati personali', categoriesPersonnes: 'Categorie di interessati', nbPersonnes: 'Numero approssimativo di interessati', categoriesDonnees: 'Categorie di registrazioni dei dati personali', nbEnregistrements: 'Numero approssimativo di registrazioni dei dati personali', dpo: 'Nome e dati di contatto del responsabile della protezione dei dati o di altro punto di contatto', consequences: 'Probabili conseguenze della violazione', mesures: 'Misure adottate o di cui si propone l’adozione per porre rimedio e attenuare i possibili effetti negativi', retardMotif: 'Motivi del ritardo (notifica oltre le 72 ore)' } },
}

export async function buildDeclarationWorkbook(what: DeclarationExport, inc: DeclarationIncident, ctx: DeclarationContext, lang: ExportLang): Promise<Buffer> {
  const t = L[lang] ?? L.fr
  const wb = new ExcelJS.Workbook()
  wb.creator = 'ACRA — Augmented Cyber (& Business) Risk Analysis'; wb.created = ctx.now
  const info = wb.addWorksheet(t.readme)
  info.columns = [{ width: 28 }, { width: 110 }]
  const kv = (k: string, v: string | number) => info.addRow([k, typeof v === 'number' ? v : S(v)])
  info.addRow([t.title]).font = { bold: true, size: 14 }
  info.addRow([])
  kv(t.incident, inc.intitule); kv(t.reference, `ACRA-${inc.id}`); kv(t.org, ctx.organisationNom)
  kv(t.generated, itsDatetime(ctx.now) ?? '')
  if (what.kind === 'DORA') kv(t.phase, t[`stage_${what.stage}`])
  info.addRow([])
  info.addRow([t.notice]); info.addRow([t.source]); if (what.kind === 'DORA') info.addRow([t.legend])
  for (let r = 1; r <= info.rowCount; r++) { const cell = info.getRow(r).getCell(1); if (cell.value && !info.getRow(r).getCell(2).value && r > 2) { info.mergeCells(r, 1, r, 2); cell.alignment = { wrapText: true, vertical: 'top' }; info.getRow(r).height = 48 } }

  if (what.kind === 'DORA') {
    const ws = wb.addWorksheet(t[`stage_${what.stage}`])
    ws.columns = [{ header: t.no, width: 7 }, { header: t.field, width: 60 }, { header: t.type, width: 11 }, { header: t.mandatory, width: 22 }, { header: t.condition, width: 40 }, { header: t.value, width: 50 }, { header: t.status, width: 24 }, { header: t.allowed, width: 70 }]
    head(ws.getRow(1)); ws.views = [{ state: 'frozen', ySplit: 1 }]
    for (const r of doraFieldRows(inc, what.stage, what.declaration, ctx)) {
      const row = ws.addRow([r.id, S(r.name), r.kind, t[r.mandatory] ?? r.mandatory, S(r.condition ?? ''), show(r.value), t[r.status], S((r.allowed ?? []).join(' | '))])
      row.alignment = { vertical: 'top', wrapText: true }
      if (r.status === 'MISSING') row.getCell(7).font = { bold: true, color: { argb: 'FFB91C1C' } }
      if (r.status === 'TO_CHECK') row.getCell(7).font = { color: { argb: 'FFB45309' } }
    }
  } else {
    const ws = wb.addWorksheet(t.decl)
    ws.columns = [{ width: 30 }, { width: 90 }]
    const add = (k: string, v: string | number) => ws.addRow([k, typeof v === 'number' ? v : S(v)])
    add(t.regime, `${what.code}${what.label ? ` — ${what.label}` : ''}`); if (what.autorite) add(t.authority, what.autorite)
    add(t.phase, what.phase.label ? `${what.phase.label} (${what.phase.code})` : what.phase.code)
    add(t.deadline, itsDatetime(what.echeance) ?? '—')
    add(t.state, what.soumisLe ? `${t.submitted} ${itsDatetime(what.soumisLe)}` : t.notSubmitted); if (what.reference) add(t.ackRef, what.reference)
    ws.addRow([])
    add(t.incident, inc.intitule); add(t.reference, `ACRA-${inc.id}`); add(t.org, ctx.organisationNom)
    if (inc.description) add(t.description, inc.description)
    if (inc.dateDetection) add(t.detected, itsDatetime(inc.dateDetection) ?? ''); if (inc.dateSurvenance) add(t.occurred, itsDatetime(inc.dateSurvenance) ?? '')
    if (inc.statut) add(t.statusInc, inc.statut)
    ws.getColumn(1).font = { bold: true }; ws.eachRow(r => { r.alignment = { vertical: 'top', wrapText: true } })
    if (what.code === 'RGPD_33') {
      const rg = RG[lang] ?? RG.fr
      const w2 = wb.addWorksheet(rg.sheet)
      w2.columns = [{ width: 70 }, { width: 70 }]
      for (const f of RGPD_FIELDS) {
        const v = what.declaration?.[f.id] ?? (f.key === 'nature' ? inc.description ?? undefined : undefined)
        const row = w2.addRow([`${rg.label[f.key]} (${f.art})`, v === undefined ? rg.todo : show(v)])
        row.alignment = { vertical: 'top', wrapText: true }
        if (v === undefined) row.getCell(2).font = { bold: true, color: { argb: 'FFB91C1C' } }
      }
      w2.getColumn(1).font = { bold: true }
    }
  }
  return Buffer.from(await wb.xlsx.writeBuffer())
}
