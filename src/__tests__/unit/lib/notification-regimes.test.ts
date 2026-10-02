/** Régimes de notification d'incident configurables (NIS2, RGPD, interne, personnalisés). */
import { describe, expect, it } from 'vitest'
import {
  CATALOGUE_REGIMES, resolveRegimes, sanitizeRegimesConfig, regimeApplicable, calculerHorloges,
  sanitizeNotifications, marquerSoumis, retirerSoumission,
} from '@/lib/notification-regimes'

const T0 = new Date('2026-09-29T08:00:00Z')
const h = (n: number) => new Date(T0.getTime() + n * 3600_000)

describe('catalogue et résolution', () => {
  it('livre NIS2, RGPD art. 33, CRA art. 14, SEC 8-K, NYDFS 500.17, HIPAA et un régime interne, tous inactifs par défaut (rétrocompatible)', () => {
    expect(CATALOGUE_REGIMES.map(r => r.code)).toEqual(['NIS2', 'RGPD_33', 'CRA_14', 'SEC_8K', 'NYDFS_500_17', 'HIPAA_BREACH', 'US_BANKING_36H', 'FTC_SAFEGUARDS', 'INTERNE'])
    expect(resolveRegimes(undefined).every(r => !r.actif)).toBe(true)
  })
  it('NIS2 : alerte précoce 24 h, notification 72 h, rapport final un mois après la notification', () => {
    const nis2 = CATALOGUE_REGIMES.find(r => r.code === 'NIS2')!
    expect(nis2.phases.map(p => [p.code, p.delai, p.apres])).toEqual([
      ['ALERTE_PRECOCE', { h: 24 }, 'CONNAISSANCE'],
      ['NOTIFICATION', { h: 72 }, 'CONNAISSANCE'],
      ['RAPPORT_FINAL', { mois: 1 }, 'NOTIFICATION'],
    ])
    expect(nis2.declencheur).toBe('INCIDENT_SIGNIFICATIF')
  })
  it('RGPD art. 33 : 72 h après la connaissance de la violation, déclencheur données personnelles', () => {
    const g = CATALOGUE_REGIMES.find(r => r.code === 'RGPD_33')!
    expect(g.phases).toHaveLength(1)
    expect(g.phases[0].delai).toEqual({ h: 72 })
    expect(g.declencheur).toBe('DONNEES_PERSONNELLES')
  })
  it('l’organisation active un régime et surcharge un délai sans toucher au reste', () => {
    const r = resolveRegimes([{ code: 'INTERNE', actif: true, phases: [{ code: 'INFORMER_DIRECTION', delaiH: 2 }] }])
    const interne = r.find(x => x.code === 'INTERNE')!
    expect(interne.actif).toBe(true)
    expect(interne.phases.find(p => p.code === 'INFORMER_DIRECTION')!.delai).toEqual({ h: 2 })
    expect(interne.phases.length).toBe(CATALOGUE_REGIMES.find(x => x.code === 'INTERNE')!.phases.length)
  })
  it('un régime personnalisé (contractuel client) fonctionne sans code', () => {
    const r = resolveRegimes([{ code: 'CLIENT_X', actif: true, label: 'Client X', autorite: 'Client X', declencheur: 'CONTRACTUEL',
      phases: [{ code: 'PREVENIR', label: 'Prévenir le client', delaiH: 2, apres: 'CONNAISSANCE' }] }])
    const c = r.find(x => x.code === 'CLIENT_X')!
    expect(c.custom).toBe(true)
    expect(c.phases[0].delai).toEqual({ h: 2 })
  })
})

describe('sanitizeRegimesConfig', () => {
  it('écarte codes invalides, doublons, délais négatifs ou absurdes, phases en trop', () => {
    const out = sanitizeRegimesConfig([
      { code: 'bad code', actif: true },
      { code: 'NIS2', actif: true }, { code: 'NIS2', actif: false },
      { code: 'X1', actif: true, label: 'X', declencheur: 'MANUEL', phases: [{ code: 'P', label: 'p', delaiH: -3 }, { code: 'Q', label: 'q', delaiH: 999999 }, { code: 'R', label: 'r', delaiH: 5 }] },
      42, null,
    ])
    expect(out.map(r => r.code)).toEqual(['NIS2', 'X1'])
    expect(out[0].actif).toBe(true)
    expect(out[1].phases?.map(p => p.code)).toEqual(['R'])
  })
  it('borne le nombre de régimes personnalisés', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ code: `C${i}`, actif: true, label: 'c', declencheur: 'MANUEL', phases: [{ code: 'P', label: 'p', delaiH: 1 }] }))
    expect(sanitizeRegimesConfig(many).length).toBeLessThanOrEqual(12)
  })
})

describe('applicabilité', () => {
  const r = (code: string) => resolveRegimes([{ code, actif: true }]).find(x => x.code === code)!
  it('suit le déclencheur : significatif, données personnelles, contractuel, manuel, toujours', () => {
    expect(regimeApplicable(r('NIS2'), { significatif: true })).toBe(true)
    expect(regimeApplicable(r('NIS2'), {})).toBe(false)
    expect(regimeApplicable(r('RGPD_33'), { donneesPersonnelles: true })).toBe(true)
    expect(regimeApplicable(r('RGPD_33'), { significatif: true })).toBe(false)
    expect(regimeApplicable(r('INTERNE'), {})).toBe(true)
  })
  it('un régime inactif n’est jamais applicable ; le déclenchement manuel se fait par la liste `regimes`', () => {
    expect(regimeApplicable({ ...r('NIS2'), actif: false }, { significatif: true })).toBe(false)
    const man = resolveRegimes([{ code: 'M1', actif: true, label: 'M', declencheur: 'MANUEL', phases: [{ code: 'P', label: 'p', delaiH: 1 }] }]).find(x => x.code === 'M1')!
    expect(regimeApplicable(man, {})).toBe(false)
    expect(regimeApplicable(man, { regimes: ['M1'] })).toBe(true)
  })
})

describe('calculerHorloges', () => {
  const regimes = resolveRegimes([{ code: 'NIS2', actif: true }, { code: 'RGPD_33', actif: true }])
  const base = { connaissance: T0, attributs: { significatif: true, donneesPersonnelles: true }, notifications: [] }

  it('affiche simultanément les horloges des régimes applicables (NIS2 + RGPD)', () => {
    const hs = calculerHorloges(base, regimes, h(1))
    expect(hs.map(x => x.regime)).toEqual(['NIS2', 'RGPD_33'])
    const nis2 = hs[0].phases
    expect(nis2[0].echeance).toEqual(h(24))
    expect(nis2[1].echeance).toEqual(h(72))
    expect(nis2[0].statut).toBe('A_FAIRE')
    expect(hs[1].phases[0].echeance).toEqual(h(72))
  })
  it('désactiver NIS2 retire son horloge', () => {
    const hs = calculerHorloges(base, resolveRegimes([{ code: 'RGPD_33', actif: true }]), h(1))
    expect(hs.map(x => x.regime)).toEqual(['RGPD_33'])
  })
  it('le rapport final attend la notification, puis court un mois après sa soumission', () => {
    const av = calculerHorloges(base, regimes, h(30))[0].phases[2]
    expect(av.statut).toBe('EN_ATTENTE')
    expect(av.echeance).toBeNull()
    const notifs = [{ regime: 'NIS2', phase: 'NOTIFICATION', soumisLe: h(50).toISOString() }]
    const ap = calculerHorloges({ ...base, notifications: notifs }, regimes, h(60))[0].phases[2]
    expect(ap.echeance).toEqual(new Date('2026-11-01T10:00:00Z'))
    expect(ap.statut).toBe('A_FAIRE')
  })
  it('en retard quand l’échéance est passée sans soumission ; soumis tardivement est signalé', () => {
    const late = calculerHorloges(base, regimes, h(25))[0].phases[0]
    expect(late.statut).toBe('EN_RETARD')
    const ok = calculerHorloges({ ...base, notifications: [{ regime: 'NIS2', phase: 'ALERTE_PRECOCE', soumisLe: h(10).toISOString(), reference: 'ANSSI-1' }] }, regimes, h(25))[0].phases[0]
    expect([ok.statut, ok.tardive, ok.reference]).toEqual(['SOUMIS', false, 'ANSSI-1'])
    const tard = calculerHorloges({ ...base, notifications: [{ regime: 'NIS2', phase: 'ALERTE_PRECOCE', soumisLe: h(30).toISOString() }] }, regimes, h(31))[0].phases[0]
    expect([tard.statut, tard.tardive]).toEqual(['SOUMIS', true])
  })
  it('sans date de connaissance, aucune échéance n’est inventée', () => {
    const p = calculerHorloges({ ...base, connaissance: null }, regimes, h(1))[0].phases[0]
    expect(p.echeance).toBeNull()
    expect(p.statut).toBe('EN_ATTENTE')
  })
})

describe('notifications soumises', () => {
  it('nettoie l’entrée, marque et retire une soumission (une seule par phase)', () => {
    expect(sanitizeNotifications([{ regime: 'NIS2', phase: 'ALERTE_PRECOCE', soumisLe: '2026-09-29T10:00:00Z', reference: 'R1' }, { regime: '', phase: 'x' }, 'z'])).toHaveLength(1)
    let n = marquerSoumis([], { regime: 'NIS2', phase: 'NOTIFICATION', soumisLe: T0, reference: 'A' })
    n = marquerSoumis(n, { regime: 'NIS2', phase: 'NOTIFICATION', soumisLe: h(1), reference: 'B' })
    expect(n).toHaveLength(1)
    expect(n[0].reference).toBe('B')
    expect(retirerSoumission(n, 'NIS2', 'NOTIFICATION')).toEqual([])
  })
})

describe('régimes ajoutés : CRA, SEC 8-K, NYDFS, HIPAA', () => {
  const regime = (code: string) => CATALOGUE_REGIMES.find(r => r.code === code)!
  it('CRA (Règlement (UE) 2024/2847, art. 14) : alerte précoce 24 h, notification 72 h, rapport final un mois après la notification ; ajout manuel', () => {
    expect(regime('CRA_14').phases.map(p => [p.code, p.delai, p.apres])).toEqual([
      ['ALERTE_PRECOCE', { h: 24 }, 'CONNAISSANCE'], ['NOTIFICATION', { h: 72 }, 'CONNAISSANCE'], ['RAPPORT_FINAL', { mois: 1 }, 'NOTIFICATION'],
    ])
    expect(regime('CRA_14').declencheur).toBe('MANUEL')
  })
  it('SEC 8-K item 1.05 : 4 jours ouvrés ; NYDFS 500.17 : 72 h ; HIPAA : 60 jours', () => {
    expect(regime('SEC_8K').phases[0].delai).toEqual({ jOuvres: 4 })
    expect(regime('NYDFS_500_17').phases[0].delai).toEqual({ h: 72 })
    expect(regime('HIPAA_BREACH').phases[0].delai).toEqual({ jours: 60 })
  })
  it('les délais en jours et en jours ouvrés (samedi/dimanche exclus) sont calculés', () => {
    const regimes = resolveRegimes([{ code: 'SEC_8K', actif: true }, { code: 'HIPAA_BREACH', actif: true }])
    const vendredi = new Date('2026-10-02T12:00:00Z') // vendredi
    const h = calculerHorloges({ connaissance: vendredi, attributs: { regimes: ['SEC_8K', 'HIPAA_BREACH'] }, notifications: [] }, regimes, vendredi)
    const sec = h.find(x => x.regime === 'SEC_8K')!.phases[0].echeance!
    expect(sec.toISOString()).toBe('2026-10-08T12:00:00.000Z') // ven → lun(1) mar(2) mer(3) jeu(4)
    const hipaa = h.find(x => x.regime === 'HIPAA_BREACH')!.phases[0].echeance!
    expect(hipaa.toISOString()).toBe('2026-12-01T12:00:00.000Z') // +60 jours
  })
})

describe('régimes bancaires et FTC des États-Unis', () => {
  const regime = (code: string) => CATALOGUE_REGIMES.find(r => r.code === code)!
  it('agences bancaires fédérales : 36 h après la détermination ; FTC Safeguards : 30 jours ; ajout manuel, inactifs par défaut', () => {
    expect(regime('US_BANKING_36H').phases[0].delai).toEqual({ h: 36 }); expect(regime('FTC_SAFEGUARDS').phases[0].delai).toEqual({ jours: 30 })
    expect(regime('US_BANKING_36H').declencheur).toBe('MANUEL'); expect(regime('FTC_SAFEGUARDS').actif).toBe(false)
  })
  it('échéance FTC calculée en jours calendaires', () => {
    const regimes = resolveRegimes([{ code: 'FTC_SAFEGUARDS', actif: true }])
    const t0 = new Date('2026-10-02T12:00:00Z')
    const h = calculerHorloges({ connaissance: t0, attributs: { regimes: ['FTC_SAFEGUARDS'] }, notifications: [] }, regimes, t0)
    expect(h[0].phases[0].echeance!.toISOString()).toBe('2026-11-01T12:00:00.000Z')
  })
})
