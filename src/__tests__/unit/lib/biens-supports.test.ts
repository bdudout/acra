import { describe, it, expect } from 'vitest'
import { bienValeurMetierIds, normalizeBienVmLinks } from '@/lib/biens-supports'

// Association N‑N biens supports ↔ valeurs métier (GitHub issue #1).

describe('bienValeurMetierIds — lecture rétro-compatible', () => {
  it('lit le nouveau format valeurMetierIds', () => {
    expect(bienValeurMetierIds({ valeurMetierIds: ['vm1', 'vm2'] })).toEqual(['vm1', 'vm2'])
  })
  it('lit l’ancien format singulier valeurMetierId', () => {
    expect(bienValeurMetierIds({ valeurMetierId: 'vm1' })).toEqual(['vm1'])
  })
  it('le nouveau format prime sur l’ancien', () => {
    expect(bienValeurMetierIds({ valeurMetierIds: ['vm2'], valeurMetierId: 'vm1' })).toEqual(['vm2'])
  })
  it('déduplique et ignore les valeurs vides', () => {
    expect(bienValeurMetierIds({ valeurMetierIds: ['vm1', '', 'vm1', 'vm2'] })).toEqual(['vm1', 'vm2'])
  })
  it('renvoie [] si aucun lien / bien nul', () => {
    expect(bienValeurMetierIds({})).toEqual([])
    expect(bienValeurMetierIds({ valeurMetierId: '' })).toEqual([])
    expect(bienValeurMetierIds(null)).toEqual([])
  })
})

describe('normalizeBienVmLinks — conversion au format N‑N', () => {
  it('convertit l’ancien champ et retire le singulier', () => {
    const out = normalizeBienVmLinks({ nom: 'Serveur', valeurMetierId: 'vm1' })
    expect(out.valeurMetierIds).toEqual(['vm1'])
    expect('valeurMetierId' in out).toBe(false)
    expect(out.nom).toBe('Serveur')
  })
  it('préserve un bien déjà au nouveau format', () => {
    const out = normalizeBienVmLinks({ nom: 'BDD', valeurMetierIds: ['vm1', 'vm2'] })
    expect(out.valeurMetierIds).toEqual(['vm1', 'vm2'])
  })
  it('non destructif (n’altère pas la source)', () => {
    const src = { nom: 'X', valeurMetierId: 'vm1' }
    normalizeBienVmLinks(src)
    expect(src.valeurMetierId).toBe('vm1')
  })
})
