import { describe, it, expect } from 'vitest'
import { recommendedFrameworksForSector, FRAMEWORK_IDS, FRAMEWORK_META, getFrameworkControles, getFrameworkCategories } from '@/lib/frameworks-data'
import { SECTEURS_ACTIVITE } from '@/lib/ebios-data'

// Suggestion automatique du référentiel selon le secteur (improvements-priority.md 🔴).

describe('recommendedFrameworksForSector', () => {
  it('Banque / Finance → DORA en priorité, puis PCI-DSS', () => {
    const r = recommendedFrameworksForSector('Banque / Finance')
    expect(r[0]).toBe('DORA')
    expect(r).toContain('PCI_DSS')
  })

  it('Santé / Médico-social → HDS en priorité', () => {
    expect(recommendedFrameworksForSector('Santé / Médico-social')[0]).toBe('HDS')
  })

  it('Défense → NIST 800-53 + ANSSI', () => {
    const r = recommendedFrameworksForSector('Défense / Sécurité nationale')
    expect(r).toContain('NIST_800_53')
    expect(r).toContain('ANSSI_HYG')
  })

  it('Commerce / Distribution → PCI-DSS', () => {
    expect(recommendedFrameworksForSector('Commerce / Distribution')).toContain('PCI_DSS')
  })

  it('Industrie / Énergie / Transports → IEC 62443 en priorité (OT/ICS)', () => {
    expect(recommendedFrameworksForSector('Industrie / Manufacturing')[0]).toBe('IEC_62443')
    expect(recommendedFrameworksForSector('Énergie / Utilities')[0]).toBe('IEC_62443')
    expect(recommendedFrameworksForSector('Transports / Logistique')[0]).toBe('IEC_62443')
  })

  it('insensible à la casse et aux variantes (mots-clés)', () => {
    expect(recommendedFrameworksForSector('banque de détail')[0]).toBe('DORA')
    expect(recommendedFrameworksForSector('Healthcare')[0]).toBe('HDS')
  })

  it('secteur inconnu / vide → repli ISO 27001', () => {
    expect(recommendedFrameworksForSector('')).toEqual(['ISO27001'])
    expect(recommendedFrameworksForSector(null)).toEqual(['ISO27001'])
    expect(recommendedFrameworksForSector('Secteur exotique')).toEqual(['ISO27001'])
  })

  it('ne recommande que des ids de framework valides (jamais CUSTOM)', () => {
    for (const sec of ['Banque / Finance', 'Santé / Médico-social', 'Énergie / Utilities', 'Autre']) {
      for (const fid of recommendedFrameworksForSector(sec)) {
        expect(FRAMEWORK_IDS).toContain(fid)
        expect(fid).not.toBe('CUSTOM')
      }
    }
  })

  // ── Secteurs ajoutés (expansion NIS2 + compléments FR) ──────────────────────
  it('Professions juridiques → ANSSI Hygiène + ISO 27001', () => {
    const r = recommendedFrameworksForSector("Professions juridiques / Cabinet d'avocats")
    expect(r).toEqual(['ANSSI_HYG', 'ISO27001'])
  })
  it('E-commerce → PCI-DSS (paiement)', () => {
    expect(recommendedFrameworksForSector('E-commerce / Marketplace')).toContain('PCI_DSS')
  })
  it('Eau / Assainissement → IEC 62443 (OT)', () => {
    expect(recommendedFrameworksForSector('Eau / Assainissement')[0]).toBe('IEC_62443')
  })
  it('Tourisme / Hôtellerie → PCI-DSS', () => {
    expect(recommendedFrameworksForSector('Tourisme / Hôtellerie-restauration')).toContain('PCI_DSS')
  })
  it('Informatique / Numérique et E-commerce → SOC 2 recommandé', () => {
    expect(recommendedFrameworksForSector('Informatique / Numérique')).toContain('SOC2')
    expect(recommendedFrameworksForSector('E-commerce / Marketplace')).toContain('SOC2')
  })
  it('Agriculture / Immobilier / Médias / Associations → ANSSI Hygiène', () => {
    for (const s of ['Agriculture / Agroalimentaire', 'Immobilier / Construction', 'Médias / Culture', 'Associations / ESS']) {
      expect(recommendedFrameworksForSector(s)).toContain('ANSSI_HYG')
    }
  })

  // ── SOC 2 : contenu du référentiel ──────────────────────────────────────────
  it('SOC 2 : méta + contrôles + catégories cohérents', () => {
    expect(FRAMEWORK_META.SOC2.nom).toMatch(/SOC 2/)
    const ctrls = getFrameworkControles('SOC2')
    expect(ctrls.length).toBeGreaterThan(10)
    const cats = getFrameworkCategories('SOC2')
    // les 5 Trust Services Criteria
    expect(Object.keys(cats).sort()).toEqual(['A', 'C', 'CC', 'P', 'PI'])
    // chaque contrôle pointe vers une catégorie déclarée
    for (const c of ctrls) expect(cats[c.categorie]).toBeTruthy()
  })

  // Garde-fou : chaque secteur du référentiel reçoit une recommandation valide,
  // et seul « Autre » tombe sur le repli générique ISO 27001 seul.
  it('chaque secteur de SECTEURS_ACTIVITE renvoie des frameworks valides', () => {
    for (const sec of SECTEURS_ACTIVITE) {
      const r = recommendedFrameworksForSector(sec)
      expect(r.length).toBeGreaterThan(0)
      for (const fid of r) {
        expect(FRAMEWORK_IDS).toContain(fid)
        expect(fid).not.toBe('CUSTOM')
      }
      if (sec !== 'Autre') {
        // un secteur connu doit matcher une branche dédiée (≠ repli ISO seul),
        // sauf cas où la reco dédiée est précisément ISO seul — ici aucun.
        expect(r).not.toEqual(['ISO27001'])
      }
    }
  })
})
