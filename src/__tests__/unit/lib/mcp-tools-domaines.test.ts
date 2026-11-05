// Outils MCP de LECTURE des domaines GRC (lot S5a) : plans d'action, registre des risques, conformité, contrôles, audits,
// incidents, registre TIC, résilience. Preuve d'isolation : un faux prisma enregistre CHAQUE requête et vérifie qu'elle
// est bornée à l'organisation de la clé (organizationId = orgA) ; refus si le module est inactif, si la clé n'a pas de
// membre de l'organisation ou si le rôle porté par la clé ne lit pas le domaine.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  const appels: { cible: string; args: unknown }[] = []
  const reponses = new Map<string, unknown>()
  const repondre = (cible: string, methode: string, args: unknown) => {
    appels.push({ cible, args })
    const r = reponses.get(cible)
    if (typeof r === 'function') return r(args)
    if (r !== undefined) return r
    return methode === 'findMany' || methode === 'groupBy' || cible === '$queryRaw' ? [] : methode === 'count' ? 0 : null
  }
  const modele = (nom: string) => new Proxy({}, { get: (_t, m: string) => async (args: unknown) => repondre(`${nom}.${m}`, m, args) })
  const prisma = new Proxy({}, {
    get: (_t, nom: string) => nom === '$queryRaw' ? async (sql: unknown) => repondre('$queryRaw', '$queryRaw', sql) : modele(nom),
  })
  return {
    appels, reponses, prisma,
    cfg: {} as Record<string, unknown>,
    acteur: { value: { userId: 'u1', role: 'RSSI' } as { userId: string; role: string } | null },
    acces: { tout: true as boolean, concerne: (_r: string | null | undefined) => true as boolean },
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: h.prisma }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async () => h.cfg) }))
vi.mock('@/lib/mcp/acteur.server', () => ({ acteurMcp: vi.fn(async () => h.acteur.value) }))
vi.mock('@/lib/acces-resultats.server', () => ({ accesResultats: vi.fn(async () => h.acces) }))
vi.mock('@/lib/action-items.server', () => ({ gatherActionItems: vi.fn(async () => []) }))
vi.mock('@/lib/referentiel.server', () => ({
  listReferentiels: vi.fn(async () => [
    { code: 'ISO27001', nom: 'ISO/IEC 27001:2022', version: '2022', nbExigences: 3, actif: true, source: 'BUILTIN', type: 'NORME', domaine: 'CYBER' },
    { code: 'PCI-DSS', nom: 'PCI-DSS v4.0.1', version: '4.0.1', nbExigences: 2, actif: false, source: 'BUILTIN', type: 'NORME', domaine: 'CYBER' },
  ]),
  getExigencesFor: vi.fn(async () => [
    { ref: 'A.5.1', nom: 'Politiques de sécurité de l’information' }, { ref: 'A.5.2', nom: 'Fonctions et responsabilités' }, { ref: 'A.8.1', nom: 'Terminaux utilisateurs' },
  ]),
}))
vi.mock('@/lib/dependances-critiques.server', () => ({ chargerFonctionsCritiques: vi.fn(async () => ({ fonctions: FONCTIONS, scenariosDetail: {} })) }))
vi.mock('@/lib/propositions-risques-tic.server', () => ({ propositionsOuvertesOrg: vi.fn(async () => PROPOSITIONS) }))

import { buildDomaineTools } from '@/lib/mcp/tools-domaines.server'
import { gatherActionItems } from '@/lib/action-items.server'
import { chargerFonctionsCritiques } from '@/lib/dependances-critiques.server'
import { propositionsOuvertesOrg } from '@/lib/propositions-risques-tic.server'

const FONCTIONS = [{
  id: 'p1', nom: 'Paiements', criticiteDora: 'CRITIQUE', proprietaire: 'DG', rtoMinutes: 240, rpoMinutes: 60, toleranceImpactMinutes: 480,
  nbControles: 2, nbRisques: 1, nbIncidents12m: 0,
  usages: [{ id: 'us1', useCase: 'Hébergement', tiersId: 't1', tiersNom: 'CloudCo', offre: 'IaaS', criticite: 'CRITIQUE', couvert: true, evalue: true, exposeInternet: true, perimetrePci: false, avecSi: true, interconnexion: false, hotes: ['pay.interne.example'], contratSansSortie: false, evaluation: { statut: 'VALIDEE', valideLe: null } }],
  dernierTest: { dureeRepriseMinutes: 200, date: '2026-06-01' },
  scenarios: [{ id: 'sc1', intitule: 'Panne du centre de données', dureeInterruptionMinutes: 600 }],
}]
const PROPOSITIONS = [{ cle: 'tic:contrat:a1:sortie', type: 'CONTRAT_SANS_SORTIE', famille: 'TIERS_TIC', origine: { type: 'CONTRAT', id: 'a1', libelle: 'C-001', lien: '/registre-tic' }, processusId: null, params: { reference: 'C-001', prestataire: 'CloudCo' }, gravite: 3, vraisemblance: 2 }]

const ctx = { organizationId: 'orgA', keyId: 'k1' }
const tools = Object.fromEntries(buildDomaineTools().map(t => [t.name, t]))
const appeler = (nom: string, args: Record<string, unknown> = {}) => tools[nom].handler(args, ctx)
const json = (r: { content: { text: string }[] }) => JSON.parse(r.content[0].text)
const TOUS_ACTIFS = { registreRisquesActive: true, incidentsActive: true, controlePermanentActive: true, auditInterneActive: true, conformiteActive: true, reglementaireActive: true, conformiteNiveau: 'ORGANISATION' }

/**
 * La requête est-elle bornée à orgA, sans jamais citer une autre organisation ? Prisma : `organizationId` = orgA (ou
 * `{ in: ['orgA'] }`) AU 1er NIVEAU du where (un OR ne peut donc pas l'éluder) et aucun organizationId dans un OR.
 * SQL brut : orgA parmi les valeurs liées.
 */
function borneeOrgA(args: unknown): boolean {
  const s = JSON.stringify(args ?? null)
  if (s.includes('orgB')) return false
  if (!args || typeof args !== 'object') return false
  const a = args as { where?: Record<string, unknown>; values?: unknown }
  if (Array.isArray(a.values)) return a.values.includes('orgA')
  const w = a.where
  if (!w || typeof w !== 'object') return false
  const org = w.organizationId
  const ok = org === 'orgA' || JSON.stringify(org) === JSON.stringify({ in: ['orgA'] })
  if (!ok) return false
  if (w.OR !== undefined && JSON.stringify(w.OR).includes('organizationId')) return false
  return true
}
describe('borneeOrgA (garde du test lui-même)', () => {
  it('exige organizationId = orgA au 1er niveau du where', () => {
    expect(borneeOrgA({ where: { organizationId: 'orgA', id: 'x' } })).toBe(true)
    expect(borneeOrgA({ where: { organizationId: { in: ['orgA'] } } })).toBe(true)
    expect(borneeOrgA({ where: { id: 'x', liens: { some: { organizationId: 'orgA' } } } })).toBe(false)
    expect(borneeOrgA({ where: { OR: [{ organizationId: 'orgA' }, { public: true }] } })).toBe(false)
    expect(borneeOrgA({ where: { organizationId: 'orgA', OR: [{ organizationId: 'orgC' }, { id: 'x' }] } })).toBe(false)
    expect(borneeOrgA({ where: { organizationId: 'orgB' } })).toBe(false)
    expect(borneeOrgA({ strings: ['…'], values: ['orgA', 5] })).toBe(true)
    expect(borneeOrgA({ strings: ['…'], values: [5] })).toBe(false)
  })
})
function toutesBornees() {
  expect(h.appels.length).toBeGreaterThan(0)
  for (const a of h.appels) expect(borneeOrgA(a.args), `${a.cible} ${JSON.stringify(a.args)}`).toBe(true)
}

beforeEach(() => {
  vi.clearAllMocks()
  h.appels.length = 0
  h.reponses.clear()
  for (const k of Object.keys(h.cfg)) delete h.cfg[k]
  Object.assign(h.cfg, TOUS_ACTIFS)
  h.acteur.value = { userId: 'u1', role: 'RSSI' }
  h.acces.tout = true
  h.acces.concerne = () => true
})

describe('outils de lecture des domaines : déclaration', () => {
  it('8 outils read_*, sans organizationId, avec pagination bornée', () => {
    expect(Object.keys(tools).sort()).toEqual(['read_audits', 'read_conformite', 'read_controles', 'read_incidents', 'read_plans_actions', 'read_resilience', 'read_risk_register', 'read_tic_register'])
    for (const t of Object.values(tools)) {
      const props = (t.inputSchema as { properties: Record<string, { maximum?: number }> }).properties
      expect(props.organizationId).toBeUndefined()
      expect(t.description.length).toBeGreaterThan(60)
      if (props.taille) expect(props.taille.maximum).toBeLessThanOrEqual(100)
    }
  })
  it('clé sans membre de l’organisation : refus explicite, aucune lecture', async () => {
    h.acteur.value = null
    for (const nom of Object.keys(tools)) {
      const r = await appeler(nom)
      expect(r.isError, nom).toBe(true)
      expect(r.content[0].text).toContain('cle_sans_membre')
    }
    expect(h.appels).toHaveLength(0)
  })
  it('argument inconnu refusé (pas d’organizationId glissé en douce)', async () => {
    const r = await appeler('read_risk_register', { organizationId: 'orgB' })
    expect(r.isError).toBe(true)
    expect(r.content[0].text).toContain('argument_inconnu')
    expect(h.appels).toHaveLength(0)
  })
})

describe('refus si le module est inactif (getOrgConfig)', () => {
  const cas: [string, string][] = [
    ['read_risk_register', 'registreRisquesActive'], ['read_incidents', 'incidentsActive'], ['read_controles', 'controlePermanentActive'],
    ['read_audits', 'auditInterneActive'], ['read_conformite', 'conformiteActive'], ['read_tic_register', 'reglementaireActive'], ['read_resilience', 'reglementaireActive'],
  ]
  for (const [nom, flag] of cas) {
    it(`${nom} : ${flag} = false → module_inactif`, async () => {
      h.cfg[flag] = false
      const r = await appeler(nom)
      expect(r.isError).toBe(true)
      expect(r.content[0].text).toContain('module_inactif')
      expect(h.appels).toHaveLength(0)
    })
  }
})

describe('RBAC du rôle porté par la clé', () => {
  it('conformité : un LECTEUR ne lit pas (peutLireConformite)', async () => {
    h.acteur.value = { userId: 'u1', role: 'LECTEUR' }
    const r = await appeler('read_conformite')
    expect(r.isError).toBe(true)
    expect(r.content[0].text).toContain('role_non_autorise')
  })
  it('registre TIC et résilience : un METIER ne lit pas (gouvernance ou lecture globale du dispositif)', async () => {
    h.acteur.value = { userId: 'u1', role: 'METIER' }
    for (const nom of ['read_tic_register', 'read_resilience']) {
      const r = await appeler(nom)
      expect(r.isError, nom).toBe(true)
      expect(r.content[0].text).toContain('role_non_autorise')
    }
  })
})

describe('read_plans_actions', () => {
  const item = (o: Record<string, unknown>) => ({ id: 'x', source: 'PLAN_ACTION', origine: 'risque', sourceId: 's', titre: 'T', description: null, porteur: 'RSSI', entite: null, entiteId: null, echeance: null, statut: 'A_FAIRE', priorite: 'MODERE', lien: null, riskItemId: null, ...o })
  it('store unifié de l’org de la clé (modules actifs, rôle porté), filtres origine/priorité/en retard/famille TIC, pagination', async () => {
    vi.mocked(gatherActionItems).mockResolvedValue([
      item({ id: 'a1', titre: 'Chiffrer les sauvegardes', priorite: 'CRITIQUE', echeance: new Date('2020-01-01'), riskItemId: 'ri1' }),
      item({ id: 'a2', titre: 'Revue des accès', priorite: 'CRITIQUE', echeance: new Date('2020-01-01'), riskItemId: 'ri2' }),
      item({ id: 'a3', titre: 'Audit fournisseur', origine: 'audit', priorite: 'CRITIQUE' }),
      item({ id: 'a4', titre: 'Sensibilisation', priorite: 'MODERE', echeance: new Date('2099-01-01') }),
    ] as never)
    h.reponses.set('riskItem.findMany', [{ id: 'ri1' }])
    const d = json(await appeler('read_plans_actions', { origine: 'risque', priorite: 'CRITIQUE', enRetard: true, familleTic: 'CYBER', taille: 500 }))
    const [orgId, mods, access] = vi.mocked(gatherActionItems).mock.calls[0]
    expect(orgId).toBe('orgA')
    expect(mods).toMatchObject({ incidentsActive: true, registreRisquesActive: true })
    expect(access).toEqual({ userId: 'u1', role: 'RSSI', scope: { visibleOrgIds: ['orgA'] } })
    expect(h.appels[0].args).toMatchObject({ where: { organizationId: 'orgA', familleRisqueTic: 'CYBER' } })
    expect(d.pagination).toMatchObject({ page: 1, taille: 100, total: 1 })
    expect(d.actions).toEqual([expect.objectContaining({ id: 'a1', titre: 'Chiffrer les sauvegardes', statut: 'EN_RETARD', priorite: 'CRITIQUE', echeance: '2020-01-01' })])
    expect(d.synthese.total).toBe(1)
    toutesBornees()
  })
  it('LECTEUR : pas d’action de conformité (refus read_conformite), jamais la description libre d’un incident', async () => {
    h.acteur.value = { userId: 'u1', role: 'LECTEUR' }
    h.acces.tout = false
    vi.mocked(gatherActionItems).mockResolvedValue([
      item({ id: 'c1', origine: 'conformite', titre: 'Écart A.5.2', description: 'détail conformité' }),
      item({ id: 'i1', origine: 'incident', titre: 'Phishing', description: 'victime : M. Durand' }),
      item({ id: 'r1', origine: 'risque', titre: 'Chiffrer', description: 'ok' }),
    ] as never)
    const d = json(await appeler('read_plans_actions'))
    const [, , access] = vi.mocked(gatherActionItems).mock.calls[0]
    expect(access).toMatchObject({ userId: 'u1', role: 'LECTEUR' })
    expect(d.actions.map((a: { id: string }) => a.id).sort()).toEqual(['i1', 'r1'])
    expect(d.actions.find((a: { id: string }) => a.id === 'i1').description).toBeNull()
    expect(d.synthese.total).toBe(2)
    expect(JSON.stringify(d)).not.toContain('Durand')
  })
  it('ANALYSTE (lit la conformité) : actions de conformité conservées, description d’incident toujours masquée', async () => {
    h.acteur.value = { userId: 'u1', role: 'ANALYSTE' }
    h.acces.tout = false
    vi.mocked(gatherActionItems).mockResolvedValue([
      item({ id: 'c1', origine: 'conformite', titre: 'Écart A.5.2' }),
      item({ id: 'i1', origine: 'incident', titre: 'Phishing', description: 'victime : M. Durand' }),
    ] as never)
    const d = json(await appeler('read_plans_actions', { origine: 'conformite' }))
    expect(d.actions.map((a: { id: string }) => a.id)).toEqual(['c1'])
    const d2 = json(await appeler('read_plans_actions'))
    expect(JSON.stringify(d2)).not.toContain('Durand')
  })
})

describe('read_risk_register', () => {
  it('requête légère partagée avec /api/risk-items, filtres famille TIC/statut/niveau/provenance', async () => {
    h.reponses.set('riskItem.findMany', [
      { id: 'r1', intitule: 'Rançongiciel', taxonomieCode: 'CYB', entite: null, proprietaire: 'RSSI', statut: 'EVALUE', familleRisqueTic: 'CYBER', provenance: 'MANUEL', graviteInherente: 4, vraisemblanceInherente: 4, graviteResiduelle: 4, vraisemblanceResiduelle: 3, processus: { nom: 'Paiements' } },
      { id: 'r2', intitule: 'Panne fournisseur', taxonomieCode: 'TIERS', entite: null, proprietaire: null, statut: 'EVALUE', familleRisqueTic: 'TIERS_TIC', provenance: 'PROPOSITION_TIC', graviteInherente: 2, vraisemblanceInherente: 1, graviteResiduelle: 1, vraisemblanceResiduelle: 1, processus: null },
    ])
    const d = json(await appeler('read_risk_register', { familleTic: 'CYBER', statut: 'EVALUE', niveau: 'eleve', provenance: 'MANUEL' }))
    expect(d.risques).toEqual([expect.objectContaining({ id: 'r1', intitule: 'Rançongiciel', familleRisqueTic: 'CYBER', processus: 'Paiements', niveauResiduel: 12 })])
    expect(d.pagination.total).toBe(1)
    expect(d.synthese).toBeDefined()
    toutesBornees()
  })
})

describe('read_conformite', () => {
  it('référentiels activés, taux par suivi, écarts libellés', async () => {
    h.reponses.set('conformite.findMany', [{ referentiel: 'ISO27001', entite: '', nom: null, updatedAt: new Date('2026-10-01'), entries: [
      { ref: 'A.5.1', statut: 'conforme' }, { ref: 'A.5.2', statut: 'non_conforme', traitement: 'plan_action' }, { ref: 'A.8.1', statut: 'partiel' },
    ] }])
    const d = json(await appeler('read_conformite'))
    expect(d.referentielsActives).toEqual([expect.objectContaining({ code: 'ISO27001', nom: 'ISO/IEC 27001:2022' })])
    expect(d.suivis[0]).toMatchObject({ referentiel: 'ISO27001', stats: { tauxConformite: 33, total: 3 } })
    expect(d.suivis[0].ecarts).toEqual([
      expect.objectContaining({ ref: 'A.5.2', statut: 'non_conforme', traitement: 'plan_action', libelle: 'Fonctions et responsabilités' }),
      expect.objectContaining({ ref: 'A.8.1', statut: 'partiel' }),
    ])
    expect(d.suivisTotal).toBe(1)
    expect(d.suivisTronques).toBe(false)
    toutesBornees()
  })
  it('plus de 50 suivis : total compté en base et troncature signalée', async () => {
    h.reponses.set('conformite.findMany', Array.from({ length: 50 }, (_, n) => ({ referentiel: 'ISO27001', entite: `E${n}`, nom: null, updatedAt: new Date(), entries: [] })))
    h.reponses.set('conformite.count', 73)
    const d = json(await appeler('read_conformite', { referentiel: 'ISO27001' }))
    expect(d.suivisTotal).toBe(73)
    expect(d.suivisTronques).toBe(true)
    const compte = h.appels.find(a => a.cible === 'conformite.count')
    expect(compte?.args).toEqual({ where: { organizationId: 'orgA', referentiel: 'ISO27001' } })
    toutesBornees()
  })
})

describe('read_controles', () => {
  it('bibliothèque (agrégats SQL bornés), campagnes et anomalies relevées ; filtre anomalies', async () => {
    h.reponses.set('controle.findMany', [
      { id: 'c1', intitule: 'Revue des comptes', responsable: 'Alice', niveau: 'N1', referentielCode: null, actif: true, periodicite: 'MENSUEL', createdAt: new Date('2026-01-01') },
      { id: 'c2', intitule: 'Sauvegardes', responsable: 'Bob', niveau: 'N1', referentielCode: null, actif: true, periodicite: 'MENSUEL', createdAt: new Date('2026-01-01') },
    ])
    h.reponses.set('$queryRaw', [{ controleId: 'c1', derniere: new Date('2026-10-01'), evaluees: BigInt(3), conformes: BigInt(2) }])
    h.reponses.set('campagneControle.findMany', [{ id: 'k1', intitule: 'Campagne T4', niveau: 'N1', statut: 'EN_COURS', recurrence: 'TRIMESTRIEL', dateDebut: null, dateFin: null, controleIds: ['c1', 'c2'] }])
    h.reponses.set('controleExecution.findMany', [{ id: 'e1', dateRealisation: new Date('2026-10-01'), constat: 'Comptes orphelins', controleId: 'c1', controle: { intitule: 'Revue des comptes', responsable: 'Alice' } }])
    const d = json(await appeler('read_controles', { anomaliesSeules: true }))
    expect(d.controles).toEqual([expect.objectContaining({ id: 'c1', anomalies: 1 })])
    expect(d.synthese).toMatchObject({ total: 2, avecAnomalies: 1 })
    expect(d.campagnes[0]).toMatchObject({ intitule: 'Campagne T4', nbControles: 2 })
    expect(d.anomalies[0]).toMatchObject({ controle: 'Revue des comptes', constat: 'Comptes orphelins' })
    toutesBornees()
  })
  it('1re ligne : seuls les contrôles dont elle est responsable, pas de campagne', async () => {
    h.acteur.value = { userId: 'u1', role: 'ANALYSTE' }
    h.acces.tout = false
    h.acces.concerne = r => r === 'Alice'
    h.reponses.set('controle.findMany', [
      { id: 'c1', intitule: 'Revue des comptes', responsable: 'Alice', niveau: 'N1', referentielCode: null, actif: true, periodicite: 'MENSUEL', createdAt: new Date('2026-01-01') },
      { id: 'c2', intitule: 'Sauvegardes', responsable: 'Bob', niveau: 'N1', referentielCode: null, actif: true, periodicite: 'MENSUEL', createdAt: new Date('2026-01-01') },
    ])
    const execs = [{ id: 'e2', dateRealisation: new Date(), constat: 'x', controleId: 'c2', controle: { intitule: 'Sauvegardes', responsable: 'Bob' } }]
    h.reponses.set('controleExecution.findMany', (args: { where: { controleId?: { in: string[] } } }) =>
      execs.filter(e => !args.where.controleId || args.where.controleId.in.includes(e.controleId)))
    const d = json(await appeler('read_controles'))
    expect(d.controles.map((c: { id: string }) => c.id)).toEqual(['c1'])
    expect(d.campagnes).toEqual([])
    expect(d.anomalies).toEqual([])
    // Filtrage côté base AVANT la limite : seuls les contrôles visibles sont interrogés.
    const req = h.appels.find(a => a.cible === 'controleExecution.findMany')?.args as { where: Record<string, unknown> }
    expect(req.where).toMatchObject({ organizationId: 'orgA', resultat: 'ANOMALIE', controleId: { in: ['c1'] } })
    toutesBornees()
  })
  it('rôle à lecture globale : anomalies de tous les contrôles (pas de filtre controleId)', async () => {
    await appeler('read_controles')
    const req = h.appels.find(a => a.cible === 'controleExecution.findMany')?.args as { where: Record<string, unknown> }
    expect(req.where.controleId).toBeUndefined()
  })
})

describe('read_audits', () => {
  it('missions visibles + constats ouverts (terminés exclus), triés par criticité', async () => {
    h.reponses.set('auditMission.findMany', [{
      id: 'm1', intitule: 'Audit PCA', responsable: 'Auditeur', statut: 'EN_COURS', type: 'INTERNE', dateDebut: null, dateFin: null, archiveLe: null,
      constats: [
        { id: 'k1', intitule: 'PCA non testé', criticite: 2, statut: 'OUVERT', echeance: null, responsableAction: 'DSI', source: 'AUDIT_INTERNE' },
        { id: 'k2', intitule: 'Sauvegardes hors site', criticite: 4, statut: 'EN_COURS', echeance: null, responsableAction: 'DSI', source: 'REGULATEUR' },
        { id: 'k3', intitule: 'Inventaire', criticite: 3, statut: 'RESOLU', echeance: null, responsableAction: 'DSI', source: 'AUDIT_INTERNE' },
      ],
    }])
    const d = json(await appeler('read_audits'))
    expect(d.missions[0]).toMatchObject({ id: 'm1', intitule: 'Audit PCA', synthese: { total: 3, ouverts: 2 } })
    expect(d.missions[0].constats).toBeUndefined()
    expect(d.constatsOuverts.map((c: { id: string }) => c.id)).toEqual(['k2', 'k1'])
    expect(d.constatsOuverts[0]).toMatchObject({ mission: 'Audit PCA', source: 'REGULATEUR' })
    toutesBornees()
  })
  it('1re ligne : missions dont elle est responsable, sinon ses seuls constats ; mission sans constat à elle masquée', async () => {
    h.acteur.value = { userId: 'u1', role: 'ANALYSTE' }
    h.acces.tout = false
    h.acces.concerne = r => r === 'Alice'
    const k = (id: string, resp: string) => ({ id, intitule: id, criticite: 2, statut: 'OUVERT', echeance: null, responsableAction: resp, source: 'AUDIT_INTERNE' })
    h.reponses.set('auditMission.findMany', [
      { id: 'm1', intitule: 'M1', responsable: 'Bob', statut: 'EN_COURS', type: 'INTERNE', dateDebut: null, dateFin: null, archiveLe: null, constats: [k('k1', 'Bob'), k('k2', 'Alice')] },
      { id: 'm2', intitule: 'M2', responsable: 'Alice', statut: 'EN_COURS', type: 'INTERNE', dateDebut: null, dateFin: null, archiveLe: null, constats: [k('k3', 'Bob')] },
      { id: 'm3', intitule: 'M3', responsable: 'Bob', statut: 'EN_COURS', type: 'INTERNE', dateDebut: null, dateFin: null, archiveLe: null, constats: [k('k4', 'Carol')] },
    ])
    const d = json(await appeler('read_audits'))
    expect(d.missions.map((m: { id: string }) => m.id).sort()).toEqual(['m1', 'm2'])
    expect(d.constatsOuverts.map((c: { id: string }) => c.id).sort()).toEqual(['k2', 'k3'])
    expect(d.missions.find((m: { id: string }) => m.id === 'm1').synthese.total).toBe(1)
    toutesBornees()
  })
})

describe('read_incidents', () => {
  it('requête légère partagée avec /api/incidents, filtre statut, classe DORA des incidents de la page', async () => {
    h.reponses.set('incident.findMany', (args: { select?: { doraCriteres?: boolean } }) => args.select?.doraCriteres
      ? [{ id: 'i1', doraCriteres: {}, dateDetection: new Date('2026-10-01'), doraClasseMajeurLe: null, doraInitialeSoumiseLe: null, doraIntermediaireSoumiseLe: null, doraFinaleSoumiseLe: null, quasiIncident: false }]
      : [
          { id: 'i1', intitule: 'Indisponibilité paiement', statut: 'QUALIFIE', taxonomieCode: 'IT', processusId: 'p1', entite: null, entiteId: null, dateSurvenance: new Date('2026-10-01'), dateDetection: new Date('2026-10-01'), montantBrut: '1000', recuperations: '200', riskItemId: null, processus: { nom: 'Paiements' }, riskItem: null, risquesLies: [] },
          { id: 'i2', intitule: 'Phishing', statut: 'DECLARE', taxonomieCode: 'CYB', processusId: null, entite: null, entiteId: null, dateSurvenance: null, dateDetection: null, montantBrut: null, recuperations: null, riskItemId: null, processus: null, riskItem: null, risquesLies: [] },
        ])
    const d = json(await appeler('read_incidents', { statut: 'QUALIFIE' }))
    expect(d.incidents).toEqual([expect.objectContaining({ id: 'i1', intitule: 'Indisponibilité paiement', perteNette: 800, processus: 'Paiements', dora: expect.objectContaining({ classe: expect.any(String) }) })])
    expect(d.incidents[0].description).toBeUndefined()
    toutesBornees()
  })
})

describe('read_tic_register', () => {
  it('registre d’informations + fonctions critiques ou importantes, sans points d’accès (hôtes)', async () => {
    h.reponses.set('arrangementTic.findMany', [{ id: 'a1', reference: 'C-001', prestataireNom: 'CloudCo', identifiant: 'LEI123', pays: 'FR', typeService: 'CLOUD', fonctionSupportee: 'Paiements', criticite: 'CRITIQUE', dateDebut: null, dateFin: null, paysDonnees: 'FR', sousTraitance: false, strategieSortie: null, prestataireAlternatif: null, strategieSortieTesteeLe: null }])
    const d = json(await appeler('read_tic_register', { criticite: 'CRITIQUE' }))
    expect(d.arrangements[0]).toMatchObject({ reference: 'C-001', prestataire: 'CloudCo', criticite: 'CRITIQUE', strategieSortie: false })
    expect(d.completude.total).toBe(1)
    expect(d.fonctionsCritiques[0]).toMatchObject({ nom: 'Paiements', usages: [expect.objectContaining({ tiers: 'CloudCo', offre: 'IaaS' })] })
    expect(JSON.stringify(d)).not.toContain('pay.interne.example')
    expect(vi.mocked(chargerFonctionsCritiques)).toHaveBeenCalledWith('orgA')
    toutesBornees()
  })
})

describe('read_resilience', () => {
  it('fonctions critiques (RTO/RPO/tolérance, écarts), tests de l’année, scénarios sévères, risques TIC proposés', async () => {
    h.reponses.set('testResilience.findMany', [{ id: 't1', annee: 2026, intitule: 'Bascule PRA', type: 'SCENARIO', perimetre: null, fonctionCritique: true, processusId: 'p1', riskItemIds: [], testeur: 'INTERNE', independant: true, statut: 'REALISE', datePrevue: null, dateRealisation: new Date('2026-06-01'), resultat: null, constats: [{ description: 'Lenteur', severite: 2, corrige: false }], updatedAt: new Date() }])
    const d = json(await appeler('read_resilience', { annee: 2026 }))
    expect(d.fonctions[0]).toMatchObject({ nom: 'Paiements', rtoMinutes: 240, rpoMinutes: 60, toleranceImpactMinutes: 480, scenarios: [expect.objectContaining({ intitule: 'Panne du centre de données' })] })
    expect(d.fonctions[0].ecarts.length).toBeGreaterThan(0)
    expect(d.tests[0]).toMatchObject({ intitule: 'Bascule PRA', statut: 'REALISE', constatsOuverts: 1 })
    expect(d.propositionsRisques[0]).toMatchObject({ cle: 'tic:contrat:a1:sortie', famille: 'TIERS_TIC' })
    expect(d.propositionsRisques[0].intitule).toEqual(expect.any(String))
    expect(JSON.stringify(d)).not.toContain('pay.interne.example')
    expect(vi.mocked(propositionsOuvertesOrg)).toHaveBeenCalledWith('orgA')
    toutesBornees()
  })
  it('registre des risques inactif : pas de risques proposés (null), le reste est lu', async () => {
    h.cfg.registreRisquesActive = false
    const d = json(await appeler('read_resilience'))
    expect(d.propositionsRisques).toBeNull()
    expect(vi.mocked(propositionsOuvertesOrg)).not.toHaveBeenCalled()
  })
})
