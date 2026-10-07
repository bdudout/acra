import { describe, expect, it } from 'vitest'
import { estConcerne, voitTousLesResultats } from '@/lib/acces-resultats'

describe('voitTousLesResultats — résultats d’audit et de contrôle', () => {
  it('lecture globale du dispositif : gouvernance, contrôle, audit, direction métier', () => {
    for (const r of ['ADMIN', 'SUPER_ADMIN', 'RSSI', 'RISK_MANAGER', 'CONFORMITE', 'DPO', 'CONTROLEUR', 'AUDITEUR', 'DIRECTION_METIER'] as const) expect(voitTousLesResultats(r), r).toBe(true)
  })
  it('1re ligne et lecture seule : seulement ce qui les concerne', () => {
    for (const r of ['ANALYSTE', 'METIER', 'LECTEUR'] as const) expect(voitTousLesResultats(r), r).toBe(false)
  })
})

describe('estConcerne — responsable (texte libre) ↔ utilisateur', () => {
  const u = { name: 'Marie Dupont', email: 'marie.dupont@exemple.fr' }
  it('nom ou e-mail, sans tenir compte de la casse, des accents ni des espaces', () => {
    expect(estConcerne('marie dupont', u)).toBe(true)
    expect(estConcerne('  MARIE.DUPONT@exemple.fr ', u)).toBe(true)
    expect(estConcerne('Marie Dupont (DSI)', u)).toBe(false)
    expect(estConcerne('Mârie Düpont', u)).toBe(true)
  })
  it('liste de responsables séparés par virgule ou point-virgule', () => {
    expect(estConcerne('Paul Martin ; Marie Dupont', u)).toBe(true)
  })
  it('responsable absent, équipe ou utilisateur sans nom : non concerné', () => {
    expect(estConcerne(null, u)).toBe(false)
    expect(estConcerne('Contrôle permanent', u)).toBe(false)
    expect(estConcerne('', { name: '', email: '' })).toBe(false)
  })
})

describe('visibiliteMission', () => {
  const concerne = (s: string | null | undefined) => s === 'Marie'
  const constats = [{ id: 'c1', responsableAction: 'Marie' }, { id: 'c2', responsableAction: 'Paul' }]
  it('tout voir : mission complète', async () => {
    const { visibiliteMission } = await import('@/lib/acces-resultats')
    expect(visibiliteMission({ responsable: 'X' }, constats, { tout: true, concerne })).toEqual({ visible: true, complete: true, constats })
  })
  it('responsable de la mission : complète ; responsable d’un constat : ce constat seulement ; sinon invisible', async () => {
    const { visibiliteMission } = await import('@/lib/acces-resultats')
    expect(visibiliteMission({ responsable: 'Marie' }, constats, { tout: false, concerne }).complete).toBe(true)
    expect(visibiliteMission({ responsable: 'X' }, constats, { tout: false, concerne })).toEqual({ visible: true, complete: false, constats: [constats[0]] })
    expect(visibiliteMission({ responsable: 'X' }, [constats[1]], { tout: false, concerne }).visible).toBe(false)
  })
})
