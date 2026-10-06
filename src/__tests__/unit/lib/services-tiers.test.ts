import { describe, expect, it } from 'vitest'
import { grapheEntite, regrouperServicesTiers } from '@/lib/services-tiers'

const pp = (id: string, nom: string, analyseId: string, tierId: string | null = null) => ({ id, nom, type: 'PRESTATAIRE', tierId, analyseId, analyseNom: `Analyse ${analyseId}` })
const tiers = [{ id: 't1', nom: 'Société Générale SA', lei: null, aliases: [] }, { id: 't2', nom: 'OVHcloud', lei: null, aliases: ['OVH'] }]

describe('regrouperServicesTiers — services tiers (parties prenantes) regroupés par nom', () => {
  const groupes = regrouperServicesTiers([
    pp('p1', 'OVH', 'a1'), pp('p2', 'ovh', 'a2', 't2'), pp('p3', 'OVH', 'a2'),
    pp('p4', 'Société Générale', 'a1'), pp('p5', 'Prestataire inconnu', 'a3'),
  ], tiers)
  const ovh = groupes.find(g => g.nom === 'OVH')!

  it('un groupe par nom comparable, orthographe la plus fréquente, analyses dédupliquées', () => {
    expect(groupes).toHaveLength(3)
    expect(ovh.partieIds).toEqual(['p1', 'p2', 'p3'])
    expect(ovh.analyses.map(a => a.id)).toEqual(['a1', 'a2'])
  })
  it('entités déjà rattachées et occurrences encore à rattacher', () => {
    expect(ovh.tierIds).toEqual(['t2'])
    expect(ovh.aRattacher).toEqual(['p1', 'p3'])
    expect(ovh.parEntite).toEqual({ t2: ['p2'] })
  })
  it('entités candidates proposées (nom, alias), jamais appliquées', () => {
    expect(ovh.candidats).toEqual([{ tierId: 't2', nom: 'OVHcloud', reason: 'ALIAS' }])
    expect(groupes.find(g => g.nom === 'Société Générale')!.candidats).toEqual([{ tierId: 't1', nom: 'Société Générale SA', reason: 'NAME' }])
    expect(groupes.find(g => g.nom === 'Prestataire inconnu')!.candidats).toEqual([])
  })
})

describe('grapheEntite — services tiers à gauche, entité au centre, contrats à droite', () => {
  it('positions et liens', () => {
    const g = grapheEntite({ nom: 'OVHcloud' }, [{ key: 's1', nom: 'OVH' }, { key: 's2', nom: 'OVH Mail' }], [{ id: 'c1', reference: 'TIC-01' }])
    const entite = g.noeuds.find(n => n.type === 'ENTITE')!
    const services = g.noeuds.filter(n => n.type === 'SERVICE')
    const contrat = g.noeuds.find(n => n.type === 'CONTRAT')!
    expect(services.every(s => s.x < entite.x) && contrat.x > entite.x).toBe(true)
    expect(services[0].y).toBeLessThan(services[1].y)
    expect(g.liens).toHaveLength(3)
    expect(g.liens.every(l => l.de === entite.id || l.vers === entite.id)).toBe(true)
    expect(g.hauteur).toBeGreaterThan(0)
  })
  it('entité seule : un nœud, aucun lien', () => {
    const g = grapheEntite({ nom: 'X' }, [], [])
    expect(g.noeuds).toHaveLength(1)
    expect(g.liens).toHaveLength(0)
  })
})
