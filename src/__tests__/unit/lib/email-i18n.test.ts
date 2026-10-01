import { describe, it, expect } from 'vitest'
import { emailLocale, derogationDigestEmail, relancesEmail } from '@/lib/email-i18n'

describe('emailLocale', () => {
  it('normalise vers une locale supportée, repli fr', () => {
    expect(emailLocale('en')).toBe('en')
    expect(emailLocale('it')).toBe('it')
    expect(emailLocale('xx')).toBe('fr')
    expect(emailLocale(null)).toBe('fr')
    expect(emailLocale(undefined)).toBe('fr')
  })
})

describe('derogationDigestEmail', () => {
  const params = { orgNom: 'StarBank', active: 3, expireBientot: 2, expiree: 1, items: [
    { intitule: 'Deux', joursRestants: 5 },
    { intitule: 'Un', joursRestants: -2 },
  ] }
  it('anglais : compteurs et lignes localisés', () => {
    const e = derogationDigestEmail('en', params)
    expect(e.subject).toContain('Waivers summary')
    expect(e.subject).toContain('StarBank')
    expect(e.text).toContain('Active : 3')
    expect(e.text).toContain('Expiring soon : 2')
    expect(e.text).toContain('Expired : 1')
    expect(e.text).toContain('expires in 5 day(s)')
    expect(e.text).toContain('expired 2 day(s) ago')
  })
  it('français par défaut', () => {
    const e = derogationDigestEmail(null, params)
    expect(e.text).toContain('Actives : 3')
    expect(e.text).toContain('Bientôt expirées : 2')
  })
})

describe('versions HTML (multipart)', () => {
  it('digest : compteurs et lignes présents dans le html, localisés', () => {
    const e = derogationDigestEmail('en', { orgNom: 'StarBank', active: 3, expireBientot: 2, expiree: 1, items: [{ intitule: 'Legacy access', joursRestants: -2 }] })
    expect(e.html).toContain('Waivers summary')
    expect(e.html).toContain('StarBank')
    expect(e.html).toContain('Expiring soon')
    expect(e.html).toContain('Legacy access')
    expect(e.html).toContain('expired 2 day(s) ago')
  })
  it('digest : nom d\'organisation hostile échappé', () => {
    const e = derogationDigestEmail('fr', { orgNom: '<script>x</script>', active: 0, expireBientot: 1, expiree: 0, items: [] })
    expect(e.html.includes('<script>')).toBe(false)
    expect(e.html).toContain('&lt;script&gt;')
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
