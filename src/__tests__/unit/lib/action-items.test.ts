import { describe, it, expect } from 'vitest'
import {
  normalizeMesure,
  normalizeRiskAction,
  normalizeAuditConstat,
  normalizeControleAnomalie,
  normalizeIncident,
  normalizeConformiteTraitement,
  mapMesurePriorite,
  mapCriticitePriorite,
  filterActionItems,
  sortActionItems,
  summarizeActionItems,
  ACTION_SOURCES,
  ACTION_ORIGINES,
  type ActionItem,
} from '@/lib/action-items'

const NOW = new Date('2026-09-09T00:00:00Z')

describe('mapMesurePriorite (Int 1-4, 1 = plus prioritaire)', () => {
  it('1 → CRITIQUE, 2 → MAJEUR (défaut cohérent), 3+ → MODERE', () => {
    expect(mapMesurePriorite(1)).toBe('CRITIQUE')
    expect(mapMesurePriorite(2)).toBe('MAJEUR')
    expect(mapMesurePriorite(3)).toBe('MODERE')
    expect(mapMesurePriorite(4)).toBe('MODERE')
  })
  it('valeur absente/invalide → MAJEUR (défaut)', () => {
    expect(mapMesurePriorite(null)).toBe('MAJEUR')
    expect(mapMesurePriorite(undefined)).toBe('MAJEUR')
    expect(mapMesurePriorite(0)).toBe('MAJEUR')
  })
})

describe('mapCriticitePriorite (Int 1-4, 4 = plus critique — audit/incident)', () => {
  it('4 → CRITIQUE, 3 → MAJEUR, 1-2 → MODERE', () => {
    expect(mapCriticitePriorite(4)).toBe('CRITIQUE')
    expect(mapCriticitePriorite(3)).toBe('MAJEUR')
    expect(mapCriticitePriorite(2)).toBe('MODERE')
    expect(mapCriticitePriorite(1)).toBe('MODERE')
  })
  it('valeur absente → MAJEUR', () => {
    expect(mapCriticitePriorite(null)).toBe('MAJEUR')
  })
})

describe('normalizeMesure', () => {
  it('mappe nom/statut/priorité/porteur et REALISE → FAIT', () => {
    const item = normalizeMesure({
      id: 'm1', nom: 'Chiffrement des sauvegardes', statut: 'REALISE', priorite: 1,
      responsable: 'DSI', entite: 'Production', echeance: new Date('2026-01-01'),
      risqueId: 'r1',
    }, { lien: '/analyses/a1' })
    expect(item.source).toBe('MESURE')
    expect(item.id).toBe('MESURE:m1')
    expect(item.sourceId).toBe('m1')
    expect(item.titre).toBe('Chiffrement des sauvegardes')
    expect(item.statut).toBe('FAIT')
    expect(item.priorite).toBe('CRITIQUE')
    expect(item.porteur).toBe('DSI')
    expect(item.lien).toBe('/analyses/a1')
  })
  it('REPORTE → A_FAIRE ; porteur retombe sur entite si pas de responsable', () => {
    const item = normalizeMesure({
      id: 'm2', nom: 'X', statut: 'REPORTE', priorite: 2, responsable: null,
      entite: 'Métier', echeance: null, risqueId: null,
    })
    expect(item.statut).toBe('A_FAIRE')
    expect(item.porteur).toBe('Métier')
  })
})

describe('normalizeRiskAction', () => {
  it('conserve statut/priorité canoniques du registre', () => {
    const item = normalizeRiskAction({
      id: 'ra1', intitule: 'Revue des accès', description: 'desc', responsable: 'RSSI',
      echeance: new Date('2026-03-01'), statut: 'EN_COURS', priorite: 'MAJEUR', riskItemId: 'ri1',
    }, { lien: '/registre?item=ri1' })
    expect(item.source).toBe('RISK_ACTION')
    expect(item.statut).toBe('EN_COURS')
    expect(item.priorite).toBe('MAJEUR')
    expect(item.riskItemId).toBe('ri1')
  })
})

describe('normalizeAuditConstat', () => {
  it('OUVERT → A_FAIRE, criticité 4 → CRITIQUE, recommandation en description', () => {
    const item = normalizeAuditConstat({
      id: 'c1', intitule: 'Absence de revue', recommandation: 'Mettre en place une revue trimestrielle',
      criticite: 4, statut: 'OUVERT', responsableAction: 'Audit', echeance: null, riskItemId: null,
    }, { lien: '/audit?mission=x' })
    expect(item.source).toBe('AUDIT')
    expect(item.statut).toBe('A_FAIRE')
    expect(item.priorite).toBe('CRITIQUE')
    expect(item.description).toBe('Mettre en place une revue trimestrielle')
    expect(item.porteur).toBe('Audit')
  })
  it('RESOLU et ACCEPTE → FAIT', () => {
    expect(normalizeAuditConstat({ id: 'a', intitule: 't', statut: 'RESOLU', criticite: 1 }).statut).toBe('FAIT')
    expect(normalizeAuditConstat({ id: 'b', intitule: 't', statut: 'ACCEPTE', criticite: 1 }).statut).toBe('FAIT')
  })
})

describe('normalizeControleAnomalie', () => {
  it('une anomalie est une action A_FAIRE, priorité par défaut MAJEUR', () => {
    const item = normalizeControleAnomalie({
      id: 'e1', controleNom: 'Contrôle des habilitations', constat: 'Écart détecté',
      dateRealisation: new Date('2026-08-01'), responsable: 'Contrôle N1',
    }, { lien: '/controles?controle=k1' })
    expect(item.source).toBe('CONTROLE')
    expect(item.statut).toBe('A_FAIRE')
    expect(item.priorite).toBe('MAJEUR')
    expect(item.titre).toContain('Contrôle des habilitations')
    expect(item.description).toBe('Écart détecté')
  })
})

describe('normalizeIncident', () => {
  it('DECLARE → A_FAIRE, QUALIFIE → EN_COURS, CLOTURE → FAIT', () => {
    expect(normalizeIncident({ id: 'i1', intitule: 't', statut: 'DECLARE', impactEstime: 4 })!.statut).toBe('A_FAIRE')
    expect(normalizeIncident({ id: 'i2', intitule: 't', statut: 'QUALIFIE', impactEstime: 2 })!.statut).toBe('EN_COURS')
    expect(normalizeIncident({ id: 'i3', intitule: 't', statut: 'CLOTURE', impactEstime: 1 })!.statut).toBe('FAIT')
  })
  it('REJETE renvoie null (exclu des plans d’action)', () => {
    expect(normalizeIncident({ id: 'i4', intitule: 't', statut: 'REJETE', impactEstime: 1 })).toBeNull()
  })
  it('impactEstime 4 → CRITIQUE', () => {
    expect(normalizeIncident({ id: 'i5', intitule: 't', statut: 'DECLARE', impactEstime: 4 })!.priorite).toBe('CRITIQUE')
  })
})

function mk(partial: Partial<ActionItem>): ActionItem {
  return {
    id: partial.id ?? 'x', source: partial.source ?? 'MESURE', sourceId: partial.sourceId ?? 'x',
    origine: partial.origine ?? 'risque',
    titre: partial.titre ?? 't', description: partial.description ?? null, porteur: partial.porteur ?? null,
    entite: partial.entite ?? null, echeance: partial.echeance ?? null,
    statut: partial.statut ?? 'A_FAIRE', priorite: partial.priorite ?? 'MAJEUR',
    lien: partial.lien ?? null, riskItemId: partial.riskItemId ?? null,
  }
}

describe('filterActionItems', () => {
  const items: ActionItem[] = [
    mk({ id: '1', source: 'MESURE', priorite: 'CRITIQUE', statut: 'A_FAIRE', porteur: 'DSI', titre: 'Chiffrer' }),
    mk({ id: '2', source: 'AUDIT', priorite: 'MODERE', statut: 'FAIT', porteur: 'Audit', titre: 'Revue' }),
    mk({ id: '3', source: 'INCIDENT', priorite: 'MAJEUR', statut: 'A_FAIRE', porteur: 'DSI', echeance: new Date('2020-01-01') }),
  ]
  it('filtre par source', () => {
    expect(filterActionItems(items, { source: 'MESURE' }, NOW).map(i => i.id)).toEqual(['1'])
  })
  it('filtre par origine (typologie de plan d\'action)', () => {
    const parOrigine: ActionItem[] = [
      mk({ id: 'r', origine: 'risque' }),
      mk({ id: 'c', origine: 'conformite' }),
      mk({ id: 'reg', origine: 'regulateur' }),
    ]
    expect(filterActionItems(parOrigine, { origine: 'conformite' }, NOW).map(i => i.id)).toEqual(['c'])
    expect(filterActionItems(parOrigine, { origine: 'regulateur' }, NOW).map(i => i.id)).toEqual(['reg'])
  })
  it('filtre par priorité', () => {
    expect(filterActionItems(items, { priorite: 'CRITIQUE' }, NOW).map(i => i.id)).toEqual(['1'])
  })
  it('filtre par porteur (insensible casse/partiel)', () => {
    expect(filterActionItems(items, { porteur: 'dsi' }, NOW).map(i => i.id)).toEqual(['1', '3'])
  })
  it('filtre par statut effectif EN_RETARD (échéance passée + non fait)', () => {
    expect(filterActionItems(items, { statut: 'EN_RETARD' }, NOW).map(i => i.id)).toEqual(['3'])
  })
  it('filtre par recherche texte sur le titre', () => {
    expect(filterActionItems(items, { q: 'chiff' }, NOW).map(i => i.id)).toEqual(['1'])
  })
  it('sans filtre : tout', () => {
    expect(filterActionItems(items, {}, NOW)).toHaveLength(3)
  })
  it('filtre par fenêtre d\'échéance (retard / semaine / sans)', () => {
    const win: ActionItem[] = [
      mk({ id: 'r', statut: 'A_FAIRE', echeance: new Date('2020-01-01') }),            // en retard
      mk({ id: 's', statut: 'A_FAIRE', echeance: new Date(NOW.getTime() + 3 * 86400000) }), // dans 3j
      mk({ id: 'm', statut: 'A_FAIRE', echeance: new Date(NOW.getTime() + 20 * 86400000) }), // dans 20j
      mk({ id: 'n', statut: 'A_FAIRE', echeance: null }),                               // sans échéance
    ]
    expect(filterActionItems(win, { echeanceBucket: 'retard' }, NOW).map(i => i.id)).toEqual(['r'])
    expect(filterActionItems(win, { echeanceBucket: 'semaine' }, NOW).map(i => i.id)).toEqual(['s'])
    expect(filterActionItems(win, { echeanceBucket: 'mois' }, NOW).map(i => i.id).sort()).toEqual(['m', 's'])
    expect(filterActionItems(win, { echeanceBucket: 'sans' }, NOW).map(i => i.id)).toEqual(['n'])
  })
})

describe('sortActionItems', () => {
  it('EN_RETARD d’abord, puis priorité CRITIQUE→MODERE, puis échéance croissante', () => {
    const items: ActionItem[] = [
      mk({ id: 'moderee', priorite: 'MODERE', statut: 'A_FAIRE', echeance: new Date('2027-01-01') }),
      mk({ id: 'retard', priorite: 'MODERE', statut: 'A_FAIRE', echeance: new Date('2020-01-01') }),
      mk({ id: 'critique', priorite: 'CRITIQUE', statut: 'A_FAIRE', echeance: new Date('2027-01-01') }),
    ]
    expect(sortActionItems(items, NOW).map(i => i.id)).toEqual(['retard', 'critique', 'moderee'])
  })
})

describe('summarizeActionItems', () => {
  it('réutilise la synthèse d’avancement (retard dérivé)', () => {
    const items: ActionItem[] = [
      mk({ statut: 'FAIT' }),
      mk({ statut: 'A_FAIRE', echeance: new Date('2020-01-01') }),
      mk({ statut: 'EN_COURS' }),
    ]
    const s = summarizeActionItems(items, NOW)
    expect(s.total).toBe(3)
    expect(s.faits).toBe(1)
    expect(s.enRetard).toBe(1)
    expect(s.enCours).toBe(1)
    expect(s.tauxAvancement).toBe(33)
  })
})

describe('ACTION_SOURCES', () => {
  it('énumère les sources (dont conformité)', () => {
    expect(ACTION_SOURCES).toEqual(['MESURE', 'RISK_ACTION', 'CONFORMITE', 'AUDIT', 'CONTROLE', 'INCIDENT'])
  })
})

describe('typologie d\'origine', () => {
  it('ACTION_ORIGINES = 6 facettes métier', () => {
    expect(ACTION_ORIGINES).toEqual(['risque', 'conformite', 'controle', 'audit', 'regulateur', 'incident'])
  })
  it('mesure et action de registre → origine « risque »', () => {
    expect(normalizeMesure({ id: 'm', nom: 'x' }).origine).toBe('risque')
    expect(normalizeRiskAction({ id: 'ra', intitule: 'x' }).origine).toBe('risque')
  })
  it('constat d\'audit interne → « audit », constat régulateur → « regulateur »', () => {
    expect(normalizeAuditConstat({ id: 'a', intitule: 'x', source: 'AUDIT_INTERNE' }).origine).toBe('audit')
    expect(normalizeAuditConstat({ id: 'a', intitule: 'x', source: 'AUDITEUR_EXTERNE' }).origine).toBe('audit')
    expect(normalizeAuditConstat({ id: 'a', intitule: 'x', source: 'REGULATEUR' }).origine).toBe('regulateur')
  })
  it('anomalie de contrôle → « controle », incident → « incident »', () => {
    expect(normalizeControleAnomalie({ id: 'c', controleNom: 'x' }).origine).toBe('controle')
    expect(normalizeIncident({ id: 'i', intitule: 'x', statut: 'DECLARE' })!.origine).toBe('incident')
  })
  it('traitement de conformité (plan d\'action) → source CONFORMITE, origine « conformite »', () => {
    const it = normalizeConformiteTraitement({
      id: 'ct1', intitule: 'Corriger A.5.1', description: 'd', responsable: 'RSSI',
      echeance: new Date('2026-06-01'), statut: 'EN_COURS', referentiel: 'ISO27001', refs: ['A.5.1'],
    }, { lien: '/conformite/socle?ref=ISO27001' })
    expect(it.source).toBe('CONFORMITE')
    expect(it.origine).toBe('conformite')
    expect(it.titre).toBe('Corriger A.5.1')
    expect(it.porteur).toBe('RSSI')
    expect(it.statut).toBe('EN_COURS')
  })
})
