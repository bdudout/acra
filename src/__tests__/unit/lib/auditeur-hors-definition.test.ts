/**
 * n° 64 (recette 2026-10-19) : en mode « ligne unique » (2ᵉ ligne désactivée), la définition
 * des dispositifs (contrôles, campagnes, KRI, questionnaires) est ouverte à tout rôle sauf le
 * lecteur. Option d'organisation `auditeurHorsDefinition` (désactivée par défaut) : en exclut
 * aussi l'AUDITEUR, pour préserver l'indépendance de la 3ᵉ ligne.
 */
import { describe, it, expect } from 'vitest'
import { peutDefinir2eLigne, peutDefinirKri, peutPiloter, peutDefinir, optionsDefinition } from '@/lib/permissions'
import { DEFAULT_ORG_CONFIG, resolveOrgConfig, BOOL_KEYS, type RawOrgConfig } from '@/lib/org-config'

const row = (partial: Partial<RawOrgConfig>) => partial as RawOrgConfig

describe('peutDefinir2eLigne — option auditeurHorsDefinition', () => {
  it('par défaut (option désactivée), la ligne unique reste ouverte à l\'auditeur', () => {
    expect(peutDefinir2eLigne('AUDITEUR', { secondeLigneActive: false })).toBe(true)
    expect(peutDefinir2eLigne('AUDITEUR', { secondeLigneActive: false, auditeurHorsDefinition: false })).toBe(true)
  })
  it('option activée : l\'auditeur est exclu en ligne unique, les autres rôles (sauf lecteur) restent autorisés', () => {
    const opts = { secondeLigneActive: false, auditeurHorsDefinition: true }
    expect(peutDefinir2eLigne('AUDITEUR', opts)).toBe(false)
    expect(peutDefinir2eLigne('LECTEUR', opts)).toBe(false)
    for (const r of ['METIER', 'ANALYSTE', 'DPO', 'CONTROLEUR', 'RSSI', 'ADMIN'] as const) expect(peutDefinir2eLigne(r, opts)).toBe(true)
  })
  it('les alias (KRI, campagnes, réseau) suivent la même règle', () => {
    const opts = { secondeLigneActive: false, auditeurHorsDefinition: true }
    expect(peutDefinirKri('AUDITEUR', opts)).toBe(false)
    expect(peutPiloter('AUDITEUR', opts)).toBe(false)
    expect(peutDefinir('AUDITEUR', opts)).toBe(false)
  })
  it('sans effet quand la 2ᵉ ligne est active (l\'auditeur n\'y définit déjà pas)', () => {
    expect(peutDefinir2eLigne('AUDITEUR', { secondeLigneActive: true, auditeurHorsDefinition: false })).toBe(false)
  })
  it('optionsDefinition lit la configuration résolue de l\'organisation', () => {
    expect(optionsDefinition({ secondeLigneActive: false, auditeurHorsDefinition: true })).toEqual({ secondeLigneActive: false, auditeurHorsDefinition: true })
  })
})

describe('configuration d\'organisation', () => {
  it('désactivée par défaut, booléen de configuration d\'organisation', () => {
    expect(DEFAULT_ORG_CONFIG.auditeurHorsDefinition).toBe(false)
    expect(BOOL_KEYS).toContain('auditeurHorsDefinition')
    // Héritage multi-organisation : la valeur de l'org la plus proche l'emporte, sinon le défaut.
    expect(resolveOrgConfig([null, row({ auditeurHorsDefinition: true })]).auditeurHorsDefinition).toBe(true)
    expect(resolveOrgConfig([row({ auditeurHorsDefinition: false }), row({ auditeurHorsDefinition: true })]).auditeurHorsDefinition).toBe(false)
    expect(resolveOrgConfig([null]).auditeurHorsDefinition).toBe(false)
  })
})
