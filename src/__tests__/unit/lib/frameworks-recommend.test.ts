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
  it('Informatique / Numérique et E-commerce → NIST SSDF (DevSecOps) recommandé', () => {
    expect(recommendedFrameworksForSector('Informatique / Numérique')).toContain('NIST_SSDF')
    expect(recommendedFrameworksForSector('E-commerce / Marketplace')).toContain('NIST_SSDF')
  })
  it('Agriculture / Immobilier / Médias / Associations → ANSSI Hygiène', () => {
    for (const s of ['Agriculture / Agroalimentaire', 'Immobilier / Construction', 'Médias / Culture', 'Associations / ESS']) {
      expect(recommendedFrameworksForSector(s)).toContain('ANSSI_HYG')
    }
  })

  // ── Affinage par sous-secteur (issue #25) ──────────────────────────────────
  it('sous-secteur « éditeur de logiciel santé » → fait remonter le dév. sécurisé', () => {
    const r = recommendedFrameworksForSector('Santé / Médico-social', null, 'sante-editeur')
    expect(r).toContain('NIST_SSDF')
    expect(r).toContain('SOC2')
    expect(r).toContain('HDS') // le socle santé reste présent
  })
  it('sous-secteur « fintech / paiement » → PCI-DSS en priorité', () => {
    expect(recommendedFrameworksForSector('Banque / Finance', null, 'banque-fintech')[0]).toBe('PCI_DSS')
  })
  it('sous-secteur « industrie de process / nucléaire » → IEC 62443 en priorité', () => {
    expect(recommendedFrameworksForSector('Industrie / Manufacturing', null, 'industrie-process')[0]).toBe('IEC_62443')
    expect(recommendedFrameworksForSector('Énergie / Utilities', null, 'energie-nucleaire')[0]).toBe('IEC_62443')
  })
  it('sous-secteur absent ou neutre → recommandation inchangée', () => {
    expect(recommendedFrameworksForSector('Santé / Médico-social', null, undefined)[0]).toBe('HDS')
    expect(recommendedFrameworksForSector('Santé / Médico-social', null, 'sante-hopital')[0]).toBe('HDS')
  })
  it('aucun doublon de framework après affinage', () => {
    const r = recommendedFrameworksForSector('Santé / Médico-social', null, 'sante-editeur')
    expect(r.length).toBe(new Set(r).size)
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

  it('NIST SSDF : méta + contrôles + 4 groupes de pratiques (PO/PS/PW/RV)', () => {
    expect(FRAMEWORK_META.NIST_SSDF.nom).toMatch(/SSDF/)
    const ctrls = getFrameworkControles('NIST_SSDF')
    expect(ctrls.length).toBeGreaterThanOrEqual(12)
    const cats = getFrameworkCategories('NIST_SSDF')
    expect(Object.keys(cats).sort()).toEqual(['PO', 'PS', 'PW', 'RV'])
    for (const c of ctrls) expect(cats[c.categorie]).toBeTruthy()
    // couvre les pratiques DevSecOps clés
    const txt = ctrls.map(c => `${c.nom} ${c.description}`).join(' ').toLowerCase()
    for (const kw of ['sast', 'dast', 'sbom', 'sca', 'secret']) expect(txt).toContain(kw)
  })

  // ── Adaptation à la taille de l'organisation (issue #37) ────────────────────
  it('STANDARD (défaut) ne modifie pas la recommandation sectorielle', () => {
    expect(recommendedFrameworksForSector('Banque / Finance', 'STANDARD'))
      .toEqual(recommendedFrameworksForSector('Banque / Finance'))
  })
  it('TPE place ANSSI Hygiène + CIS v8 en tête (socle atteignable)', () => {
    const r = recommendedFrameworksForSector('Banque / Finance', 'TPE')
    expect(r.slice(0, 2)).toEqual(['ANSSI_HYG', 'CIS_V8'])
    expect(r).toContain('DORA') // la reco sectorielle reste présente
    expect(new Set(r).size).toBe(r.length) // pas de doublon
  })
  it('PME place ANSSI Hygiène en tête', () => {
    expect(recommendedFrameworksForSector('Industrie / Manufacturing', 'PME')[0]).toBe('ANSSI_HYG')
  })
  it('ETI_GE conserve la recommandation sectorielle complète', () => {
    expect(recommendedFrameworksForSector('Santé / Médico-social', 'ETI_GE'))
      .toEqual(recommendedFrameworksForSector('Santé / Médico-social'))
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
