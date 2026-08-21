/**
 * navigation.test.ts — modèle de navigation (fonction pure), deux modes.
 *
 * `buildNav` renvoie `{ mode, entries }` :
 *  - mode `cyber` : parcours EBIOS inline + menu « GRC » (gouvernance/incidents) ;
 *  - mode `grc`   : cyber replié en sous-menu, domaines GRC groupés en tête.
 *
 * Règle d'or : le GATING (qui voit quoi) reste identique au comportement
 * historique — seule la DISPOSITION change selon le mode.
 */
import { describe, it, expect } from 'vitest'
import { buildNav, type NavModel, type NavKey, type NavGroupId, type NavModules } from '@/lib/navigation'

const ALL_ON: NavModules = { registre: true, incidents: true, controles: true, audit: true, kri: true, reglementaire: true }
const ALL_OFF: NavModules = { registre: false, incidents: false, controles: false, audit: false, kri: false, reglementaire: false }

/** Toutes les destinations atteignables (liens directs + items de groupes). */
function allKeys(m: NavModel): NavKey[] {
  return m.entries.flatMap(e => (e.kind === 'link' ? [e.key] : e.items))
}
/** Identifiants des groupes déroulants présents. */
function groupIds(m: NavModel): NavGroupId[] {
  return m.entries.flatMap(e => (e.kind === 'group' ? [e.id] : []))
}

describe('buildNav — mode cyber (aucun module 2ᵉ/3ᵉ ligne)', () => {
  it('expose dashboard + les 4 liens EBIOS en tête, pour tout rôle', () => {
    for (const role of ['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER', 'RSSI', 'DIRECTION_METIER', 'AUDITEUR', 'ANALYSTE', 'LECTEUR', 'CONTROLEUR', 'METIER'] as const) {
      const m = buildNav(role, ALL_OFF)
      expect(m.mode).toBe('cyber')
      expect(m.entries.slice(0, 5)).toEqual([
        { kind: 'link', key: 'dashboard' },
        { kind: 'link', key: 'analyses' },
        { kind: 'link', key: 'risques' },
        { kind: 'link', key: 'tiers' },
        { kind: 'link', key: 'actions' },
      ])
    }
  })

  it('RISK_MANAGER a un menu « GRC » avec conformité + référentiels + documents + dérogations', () => {
    const m = buildNav('RISK_MANAGER', ALL_OFF)
    expect(groupIds(m)).toEqual(['grc'])
    const grc = m.entries.find(e => e.kind === 'group')!
    expect(grc.kind === 'group' && grc.items).toEqual(['conformite', 'referentiels', 'documents', 'derogations'])
  })

  it('ANALYSTE / LECTEUR sans module n’ont aucun menu GRC', () => {
    expect(groupIds(buildNav('ANALYSTE', ALL_OFF))).toEqual([])
    expect(groupIds(buildNav('LECTEUR', ALL_OFF))).toEqual([])
  })

  it('incidents SEULS ne basculent pas en mode GRC (restent dans le menu « GRC »)', () => {
    const m = buildNav('ANALYSTE', { ...ALL_OFF, incidents: true })
    expect(m.mode).toBe('cyber')
    expect(allKeys(m)).toContain('incidents')
  })
})

describe('buildNav — mode grc (module 2ᵉ/3ᵉ ligne actif)', () => {
  it('bascule en mode grc et replie le cyber dans un sous-menu', () => {
    const m = buildNav('RISK_MANAGER', ALL_ON)
    expect(m.mode).toBe('grc')
    const cyber = m.entries.find(e => e.kind === 'group' && e.id === 'cyber')
    expect(cyber && cyber.kind === 'group' && cyber.items).toEqual(['analyses', 'risques', 'tiers', 'actions'])
    // dashboard reste un lien direct en tête
    expect(m.entries[0]).toEqual({ kind: 'link', key: 'dashboard' })
  })

  it('RISK_MANAGER (gouvernance) voit cartographie, registre, contrôle, audit, réglementaire, gouvernance', () => {
    const m = buildNav('RISK_MANAGER', ALL_ON)
    const keys = allKeys(m)
    for (const k of ['cartographie', 'registre', 'campagnes', 'pilotage', 'processus', 'controles', 'kri', 'audit', 'reglementaire', 'registreTic', 'conformite', 'derogations']) {
      expect(keys).toContain(k)
    }
    expect(groupIds(m)).toEqual(expect.arrayContaining(['cyber', 'registre', 'controle', 'gouvernance']))
  })

  it('CONTROLEUR (2ᵉ ligne) voit les modules + le pilotage (lecture globale, #126) mais pas la gouvernance-écriture', () => {
    const m = buildNav('CONTROLEUR', ALL_ON)
    const keys = allKeys(m)
    expect(keys).toContain('controles')
    expect(keys).toContain('audit')
    expect(keys).toContain('cartographie')
    // Pilotage = cockpit de LECTURE consolidée : désormais exposé (l'API /grc/rollup
    // le sert déjà) — cohérent avec la lecture globale du dispositif (#126).
    expect(keys).toContain('pilotage')
    // Mais pas la gouvernance-écriture ni les données de cartographie.
    expect(keys).not.toContain('conformite')
    expect(keys).not.toContain('derogations')
    expect(keys).not.toContain('processus')
  })

  it('METIER (1ʳᵉ ligne) : cyber + incidents seulement, aucun module de gestion', () => {
    const m = buildNav('METIER', ALL_ON)
    const keys = allKeys(m)
    expect(keys).toContain('incidents')
    expect(keys).not.toContain('controles')
    expect(keys).not.toContain('audit')
    expect(keys).not.toContain('registre')
    expect(keys).not.toContain('cartographie')
  })

  it('CONFORMITE et DPO (2ᵉ ligne gouvernance) accèdent à conformité + dérogations', () => {
    for (const role of ['CONFORMITE', 'DPO'] as const) {
      const keys = allKeys(buildNav(role, ALL_ON))
      expect(keys).toContain('conformite')
      expect(keys).toContain('derogations')
    }
  })

  it('le parcours EBIOS reste TOUJOURS atteignable (dans le sous-menu cyber)', () => {
    const m = buildNav('ANALYSTE', ALL_ON)
    for (const k of ['dashboard', 'analyses', 'risques', 'tiers', 'actions']) {
      expect(allKeys(m)).toContain(k)
    }
  })
})
