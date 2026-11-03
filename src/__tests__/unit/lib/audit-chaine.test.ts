// Journal d'audit infalsifiable : empreinte déterministe de chaque entrée chaînée à la précédente ; toute modification,
// suppression ou insertion au milieu de la chaîne est détectée et localisée.
import { describe, expect, it } from 'vitest'
import { empreinte, verifierSegment, GENESE, type EntreeAudit } from '@/lib/audit-chaine'

const e = (seq: number, o: Partial<EntreeAudit> = {}): EntreeAudit => ({
  seq: BigInt(seq), createdAt: new Date(`2026-11-03T08:00:0${seq % 10}Z`), action: 'LOGIN_SUCCESS', userId: 'u1', userEmail: 'a@b.fr', userRole: 'RSSI',
  targetId: null, targetType: null, ip: '10.0.0.1', details: null, organizationId: 'org1', ...o,
})
function chainer(entrees: EntreeAudit[], cle?: string) {
  let prev = GENESE
  return entrees.map(x => { const h = empreinte(x, prev, cle); const r = { ...x, hashPrecedent: prev, hash: h }; prev = h; return r })
}

describe('empreinte', () => {
  it('déterministe, dépend du contenu, de la précédente et de la clé', () => {
    expect(empreinte(e(1), GENESE)).toBe(empreinte(e(1), GENESE))
    expect(empreinte(e(1), GENESE)).not.toBe(empreinte(e(1, { action: 'LOGIN_FAILED' }), GENESE))
    expect(empreinte(e(1), GENESE)).not.toBe(empreinte(e(1), 'autre'))
    expect(empreinte(e(1), GENESE, 'cle-secrete')).not.toBe(empreinte(e(1), GENESE))
    expect(empreinte(e(1), GENESE)).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('verifierSegment', () => {
  const chaine = chainer([e(1), e(2), e(3), e(4)])
  it('chaîne intacte', () => {
    expect(verifierSegment(chaine, GENESE)).toEqual({ ok: true, verifiees: 4, dernierHash: chaine[3].hash })
  })
  it('contenu modifié : rupture localisée', () => {
    const k = chaine.map((x, i) => (i === 2 ? { ...x, details: '{"falsifie":true}' } : x))
    expect(verifierSegment(k, GENESE)).toEqual({ ok: false, verifiees: 2, rupture: { seq: '3', raison: 'contenu_modifie' } })
  })
  it('entrée supprimée : maillon manquant détecté sur la suivante', () => {
    const k = [chaine[0], chaine[2], chaine[3]]
    expect(verifierSegment(k, GENESE)).toMatchObject({ ok: false, rupture: { seq: '3', raison: 'maillon_manquant' } })
  })
  it('chaîne recalculée sans la clé : détectée si une clé est configurée', () => {
    const avecCle = chainer([e(1), e(2)], 'cle-secrete')
    expect(verifierSegment(avecCle, GENESE, 'cle-secrete').ok).toBe(true)
    expect(verifierSegment(chainer([e(1), e(2)]), GENESE, 'cle-secrete')).toMatchObject({ ok: false, rupture: { seq: '1', raison: 'contenu_modifie' } })
  })
  it('vérification par lots : reprise à partir de la dernière empreinte', () => {
    const r1 = verifierSegment(chaine.slice(0, 2), GENESE)
    expect(r1.ok && verifierSegment(chaine.slice(2), r1.dernierHash).ok).toBe(true)
  })
})
