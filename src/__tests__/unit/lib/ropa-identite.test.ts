import { describe, it, expect } from 'vitest'
import { sanitizeIdentite, identiteEffective, dposDesignes } from '@/lib/ropa-identite'

describe('dposDesignes', () => {
  const org = { id: 'f1', path: '/g/f1/' }
  it('DPO de l’organisation, ou d’une organisation parente avec portée « sous-arbre » ; pas un DPO d’une autre branche', () => {
    const r = dposDesignes(org, [
      { organizationId: 'f1', role: 'DPO', scope: 'NODE', user: { name: 'Alice Martin', email: 'alice@x.fr', isActive: true } },
      { organizationId: 'g', role: 'DPO', scope: 'SUBTREE', user: { name: null, email: 'dpo-groupe@x.fr', isActive: true } },
      { organizationId: 'g', role: 'DPO', scope: 'NODE', user: { name: 'Groupe seul', email: 'g@x.fr', isActive: true } },
      { organizationId: 'f1', role: 'RSSI', scope: 'NODE', user: { name: 'Bob', email: 'b@x.fr', isActive: true } },
      { organizationId: 'f1', role: 'DPO', scope: 'NODE', user: { name: 'Inactif', email: 'i@x.fr', isActive: false } },
    ])
    expect(r).toEqual([{ nom: 'Alice Martin', contact: 'alice@x.fr' }, { nom: 'dpo-groupe@x.fr', contact: 'dpo-groupe@x.fr' }])
  })
})

describe('identiteEffective', () => {
  const saisie = sanitizeIdentite({ responsableNom: ' Banque Exemple SA ', responsableAdresse: '1 rue X, Paris', responsableContact: 'contact@banque.fr', dpoNom: 'DPO externe', dpoContact: 'dpo@cabinet.fr', representantNom: '' })
  it('DPO désigné dans ACRA : repris automatiquement (la saisie libre est ignorée)', () => {
    const e = identiteEffective(saisie, [{ nom: 'Alice Martin', contact: 'alice@x.fr' }])
    expect(e.dpo).toEqual({ source: 'DESIGNE', nom: 'Alice Martin', contact: 'alice@x.fr' })
    expect(e.responsable).toEqual({ nom: 'Banque Exemple SA', adresse: '1 rue X, Paris', contact: 'contact@banque.fr' })
    expect(e.manquants).toEqual([])
  })
  it('aucun DPO désigné : champ libre ; manquants signalés (art. 30 §1 a)', () => {
    expect(identiteEffective(saisie, []).dpo).toEqual({ source: 'SAISI', nom: 'DPO externe', contact: 'dpo@cabinet.fr' })
    const vide = identiteEffective(sanitizeIdentite({}), [])
    expect(vide.dpo.source).toBe('AUCUN')
    expect(vide.manquants).toEqual(['responsableNom', 'responsableContact'])
  })
  it('saisie bornée et nettoyée', () => {
    expect(sanitizeIdentite({ responsableNom: 'x'.repeat(500), representantNom: 3 }).responsableNom).toHaveLength(200)
    expect(sanitizeIdentite(null).representantNom).toBe('')
  })
})
