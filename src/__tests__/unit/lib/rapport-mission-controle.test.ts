import { describe, it, expect } from 'vitest'
import { fr } from '@/lib/i18n/fr'
import { rapportMissionControleMarkdown, synthetiserMission, type MissionControleRapportData } from '@/lib/rapport-mission-controle'

const L = { ...fr.campagneControle.rapportControle, statutsMission: fr.campagneControle.statutOpt, statutsPreco: fr.questionnaires.statutsPreco }

const data: MissionControleRapportData = {
  mission: { intitule: 'Mission T3', description: 'Revue des accès', niveau: 'N2', statut: 'EN_COURS', dateDebut: new Date('2026-07-01'), dateFin: new Date('2026-09-30') },
  controles: [{ intitule: 'Revue | des droits', conformes: 2, anomalies: 1, nonApplicables: 1 }],
  questionnaires: [{ titre: 'Questionnaire RGPD', total: 4, soumises: 3, revues: 2, nonConformes: [{ question: 'Registre tenu ?', cible: 'RGPD art30' }] }],
  preconisations: [
    { intitule: 'Tenir le registre', criticite: 3, responsable: 'DPO', echeance: new Date('2026-12-31'), statut: 'EN_COURS', exigence: 'RGPD art30', plans: ['PA registre'], acceptation: null },
    { intitule: 'Chiffrer', criticite: 2, responsable: null, echeance: null, statut: 'ACCEPTE', exigence: null, plans: [], acceptation: 'Coût disproportionné' },
  ],
}

describe('rapport de mission de contrôle', () => {
  it('synthétise exécutions, taux de réponse, non-conformités et préconisations ouvertes', () => {
    expect(synthetiserMission(data)).toEqual({ controles: 1, executions: 4, anomalies: 1, questionnaires: 1, tauxReponse: 75, nonConformites: 1, preconisations: 2, ouvertes: 1 })
    expect(synthetiserMission({ ...data, questionnaires: [] }).tauxReponse).toBeNull()
  })

  it('produit les sections, échappe les tableaux et trace les acceptations de risque', () => {
    const md = rapportMissionControleMarkdown(data, L, 'fr-FR', new Date('2026-10-01'))
    expect(md).toContain('# Rapport de contrôle — Mission T3')
    expect(md).toContain('| Taux de réponse | 75 % |')
    expect(md).toContain('Revue ¦ des droits')
    expect(md).toContain('| Questionnaire RGPD | Registre tenu ? | RGPD art30 |')
    expect(md).toContain('Tenir le registre (RGPD art30)')
    expect(md).toContain('PA registre')
    expect(md).toContain('Risque accepté — acceptation : Coût disproportionné')
    expect(md).toContain('## Conclusions du contrôleur')
  })

  it('indique l’absence d’éléments sans section de non-conformités', () => {
    const md = rapportMissionControleMarkdown({ ...data, controles: [], questionnaires: [], preconisations: [] }, L, 'fr-FR', new Date())
    expect(md).not.toContain('## Non-conformités')
    expect(md.match(/Aucun élément\./g)).toHaveLength(3)
  })
})
