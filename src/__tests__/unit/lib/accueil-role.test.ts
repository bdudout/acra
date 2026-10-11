// Recette n° 32 : accueil selon le rôle — les rôles sans analyse (Métier, Contrôleur, Auditeur, Direction métier) voient
// leur action principale et « À traiter » au lieu des compteurs d'analyses à 0, du guide EBIOS et de la configuration.
import { describe, expect, it } from 'vitest'
import { accueilRole } from '@/lib/accueil-role'

const tous = { incidentsActive: true, controlePermanentActive: true, auditInterneActive: true }

describe('accueilRole', () => {
  it('Métier sans analyse : « Déclarer un incident » ; Contrôleur : contrôles ; Auditeur : missions ; Direction métier : plan d’action', () => {
    expect(accueilRole('METIER', 0, tous)).toEqual({ centreAnalyses: false, actions: [{ cle: 'declarerIncident', href: '/incidents' }, { cle: 'planAction', href: '/actions' }] })
    expect(accueilRole('CONTROLEUR', 0, tous).actions[0]).toEqual({ cle: 'executerControles', href: '/controles' })
    expect(accueilRole('AUDITEUR', 0, tous).actions[0]).toEqual({ cle: 'missionsAudit', href: '/audit' })
    expect(accueilRole('DIRECTION_METIER', 0, tous).actions[0]).toEqual({ cle: 'planAction', href: '/actions' })
  })
  it('module inactif : action retirée (le plan d’action reste)', () => {
    expect(accueilRole('METIER', 0, { ...tous, incidentsActive: false }).actions).toEqual([{ cle: 'planAction', href: '/actions' }])
    expect(accueilRole('CONTROLEUR', 0, { ...tous, controlePermanentActive: false }).actions).toEqual([{ cle: 'planAction', href: '/actions' }])
  })
  it('rôle d’analyse, ou rôle métier à qui une analyse est partagée : accueil des analyses inchangé', () => {
    expect(accueilRole('ANALYSTE', 0, tous)).toEqual({ centreAnalyses: true, actions: [] })
    expect(accueilRole('RSSI', 0, tous).centreAnalyses).toBe(true)
    expect(accueilRole('METIER', 2, tous).centreAnalyses).toBe(true)
  })
})
