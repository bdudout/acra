import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  organization: { findUnique: vi.fn(), findMany: vi.fn() },
  analyse: { findMany: vi.fn(async () => [] as unknown[]) },
  process: { findMany: vi.fn(), create: vi.fn() },
  risk: { findMany: vi.fn(), create: vi.fn() },
  control: { findMany: vi.fn(), create: vi.fn() },
  kri: { findMany: vi.fn(), create: vi.fn() },
  mission: { findMany: vi.fn(), create: vi.fn() },
  test: { findMany: vi.fn(), create: vi.fn() },
  cfg: vi.fn(),
  queryRaw: vi.fn(), transaction: vi.fn(),
}))
const auth = vi.hoisted(() => ({ scope: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'user1', role: 'ADMIN' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: {
  organization: db.organization, analyse: db.analyse, processus: db.process, riskItem: db.risk, controle: db.control, kri: db.kri, auditMission: db.mission, testResilience: db.test, $transaction: db.transaction,
} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: auth.scope }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: db.cfg }))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn(), getClientIp: vi.fn(() => '127.0.0.1') }))

import { GET, POST } from '@/app/api/catalogue-suggestions/route'
import { CATALOGUE_PACK_VERSION } from '@/lib/sector-suggestions'

const request = (body: object) => ({ json: async () => body }) as never

beforeEach(() => {
  vi.clearAllMocks()
  auth.scope.mockResolvedValue({ activeOrgId: 'org1', role: 'ADMIN' })
  db.organization.findUnique.mockResolvedValue({ secteursActivite: ['FINANCE'] })
  db.analyse.findMany.mockResolvedValue([])
  db.process.findMany.mockResolvedValue([])
  db.risk.findMany.mockResolvedValue([])
  db.control.findMany.mockResolvedValue([])
  db.kri.findMany.mockResolvedValue([])
  db.mission.findMany.mockResolvedValue([])
  db.test.findMany.mockResolvedValue([])
  db.test.create.mockImplementation(async ({ data }: { data: { catalogueKey: string } }) => ({ id: `id-${data.catalogueKey}`, ...data }))
  db.mission.create.mockImplementation(async ({ data }: { data: { catalogueKey: string } }) => ({ id: `id-${data.catalogueKey}`, ...data }))
  db.kri.create.mockImplementation(async ({ data }: { data: { catalogueKey: string } }) => ({ id: `id-${data.catalogueKey}`, ...data }))
  db.cfg.mockResolvedValue({ registreRisquesActive: true })
  db.control.create.mockImplementation(async ({ data }: { data: { catalogueKey: string } }) => ({ id: `id-${data.catalogueKey}`, ...data }))
  db.queryRaw.mockResolvedValue([])
  db.process.create.mockImplementation(async ({ data }: { data: { catalogueKey: string } }) => ({ id: `id-${data.catalogueKey}`, ...data }))
  db.risk.create.mockImplementation(async ({ data }: { data: { catalogueKey: string } }) => ({ id: `id-${data.catalogueKey}`, ...data }))
  db.transaction.mockImplementation(async (run: (tx: unknown) => Promise<unknown>) => run({
    processus: db.process, riskItem: db.risk, controle: db.control, kri: db.kri, auditMission: db.mission, testResilience: db.test, $queryRaw: db.queryRaw,
  }))
})

describe('catalogue de suggestions — aperçu et import partiel', () => {
  it('prévisualise le secteur de l’organisation et les éléments déjà importés sans écrire', async () => {
    db.process.findMany.mockResolvedValue([{ id: 'p1', catalogueKey: 'core.process.deliver' }])
    const res = await GET(new Request('http://localhost/api/catalogue-suggestions?locale=fr') as never)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.sector).toBe('FINANCE')
    expect(data.items.find((item: { key: string }) => item.key === 'core.process.deliver').status).toBe('ALREADY_IMPORTED')
    expect(data.items.some((item: { key: string }) => item.key === 'finance.risk.payment-routing')).toBe(true)
    expect(db.process.create).not.toHaveBeenCalled()
  })

  it('bloque sans surprise les liens omis, puis importe seulement trois risques explicitement acceptés', async () => {
    const selectedKeys = ['core.risk.payment-fraud', 'core.risk.ransomware', 'core.risk.data-leak']
    const preview = await POST(request({ sector: null, locale: 'fr', selectedKeys }))
    expect(preview.status).toBe(409)
    expect((await preview.json()).unlinked).toHaveLength(3)
    expect(db.risk.create).not.toHaveBeenCalled()
    const accepted = await POST(request({ sector: null, locale: 'fr', selectedKeys, acceptUnlinked: true }))
    expect(accepted.status).toBe(201)
    expect(db.risk.create).toHaveBeenCalledTimes(3)
    expect(db.risk.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      catalogueKey: 'core.risk.payment-fraud', processusId: null, provenance: 'ACRA', statut: 'IDENTIFIE',
    }) }))
  })

  it('crée le processus parent avant l’enfant et relie le risque à son processus, sans cotation', async () => {
    const res = await POST(request({ sector: 'FINANCE', locale: 'fr', selectedKeys: [
      'finance.risk.payment-routing', 'finance.process.payments', 'core.process.deliver',
    ] }))
    expect(res.status).toBe(201)
    expect(db.process.create).toHaveBeenCalledTimes(2)
    expect(db.process.create).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: expect.objectContaining({
      parentId: 'id-core.process.deliver',
    }) }))
    expect(db.risk.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      processusId: 'id-finance.process.payments', graviteInherente: null,
    }) }))
  })

  it('n’importe pas une clé hors secteur et ne recrée pas une clé déjà présente', async () => {
    const invalid = await POST(request({ sector: 'SANTE', locale: 'fr', selectedKeys: ['finance.risk.payment-routing'] }))
    expect(invalid.status).toBe(400)
    db.risk.findMany.mockResolvedValue([{ id: 'edited', catalogueKey: 'sante.risk.patient-data' }])
    const existing = await POST(request({ sector: 'SANTE', locale: 'fr', selectedKeys: ['sante.risk.patient-data'] }))
    expect(existing.status).toBe(200)
    expect((await existing.json()).alreadyImported).toEqual(['sante.risk.patient-data'])
    expect(db.risk.create).not.toHaveBeenCalled()
  })

  it('interdit la création de processus à un non-admin de l’organisation', async () => {
    auth.scope.mockResolvedValue({ activeOrgId: 'org1', role: 'ANALYSTE' })
    const res = await POST(request({ sector: null, locale: 'fr', selectedKeys: ['core.process.govern'] }))
    expect(res.status).toBe(403)
    expect(db.process.create).not.toHaveBeenCalled()
  })

  it('contrôles-types : invisibles sans le module « contrôle permanent » ; importés comme définitions nues (aucune exécution, aucun responsable) avec provenance', async () => {
    let data = await (await GET(new Request('http://localhost/api/catalogue-suggestions?locale=fr') as never)).json()
    expect(data.items.some((i: { kind: string }) => i.kind === 'CONTROL')).toBe(false)
    expect((await POST(request({ sector: null, locale: 'fr', selectedKeys: ['core.control.access-review'], acceptUnlinked: true }))).status).toBe(403)
    expect(db.control.create).not.toHaveBeenCalled()

    db.cfg.mockResolvedValue({ registreRisquesActive: true, controlePermanentActive: true, secondeLigneActive: true })
    data = await (await GET(new Request('http://localhost/api/catalogue-suggestions?locale=fr') as never)).json()
    expect(data.items.some((i: { kind: string }) => i.kind === 'CONTROL')).toBe(true)
    const res = await POST(request({ sector: null, locale: 'fr', selectedKeys: ['core.process.digital', 'core.process.digital.iam', 'core.control.access-review'] }))
    expect(res.status).toBe(201)
    const created = db.control.create.mock.calls[0][0].data
    expect(created).toMatchObject({ organizationId: 'org1', periodicite: 'TRIMESTRIEL', typeControle: 'DETECTIF', catalogueKey: 'core.control.access-review', catalogueVersion: CATALOGUE_PACK_VERSION, processusId: 'id-core.process.digital.iam' })
    expect(created).not.toHaveProperty('responsable'); expect(created).not.toHaveProperty('executions')
  })
  it('contrôles-types : refusés à un rôle sans droit de définition 2ᵉ ligne', async () => {
    db.cfg.mockResolvedValue({ registreRisquesActive: true, controlePermanentActive: true, secondeLigneActive: true })
    auth.scope.mockResolvedValue({ activeOrgId: 'org1', role: 'ANALYSTE' })
    expect((await POST(request({ sector: null, locale: 'fr', selectedKeys: ['core.control.access-review'], acceptUnlinked: true }))).status).toBe(403)
    expect(db.control.create).not.toHaveBeenCalled()
  })

  it('KRI candidats : invisibles sans le module KRI ; importés SANS seuil ni mesure (statut inconnu), avec unité, sens et fréquence suggérés', async () => {
    let data = await (await GET(new Request('http://localhost/api/catalogue-suggestions?locale=fr') as never)).json()
    expect(data.items.some((i: { kind: string }) => i.kind === 'KRI')).toBe(false)
    expect((await POST(request({ sector: null, locale: 'fr', selectedKeys: ['core.kri.backup-success'], acceptUnlinked: true }))).status).toBe(403)
    db.cfg.mockResolvedValue({ registreRisquesActive: true, kriActive: true, secondeLigneActive: true })
    data = await (await GET(new Request('http://localhost/api/catalogue-suggestions?locale=fr') as never)).json()
    expect(data.items.some((i: { kind: string }) => i.kind === 'KRI')).toBe(true)
    const res = await POST(request({ sector: null, locale: 'fr', selectedKeys: ['core.process.digital', 'core.process.digital.backup', 'core.kri.backup-success'] }))
    expect(res.status).toBe(201)
    expect(db.kri.create.mock.calls[0][0].data).toMatchObject({ organizationId: 'org1', unite: '%', sens: 'BAISSE', frequence: 'MENSUEL', seuilAlerte: null, seuilCritique: null, catalogueKey: 'core.kri.backup-success', processusId: 'id-core.process.digital.backup' })
  })
  it('KRI candidats : refusés à un rôle sans droit de définition', async () => {
    db.cfg.mockResolvedValue({ registreRisquesActive: true, kriActive: true, secondeLigneActive: true })
    auth.scope.mockResolvedValue({ activeOrgId: 'org1', role: 'ANALYSTE' })
    expect((await POST(request({ sector: null, locale: 'fr', selectedKeys: ['core.kri.backup-success'], acceptUnlinked: true }))).status).toBe(403)
    expect(db.kri.create).not.toHaveBeenCalled()
  })

  it('missions d’audit types : réservées à l’auditeur/admin avec module actif ; créées PLANIFIÉES avec programme, sans dates ni notation', async () => {
    expect((await POST(request({ sector: null, locale: 'fr', selectedKeys: ['core.audit.access'], acceptUnlinked: true }))).status).toBe(403)
    db.cfg.mockResolvedValue({ registreRisquesActive: true, auditInterneActive: true })
    auth.scope.mockResolvedValue({ activeOrgId: 'org1', role: 'ANALYSTE' })
    expect((await POST(request({ sector: null, locale: 'fr', selectedKeys: ['core.audit.access'], acceptUnlinked: true }))).status).toBe(403)
    auth.scope.mockResolvedValue({ activeOrgId: 'org1', role: 'AUDITEUR' })
    const res = await POST(request({ sector: null, locale: 'fr', selectedKeys: ['core.process.digital', 'core.process.digital.iam', 'core.audit.access'] }))
    expect(res.status).toBe(403) // AUDITEUR n'a pas le droit de créer des processus : la sélection mixte est refusée en bloc
    const ok = await POST(request({ sector: null, locale: 'fr', selectedKeys: ['core.audit.access'], acceptUnlinked: true }))
    expect(ok.status).toBe(201)
    const created = db.mission.create.mock.calls[0][0].data
    expect(created).toMatchObject({ organizationId: 'org1', statut: 'PLANIFIEE', catalogueKey: 'core.audit.access', processusIds: [] })
    expect(created.programme).toHaveLength(4)
    expect(created).not.toHaveProperty('notation'); expect(created).not.toHaveProperty('dateDebut')
  })

  it('nouveautés : signale les clés ajoutées après la plus ancienne version importée, sans modifier l’existant ; rien si rien n’a été importé', async () => {
    let data = await (await GET(new Request('http://localhost/api/catalogue-suggestions?locale=fr') as never)).json()
    expect(data.whatsNew).toEqual({ since: null, keys: [] })
    db.process.findMany.mockResolvedValue([{ id: 'p1', catalogueKey: 'core.process.deliver', catalogueVersion: '1.0' }])
    data = await (await GET(new Request('http://localhost/api/catalogue-suggestions?locale=fr') as never)).json()
    expect(data.whatsNew.since).toBe('1.0')
    expect(data.whatsNew.keys).toContain('core.process.digital.iam')
    expect(data.whatsNew.keys).not.toContain('core.process.deliver')
    expect(db.process.create).not.toHaveBeenCalled()
  })

  it('plans de test de résilience : invisibles sans le module réglementaire ; créés PLANIFIÉS sans date, résultat, fonction critique ni indépendance présumées', async () => {
    let data = await (await GET(new Request('http://localhost/api/catalogue-suggestions?locale=fr') as never)).json()
    expect(data.items.some((i: { kind: string }) => i.kind === 'RESILIENCE_TEST')).toBe(false)
    expect((await POST(request({ sector: null, locale: 'fr', selectedKeys: ['core.resilience.pentest'], acceptUnlinked: true }))).status).toBe(403)
    expect(db.test.create).not.toHaveBeenCalled()

    db.cfg.mockResolvedValue({ registreRisquesActive: true, reglementaireActive: true })
    data = await (await GET(new Request('http://localhost/api/catalogue-suggestions?locale=fr') as never)).json()
    const keys = data.items.filter((i: { kind: string }) => i.kind === 'RESILIENCE_TEST').map((i: { key: string }) => i.key)
    expect(keys).toContain('finance.resilience.payment-end-to-end') // pack du secteur de l'organisation (FINANCE)
    expect(keys).not.toContain('assurance.resilience.claims-continuity')
    const res = await POST(request({ sector: 'FINANCE', locale: 'fr', selectedKeys: ['core.process.digital', 'core.resilience.pentest'] }))
    expect(res.status).toBe(201)
    const created = db.test.create.mock.calls[0][0].data
    expect(created).toMatchObject({ organizationId: 'org1', type: 'PENETRATION', statut: 'PLANIFIE', fonctionCritique: false, independant: false, annee: new Date().getFullYear(), processusId: 'id-core.process.digital', catalogueKey: 'core.resilience.pentest', catalogueVersion: CATALOGUE_PACK_VERSION })
    for (const field of ['datePrevue', 'dateRealisation', 'resultat', 'constats', 'testeur']) expect(created).not.toHaveProperty(field)
  })
  it('plans de test de résilience : refusés à un rôle sans droit d’évaluation DORA', async () => {
    db.cfg.mockResolvedValue({ registreRisquesActive: true, reglementaireActive: true })
    auth.scope.mockResolvedValue({ activeOrgId: 'org1', role: 'ANALYSTE' })
    expect((await POST(request({ sector: null, locale: 'fr', selectedKeys: ['core.resilience.pentest'], acceptUnlinked: true }))).status).toBe(403)
    expect(db.test.create).not.toHaveBeenCalled()
  })

  it('multisecteur : par défaut l’union des secteurs de l’organisation ; une filiale sans secteur hérite de ceux du groupe', async () => {
    db.organization.findUnique.mockResolvedValue({ path: '/org1/', secteursActivite: ['FINANCE', 'ASSURANCE'] })
    let data = await (await GET(new Request('http://localhost/api/catalogue-suggestions?locale=fr') as never)).json()
    expect(data.sector).toBe('ALL')
    expect(data.items.some((i: { key: string }) => i.key.startsWith('finance.'))).toBe(true)
    expect(data.items.some((i: { key: string }) => i.key.startsWith('assurance.'))).toBe(true)
    data = await (await GET(new Request('http://localhost/api/catalogue-suggestions?locale=fr&sector=ASSURANCE') as never)).json()
    expect(data.sector).toBe('ASSURANCE')
    expect(data.items.some((i: { key: string }) => i.key.startsWith('finance.'))).toBe(false)

    db.organization.findUnique.mockResolvedValue({ path: '/groupe/filiale/', secteursActivite: [] })
    db.organization.findMany.mockResolvedValue([{ id: 'groupe', secteursActivite: ['SANTE'] }])
    auth.scope.mockResolvedValue({ activeOrgId: 'filiale', role: 'ADMIN' })
    data = await (await GET(new Request('http://localhost/api/catalogue-suggestions?locale=fr') as never)).json()
    expect(data).toMatchObject({ sector: 'SANTE', configuredSectors: [], effectiveSectors: ['SANTE'], inheritedSectors: true })
    const res = await POST(request({ sector: 'ALL', locale: 'fr', selectedKeys: ['sante.risk.patient-data'], acceptUnlinked: true }))
    expect(res.status).toBe(201)
    expect(db.risk.create.mock.calls[0][0].data).toMatchObject({ organizationId: 'filiale', catalogueKey: 'sante.risk.patient-data' })
  })

  it('registre : description et catégorie bâloise reprises, la catégorie seulement si la taxonomie de l’organisation la contient', async () => {
    const res = await POST(request({ sector: null, locale: 'fr', selectedKeys: ['core.risk.internal-fraud'], acceptUnlinked: true }))
    expect(res.status).toBe(201)
    expect(db.risk.create.mock.calls[0][0].data).toMatchObject({ taxonomieCode: 'BALE_1', statut: 'IDENTIFIE', graviteInherente: null })
    expect(db.risk.create.mock.calls[0][0].data.description).toMatch(/contournant les contrôles/)
    db.cfg.mockResolvedValue({ registreRisquesActive: true, taxonomieRisques: [{ code: 'MAISON', label: 'Maison', domaine: 'OP_RISK', ordre: 1 }] })
    await POST(request({ sector: null, locale: 'fr', selectedKeys: ['core.risk.premises'], acceptUnlinked: true }))
    expect(db.risk.create.mock.calls[1][0].data.taxonomieCode).toBeNull()
  })
  it('contrôle bancassurance : les textes de référence sont repris dans la description du contrôle créé (langue de l’utilisateur)', async () => {
    db.cfg.mockResolvedValue({ registreRisquesActive: true, controlePermanentActive: true, secondeLigneActive: true })
    const res = await POST(request({ sector: 'FINANCE', locale: 'en', selectedKeys: ['finance.process.ict', 'finance.control.ict-register'] }))
    expect(res.status).toBe(201)
    const created = db.control.create.mock.calls[0][0].data
    expect(created).toMatchObject({ catalogueKey: 'finance.control.ict-register', periodicite: 'TRIMESTRIEL', typeControle: 'DETECTIF' })
    expect(created.description).toBe('References : Règlement (UE) 2022/2554 (DORA)')
  })
})

describe('patterns d’architecture des analyses de l’organisation (lot A5)', () => {
  it('GET : les éléments rattachés aux patterns cochés dans les analyses sont proposés ; sans pattern, aucun', async () => {
    db.cfg.mockResolvedValue({ registreRisquesActive: true, controlePermanentActive: true, kriActive: true, auditInterneActive: true, reglementaireActive: true })
    const get = async () => (await (await GET(new Request('http://localhost/api/catalogue-suggestions?locale=fr') as never)).json()) as { items: { key: string }[]; patterns: string[] }
    const sans = await get()
    expect(sans.patterns).toEqual([]); expect(sans.items.some(i => i.key.startsWith('technique.') || i.key.startsWith('archi.'))).toBe(false)
    db.analyse.findMany.mockResolvedValue([{ patternsArchi: ['API_PARTENAIRES', 'DMZ'] }, { patternsArchi: ['DMZ', 'PIRATE'] }, { patternsArchi: null }])
    const avec = await get()
    expect(avec.patterns).toEqual(['API_PARTENAIRES', 'DMZ'])
    expect(avec.items.some(i => i.key === 'technique.control.api-authz-tests')).toBe(true)
    expect(avec.items.some(i => i.key === 'archi.control.dmz-rules-review')).toBe(true)
    expect((db.analyse.findMany.mock.calls as unknown as Array<[{ where: unknown }]>)[0][0].where).toMatchObject({ organizationId: 'org1', deletedAt: null })
  })
})
