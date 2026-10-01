import { describe, it, expect } from 'vitest'
import { emailLocale, relancesEmail, tableauBordEmail } from '@/lib/email-i18n'

describe('emailLocale', () => {
  it('normalise vers une locale supportée, repli fr', () => {
    expect(emailLocale('en')).toBe('en')
    expect(emailLocale('it')).toBe('it')
    expect(emailLocale('xx')).toBe('fr')
    expect(emailLocale(null)).toBe('fr')
    expect(emailLocale(undefined)).toBe('fr')
  })
})

describe('tableauBordEmail — tableau de bord mensuel', () => {
  const sections = [
    { organisation: 'Banque <Groupe>', indicateurs: [
      { cle: 'risquesEleves' as const, valeur: 2, ton: 'danger' as const },
      { cle: 'perteNetteMois' as const, valeur: 40000, unite: '€' as const, ton: 'warning' as const },
      { cle: 'tauxConformite' as const, valeur: 92, unite: '%' as const, ton: 'success' as const },
    ], attention: [
      { type: 'RISQUE_ELEVE' as const, intitule: 'Panne <SI> paiements', niveau: 16, ton: 'danger' as const },
      { type: 'PLAN_EN_RETARD' as const, intitule: 'MFA partout', date: '2026-09-15', ton: 'warning' as const },
      { type: 'DEROGATION_A_EXPIRER' as const, intitule: 'TLS 1.0', date: '2026-10-20', ton: 'warning' as const },
    ] },
    { organisation: 'Assurance', indicateurs: [{ cle: 'decisionsEnAttente' as const, valeur: 0, ton: 'success' as const }], attention: [] },
  ]
  it('une section par organisation : indicateurs formatés, points d’attention détaillés, rien à signaler sinon', () => {
    const m = tableauBordEmail('fr', { mois: new Date('2026-09-01T00:00:00Z'), sections, url: 'https://acra.test/pilotage' })
    expect(m.subject).toBe('[ACRA] Tableau de bord — septembre 2026')
    expect(m.text).toContain('■ Banque <Groupe>')
    expect(m.text).toMatch(/Perte nette du mois : 40\s000 €/)
    expect(m.text).toContain('Contrôles conformes : 92 %')
    expect(m.text).toContain('• Risque élevé — Panne <SI> paiements (niveau 16)')
    expect(m.text).toContain('• Plan d’action en retard — MFA partout (échéance le 2026-09-15)')
    expect(m.text).toContain('• Dérogation à expirer — TLS 1.0 (fin le 2026-10-20)')
    expect(m.text).toContain('■ Assurance')
    expect(m.text).toContain('Aucun point d’attention ce mois-ci.')
    expect(m.html).toContain('Banque &lt;Groupe&gt;')
    expect(m.html).toContain('Panne &lt;SI&gt; paiements')
    expect(m.html.includes('<SI>')).toBe(false)
    expect(m.html).toContain('#DC2626')
    expect(m.html).toContain('https://acra.test/pilotage')
  })
  it('traduit (mois et libellés), repli français', () => {
    const en = tableauBordEmail('en', { mois: new Date('2026-09-01T00:00:00Z'), sections, url: null })
    expect(en.subject).toBe('[ACRA] Dashboard — September 2026')
    expect(en.text).toContain('High risk — Panne <SI> paiements (level 16)')
    expect(tableauBordEmail('de', { mois: new Date('2026-09-01T00:00:00Z'), sections, url: null }).subject).toContain('September 2026')
    expect(tableauBordEmail('zz', { mois: new Date('2026-09-01T00:00:00Z'), sections, url: null }).text).toContain('Risques élevés : 2')
  })
})

describe('relancesEmail — synthèse unique par personne', () => {
  const o = (organisation: string) => ({ organisation })
  const items = [
    { ...o('Banque'), categorie: 'QUESTIONNAIRE' as const, intitule: 'Accès <ISO>', type: 'ECHEANCE_PROCHE' as const, echeance: '2026-10-10' },
    { ...o('Banque'), categorie: 'PLAN_ACTION' as const, intitule: 'MFA', type: 'EN_RETARD' as const, echeance: '2026-09-01' },
    { ...o('Banque'), categorie: 'PRECONISATION' as const, intitule: 'Registre', type: 'PERIODIQUE' as const, echeance: null },
  ]
  it('une organisation : nommée dans l’objet, toutes les lignes dans le même message, avec un lien, HTML échappé', () => {
    const m = relancesEmail('fr', { items, url: 'https://acra.test/controles/questionnaires' })
    expect(m.subject).toBe('[ACRA] 3 élément(s) à traiter — Banque')
    expect(m.text).toContain('• Questionnaire à répondre — Accès <ISO> : échéance le 2026-10-10')
    expect(m.text).toContain('Plan d’action — MFA : en retard (échéance le 2026-09-01)')
    expect(m.text).toContain('Préconisation — Registre : toujours ouvert')
    expect(m.html).toContain('Accès &lt;ISO&gt;')
    expect(m.html.includes('<ISO>')).toBe(false)
    expect(m.html).toContain('https://acra.test/controles/questionnaires')
  })
  it('plusieurs organisations : un seul message, chaque ligne préfixée par son organisation', () => {
    const m = relancesEmail('fr', { url: null, items: [
      ...items.slice(0, 1),
      { ...o('Assurance'), categorie: 'CONTROLE_A_EXECUTER', intitule: 'Revue des accès', type: 'EN_RETARD', echeance: '2026-09-15' },
      { ...o('Assurance'), categorie: 'CONSTAT_A_VERIFIER', intitule: 'MFA (Audit IAM)', type: 'EN_ATTENTE', echeance: null },
      { ...o('Assurance'), categorie: 'DEROGATION_EXPIRATION', intitule: 'TLS 1.0', type: 'ECHEANCE_PROCHE', echeance: '2026-10-20' },
    ] })
    expect(m.subject).toBe('[ACRA] 4 élément(s) à traiter')
    expect(m.text).toContain('Banque · Questionnaire à répondre — Accès <ISO>')
    expect(m.text).toContain('Assurance · Contrôle à exécuter — Revue des accès : en retard (échéance le 2026-09-15)')
    expect(m.text).toContain('Assurance · Recommandation d’audit réalisée à vérifier — MFA (Audit IAM) : en attente')
    expect(m.text).toContain('Assurance · Dérogation arrivant à expiration — TLS 1.0 : échéance le 2026-10-20')
  })
  it('ton rouge s’il y a un retard, ambre sinon', () => {
    expect(relancesEmail('fr', { items, url: null }).html).toContain('#DC2626')
    expect(relancesEmail('fr', { items: items.slice(0, 1), url: null }).html).toContain('#D97706')
  })
  it('traduit, avec repli français, et sans lien si l’URL est inconnue', () => {
    expect(relancesEmail('de', { items, url: null }).subject).toContain('Einträge')
    expect(relancesEmail('es', { items: [{ ...o('X'), categorie: 'CONSTAT_AUDIT', intitule: 'A', type: 'ECHEANCE_PROCHE', echeance: '2026-10-01' }], url: null }).text).toContain('Recomendación de auditoría — A : vence el 2026-10-01')
    expect(relancesEmail('xx', { items, url: null }).text).not.toContain('Ouvrir ACRA')
  })
})

describe('relancesEmail — décisions en attente', () => {
  it('libelle vérifications et validations avec la date de début d’attente', () => {
    const m = relancesEmail('fr', { url: null, items: [
      { organisation: 'O', categorie: 'PRECONISATION_A_VERIFIER', intitule: 'Registre', type: 'EN_ATTENTE', echeance: '2026-09-20' },
      { organisation: 'O', categorie: 'DEROGATION_AVIS', intitule: 'TLS 1.0', type: 'EN_ATTENTE', echeance: '2026-09-15' },
      { organisation: 'O', categorie: 'PROJET360_A_APPROUVER', intitule: 'CRM', type: 'EN_ATTENTE', echeance: '2026-09-10' },
    ] })
    expect(m.text).toContain('Préconisation réalisée à vérifier — Registre : en attente depuis le 2026-09-20')
    expect(m.text).toContain('Dérogation : avis RSSI attendu — TLS 1.0')
    expect(m.text).toContain('Projet 360 à approuver — CRM')
    expect(relancesEmail('it', { url: null, items: [{ organisation: 'O', categorie: 'ANALYSE_A_APPROUVER', intitule: 'A', type: 'EN_ATTENTE', echeance: '2026-09-01' }] }).text).toContain('Analisi da approvare — A : in attesa dal 2026-09-01')
  })
})
