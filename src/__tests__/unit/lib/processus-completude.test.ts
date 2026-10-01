import { describe, it, expect } from 'vitest'
import { champsManquantsProcessus } from '@/lib/processus-completude'

describe('complétude d’un processus', () => {
  it('un processus importé (nom seul) attend propriétaire et criticité', () => {
    expect(champsManquantsProcessus({})).toEqual(['proprietaire', 'criticite'])
  })
  it('RTO / RPO exigés seulement pour un processus critique ou important', () => {
    expect(champsManquantsProcessus({ proprietaire: 'DSI', criticite: 2 })).toEqual([])
    expect(champsManquantsProcessus({ proprietaire: 'DSI', criticite: 4 })).toEqual(['rto', 'rpo'])
    expect(champsManquantsProcessus({ proprietaire: 'DSI', criticite: 1, criticiteDora: 'CRITIQUE', rtoMinutes: 60 })).toEqual(['rpo'])
  })
  it('un propriétaire vide (espaces) compte comme manquant', () => {
    expect(champsManquantsProcessus({ proprietaire: '  ', criticite: 1 })).toEqual(['proprietaire'])
  })
})
