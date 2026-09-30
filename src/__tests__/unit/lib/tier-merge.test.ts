import { describe, expect, it } from 'vitest'
import { mergeAliases, planTierMerge } from '@/lib/tier-merge'

const t = (id: string, lei: string | null = null, root = 'grp') => ({ id, lei, root })
const alone = { otherOrganizations: 0, foreignArrangements: 0, foreignParties: 0, foreignUsages: 0 }

describe('planTierMerge — fusion de deux identités en doublon', () => {
  it('autorise la fusion de deux identités du même groupe utilisées par la seule organisation', () => {
    expect(planTierMerge(t('a'), t('b'), alone)).toEqual({ ok: true })
  })
  it('refuse : même identité, groupes différents, LEI différents', () => {
    expect(planTierMerge(t('a'), t('a'), alone)).toEqual({ ok: false, error: 'same_tier' })
    expect(planTierMerge(t('a'), t('b', null, 'autre'), alone)).toEqual({ ok: false, error: 'different_group' })
    expect(planTierMerge(t('a', '549300AAAAAAAAAAAA11'), t('b', '549300BBBBBBBBBBBB22'), alone)).toEqual({ ok: false, error: 'lei_conflict' })
  })
  it('un LEI d’un seul côté ou identique ne bloque pas', () => {
    expect(planTierMerge(t('a', '549300AAAAAAAAAAAA11'), t('b'), alone).ok).toBe(true)
    expect(planTierMerge(t('a', '549300AAAAAAAAAAAA11'), t('b', '549300AAAAAAAAAAAA11'), alone).ok).toBe(true)
  })
  it('refuse si la fusion toucherait les données d’une autre organisation (accès, contrats, parties prenantes ou usages ailleurs)', () => {
    for (const k of ['otherOrganizations', 'foreignArrangements', 'foreignParties', 'foreignUsages'] as const)
      expect(planTierMerge(t('a'), t('b'), { ...alone, [k]: 1 })).toEqual({ ok: false, error: 'shared_with_other_organizations' })
  })
})

describe('mergeAliases — le nom absorbé devient un alias du tiers conservé', () => {
  it('ajoute le nom et les alias de la source, sans doublon ni alias identique au nom conservé', () => {
    expect(mergeAliases({ nom: 'Acme Logiciels', aliases: ['Acme'] }, { nom: 'ACME LOGICIELS SAS', aliases: ['acme', 'AcmeSoft'] })).toEqual(['Acme', 'AcmeSoft']) // nom absorbé = nom conservé (forme juridique près) : pas d’alias inutile
    expect(mergeAliases({ nom: 'Acme Logiciels', aliases: [] }, { nom: 'Acme Software Inc', aliases: [] })).toEqual(['Acme Software Inc'])
  })
  it('borne à 20 alias et ignore les chaînes vides', () => {
    const many = Array.from({ length: 30 }, (_, i) => `Alias ${i}`)
    expect(mergeAliases({ nom: 'A', aliases: [] }, { nom: 'B', aliases: many })).toHaveLength(20)
    expect(mergeAliases({ nom: 'A', aliases: ['', '  '] }, { nom: '', aliases: [] })).toEqual([])
  })
})
