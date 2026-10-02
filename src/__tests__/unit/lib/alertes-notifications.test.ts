import { describe, expect, it } from 'vitest'
import { alertesRegimesDues } from '@/lib/alertes-notifications'
import { calculerHorloges, resolveRegimes } from '@/lib/notification-regimes'

const H = 3_600_000
const T0 = new Date('2026-10-05T08:00:00Z')
const regimes = resolveRegimes([{ code: 'NIS2', actif: true }, { code: 'CRA_14', actif: true }])
const horloges = (connaissance: Date, notifications: { regime: string; phase: string; soumisLe: string }[], now: Date) =>
  calculerHorloges({ connaissance, attributs: { significatif: true, regimes: ['CRA_14'] }, notifications }, regimes, now)

describe('alertesRegimesDues — relances des déclarations à faire (tous régimes)', () => {
  it('rien tant qu’on est loin de l’échéance ; alerte quand le quart final du délai commence', () => {
    // NIS2 alerte précoce 24 h : fenêtre = dernier quart (6 h) ; à T0+17 h il reste 7 h ⇒ pas encore ; à T0+19 h il reste 5 h ⇒ alerte
    expect(alertesRegimesDues(horloges(T0, [], new Date(T0.getTime() + 17 * H)), {}, new Date(T0.getTime() + 17 * H)).filter(a => a.regime === 'NIS2' && a.phase === 'ALERTE_PRECOCE')).toHaveLength(0)
    const now = new Date(T0.getTime() + 19 * H)
    const dues = alertesRegimesDues(horloges(T0, [], now), {}, now).filter(a => a.regime === 'NIS2' && a.phase === 'ALERTE_PRECOCE')
    expect(dues).toHaveLength(1)
    expect(dues[0]).toMatchObject({ statut: 'A_FAIRE', cle: 'NIS2:ALERTE_PRECOCE:A_FAIRE' })
  })
  it('retard : alerte EN_RETARD distincte ; chaque alerte n’est émise qu’une fois', () => {
    const now = new Date(T0.getTime() + 30 * H)
    const premiere = alertesRegimesDues(horloges(T0, [], now), {}, now).find(a => a.regime === 'NIS2' && a.phase === 'ALERTE_PRECOCE' && a.statut === 'EN_RETARD')!
    expect(premiere.cle).toBe('NIS2:ALERTE_PRECOCE:EN_RETARD')
    const deja = { [premiere.cle]: now.toISOString() }
    expect(alertesRegimesDues(horloges(T0, [], now), deja, now).some(a => a.cle === premiere.cle)).toBe(false)
  })
  it('une phase soumise ne déclenche rien ; une phase qui suit une autre attend sa soumission (pas d’échéance inventée)', () => {
    const now = new Date(T0.getTime() + 100 * H)
    const soumis = [{ regime: 'NIS2', phase: 'ALERTE_PRECOCE', soumisLe: T0.toISOString() }, { regime: 'NIS2', phase: 'NOTIFICATION', soumisLe: new Date(T0.getTime() + 60 * H).toISOString() }]
    const dues = alertesRegimesDues(horloges(T0, soumis, now), {}, now).filter(a => a.regime === 'NIS2')
    expect(dues.map(a => a.phase)).not.toContain('ALERTE_PRECOCE'); expect(dues.map(a => a.phase)).not.toContain('NOTIFICATION')
    const sansNotif = alertesRegimesDues(horloges(T0, [soumis[0]], new Date(T0.getTime() + 30 * H)), {}, new Date(T0.getTime() + 30 * H)).filter(a => a.regime === 'NIS2')
    expect(sansNotif.map(a => a.phase)).not.toContain('RAPPORT_FINAL') // attend la notification
  })
  it('rapport final : alerte dans la dernière semaine du mois suivant la notification, puis au retard', () => {
    const notif = new Date(T0.getTime() + 50 * H)
    const soumis = [{ regime: 'NIS2', phase: 'ALERTE_PRECOCE', soumisLe: T0.toISOString() }, { regime: 'NIS2', phase: 'NOTIFICATION', soumisLe: notif.toISOString() }]
    const echeance = new Date(notif); echeance.setUTCMonth(echeance.getUTCMonth() + 1)
    const sixJours = new Date(echeance.getTime() - 6 * 24 * H)
    expect(alertesRegimesDues(horloges(T0, soumis, sixJours), {}, sixJours).some(a => a.regime === 'NIS2' && a.phase === 'RAPPORT_FINAL' && a.statut === 'A_FAIRE')).toBe(true)
    const vingtJours = new Date(echeance.getTime() - 20 * 24 * H)
    expect(alertesRegimesDues(horloges(T0, soumis, vingtJours), {}, vingtJours).some(a => a.phase === 'RAPPORT_FINAL')).toBe(false)
  })
})
