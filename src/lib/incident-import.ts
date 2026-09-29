/**
 * incident-import.ts — Import CSV d'incidents (lot L1, B-INC-5). Module PUR.
 * Sources visées : historique tableur, export SIEM/ITSM. Chaque ligne est validée par les mêmes
 * règles que la déclaration (`validateIncidentInput` / `cleanIncidentInput`) ; les lignes invalides
 * sont remontées par numéro et l'import continue. Plafond de lignes borné.
 */

import { validateIncidentInput, cleanIncidentInput, type CleanIncident, type IncidentInput, type IncidentCleanConfig } from './incident'

export const MAX_LIGNES_IMPORT = 500

/** Découpe un CSV (séparateur `;` ou `,` détecté sur l'en-tête ; guillemets, BOM, CRLF gérés). */
export function parseCsv(texte: string): string[][] {
  const src = texte.replace(/^﻿/, '')
  if (!src.trim()) return []
  const premiere = src.split(/\r?\n/)[0]
  const sep = (premiere.match(/;/g)?.length ?? 0) >= (premiere.match(/,/g)?.length ?? 0) && premiere.includes(';') ? ';' : ','
  const lignes: string[][] = []
  let champ = ''; let ligne: string[] = []; let entre = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (entre) {
      if (c === '"') { if (src[i + 1] === '"') { champ += '"'; i++ } else entre = false } else champ += c
    } else if (c === '"') entre = true
    else if (c === sep) { ligne.push(champ); champ = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      ligne.push(champ); champ = ''
      if (ligne.some(x => x !== '') || ligne.length > 1) lignes.push(ligne)
      ligne = []
    } else champ += c
  }
  if (champ !== '' || ligne.length) { ligne.push(champ); if (ligne.some(x => x !== '')) lignes.push(ligne) }
  return lignes
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')
const ALIAS: Record<string, keyof IncidentInput> = {
  intitule: 'intitule', title: 'intitule', libelle: 'intitule', nom: 'intitule', incident: 'intitule',
  description: 'description', detail: 'description',
  datesurvenance: 'dateSurvenance', datedesurvenance: 'dateSurvenance', survenance: 'dateSurvenance', occurred: 'dateSurvenance', dateoccurrence: 'dateSurvenance',
  datedetection: 'dateDetection', datededetection: 'dateDetection', detection: 'dateDetection', detected: 'dateDetection',
  entite: 'entite', entity: 'entite', typeevenement: 'typeEvenement', type: 'typeEvenement',
  impactestime: 'impactEstime', impact: 'impactEstime', montantbrut: 'montantBrut', pertebrute: 'montantBrut', gross: 'montantBrut', montant: 'montantBrut',
  recuperations: 'recuperations', recovery: 'recuperations', quasiincident: 'quasiIncident', nearmiss: 'quasiIncident',
  taxonomiecode: 'taxonomieCode', categorie: 'taxonomieCode', category: 'taxonomieCode',
  datereglement: 'dateReglement', datedereglement: 'dateReglement', reglement: 'dateReglement',
}
const VRAI = new Set(['1', 'oui', 'yes', 'true', 'vrai', 'x'])

/** Nombre au format français (« 1 250,50 »), anglais ou brut → nombre ; vide → undefined. */
function nombre(v: string): number | undefined {
  const t = v.replace(/[\s  ]/g, '').replace(',', '.')
  if (t === '') return undefined
  return Number(t)
}

export interface ResultatImport { valides: CleanIncident[]; erreurs: { ligne: number; error: string }[]; tronque: boolean; erreurGlobale?: 'fichier_vide' | 'colonne_intitule_absente' }

export function preparerImportIncidents(texte: string, cfg: IncidentCleanConfig): ResultatImport {
  const rows = parseCsv(texte)
  if (rows.length === 0) return { valides: [], erreurs: [], tronque: false, erreurGlobale: 'fichier_vide' }
  const colonnes = rows[0].map(h => ALIAS[norm(h)] ?? null)
  if (!colonnes.includes('intitule')) return { valides: [], erreurs: [], tronque: false, erreurGlobale: 'colonne_intitule_absente' }
  const corps = rows.slice(1)
  const tronque = corps.length > MAX_LIGNES_IMPORT
  const valides: CleanIncident[] = []
  const erreurs: { ligne: number; error: string }[] = []
  corps.slice(0, MAX_LIGNES_IMPORT).forEach((cells, idx) => {
    const input: IncidentInput = {}
    colonnes.forEach((champ, i) => {
      const brut = (cells[i] ?? '').trim()
      if (!champ || brut === '') return
      if (champ === 'montantBrut' || champ === 'recuperations') { const n = nombre(brut); if (n !== undefined) input[champ] = n; return }
      if (champ === 'quasiIncident') { input.quasiIncident = VRAI.has(norm(brut)); return }
      (input as Record<string, unknown>)[champ] = brut
    })
    const erreur = validateIncidentInput(input, cfg)
    if (erreur) erreurs.push({ ligne: idx + 2, error: erreur })
    else valides.push(cleanIncidentInput(input, cfg))
  })
  return { valides, erreurs, tronque }
}
