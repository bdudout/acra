import { describe, expect, it } from 'vitest'
import { resolveAuditConfig, sanitizeAuditConfig } from '@/lib/audit-config'
import { calculerRappels, type ConstatRappel } from '@/lib/audit-rappels'
import { planPluriannuel } from '@/lib/audit-l4'

const now = new Date('2026-09-29T06:00:00Z')
const j = (n: number) => new Date(now.getTime() + n * 86_400_000)

describe('auditConfig', () => {
  it('défauts : rappels actifs, 14 j avant échéance, relance tous les 7 j, cycles par défaut', () => {
    expect(resolveAuditConfig(undefined)).toEqual({ rappelsActifs: true, rappelJoursAvant: 14, rappelRelanceJours: 7, cycles: {}, libellesNotation: {} })
  })
  it('assainit : bornes, cycles 1–10 ans sur cotations 1–4, valeurs invalides ignorées', () => {
    expect(sanitizeAuditConfig({ rappelsActifs: false, rappelJoursAvant: 500, rappelRelanceJours: 0, cycles: { 4: 2, 3: 99, 9: 1, x: 2 } }))
      .toEqual({ rappelsActifs: false, rappelJoursAvant: 90, rappelRelanceJours: 1, cycles: { 4: 2 }, libellesNotation: {} })
    expect(resolveAuditConfig('nimporte quoi').rappelJoursAvant).toBe(14)
  })
  it('libellés de notation personnalisés : notes 1–4, texte nettoyé et borné, vides ignorés', () => {
    expect(sanitizeAuditConfig({ libellesNotation: { 1: ' Conforme ', 2: '', 4: 'x'.repeat(200), 7: 'Hors échelle', 3: 12 } }).libellesNotation)
      .toEqual({ 1: 'Conforme', 4: 'x'.repeat(60) })
  })
  it('les cycles surchargés pilotent le plan pluriannuel', () => {
    const cfg = sanitizeAuditConfig({ cycles: { 4: 3 } })
    const plan = planPluriannuel([{ id: 'u', intitule: 'U', type: 'PROCESSUS', risque: 4, cycleAns: null, actif: true, processusId: null }], [], now, { cycles: cfg.cycles })
    expect(plan.entrees[0].cycleAns).toBe(3)
  })
})

describe('calculerRappels', () => {
  const cfg = resolveAuditConfig(undefined)
  const c = (o: Partial<ConstatRappel> & { id: string }): ConstatRappel => ({ statut: 'OUVERT', echeance: j(5), rappelLe: null, responsableAction: 'Alice', ...o })
  it('échéance proche / en retard / réalisée à vérifier, chacun une fois par période de relance', () => {
    const r = calculerRappels([c({ id: 'a', echeance: j(10) }), c({ id: 'b', echeance: j(-3), statut: 'EN_COURS' }), c({ id: 'd', statut: 'RESOLU', echeance: j(-30) }), c({ id: 'e', echeance: j(40) })], cfg, now)
    expect(r.map(x => [x.constatId, x.type, x.destinataire])).toEqual([['a', 'ECHEANCE_PROCHE', 'AUDITE'], ['b', 'EN_RETARD', 'AUDITE'], ['d', 'A_VERIFIER', 'AUDIT']])
  })
  it('anti-doublon : pas de rappel avant la fin de la période de relance ; vérifié / accepté jamais relancés ; désactivable', () => {
    expect(calculerRappels([c({ id: 'a', rappelLe: j(-2) })], cfg, now)).toEqual([])
    expect(calculerRappels([c({ id: 'a', rappelLe: j(-8) })], cfg, now)).toHaveLength(1)
    expect(calculerRappels([c({ id: 'a', statut: 'VERIFIE' }), c({ id: 'b', statut: 'ACCEPTE' })], cfg, now)).toEqual([])
    expect(calculerRappels([c({ id: 'a' })], { ...cfg, rappelsActifs: false }, now)).toEqual([])
  })
  it('sans échéance : rien à rappeler (sauf réalisée à vérifier)', () => {
    expect(calculerRappels([c({ id: 'a', echeance: null })], cfg, now)).toEqual([])
  })
})
