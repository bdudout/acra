// Rôles attribuables (n° 9 de la recette par scénarios) : une seule liste, dérivée de UserRole hors SUPER_ADMIN, pour les
// sous-entités, la création de compte, les membres d'organisation, le SSO et l'import CSV — le DPO d'une filiale doit
// pouvoir être désigné.
import { describe, expect, it } from 'vitest'
import { ROLES_ATTRIBUABLES, estRoleAttribuable } from '@/lib/permissions'
import { SSO_ASSIGNABLE_ROLES } from '@/lib/sso'
import { parseUsersCsv } from '@/lib/users-csv'

describe('ROLES_ATTRIBUABLES', () => {
  it('tous les rôles sauf SUPER_ADMIN, dont DPO, CONFORMITE, CONTROLEUR, AUDITEUR, METIER', () => {
    expect([...ROLES_ATTRIBUABLES].sort()).toEqual(['ADMIN', 'ANALYSTE', 'AUDITEUR', 'CONFORMITE', 'CONTROLEUR', 'DIRECTION_METIER', 'DPO', 'LECTEUR', 'METIER', 'RISK_MANAGER', 'RSSI'])
    expect(estRoleAttribuable('DPO')).toBe(true)
    expect(estRoleAttribuable('SUPER_ADMIN')).toBe(false)
    expect(estRoleAttribuable('INCONNU')).toBe(false)
  })
  it('le SSO s’aligne sur la même liste', () => {
    expect([...SSO_ASSIGNABLE_ROLES].sort()).toEqual([...ROLES_ATTRIBUABLES].sort())
  })
  it('import CSV : DPO, conformité, contrôleur, auditeur et métier reconnus', () => {
    const r = parseUsersCsv('A,a,a@x.fr,DPO\nB,b,b@x.fr,auditeur\nC,c,c@x.fr,Conformité\nD,d,d@x.fr,contrôleur\nE,e,e@x.fr,metier\nF,f,f@x.fr,SUPER_ADMIN')
    expect(r.map(x => x.role)).toEqual(['DPO', 'AUDITEUR', 'CONFORMITE', 'CONTROLEUR', 'METIER', 'ANALYSTE'])
  })
})
