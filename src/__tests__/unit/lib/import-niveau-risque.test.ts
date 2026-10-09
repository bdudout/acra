// B-IMP-09 — Niveau de risque d'un fichier importé : ACRA le recalcule (gravité × vraisemblance, matrice de l'organisation) ;
// la valeur du fichier est ignorée et, si elle diverge, un avertissement est ajouté au bilan (jamais de correction silencieuse).
import { describe, expect, it } from 'vitest'
import { divergencesNiveauRisque } from '@/lib/import-niveau-risque'
import type { ScaleConfig } from '@/lib/risk-scale'

const risque = (o: Record<string, unknown>) => ({ title: 'Fraude au président', ...o })

describe('divergencesNiveauRisque', () => {
  it('niveau « 8 » pour gravité 3 × vraisemblance 2 (= 6) : avertissement', () => {
    expect(divergencesNiveauRisque([risque({ externalId: 'R1', gravity: 3, likelihood: 2, riskLevel: '8' })])).toEqual(['risk_level_differs:R1:8:6'])
  })
  it('niveau cohérent (6), ou décimal équivalent (6,0) : aucun avertissement', () => {
    expect(divergencesNiveauRisque([risque({ externalId: 'R1', gravity: 3, likelihood: 2, riskLevel: '6' }), risque({ externalId: 'R2', gravity: 3, likelihood: 2, riskLevel: '6,0' })])).toEqual([])
  })
  it('sans niveau, sans gravité ou sans vraisemblance dans le fichier : rien à comparer', () => {
    expect(divergencesNiveauRisque([risque({ gravity: 3, likelihood: 2 }), risque({ likelihood: 2, riskLevel: '8' }), risque({ gravity: 3, riskLevel: '8' })])).toEqual([])
  })
  it('niveau en libellé : comparé au palier de la matrice (accents et casse ignorés)', () => {
    // Paliers par défaut : 6 → « Modéré » (4–7), 12 → « Critique ».
    expect(divergencesNiveauRisque([risque({ externalId: 'R1', gravity: 3, likelihood: 2, riskLevel: 'modere' })])).toEqual([])
    expect(divergencesNiveauRisque([risque({ externalId: 'R2', gravity: 3, likelihood: 2, riskLevel: 'Critique' })])).toEqual(['risk_level_differs:R2:Critique:Modéré'])
  })
  it('libellé inconnu de la matrice (autre vocabulaire) : pas de faux avertissement', () => {
    expect(divergencesNiveauRisque([risque({ externalId: 'R1', gravity: 3, likelihood: 2, riskLevel: 'Rouge' })])).toEqual([])
  })
  it('matrice de l’organisation : paliers personnalisés et mode qualitatif', () => {
    const seuilsMatrice = [{ scoreMin: 1, scoreMax: 5, label: 'Bas', couleur: '#0f0' }, { scoreMin: 6, scoreMax: 16, label: 'Haut', couleur: '#f00' }]
    expect(divergencesNiveauRisque([risque({ externalId: 'R1', gravity: 3, likelihood: 2, riskLevel: 'Bas' })], { seuilsMatrice })).toEqual(['risk_level_differs:R1:Bas:Haut'])
    const qualitative: Partial<ScaleConfig> = { seuilsMatrice, matriceMode: 'QUALITATIVE', matriceQualitative: [{ gravite: 3, vraisemblance: 2, seuilLabel: 'Bas' }] }
    expect(divergencesNiveauRisque([risque({ externalId: 'R1', gravity: 3, likelihood: 2, riskLevel: 'Bas' })], qualitative)).toEqual([])
  })
  it('sans référence : l’intitulé désigne le risque ; les « : » sont neutralisés (séparateur du code)', () => {
    expect(divergencesNiveauRisque([risque({ title: 'Risque : fuite', gravity: 2, likelihood: 2, riskLevel: '9' })])).toEqual(['risk_level_differs:Risque – fuite:9:4'])
  })
})
