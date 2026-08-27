import { describe, it, expect } from 'vitest'
import {
  isSafeIssuerUrl,
  emailDomain,
  parseAllowedDomains,
  emailDomainAllowed,
  resolveJitProvisioning,
  normalizeGroups,
  cleanRoleMapping,
  resolveSsoRole,
} from '@/lib/sso'

describe('isSafeIssuerUrl', () => {
  it('https public ok, http / privé / localhost refusés', () => {
    expect(isSafeIssuerUrl('https://login.microsoftonline.com')).toBe(true)
    expect(isSafeIssuerUrl('http://login.microsoftonline.com')).toBe(false)
    expect(isSafeIssuerUrl('https://10.0.0.1')).toBe(false)
    expect(isSafeIssuerUrl('https://localhost')).toBe(false)
  })
})

describe('emailDomain', () => {
  it('extrait le domaine en minuscule, null si invalide', () => {
    expect(emailDomain('Alice@Acme.COM')).toBe('acme.com')
    expect(emailDomain('pasunemail')).toBeNull()
  })
})

describe('parseAllowedDomains', () => {
  it('normalise, retire @, déduplique, sépare virgule/espace', () => {
    expect(parseAllowedDomains('@Acme.com, acme.com  SUB.Acme.COM')).toEqual(['acme.com', 'sub.acme.com'])
    expect(parseAllowedDomains(null)).toEqual([])
  })
})

describe('emailDomainAllowed', () => {
  it('liste vide = tous domaines autorisés', () => {
    expect(emailDomainAllowed('x@nimporte.com', '')).toBe(true)
    expect(emailDomainAllowed('x@nimporte.com', null)).toBe(true)
  })
  it('restreint aux domaines listés', () => {
    expect(emailDomainAllowed('x@acme.com', 'acme.com')).toBe(true)
    expect(emailDomainAllowed('x@autre.com', 'acme.com')).toBe(false)
  })
  it('e-mail invalide → refusé', () => {
    expect(emailDomainAllowed('invalide', '')).toBe(false)
  })
})

describe('normalizeGroups', () => {
  it('accepte un tableau ou une chaîne séparée', () => {
    expect(normalizeGroups(['A', ' B ', ''])).toEqual(['A', 'B'])
    expect(normalizeGroups('A, B; C')).toEqual(['A', 'B', 'C'])
    expect(normalizeGroups(null)).toEqual([])
  })
})

describe('cleanRoleMapping', () => {
  it('parse « groupe = RÔLE », ne garde que les rôles assignables', () => {
    const m = cleanRoleMapping('grp-rssi = RSSI\ngrp-lecture=lecteur\ngrp-bad = SUPER_ADMIN\ngrp-x = INEXISTANT\nligne_sans_egal')
    expect(m).toEqual({ 'grp-rssi': 'RSSI', 'grp-lecture': 'LECTEUR' })
  })
  it('accepte aussi un objet', () => {
    expect(cleanRoleMapping({ 'grp-admin': 'ADMIN', 'grp-bad': 'SUPER_ADMIN' })).toEqual({ 'grp-admin': 'ADMIN' })
  })
})

describe('resolveSsoRole', () => {
  const mapping = { 'grp-lecture': 'LECTEUR', 'grp-rm': 'RISK_MANAGER', 'grp-rssi': 'RSSI' }
  it('null si aucun mapping (pas de gouvernance par groupes)', () => {
    expect(resolveSsoRole(['grp-rssi'], {}, 'ANALYSTE')).toBeNull()
    expect(resolveSsoRole(['grp-rssi'], '', 'ANALYSTE')).toBeNull()
  })
  it('rôle de plus haut privilège quand plusieurs groupes matchent', () => {
    expect(resolveSsoRole(['grp-lecture', 'grp-rssi', 'grp-rm'], mapping, 'LECTEUR')).toBe('RSSI')
  })
  it('insensible à la casse sur les noms de groupes', () => {
    expect(resolveSsoRole(['GRP-RM'], mapping, 'LECTEUR')).toBe('RISK_MANAGER')
  })
  it('defaultRole si mapping configuré mais aucun groupe mappé', () => {
    expect(resolveSsoRole(['groupe-inconnu'], mapping, 'LECTEUR')).toBe('LECTEUR')
  })
})

describe('resolveJitProvisioning', () => {
  const cfg = { autoProvision: true, defaultRole: 'LECTEUR', allowedDomains: 'acme.com' }
  it('lie un utilisateur existant (rôle inchangé)', () => {
    expect(resolveJitProvisioning(cfg, { email: 'a@acme.com', name: 'A', email_verified: true }, true).action).toBe('link')
  })
  it('crée un nouvel utilisateur avec le rôle par défaut si autoProvision', () => {
    const r = resolveJitProvisioning(cfg, { email: 'new@acme.com', email_verified: true }, false)
    expect(r.action).toBe('create')
    if (r.action === 'create') { expect(r.role).toBe('LECTEUR'); expect(r.email).toBe('new@acme.com') }
  })
  it('refuse un domaine non autorisé', () => {
    const r = resolveJitProvisioning(cfg, { email: 'x@autre.com', email_verified: true }, false)
    expect(r).toEqual({ action: 'deny', reason: 'domaine_non_autorise' })
  })
  it('refuse un e-mail non vérifié', () => {
    const r = resolveJitProvisioning(cfg, { email: 'x@acme.com', email_verified: false }, false)
    expect(r).toEqual({ action: 'deny', reason: 'email_non_verifie' })
  })
  it('refuse la création si autoProvision off et pas d’utilisateur existant', () => {
    const r = resolveJitProvisioning({ ...cfg, autoProvision: false }, { email: 'new@acme.com', email_verified: true }, false)
    expect(r).toEqual({ action: 'deny', reason: 'provisioning_desactive' })
  })
  it('liste de domaines vide → autorise tout domaine', () => {
    expect(resolveJitProvisioning({ ...cfg, allowedDomains: '' }, { email: 'x@nimporte.io', email_verified: true }, false).action).toBe('create')
  })
})
