import { describe, expect, it } from 'vitest'
import { classifyTierCoverage, cleanTierInput, findTierCandidates, normalizeLei, rootOrganizationIdOf } from '@/lib/tier-identity'

const tiers = [
  { id: 't1', nom: 'Amazon Web Services EMEA SARL', lei: '549300ABCDEFGHIJ1234', pays: 'LU', aliases: ['AWS'] },
  { id: 't2', nom: 'Société Générale', lei: null, pays: 'FR', aliases: [] },
  { id: 't3', nom: 'Acme Logiciels', lei: null, pays: 'FR', aliases: ['Acme SAS'] },
]

describe('normalizeLei', () => {
  it('accepte 20 caractères alphanumériques (casse et espaces ignorés), refuse le reste', () => {
    expect(normalizeLei('549300abcdefghij1234')).toBe('549300ABCDEFGHIJ1234')
    expect(normalizeLei(' 5493 00ABCDEFGHIJ1234 ')).toBe('549300ABCDEFGHIJ1234')
    expect(normalizeLei('123')).toBeNull(); expect(normalizeLei('')).toBeNull(); expect(normalizeLei(null)).toBeNull()
    expect(normalizeLei('549300ABCDEFGHIJ123!')).toBeNull()
  })
})

describe('findTierCandidates — rapprochement proposé, jamais décidé', () => {
  it('LEI identique : candidat FORT, même si le nom diffère', () => {
    expect(findTierCandidates({ nom: 'AWS Europe', lei: '549300abcdefghij1234' }, tiers)).toEqual([{ tierId: 't1', reason: 'LEI', strength: 'STRONG' }])
  })
  it('nom identique après normalisation (casse, accents, forme juridique) ou alias : candidat FAIBLE à revoir', () => {
    expect(findTierCandidates({ nom: 'SOCIETE GENERALE SA' }, tiers)).toEqual([{ tierId: 't2', reason: 'NAME', strength: 'WEAK' }])
    expect(findTierCandidates({ nom: 'acme sas' }, tiers)).toEqual([{ tierId: 't3', reason: 'ALIAS', strength: 'WEAK' }])
  })
  it('un nom seul ne prouve pas l’identité : aucun candidat fort ; deux LEI différents → pas de candidat par le nom', () => {
    expect(findTierCandidates({ nom: 'Société Générale' }, tiers).every(c => c.strength === 'WEAK')).toBe(true)
    expect(findTierCandidates({ nom: 'Société Générale', lei: '999999ABCDEFGHIJ9999' }, [{ ...tiers[1], lei: '111111ABCDEFGHIJ1111' }])).toEqual([])
  })
  it('homonymes sans lien : aucun candidat ; plusieurs candidats : tous renvoyés, le fort en premier', () => {
    expect(findTierCandidates({ nom: 'Totalement autre' }, tiers)).toEqual([])
    const out = findTierCandidates({ nom: 'Acme Logiciels', lei: '549300ABCDEFGHIJ1234' }, tiers)
    expect(out.map(c => [c.tierId, c.strength])).toEqual([['t1', 'STRONG'], ['t3', 'WEAK']])
  })
})

describe('classifyTierCoverage', () => {
  it('distingue cyber seulement, TIC seulement, les deux, ou aucun usage', () => {
    expect(classifyTierCoverage({ cyber: true, tic: false })).toBe('CYBER_ONLY')
    expect(classifyTierCoverage({ cyber: false, tic: true })).toBe('TIC_ONLY')
    expect(classifyTierCoverage({ cyber: true, tic: true })).toBe('CYBER_AND_TIC')
    expect(classifyTierCoverage({ cyber: false, tic: false })).toBe('UNUSED')
  })
})

describe('cleanTierInput', () => {
  it('nettoie nom, LEI, pays ; refuse un nom vide, un LEI mal formé, un pays inconnu', () => {
    expect(cleanTierInput({ nom: '  Acme  ', lei: '549300abcdefghij1234', pays: 'fr' })).toEqual({ ok: true, value: { nom: 'Acme', lei: '549300ABCDEFGHIJ1234', pays: 'FR', aliases: [] } })
    expect(cleanTierInput({ nom: '' })).toEqual({ ok: false, error: 'nom_requis' })
    expect(cleanTierInput({ nom: 'A', lei: 'trop court' })).toEqual({ ok: false, error: 'lei_invalide' })
    expect(cleanTierInput({ nom: 'A', pays: 'FRANCE' })).toEqual({ ok: false, error: 'pays_invalide' })
    expect(cleanTierInput({ nom: 'x'.repeat(201) })).toEqual({ ok: false, error: 'nom_trop_long' })
  })
  it('alias : nettoyés, dédoublonnés, bornés', () => {
    const r = cleanTierInput({ nom: 'Acme', aliases: [' AWS ', 'aws', '', 'x'.repeat(300), 'Acme SAS'] })
    expect(r.ok && r.value.aliases).toEqual(['AWS', 'Acme SAS'])
  })
})

describe('rootOrganizationIdOf — racine du groupe d’après le chemin matérialisé', () => {
  it('prend le premier segment du chemin ; une organisation racine est sa propre racine', () => {
    expect(rootOrganizationIdOf('/grp/fil1/', 'fil1')).toBe('grp')
    expect(rootOrganizationIdOf('/grp/', 'grp')).toBe('grp')
    expect(rootOrganizationIdOf('/', 'solo')).toBe('solo')
  })
})

import { certainMatches } from '@/lib/tier-identity'
describe('certainMatches — rapprochement en masse (LEI identique uniquement)', () => {
  const u = (id: string, candidates: { tierId: string; strength: 'STRONG' | 'WEAK' }[]) => ({ id, candidates })
  it('retient les arrangements ayant exactement UN candidat fort ; ignore faibles, ambigus et sans candidat', () => {
    const r = certainMatches([
      u('a1', [{ tierId: 't1', strength: 'STRONG' }]),
      u('a2', [{ tierId: 't1', strength: 'WEAK' }]),
      u('a3', [{ tierId: 't1', strength: 'STRONG' }, { tierId: 't2', strength: 'STRONG' }]),
      u('a4', []),
      u('a5', [{ tierId: 't2', strength: 'STRONG' }, { tierId: 't3', strength: 'WEAK' }]),
    ])
    expect(r).toEqual([{ arrangementId: 'a1', tierId: 't1' }, { arrangementId: 'a5', tierId: 't2' }])
  })
})
