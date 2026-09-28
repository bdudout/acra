// @vitest-environment node
// P4 — rendu réel du rapport PDF (react-pdf), y compris registre vide et 5 langues.
import { describe, expect, it } from 'vitest'
import { resolveScaleConfig } from '@/lib/risk-scale'
import { APPETIT_DEFAULT } from '@/lib/appetit'
import { buildDirectReport } from '@/lib/rapport-methode-directe'
import { renderDirectReportPDF } from '@/lib/rapport-methode-directe-pdf-template'

const ctx = { scale: resolveScaleConfig(null), appetit: { seuilGlobal: 9, parCategorie: {} } }
const full = buildDirectReport({
  analyse: { nom: 'SI Santé', methode: 'NIST_800_30', cadrage: { perimetre: 'DPI', objectifsEtude: null } },
  risques: [{ id: 'a', nom: 'Rançongiciel', gravite: 4, vraisemblance: 3, niveauRisque: 12, strategie: 'REDUIRE', proprietaire: 'DSI', vulnerabilites: [{ description: 'RDP exposé' }] }],
  mesures: [{ nom: 'Sauvegardes', statut: 'REALISE', efficacite: 3, echeance: null, responsable: null, risqueId: 'a' }],
  plans: [{ titre: 'MFA', statut: 'A_FAIRE', priorite: 'MAJEUR', echeance: new Date('2026-12-01'), porteur: '', risqueIds: ['a'] }],
}, ctx)

describe('renderDirectReportPDF', () => {
  it('produit un vrai PDF (registre, vulnérabilités, mesures, plans)', async () => {
    const buf = await renderDirectReportPDF(full, 'fr', '2026-09-28')
    expect(buf.subarray(0, 4).toString()).toBe('%PDF')
    expect(buf.length).toBeGreaterThan(2000)
  }, 30000)

  it('analyse vide et chaque langue : pas d’erreur de rendu (chaînes vides gardées)', async () => {
    const empty = buildDirectReport({ analyse: { nom: 'Vide', methode: 'ISO_31000', cadrage: null }, risques: [], mesures: [], plans: [] }, { scale: resolveScaleConfig(null), appetit: APPETIT_DEFAULT })
    for (const l of ['fr', 'en', 'de', 'es', 'it']) {
      const buf = await renderDirectReportPDF(empty, l, '2026-09-28')
      expect(buf.subarray(0, 4).toString()).toBe('%PDF')
    }
  }, 60000)
})
