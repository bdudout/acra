/**
 * rapprochement-compta.ts — Rapprochement LDC ↔ comptabilité (B-PER-6). Module PUR.
 * L'organisation exporte un CSV du grand livre (`reference;montant[;devise]`, référence =
 * id ou intitulé de l'incident) ; on le compare au montant COMPTABILISÉ de la LDC.
 * Aucune lecture directe de l'ERP. Devise sans taux : ligne en erreur (pas de taux inventé).
 */

import { parseCsv } from './incident-import'
import { sanitizePertes, type DevisesConfig } from './pertes'

export interface IncidentCompta { id: string; intitule: string; pertes: unknown }
export type StatutRapprochement = 'OK' | 'ECART' | 'ABSENT_LDC' | 'ABSENT_COMPTA'
export interface LigneRapprochement { reference: string; incidentId: string | null; ldc: number; compta: number; ecart: number; statut: StatutRapprochement }
export interface ResultatRapprochement {
  lignes: LigneRapprochement[]
  erreurs: { ligne: number; error: 'montant_invalide' | 'reference_vide' | 'devise_sans_taux' }[]
  synthese: { ok: number; ecarts: number; absentsLdc: number; absentsCompta: number; ecartTotal: number }
  erreurGlobale?: 'fichier_vide' | 'colonnes_absentes'
}

const r2 = (n: number) => Math.round(n * 100) / 100
const norm = (s: string) => s.trim().toLowerCase()
const vide = (erreurGlobale: ResultatRapprochement['erreurGlobale']): ResultatRapprochement => ({ lignes: [], erreurs: [], synthese: { ok: 0, ecarts: 0, absentsLdc: 0, absentsCompta: 0, ecartTotal: 0 }, erreurGlobale })

export function rapprocherCompta(csv: string, incidents: IncidentCompta[], cfg: DevisesConfig, tolerance = 0.01): ResultatRapprochement {
  const rows = parseCsv(csv)
  if (rows.length === 0) return vide('fichier_vide')
  const head = rows[0].map(norm)
  const iRef = head.findIndex(h => h === 'reference' || h === 'référence' || h === 'incident')
  const iMont = head.findIndex(h => h === 'montant')
  const iDev = head.indexOf('devise')
  if (iRef < 0 || iMont < 0) return vide('colonnes_absentes')

  const index = new Map<string, IncidentCompta>()
  for (const i of incidents) { index.set(norm(i.id), i); if (!index.has(norm(i.intitule))) index.set(norm(i.intitule), i) }

  const erreurs: ResultatRapprochement['erreurs'] = []
  const compta = new Map<string, { reference: string; incident: IncidentCompta | null; total: number }>()
  rows.slice(1).forEach((cells, k) => {
    const ligne = k + 2
    const ref = (cells[iRef] ?? '').trim()
    if (!ref) { erreurs.push({ ligne, error: 'reference_vide' }); return }
    const m = Number((cells[iMont] ?? '').trim().replace(/\s/g, '').replace(',', '.'))
    if (!Number.isFinite(m)) { erreurs.push({ ligne, error: 'montant_invalide' }); return }
    const devise = ((iDev >= 0 ? cells[iDev] : '') ?? '').trim().toUpperCase() || cfg.deviseReference
    let conv = m
    if (devise !== cfg.deviseReference) {
      const t = cfg.taux[devise]
      if (typeof t !== 'number' || !(t > 0)) { erreurs.push({ ligne, error: 'devise_sans_taux' }); return }
      conv = m * t
    }
    const incident = index.get(norm(ref)) ?? null
    const cle = incident ? incident.id : `?${norm(ref)}`
    const c = compta.get(cle) ?? { reference: ref, incident, total: 0 }
    c.total += conv
    compta.set(cle, c)
  })

  const comptabilise = (i: IncidentCompta) => r2(sanitizePertes(i.pertes, cfg.deviseReference).filter(p => p.statut === 'COMPTABILISE')
    .reduce((s, p) => s + (p.devise === cfg.deviseReference ? p.montant : p.montant * (cfg.taux[p.devise] > 0 ? cfg.taux[p.devise] : 0)), 0))

  const lignes: LigneRapprochement[] = []
  for (const c of compta.values()) {
    const total = r2(c.total)
    if (!c.incident) { lignes.push({ reference: c.reference, incidentId: null, ldc: 0, compta: total, ecart: total, statut: 'ABSENT_LDC' }); continue }
    const ldc = comptabilise(c.incident)
    const ecart = r2(total - ldc)
    lignes.push({ reference: c.reference, incidentId: c.incident.id, ldc, compta: total, ecart, statut: Math.abs(ecart) <= tolerance ? 'OK' : 'ECART' })
  }
  for (const i of incidents) {
    if (compta.has(i.id)) continue
    const ldc = comptabilise(i)
    if (ldc > 0) lignes.push({ reference: i.intitule, incidentId: i.id, ldc, compta: 0, ecart: -ldc, statut: 'ABSENT_COMPTA' })
  }
  const n = (s: StatutRapprochement) => lignes.filter(l => l.statut === s).length
  return {
    lignes, erreurs,
    synthese: { ok: n('OK'), ecarts: n('ECART'), absentsLdc: n('ABSENT_LDC'), absentsCompta: n('ABSENT_COMPTA'), ecartTotal: r2(lignes.reduce((s, l) => s + l.ecart, 0)) },
  }
}
