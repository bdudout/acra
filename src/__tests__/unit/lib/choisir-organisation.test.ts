// Super-administrateur en vue « toutes les organisations » sur une page qui porte sur UNE organisation : message
// d'information (choisir une organisation) au lieu d'un 404 ou d'une redirection muette.
import { describe, expect, it } from 'vitest'
import { superAdminSansOrganisation } from '@/lib/choisir-organisation'

describe('superAdminSansOrganisation', () => {
  it('vrai seulement pour le super-administrateur sans organisation active', () => {
    expect(superAdminSansOrganisation('SUPER_ADMIN', null)).toBe(true)
    expect(superAdminSansOrganisation('SUPER_ADMIN', 'org1')).toBe(false)
    expect(superAdminSansOrganisation('ADMIN', null)).toBe(false)
    expect(superAdminSansOrganisation(undefined, null)).toBe(false)
  })
})
