/** Gabarits sectoriels : réglages de départ cohérents, aperçu des changements, aucun verrouillage. */
import { describe, expect, it } from 'vitest'
import { GABARITS, gabaritParId, planGabarit } from '@/lib/gabarits'
import { CATALOGUE_REGIMES } from '@/lib/notification-regimes'
import { RAPPORT_CODES } from '@/lib/rapport-model'
import { VOCAB_TERMS } from '@/lib/vocabulaire'

const courant = {
  modules: { registreRisquesActive: false, incidentsActive: false, controlePermanentActive: false, auditInterneActive: false, kriActive: false, reglementaireActive: false, secondeLigneActive: true },
  regimesActifs: [] as string[], vocabulaire: {},
}

describe('catalogue de gabarits', () => {
  it('huit gabarits livrés, identifiants uniques', () => {
    expect(GABARITS.map(g => g.id)).toEqual(['BANQUE', 'ASSURANCE', 'NIS2', 'SANTE', 'PUBLIC', 'PME', 'SAAS', 'CABINET'])
    expect(new Set(GABARITS.map(g => g.id)).size).toBe(GABARITS.length)
    expect(gabaritParId('NOPE')).toBeNull()
  })
  it('références valides : régimes du catalogue, rapports du catalogue, termes de vocabulaire connus', () => {
    const regimes = new Set(CATALOGUE_REGIMES.map(r => r.code))
    for (const g of GABARITS) {
      for (const r of g.regimesActifs) expect(regimes.has(r), `${g.id} ${r}`).toBe(true)
      for (const r of g.rapports) expect((RAPPORT_CODES as readonly string[]).includes(r), `${g.id} ${r}`).toBe(true)
      for (const t of Object.keys(g.vocabulaire ?? {})) expect(t in VOCAB_TERMS, `${g.id} ${t}`).toBe(true)
    }
  })
  it('banque : chaîne complète des trois lignes de défense ; PME : incidents seuls, ligne unique', () => {
    const banque = gabaritParId('BANQUE')!
    expect(banque.modules).toMatchObject({ incidentsActive: true, controlePermanentActive: true, auditInterneActive: true, kriActive: true, registreRisquesActive: true })
    expect(banque.regimesActifs).toContain('RGPD_33')
    const pme = gabaritParId('PME')!
    expect(pme.modules).toMatchObject({ incidentsActive: true, controlePermanentActive: false, auditInterneActive: false, secondeLigneActive: false })
  })
})

describe('planGabarit', () => {
  it('aperçu : uniquement ce qui change ; modules, régimes et vocabulaire', () => {
    const p = planGabarit('SANTE', courant)!
    expect(p.changements.some(c => c.type === 'MODULE' && c.cle === 'incidentsActive' && c.apres === true)).toBe(true)
    expect(p.changements.some(c => c.type === 'REGIME' && c.cle === 'RGPD_33')).toBe(true)
    expect(p.changements.every(c => c.avant !== c.apres)).toBe(true)
    expect(p.patch.modules.incidentsActive).toBe(true)
  })
  it('déjà appliqué : aucun changement ; un vocabulaire déjà personnalisé n’est pas écrasé', () => {
    const sante = gabaritParId('SANTE')!
    const deja = { modules: { ...courant.modules, ...sante.modules }, regimesActifs: [...sante.regimesActifs], vocabulaire: sante.vocabulaire ?? {} }
    expect(planGabarit('SANTE', deja)!.changements).toEqual([])
    const perso = planGabarit('SANTE', { ...courant, vocabulaire: { incident: { '*': 'Mon terme' } } })!
    expect(perso.patch.vocabulaire.incident).toEqual({ '*': 'Mon terme' })
  })
  it('gabarit inconnu → null', () => {
    expect(planGabarit('NOPE', courant)).toBeNull()
  })
})
