/** Population d'un projet 360 : réponses pré-remplies avec sources, risques proposés sans doublon. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  analyse: { count: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  arrangementTic: { count: vi.fn() },
  processus: { count: vi.fn() },
  traitement: { count: vi.fn() },
  risque: { createMany: vi.fn(), findMany: vi.fn() },
  planAction: { create: vi.fn() },
  mesure: { createMany: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async () => ({ reglementaireActive: false, qualificationQuestionnaire: { riskRules: [] } })) }))
vi.mock('@/lib/configuration-server', () => ({ getEffectiveScaleConfig: vi.fn(async () => ({ nbNiveaux: 4 })) }))

import { populateProjet360 } from '@/lib/projet360.server'
import { fr } from '@/lib/i18n/fr'

beforeEach(() => {
  vi.clearAllMocks()
  db.analyse.count.mockResolvedValue(0) // aucune analyse cyber → « risques cyber non appréciés » reste non répondu (pas de « non » deviné)
  db.arrangementTic.count.mockResolvedValueOnce(1).mockResolvedValueOnce(2) // critique, puis cloud
  db.processus.count.mockResolvedValue(0)
  db.traitement.count.mockResolvedValue(3)
  db.analyse.findUnique.mockResolvedValue({ qualification: { externalisation: true }, risques: [{ nom: 'Défaillance d’un prestataire critique', qualificationRuleId: null }] })
  db.risque.createMany.mockImplementation(async (a: { data: unknown[] }) => ({ count: a.data.length }))
  // Risques par défaut relus après création (pour leur rattacher un plan d'action).
  db.risque.findMany.mockImplementation(async (a: { where: { qualificationRuleId: { in: string[] } } }) => a.where.qualificationRuleId.in.map((ruleId, i) => ({ id: `rs${i}`, nom: ruleId, qualificationRuleId: ruleId })))
  db.planAction.create.mockImplementation(async (a: unknown) => a)
  db.mesure.createMany.mockImplementation(async (a: { data: unknown[] }) => ({ count: a.data.length }))
})

describe('populateProjet360', () => {
  it('pré-remplit avec les sources et crée les risques proposés sans doublon d’intitulé', async () => {
    const r = await populateProjet360('a1', 'org1', fr)
    const q = db.analyse.update.mock.calls[0][0].data.qualification
    expect(q).toMatchObject({ externalisation: true, 'p360.ext.prestataireCritique': true, 'p360.ext.cloud': true, 'p360.cyber.donneesSensibles': true })
    expect(q['p360._sources']).toEqual({ 'p360.ext.prestataireCritique': 'tic', 'p360.ext.cloud': 'cloud', 'p360.cyber.donneesSensibles': 'ropa' })
    const all = db.risque.createMany.mock.calls.flatMap(c => c[0].data as { nom: string; domaine: string; qualificationRuleId: string }[])
    const rows = all.filter(x => !x.qualificationRuleId.startsWith('socle:'))
    // « Défaillance d'un prestataire critique » existe déjà dans l'analyse : pas recréé.
    expect(rows.map(x => x.qualificationRuleId).sort()).toEqual(['p360-fuiteDonnees', 'p360-maitriseDonneesCloud'])
    expect(rows.every(x => x.domaine)).toBe(true)
    // Risques présents par défaut dans tout projet (configuration par défaut : les 8 du catalogue), avec domaine.
    const socle = all.filter(x => x.qualificationRuleId.startsWith('socle:'))
    expect(socle).toHaveLength(8)
    expect(socle.every(x => x.domaine)).toBe(true)
    expect(new Set(all.map(x => x.nom.toLowerCase())).size).toBe(all.length)
    expect(r).toEqual({ answers: 3, risks: 10 })
    // Un plan d'action par risque par défaut (qualification avec l'expert compétent), rattaché au risque du projet.
    expect(db.planAction.create).toHaveBeenCalledTimes(8)
    const plan = db.planAction.create.mock.calls[0][0].data
    expect(plan).toMatchObject({ organizationId: 'org1', statut: 'A_FAIRE', liens: { create: [expect.objectContaining({ type: 'RISQUE_ANALYSE', targetId: 'rs0', ref: 'a1' })] } })
    expect(db.planAction.create.mock.calls.map(c => c[0].data.titre).join(' | ')).toMatch(/DPO/)
    // Une mesure par défaut par risque par défaut, à mettre en œuvre (statut « à faire »), rattachée au risque du projet.
    const mesures = db.mesure.createMany.mock.calls.flatMap(c => c[0].data as { analyseId: string; risqueId: string; statut: string; nom: string }[])
    expect(mesures).toHaveLength(8)
    expect(mesures.every(m => m.analyseId === 'a1' && m.statut === 'A_FAIRE' && m.nom)).toBe(true)
    expect(new Set(mesures.map(m => m.risqueId)).size).toBe(8)
  })
})
