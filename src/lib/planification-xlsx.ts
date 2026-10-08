// ─── Programme d'audit et de contrôle — exports Excel (lot P6) ────────────────
// Un plan : feuille de présentation, une feuille par année (lignes, cibles nommées, échantillon, période, statut calculé,
// réalisations), historique des validations et révisions. Vue globale : synthèse des plans, lignes de l'année,
// sollicitations multiples, angles morts. Libellés : catalogue i18n ; textes neutralisés (lib/spreadsheet-safe).
// Testé : planification-xlsx.test.ts.
import ExcelJS from 'exceljs'
import { sanitizeForSpreadsheet as S } from './spreadsheet-safe'
import type { getT } from './i18n'

type Cat = ReturnType<typeof getT>
const ENTETE = 'FF4338CA'

function feuille(wb: ExcelJS.Workbook, nom: string, entetes: string[], lignes: (string | number | null)[][], largeurs?: number[]) {
  const ws = wb.addWorksheet(nom.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31) || 'Feuille')
  ws.columns = entetes.map((h, i) => ({ header: h, width: largeurs?.[i] ?? 18 }))
  const tete = ws.getRow(1)
  tete.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  tete.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ENTETE } } })
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  for (const l of lignes) ws.addRow(l.map(v => (typeof v === 'string' ? S(v) : v ?? '')))
  return ws
}

export interface LigneExport {
  annee: number; intitule: string; prisme: string
  cibles: { organisations?: string[]; entites?: string[]; tiers?: string[]; risques?: string[]; processus?: string[]; referentiel?: { code: string; exigences: string[] } | null }
  echantillon: { methode: string; population: number | null; taille: number | null } | null
  debut: string | null; fin: string | null; charge: number | null; priorite: number | null; responsable: string | null
  statutCalcule?: string | null; realisations?: { intitule: string | null }[]
}

export async function buildPlanXlsx(o: {
  t: Cat; now: Date; organisation: string
  plan: { nom: string; type: string; equipe: string | null; prismePrincipal: string; mode: string; anneeDebut: number; anneeFin: number }
  annees: { annee: number; statut: string; valideLe: string | null; revision: number; motifRevision: string | null; commentaire: string | null }[]
  lignes: LigneExport[]
  noms: Record<string, string>
}): Promise<Buffer> {
  const p = o.t.plans, e = p.export
  const wb = new ExcelJS.Workbook()
  wb.creator = 'ACRA — Augmented Cyber (& Business) Risk Analysis'; wb.created = o.now
  const nom = (ids?: string[]) => (ids ?? []).map(id => o.noms[id] ?? id).join(', ')
  const type = o.plan.type === 'AUDIT' ? o.t.planification.planAudit : o.t.planification.planControle
  feuille(wb, o.plan.nom, [e.champ, e.valeur], [
    [e.organisation, o.organisation], [e.titre, o.plan.nom], [e.type, type], [p.equipe, o.plan.equipe ?? ''],
    [p.prisme, (p.prismes as Record<string, string>)[o.plan.prismePrincipal] ?? o.plan.prismePrincipal], [p.mode, (p.modes as Record<string, string>)[o.plan.mode] ?? o.plan.mode],
    [e.horizon, `${o.plan.anneeDebut}–${o.plan.anneeFin}`], [e.genere, o.now.toISOString().slice(0, 10)],
  ], [28, 70])
  const entetes = [p.intitule, p.prisme, p.organisations, p.entites, p.tiers, p.risques, p.processus, p.referentiel, p.echantillon, p.debut, p.fin, p.charge, p.priorite, p.responsable, p.rattachement.colonne, e.realisations]
  for (const a of o.annees) {
    feuille(wb, String(a.annee), entetes, o.lignes.filter(l => l.annee === a.annee).map(l => [
      l.intitule, (p.prismes as Record<string, string>)[l.prisme] ?? l.prisme,
      nom(l.cibles.organisations), nom(l.cibles.entites), nom(l.cibles.tiers), nom(l.cibles.risques), nom(l.cibles.processus),
      l.cibles.referentiel ? `${l.cibles.referentiel.code}${l.cibles.referentiel.exigences.length ? ` : ${l.cibles.referentiel.exigences.join(', ')}` : ''}` : '',
      l.echantillon ? `${(p.methodes as Record<string, string>)[l.echantillon.methode] ?? l.echantillon.methode}${l.echantillon.taille ? ` · ${l.echantillon.taille}/${l.echantillon.population ?? '?'}` : ''}` : '',
      l.debut, l.fin, l.charge, l.priorite ? (p.priorites as Record<string, string>)[String(l.priorite)] : '', l.responsable,
      l.statutCalcule ? (p.statutsLigne as Record<string, string>)[l.statutCalcule] ?? l.statutCalcule : '',
      (l.realisations ?? []).map(r => r.intitule).filter(Boolean).join(', '),
    ]), [40, 18, 26, 26, 22, 30, 26, 30, 22, 12, 12, 10, 12, 20, 14, 30])
  }
  feuille(wb, e.historique, [p.annee, e.statut, e.valideLeCol, e.revision, e.motif, e.commentaire], o.annees.map(a => [
    a.annee, (p.statuts as Record<string, string>)[a.statut] ?? a.statut, a.valideLe ? a.valideLe.slice(0, 10) : '', a.revision, a.motifRevision ?? '', a.commentaire ?? '',
  ]), [10, 14, 14, 10, 40, 40])
  return Buffer.from(await wb.xlsx.writeBuffer())
}

export async function buildVueXlsx(o: {
  t: Cat; now: Date; organisation: string; annee: number; seuil: number
  plans: { nom: string; type: string; statut: string | null; lignes: number; realisation?: { taux: number | null; enRetard: number; actives?: number; realisees?: number } }[]
  lignes: { planNom: string; intitule: string; debut: string | null; fin: string | null; statutManuel: string | null }[]
  sollicitations: { organisations: { nom: string; nombre: number; plans: number; simultanee: boolean }[]; entites?: { nom: string; nombre: number; plans: number; simultanee: boolean }[]; tiers: { nom: string; nombre: number; plans: number; simultanee: boolean }[] }
  anglesMorts: { risques: { nom: string; niveau: number; derniere: string | null; prevu: boolean }[]; processus: { nom: string; criticite?: number | null; derniere: string | null; prevu: boolean }[] }
}): Promise<Buffer> {
  const p = o.t.plans, e = p.export, v = p.vue
  const wb = new ExcelJS.Workbook()
  wb.creator = 'ACRA — Augmented Cyber (& Business) Risk Analysis'; wb.created = o.now
  const ouiNon = (b: boolean) => (b ? e.oui : e.non)
  feuille(wb, `${e.synthese} ${o.annee}`, [p.nom, e.type, e.statut, v.lignesCol, e.taux, p.statutsLigne.EN_RETARD], o.plans.map(pl => [
    pl.nom, pl.type === 'AUDIT' ? o.t.planification.planAudit : o.t.planification.planControle,
    pl.statut ? (p.statuts as Record<string, string>)[pl.statut] ?? pl.statut : v.horsHorizon, pl.lignes, pl.realisation?.taux ?? null, pl.realisation?.enRetard ?? null,
  ]), [40, 18, 14, 10, 18, 12])
  feuille(wb, e.lignes, [e.plan, p.intitule, p.debut, p.fin, p.statutManuel], o.lignes.map(l => [
    l.planNom, l.intitule, l.debut, l.fin, l.statutManuel ? (p.statutsManuels as Record<string, string>)[l.statutManuel] ?? l.statutManuel : '',
  ]), [34, 40, 12, 12, 14])
  feuille(wb, e.sollicitations, [e.nature, e.cible, e.nombre, e.plans, v.simultanee], [
    ...o.sollicitations.organisations.map(s => [p.organisations, s.nom, s.nombre, s.plans, ouiNon(s.simultanee)]),
    ...(o.sollicitations.entites ?? []).map(s => [p.entites, s.nom, s.nombre, s.plans, ouiNon(s.simultanee)]),
    ...o.sollicitations.tiers.map(s => [p.tiers, s.nom, s.nombre, s.plans, ouiNon(s.simultanee)]),
  ], [22, 36, 10, 10, 16])
  feuille(wb, e.anglesMorts, [e.nature, e.cible, e.niveau, e.derniere, v.prevu], [
    ...o.anglesMorts.risques.map(r => [e.risque, r.nom, r.niveau, r.derniere ?? v.jamais, ouiNon(r.prevu)]),
    ...o.anglesMorts.processus.map(pr => [e.processus, pr.nom, pr.criticite ?? null, pr.derniere ?? v.jamais, ouiNon(pr.prevu)]),
  ], [14, 40, 10, 18, 10])
  return Buffer.from(await wb.xlsx.writeBuffer())
}
