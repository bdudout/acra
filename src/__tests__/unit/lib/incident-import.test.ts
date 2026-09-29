/** Import CSV d'incidents (historique, SIEM, ITSM) : parsing, alias d'en-têtes, validation par ligne. */
import { describe, expect, it } from 'vitest'
import { parseCsv, preparerImportIncidents, MAX_LIGNES_IMPORT } from '@/lib/incident-import'
import { resolveIncidentsConfig } from '@/lib/incidents-config'

const cfg = resolveIncidentsConfig({ deviseReference: 'EUR' })

describe('parseCsv', () => {
  it('détecte ; ou , ; gère guillemets, virgules internes, retours ligne, BOM et CRLF', () => {
    expect(parseCsv('﻿a;b\r\n1;"x;y"\r\n"multi\nligne";3\r\n')).toEqual([['a', 'b'], ['1', 'x;y'], ['multi\nligne', '3']])
    expect(parseCsv('a,b\n1,"x, y"\n')).toEqual([['a', 'b'], ['1', 'x, y']])
    expect(parseCsv('a;b\n"il a dit ""oui""";2')).toEqual([['a', 'b'], ['il a dit "oui"', '2']])
    expect(parseCsv('')).toEqual([])
  })
})

describe('preparerImportIncidents', () => {
  it('alias FR/EN des colonnes, montants à virgule décimale, dates, booléens', () => {
    const csv = 'Intitulé;Date de survenance;Montant brut;Quasi-incident;Type\nPhishing RH;2026-03-02;1 250,50;non;CYBER\nClé USB perdue;2026-03-05;;oui;CYBER'
    const r = preparerImportIncidents(csv, cfg)
    expect(r.erreurs).toEqual([])
    expect(r.valides).toHaveLength(2)
    expect(r.valides[0]).toMatchObject({ intitule: 'Phishing RH', montantBrut: 1250.5, typeEvenement: 'CYBER', quasiIncident: false })
    expect(r.valides[0].dateSurvenance?.toISOString().slice(0, 10)).toBe('2026-03-02')
    expect(r.valides[1]).toMatchObject({ quasiIncident: true, montantBrut: null })
  })
  it('lignes invalides remontées par numéro (l’import continue) : intitulé manquant, date invalide, type inconnu', () => {
    const csv = 'title,dateSurvenance,typeEvenement\nOK,2026-01-01,CYBER\n,2026-01-01,CYBER\nMauvaise date,nope,CYBER\nType inconnu,2026-01-01,LICORNE'
    const r = preparerImportIncidents(csv, cfg)
    expect(r.valides.map(v => v.intitule)).toEqual(['OK'])
    expect(r.erreurs).toEqual([{ ligne: 3, error: 'intitule_requis' }, { ligne: 4, error: 'date_invalide' }, { ligne: 5, error: 'type_evenement_invalide' }])
  })
  it('en-tête sans colonne intitulé → erreur globale ; plafond de lignes ; fichier vide', () => {
    expect(preparerImportIncidents('a;b\n1;2', cfg).erreurGlobale).toBe('colonne_intitule_absente')
    expect(preparerImportIncidents('', cfg).erreurGlobale).toBe('fichier_vide')
    const gros = 'intitule\n' + Array.from({ length: MAX_LIGNES_IMPORT + 5 }, (_, i) => `I${i}`).join('\n')
    const r = preparerImportIncidents(gros, cfg)
    expect(r.valides).toHaveLength(MAX_LIGNES_IMPORT)
    expect(r.tronque).toBe(true)
  })
  it('protège contre l’injection de formule : le texte importé est conservé tel quel mais jamais exécuté (stockage)', () => {
    const r = preparerImportIncidents('intitule\n=CMD|calc', cfg)
    expect(r.valides[0].intitule).toBe('=CMD|calc') // neutralisé à l’export (spreadsheet-safe), pas altéré en base
  })
})
