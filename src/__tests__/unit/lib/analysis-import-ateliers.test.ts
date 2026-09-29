import { describe, expect, it, vi } from 'vitest'
import { atelierContentSchema, summarizeAtelierContent, writeAtelierContent, type AtelierContent } from '@/lib/analysis-import-ateliers'

const content = (): AtelierContent => atelierContentSchema.parse({
  context: { perimetre: 'Application de suivi de chantiers', contexteJuridique: 'RGPD', architecture: 'Mobile + web' },
  businessValues: [
    { externalId: 'VM_01', title: 'Planification', type: 'PROCESSUS', description: 'Planning', responsible: 'Conducteurs', needs: { availability: 3, integrity: 3, confidentiality: 2 } },
    { externalId: 'VM_02', title: 'Pointage', type: 'INFORMATION', needs: { availability: 3, integrity: 3, confidentiality: 3 } },
  ],
  supportAssets: [{ externalId: 'BS_MAT.01', title: 'Postes de travail', category: 'MATERIEL', businessValueExternalIds: ['VM02', 'VM_01', 'VM_99'] }],
  fearedEvents: [
    { externalId: 'ER_01', title: 'Divulgation de données', description: 'Exfiltration', impacts: 'RGPD', gravity: 3, businessValueExternalIds: ['VM02'] },
    { externalId: 'ER_03', title: 'Modification des heures', gravity: 3, businessValueExternalIds: ['VM_02', 'VM_01'] },
  ],
  riskSources: [{ externalId: 'SR_1', title: 'Crime organisé', category: 'CYBERCRIMINEL', motivation: 3, resources: 2, retained: true, justification: 'Fréquent', objectives: ['Lucratif', 'Influence'] }],
  stakeholders: [{ externalId: 'PP_01', title: 'Chefs de chantier', type: 'CLIENT', dependency: 4, penetration: 2, maturity: 3, trust: 4 }],
  strategicScenarios: [{ externalId: 'SS_03', title: 'Vol de données', riskSourceExternalId: 'SR_1', objective: 'Lucratif', fearedEventExternalIds: ['ER03', 'ER_01', 'ER_77'], stakeholderExternalIds: ['PP01'], gravity: 3, attackPath: ['Hameçonnage', 'Usurpation'] }],
  operationalScenarios: [{ externalId: 'SO_03a', title: 'Hameçonnage ciblé', strategicScenarioExternalId: 'SS03', likelihood: 2, gravity: 3 }],
  securityBaseline: [{ title: 'Les comptes sont nominatifs', category: 'Protection', subCategory: 'Identités', coverage: 2 }],
})

function fakeTx() {
  let n = 0
  const created: Record<string, unknown[]> = {}
  const make = (model: string) => vi.fn(async ({ data }: { data: Record<string, unknown> }) => { (created[model] ??= []).push(data); return { id: `${model}-${++n}` } })
  return {
    created,
    tx: {
      cadrage: { update: vi.fn(async (a: unknown) => { (created.cadrage ??= []).push(a); return {} }) },
      sourceRisque: { create: make('sourceRisque') }, partiePrenante: { create: make('partiePrenante') },
      scenarioStrategique: { create: make('scenarioStrategique') }, scenarioOperationnel: { create: make('scenarioOperationnel') },
    },
  }
}

describe('écriture des ateliers 1 à 4', () => {
  it('cadrage : périmètre, valeurs métier (DIC), biens supports liés, événements redoutés liés, socle', async () => {
    const { tx, created } = fakeTx()
    await writeAtelierContent(tx as never, content(), { analyseId: 'a1' })
    const call = (created.cadrage![0] as { where: { analyseId: string }; data: Record<string, any> })
    expect(call.where).toEqual({ analyseId: 'a1' })
    const d = call.data
    expect(d.perimetre).toContain('suivi de chantiers')
    expect(d.valeursMetier).toHaveLength(2)
    expect(d.valeursMetier[1]).toMatchObject({ nom: 'Pointage', type: 'INFORMATION', disponibilite: 3, integrite: 3, confidentialite: 3 })
    const vmId = (ref: string) => d.valeursMetier.find((v: any) => v.nom === (ref === 'VM_02' ? 'Pointage' : 'Planification')).id
    expect(d.biensSupports[0].valeurMetierIds).toEqual([vmId('VM_02'), vmId('VM_01')]) // VM_99 inconnu : non rattaché
    expect(d.evenementsRedoutes[0]).toMatchObject({ gravite: 3, valeurMetierId: vmId('VM_02') })
    expect(d.evenementsRedoutes[0].description).toContain('Divulgation de données')
    expect(d.customControles[0]).toMatchObject({ nom: 'Les comptes sont nominatifs', categorie: 'Protection / Identités' })
    expect(d.socleSecurite[0]).toMatchObject({ ref: d.customControles[0].ref, statut: expect.any(String) })
  })
  it('sources de risque avec objectifs, parties prenantes recalculées, scénarios liés par référence (variantes VM02/VM_02, ER03/ER_03)', async () => {
    const { tx, created } = fakeTx()
    const r = await writeAtelierContent(tx as never, content(), { analyseId: 'a1' })
    expect(created.sourceRisque![0]).toMatchObject({ analyseId: 'a1', nom: 'Crime organisé', categorie: 'CYBERCRIMINEL', retenu: true, objectifsVises: [{ nom: 'Lucratif' }, { nom: 'Influence' }] })
    expect(created.partiePrenante![0]).toMatchObject({ dependance: 4, penetration: 2, exposition: 8, maturite: 3, confiance: 4, fiabilite: 12 })
    const ss = created.scenarioStrategique![0] as Record<string, any>
    expect(ss.sourceRisqueId).toBe('sourceRisque-1')
    expect(ss.evenementsRedoutesIds).toHaveLength(2) // ER_77 inconnu : non rattaché
    expect(ss.gravite).toBe(3)
    expect(ss.description).toContain('Chefs de chantier')
    expect(ss.cheminAttaque).toHaveLength(2)
    expect((created.scenarioOperationnel![0] as Record<string, any>).scenarioStrategiqueId).toBe('scenarioStrategique-3')
    expect(r.counts).toMatchObject({ businessValues: 2, supportAssets: 1, fearedEvents: 2, riskSources: 1, stakeholders: 1, strategicScenarios: 1, operationalScenarios: 1, securityBaseline: 1 })
  })
  it('sans contenu d’atelier : aucune écriture', async () => {
    const { tx, created } = fakeTx()
    const r = await writeAtelierContent(tx as never, atelierContentSchema.parse({}), { analyseId: 'a1' })
    expect(Object.keys(created)).toEqual([])
    expect(r.counts).toEqual({})
  })
})

describe('cohérence de la gravité des scénarios stratégiques', () => {
  it('avertit quand la gravité du scénario diffère du maximum des événements redoutés cités ; rien sinon', () => {
    const c = content()
    expect(summarizeAtelierContent(c).warnings.filter(w => w.startsWith('strategic_scenario_gravity'))).toEqual([]) // SS_03 : 3 = max(ER_03=3, ER_01=3)
    c.strategicScenarios[0].gravity = 2
    expect(summarizeAtelierContent(c).warnings).toContain('strategic_scenario_gravity_differs:SS_03:2:3')
  })
})

describe('aperçu : volumes et références orphelines', () => {
  it('signale les liens vers une référence absente, sans rien inventer', () => {
    const s = summarizeAtelierContent(content())
    expect(s.counts).toMatchObject({ businessValues: 2, fearedEvents: 2 })
    expect(s.warnings).toEqual(expect.arrayContaining([
      'support_asset_business_value_not_found:VM_99',
      'strategic_scenario_feared_event_not_found:ER_77',
    ]))
  })
})
