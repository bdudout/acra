// Outils MCP read_analyses et read_projet : lecture seule, STRICTEMENT bornée à l'organisation de la clé.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  analyse: { findMany: vi.fn(), findFirst: vi.fn() },
  planAction: { findMany: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/configuration-server', () => ({ getEffectiveScaleConfig: vi.fn(async () => ({ nbNiveaux: 4 })) }))

import { readAnalysesTool, readProjetTool } from '@/lib/mcp/tools-projet.server'

const ctx = { organizationId: 'orgA', keyId: 'k' }
const json = (r: { content: { text: string }[] }) => JSON.parse(r.content[0].text)
beforeEach(() => { vi.clearAllMocks() })

describe('read_analyses', () => {
  it('bornée à l’organisation de la clé, sans corbeille ; filtres méthode et recherche ; limite plafonnée', async () => {
    db.analyse.findMany.mockResolvedValue([{ id: 'p1', nom: 'Espace adhérent 2027', methode: 'PROJET_360', statut: 'BROUILLON', secteur: 'Santé / Médico-social', sousSecteur: null, sousSecteurs: ['sante-amc'], dateEcheance: new Date('2027-03-01'), updatedAt: new Date('2026-10-06') }])
    const d = json(await readAnalysesTool.handler({ methode: 'PROJET_360', recherche: 'adhérent', limite: 500 }, ctx))
    const q = db.analyse.findMany.mock.calls[0][0]
    expect(q.where).toMatchObject({ organizationId: 'orgA', deletedAt: null, methode: 'PROJET_360', nom: { contains: 'adhérent', mode: 'insensitive' } })
    expect(q.take).toBe(100)
    expect(d.analyses[0]).toMatchObject({ id: 'p1', methode: 'PROJET_360', sousSecteurs: ['sante-amc'], miseEnService: '2027-03-01' })
  })
})

describe('read_projet', () => {
  const projet = {
    id: 'p1', nom: 'Espace adhérent 2027', methode: 'PROJET_360', statut: 'BROUILLON', description: null, secteur: 'Santé / Médico-social', sousSecteur: null, sousSecteurs: ['sante-amc'],
    patternsArchi: ['EXPOSITION_INTERNET'], dateEcheance: new Date('2027-03-01'), meteoProjet: 'SOLEIL', cadrage: { perimetre: 'Portail', objectifsEtude: 'Souscription en ligne' },
    risques: [
      { id: 'r1', nom: 'Dérive du planning', domaine: 'PROJECT', strategie: 'REDUIRE', gravite: 2, vraisemblance: 2, graviteActuelle: null, vraisemblanceActuelle: null, graviteResiduelle: null, vraisemblanceResiduelle: null },
      { id: 'r2', nom: 'Fuite de données de santé', domaine: 'CYBER', strategie: 'REDUIRE', gravite: 4, vraisemblance: 3, graviteActuelle: 4, vraisemblanceActuelle: 2, graviteResiduelle: 2, vraisemblanceResiduelle: 2 },
    ],
  }
  it('projet hors organisation : introuvable (requête bornée à l’organisation), sans divulgation', async () => {
    db.analyse.findFirst.mockResolvedValue(null)
    const r = await readProjetTool.handler({ analyseId: 'autre' }, ctx)
    expect(r.isError).toBe(true)
    expect(db.analyse.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'autre', organizationId: 'orgA', deletedAt: null })
  })
  it('contexte, échelle, risques référencés R1, R2… (plus critique d’abord) avec cotations, plans et risques visés', async () => {
    db.analyse.findFirst.mockResolvedValue(projet)
    db.planAction.findMany.mockResolvedValue([{ titre: 'AIPD', statut: 'A_FAIRE', priorite: 'CRITIQUE', echeance: new Date('2027-01-15'), porteur: 'DPO', liens: [{ targetId: 'r2' }] }])
    const d = json(await readProjetTool.handler({ analyseId: 'p1' }, ctx))
    expect(d.projet).toMatchObject({ nom: 'Espace adhérent 2027', objectifs: 'Souscription en ligne', patternsArchi: ['EXPOSITION_INTERNET'], miseEnService: '2027-03-01', meteo: 'SOLEIL' })
    expect(d.echelle).toEqual({ niveaux: 4 })
    expect(d.risques[0]).toMatchObject({ ref: 'R1', nom: 'Fuite de données de santé', brut: { niveau: 12 }, actuel: { niveau: 8 }, residuel: { niveau: 4 } })
    expect(d.plans[0]).toMatchObject({ titre: 'AIPD', risques: ['R1'], echeance: '2027-01-15' })
    expect(db.planAction.findMany.mock.calls[0][0].where).toMatchObject({ organizationId: 'orgA' })
  })
  it('analyse qui n’est pas un projet 360 : erreur explicite', async () => {
    db.analyse.findFirst.mockResolvedValue({ ...projet, methode: 'EBIOS_RM' })
    expect((await readProjetTool.handler({ analyseId: 'p1' }, ctx)).isError).toBe(true)
  })
})
