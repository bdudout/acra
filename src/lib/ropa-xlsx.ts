// ─── Registre des traitements (RGPD art. 30) — export Excel ───────────────────
// Art. 30 §4 : le registre est mis à la disposition de l'autorité de contrôle sur demande. Feuille de présentation
// (organisation, date), puis une ligne par traitement : champs de l'art. 30 §1, complétude et besoin d'AIPD (art. 35)
// en clair. Libellés : catalogue i18n ; textes neutralisés (lib/spreadsheet-safe). Testé : ropa-xlsx.test.ts.
import ExcelJS from 'exceljs'
import { sanitizeForSpreadsheet as S } from './spreadsheet-safe'
import type { getT } from './i18n'
import type { Traitement, TraitementEvaluation } from './ropa'
import type { IdentiteEffective } from './ropa-identite'

type Cat = ReturnType<typeof getT>
const ENTETE = 'FF4338CA'

function feuille(wb: ExcelJS.Workbook, nom: string, entetes: string[], lignes: (string | number | null)[][], largeurs: number[]) {
  const ws = wb.addWorksheet(nom.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31))
  ws.columns = entetes.map((h, i) => ({ header: h, width: largeurs[i] ?? 18 }))
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  ws.getRow(1).eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ENTETE } } })
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  for (const l of lignes) ws.addRow(l.map(v => (typeof v === 'string' ? S(v) : v ?? '')))
}

export async function buildRopaXlsx(o: { t: Cat; now: Date; organisation: string; identite?: IdentiteEffective; traitements: (Traitement & { evaluation: TraitementEvaluation })[] }): Promise<Buffer> {
  const r = o.t.ropa, e = r.export
  const wb = new ExcelJS.Workbook()
  wb.creator = 'ACRA — Augmented Cyber (& Business) Risk Analysis'; wb.created = o.now
  const ouiNon = (b: boolean) => (b ? e.oui : e.non)
  const champ: Record<string, string> = {
    nom: r.fNom, finalite: r.fFinalite, categoriesPersonnes: r.fPersonnes, categoriesDonnees: r.fDonnees, destinataires: r.fDestinataires,
    dureeConservation: r.fDuree, mesuresSecurite: r.fMesures, garantiesTransfert: r.fGaranties,
  }
  const pres = wb.addWorksheet(e.presentation.slice(0, 31))
  pres.columns = [{ width: 28 }, { width: 60 }]
  pres.addRow([S(r.title)]).font = { bold: true, size: 13 }
  pres.addRow([e.organisation, S(o.organisation)])
  pres.addRow([e.genere, o.now.toISOString().slice(0, 10)])
  // Identité (art. 30 §1 a) : responsable, représentant, délégué à la protection des données.
  if (o.identite) {
    const id = r.identite, x = o.identite
    const ligne = (...v: string[]) => S(v.filter(Boolean).join(' — '))
    pres.addRow([id.responsable, S(x.responsable.nom)])
    pres.addRow([id.coordonnees, ligne(x.responsable.adresse, x.responsable.contact)])
    if (x.representant.nom || x.representant.contact) pres.addRow([id.representant, ligne(x.representant.nom, x.representant.contact)])
    if (x.dpo.source !== 'AUCUN') pres.addRow([id.dpo, ligne(x.dpo.nom, x.dpo.contact)])
  }
  feuille(wb, e.feuille,
    [r.fNom, r.fFinalite, r.fBase, r.fPersonnes, r.fDonnees, r.fDestinataires, r.fTransfert, r.fPays, r.fGaranties, r.fDuree, r.fMesures, e.complet, e.manquants, e.aipd, e.motifsCol],
    o.traitements.map(x => [
      x.nom, x.finalite, x.baseLegale ? (r.bases as Record<string, string>)[x.baseLegale] ?? x.baseLegale : '',
      x.categoriesPersonnes.join(', '), x.categoriesDonnees.join(', '), x.destinataires.join(', '),
      ouiNon(x.transfertHorsUE), x.paysTransfert ?? '', x.garantiesTransfert ?? '', x.dureeConservation, x.mesuresSecurite.join(', '),
      ouiNon(x.evaluation.complet), x.evaluation.champsManquants.map(c => champ[c] ?? c).join(', '),
      (r.niveaux as Record<string, string>)[x.evaluation.pia.niveau] ?? '', x.evaluation.pia.motifs.map(m => (r.criteres as Record<string, string>)[m] ?? m).join(' ; '),
    ]),
    [32, 40, 18, 26, 30, 26, 12, 16, 30, 18, 30, 12, 26, 12, 40])
  return Buffer.from(await wb.xlsx.writeBuffer())
}
