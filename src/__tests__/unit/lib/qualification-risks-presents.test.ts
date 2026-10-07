/** Risques proposés par la qualification : ne pas proposer un risque déjà présent dans l'analyse (phase 3 du projet). */
import { describe, expect, it } from 'vitest'
import { propositionsDejaPresentes } from '@/lib/qualification-risks'

const p = (id: string, title: string) => ({ id, title })

describe('propositionsDejaPresentes', () => {
  it('même règle, même intitulé (casse, accents, apostrophes, espaces) ou risque par défaut équivalent', () => {
    const proposals = [
      p('p360-compromissionExpose', 'Compromission d’un service exposé sur Internet'),
      p('p360-derivePlanning', 'Dérive du planning'),
      p('p360-defaillancePrestataire', 'Défaillance d’un prestataire critique'),
      p('p360-obsolescence', 'Obsolescence technique'),
      p('p360-fuiteDonnees', 'Fuite de données sensibles'),
    ]
    const risques = [
      { nom: "  compromission d'un SERVICE expose sur internet ", qualificationRuleId: null }, // importé d'une analyse cyber
      { nom: 'Dérive du planning : le projet ne tient pas ses jalons', qualificationRuleId: 'socle:PROJ_DELAIS' },
      { nom: 'Défaillance d’un prestataire ou d’un fournisseur clé du projet', qualificationRuleId: 'socle:PROJ_PRESTATAIRE' },
      { nom: 'Autre', qualificationRuleId: 'p360-obsolescence' },
      { nom: 'Traitement de données personnelles non conforme au RGPD', qualificationRuleId: 'socle:PROJ_RGPD' },
    ]
    const presents = propositionsDejaPresentes(proposals, risques)
    expect([...presents].sort()).toEqual(['p360-compromissionExpose', 'p360-defaillancePrestataire', 'p360-derivePlanning', 'p360-obsolescence'])
    // Fuite de données ≠ conformité RGPD : reste proposé.
    expect(presents.has('p360-fuiteDonnees')).toBe(false)
  })
  it('un risque par défaut supprimé du projet ne bloque plus la proposition équivalente', () => {
    expect(propositionsDejaPresentes([p('p360-derivePlanning', 'Dérive du planning')], []).size).toBe(0)
  })
})
