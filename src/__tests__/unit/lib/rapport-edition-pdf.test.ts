// @vitest-environment node
// Rendu réel du PDF d'une édition de rapport (react-pdf) : sections vides, chaînes vides, 5 langues.
import { describe, expect, it } from 'vitest'
import { renderRapportEditionPDF } from '@/lib/rapport-edition-pdf-template'
import type { DocumentRapport } from '@/lib/rapport-render'

const doc: DocumentRapport = {
  titre: 'Tableau de bord des incidents', sousTitre: '2026-09-01 → 2026-09-30', intro: '',
  sections: [
    { titre: 'Synthèse', kpis: [{ label: 'Total', valeur: '3', alerte: false }, { label: 'En retard', valeur: '2', alerte: true }], tables: [], textes: [] },
    { titre: 'Notifications', kpis: [], tables: [{ colonnes: ['Incident', 'Régime', 'Échéance'], lignes: [['Incident a', 'NIS2', ''], ['', '', '']] }, { colonnes: ['A'], lignes: [] }], textes: ['Avertissement'] },
  ],
}

describe('renderRapportEditionPDF', () => {
  it('produit un vrai PDF (KPI, tableaux dont vide, textes, cellules vides)', async () => {
    const buf = await renderRapportEditionPDF(doc, 'fr', '2026-10-02')
    expect(buf.subarray(0, 4).toString()).toBe('%PDF')
    expect(buf.length).toBeGreaterThan(1500)
  }, 30000)
  it('document sans section : pas d’erreur de rendu, chaque langue', async () => {
    for (const l of ['fr', 'en', 'de', 'es', 'it']) {
      const buf = await renderRapportEditionPDF({ titre: 'T', sousTitre: '', sections: [] }, l, '2026-10-02')
      expect(buf.subarray(0, 4).toString()).toBe('%PDF')
    }
  }, 60000)
})
