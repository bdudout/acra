import { describe, it, expect } from 'vitest'
import { construireTableauBord, moisEcoule, type DonneesTableauBord } from '@/lib/tableau-bord-mensuel'

const now = new Date('2026-10-01T07:00:00Z')
const jour = (n: number) => new Date(now.getTime() + n * 86_400_000)
const tous = { registre: true, incidents: true, dora: true, controles: true, audit: true, kri: true, derogations: true }
const vide: DonneesTableauBord = {
  modules: tous, appetit: null, risques: [], plans: [], incidents: [], executions: [], constats: [], preconisations: [], kri: [], derogations: [],
  derogationAlerteJours: 30, decisionsEnAttente: 0,
}
const val = (t: ReturnType<typeof construireTableauBord>, cle: string) => t.indicateurs.find(i => i.cle === cle)?.valeur

describe('tableau de bord mensuel', () => {
  it('mois écoulé : bornes UTC et clé de période', () => {
    expect(moisEcoule(now)).toEqual({ debut: new Date('2026-09-01T00:00:00Z'), fin: new Date('2026-10-01T00:00:00Z'), periode: '2026-09' })
    expect(moisEcoule(new Date('2027-01-01T06:00:00Z')).periode).toBe('2026-12')
  })

  it('indicateurs des modules actifs uniquement, tons verts quand tout va bien', () => {
    const t = construireTableauBord({ ...vide, modules: { ...tous, incidents: false, kri: false, derogations: false } }, now)
    expect(t.indicateurs.map(i => i.cle)).toEqual(['risquesEleves', 'plansEnRetard', 'anomaliesMois', 'preconisationsEnRetard', 'recosEnRetard', 'constatsCritiques', 'decisionsEnAttente'])
    expect(t.indicateurs.every(i => i.ton === 'success')).toBe(true)
    expect(t.attention).toEqual([])
  })

  it('compte et nomme le plus important, le plus grave d’abord', () => {
    const t = construireTableauBord({
      ...vide,
      appetit: { seuilGlobal: 8, parCategorie: {} } as never,
      risques: [
        { intitule: 'Fraude au président', taxonomieCode: null, niveauInherent: 16, niveauResiduel: 12 },
        { intitule: 'Panne du SI paiements', taxonomieCode: null, niveauInherent: 20, niveauResiduel: 16 },
        { intitule: 'Risque faible', taxonomieCode: null, niveauInherent: 4, niveauResiduel: 2 },
      ],
      plans: [{ titre: 'MFA partout', statut: 'EN_COURS', echeance: jour(-10) }, { titre: 'Fait', statut: 'FAIT', echeance: jour(-30) }],
      incidents: [
        { intitule: 'Rançongiciel', statut: 'QUALIFIE', montantBrut: 50_000, recuperations: 10_000, doraCriteres: null },
        { intitule: 'Faux positif', statut: 'REJETE', montantBrut: 99_999, recuperations: 0, doraCriteres: null },
      ],
      executions: [{ resultat: 'CONFORME', dateRealisation: jour(-5) }, { resultat: 'ANOMALIE', dateRealisation: jour(-4) }],
      constats: [{ intitule: 'Comptes à privilèges', criticite: 4, statut: 'OUVERT', echeance: jour(20) }, { intitule: 'Journalisation', criticite: 2, statut: 'EN_COURS', echeance: jour(-3) }],
      kri: [{ intitule: 'Taux de phishing', sens: 'HAUSSE', seuilAlerte: 5, seuilCritique: 10, derniereValeur: 12 }],
      derogations: [{ intitule: 'TLS 1.0', statut: 'ACTIVE', dateFin: jour(10) }, { intitule: 'SMBv1', statut: 'ACTIVE', dateFin: jour(-2) }],
      decisionsEnAttente: 2,
    }, now)
    expect(val(t, 'risquesEleves')).toBe(2)
    expect(val(t, 'horsAppetit')).toBe(2)
    expect(val(t, 'plansEnRetard')).toBe(1)
    expect(val(t, 'incidentsMois')).toBe(1)
    expect(t.indicateurs.find(i => i.cle === 'perteNetteMois')).toMatchObject({ valeur: 40_000, unite: '€' })
    expect(t.indicateurs.find(i => i.cle === 'tauxConformite')).toMatchObject({ valeur: 50, unite: '%', ton: 'danger' })
    expect(val(t, 'recosEnRetard')).toBe(1)
    expect(val(t, 'constatsCritiques')).toBe(1)
    expect(val(t, 'kriEnAlerte')).toBe(1)
    expect(val(t, 'derogationsAExpirer')).toBe(1)
    expect(val(t, 'derogationsExpirees')).toBe(1)
    expect(val(t, 'decisionsEnAttente')).toBe(2)
    // Le risque le plus élevé d'abord ; tout le « danger » avant les avertissements ; pas de doublon risque/appétit.
    expect(t.attention[0]).toMatchObject({ type: 'RISQUE_ELEVE', intitule: 'Panne du SI paiements', niveau: 16 })
    expect(t.attention.map(a => a.type)).toEqual(['RISQUE_ELEVE', 'RISQUE_ELEVE', 'CONSTAT_CRITIQUE', 'KRI_CRITIQUE', 'DEROGATION_EXPIREE', 'PLAN_EN_RETARD', 'RECO_EN_RETARD', 'DEROGATION_A_EXPIRER'])
    expect(t.attention.find(a => a.type === 'PLAN_EN_RETARD')).toMatchObject({ intitule: 'MFA partout', date: jour(-10).toISOString().slice(0, 10) })
  })

  it('liste courte : au plus 3 par type et 12 en tout', () => {
    const risques = Array.from({ length: 10 }, (_, i) => ({ intitule: `R${i}`, taxonomieCode: null, niveauInherent: 20, niveauResiduel: 16 }))
    const plans = Array.from({ length: 10 }, (_, i) => ({ titre: `P${i}`, statut: 'A_FAIRE', echeance: jour(-i - 1) }))
    const t = construireTableauBord({ ...vide, risques, plans }, now)
    expect(t.attention.filter(a => a.type === 'RISQUE_ELEVE')).toHaveLength(3)
    expect(t.attention.filter(a => a.type === 'PLAN_EN_RETARD').map(a => a.intitule)).toEqual(['P9', 'P8', 'P7'])
    expect(val(t, 'risquesEleves')).toBe(10)
  })
})
