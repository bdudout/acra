// Création d'une ligne OrganizationConfig pour une organisation qui n'en avait pas : les colonnes non nullables
// (interrupteurs, choix, nombres) reprennent les valeurs HÉRITÉES, sinon elles figeraient les défauts et la filiale
// perdrait les réglages de son groupe ; les champs JSON et nullables restent vides (ils continuent d'hériter).
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { DEFAULT_ORG_CONFIG, resolveOrgConfig, valeursACopierALaCreation, COLONNES_COPIEES_A_LA_CREATION } from '@/lib/org-config'

type Row = Parameters<typeof resolveOrgConfig>[0][number]

describe('valeursACopierALaCreation (pure)', () => {
  it('reprend les interrupteurs, choix et nombres hérités du groupe ; jamais les JSON ni les champs nullables', () => {
    const herite = resolveOrgConfig([null, { registreRisquesActive: true, kriActive: true, conformiteNiveau: 'ENTITE', derogationDureeDefautJours: 90, appetitRisque: { seuil: 8 } } as unknown as Row])
    const v = valeursACopierALaCreation(herite)
    expect(v).toMatchObject({ registreRisquesActive: true, kriActive: true, conformiteNiveau: 'ENTITE', derogationDureeDefautJours: 90, qualificationActive: DEFAULT_ORG_CONFIG.qualificationActive })
    expect(v).not.toHaveProperty('appetitRisque')
    expect(v).not.toHaveProperty('patternsArchiMax')
  })
  it('couvre tous les interrupteurs de module (dont les derniers ajoutés)', () => {
    for (const k of ['registreIaActive', 'campagnesRcsaActive', 'appetenceActive', 'rapportsGrcActive', 'mcpActive', 'projets360Active']) {
      expect(COLONNES_COPIEES_A_LA_CREATION as readonly string[]).toContain(k)
    }
  })
})

const m = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn(), upsert: vi.fn(), findMany: vi.fn(), org: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: {
  organizationConfig: { findUnique: m.find, update: m.update, upsert: m.upsert, findMany: m.findMany },
  organization: { findUnique: m.org },
  configuration: { findUnique: async () => ({ modulesPolicy: { kri: 'FORCE_OFF' } }) },
} }))
import { upsertOrgConfig } from '@/lib/org-config.server'

describe('upsertOrgConfig', () => {
  beforeEach(() => { Object.values(m).forEach(f => f.mockReset()); m.update.mockResolvedValue({}); m.upsert.mockResolvedValue({}) })
  it('ligne existante : simple mise à jour des champs demandés', async () => {
    m.find.mockResolvedValue({ id: 'f1' })
    await upsertOrgConfig('f1', { rapportsConfig: { a: 1 } })
    expect(m.update).toHaveBeenCalledWith({ where: { id: 'f1' }, data: { rapportsConfig: { a: 1 } } })
    expect(m.upsert).not.toHaveBeenCalled()
  })
  it('création : valeurs héritées du groupe (sans la politique d’instance) + champs demandés', async () => {
    m.find.mockResolvedValue(null)
    m.org.mockResolvedValue({ path: '/g/f1/' })
    m.findMany.mockResolvedValue([{ id: 'g', registreRisquesActive: true, kriActive: true }])
    await upsertOrgConfig('f1', { rapportsConfig: { a: 1 } })
    const arg = m.upsert.mock.calls[0][0]
    expect(arg.where).toEqual({ id: 'f1' })
    // kriActive interdit par l'instance (FORCE_OFF) : la valeur du groupe (true) est recopiée, pas la valeur forcée.
    expect(arg.create).toMatchObject({ id: 'f1', registreRisquesActive: true, kriActive: true, rapportsConfig: { a: 1 } })
    expect(arg.update).toEqual({ rapportsConfig: { a: 1 } })
  })
})
