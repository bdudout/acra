// Recette n° 32 : accueil selon le rôle — les rôles sans analyse (Métier, Contrôleur, Auditeur, Direction métier) voient
// leur action principale et « À traiter » au lieu des compteurs d'analyses à 0, du guide EBIOS et de la configuration.
import { describe, expect, it } from 'vitest'
import { accueilRole } from '@/lib/accueil-role'

const tous = { incidentsActive: true, controlePermanentActive: true, auditInterneActive: true, conformiteActive: true, registreRisquesActive: true, kriActive: true, grcActive: true }

describe('accueilRole', () => {
  it('Métier sans analyse : « Déclarer un incident » ; Contrôleur : contrôles ; Auditeur : missions ; Direction métier : plan d’action', () => {
    expect(accueilRole('METIER', 0, tous)).toEqual({ centreAnalyses: false, actions: [{ cle: 'declarerIncident', href: '/incidents' }, { cle: 'planAction', href: '/actions' }] })
    expect(accueilRole('CONTROLEUR', 0, tous).actions[0]).toEqual({ cle: 'executerControles', href: '/controles' })
    expect(accueilRole('AUDITEUR', 0, tous).actions[0]).toEqual({ cle: 'missionsAudit', href: '/audit' })
    expect(accueilRole('DIRECTION_METIER', 0, tous).actions[0]).toEqual({ cle: 'pilotage', href: '/pilotage' })
  })
  it('module inactif : action retirée (le plan d’action reste)', () => {
    expect(accueilRole('METIER', 0, { ...tous, incidentsActive: false }).actions).toEqual([{ cle: 'planAction', href: '/actions' }])
    expect(accueilRole('CONTROLEUR', 0, { ...tous, controlePermanentActive: false }).actions).toEqual([{ cle: 'planAction', href: '/actions' }])
  })
  it('rôle d’analyse, ou rôle métier à qui une analyse est partagée : accueil des analyses inchangé', () => {
    expect(accueilRole('ANALYSTE', 0, tous)).toEqual({ centreAnalyses: true, actions: [] })
    expect(accueilRole('ANALYSTE', 3, tous).centreAnalyses).toBe(true)
    expect(accueilRole('METIER', 2, tous).centreAnalyses).toBe(true)
  })
})

// Recette n° 32 (suite, option a : rôle effectif dans l'entité active) : DPO, gestionnaire des risques, direction
// métier et RSSI sans analyse ont aussi leur accueil, selon les modules actifs.
describe('accueilRole — DPO, gestionnaire des risques, direction métier, RSSI', () => {
  const plan = { cle: 'planAction', href: '/actions' }
  it('actions principales par rôle', () => {
    expect(accueilRole('DPO', 0, tous)).toEqual({ centreAnalyses: false, actions: [{ cle: 'registreTraitements', href: '/rgpd' }, plan] })
    expect(accueilRole('RISK_MANAGER', 0, tous).actions).toEqual([{ cle: 'pilotage', href: '/pilotage' }, { cle: 'registreRisques', href: '/registre' }, { cle: 'suivreKri', href: '/kri' }, plan])
    expect(accueilRole('DIRECTION_METIER', 0, tous).actions).toEqual([{ cle: 'pilotage', href: '/pilotage' }, plan])
    expect(accueilRole('RSSI', 0, tous).actions).toEqual([{ cle: 'conformite', href: '/conformite' }, { cle: 'pilotage', href: '/pilotage' }, plan])
  })
  it('modules inactifs : actions correspondantes retirées ; une analyse visible rend l’accueil des analyses', () => {
    const aucun = { incidentsActive: false, controlePermanentActive: false, auditInterneActive: false, conformiteActive: false, registreRisquesActive: false, kriActive: false, grcActive: false }
    expect(accueilRole('RISK_MANAGER', 0, aucun).actions).toEqual([plan])
    expect(accueilRole('RSSI', 0, aucun).actions).toEqual([plan])
    expect(accueilRole('RSSI', 1, tous).centreAnalyses).toBe(true)
  })
})

