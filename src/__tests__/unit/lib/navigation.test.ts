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
import { buildNav, activeNavHref, navPathFor, type NavModel, type NavKey, type NavGroupId, type NavModules } from '@/lib/navigation'
import { fr } from '@/lib/i18n/fr'
import { en } from '@/lib/i18n/en'
import { de } from '@/lib/i18n/de'
import { es } from '@/lib/i18n/es'
import { it as itLocale } from '@/lib/i18n/it'

const ALL_ON: NavModules = { registre: true, incidents: true, controles: true, audit: true, kri: true, reglementaire: true, profilsOperationnels: true }
const ALL_OFF: NavModules = { registre: false, incidents: false, controles: false, audit: false, kri: false, reglementaire: false, profilsOperationnels: false }

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

  it('incidents SEULS ne basculent pas en mode GRC ; peu d’items → lien direct (pas de menu)', () => {
    const m = buildNav('ANALYSTE', { ...ALL_OFF, incidents: true })
    expect(m.mode).toBe('cyber')
    expect(allKeys(m)).toContain('incidents')
    // 1 seul item secondaire → étalé en lien direct, aucun menu « GRC ».
    expect(groupIds(m)).toEqual([])
    expect(m.entries).toContainEqual({ kind: 'link', key: 'incidents' })
  })

  it('la barre s’adapte : ≤2 items secondaires étalés, ≥3 regroupés dans « GRC »', () => {
    // DIRECTION_METIER : gouvernance = [derogations] (1) → étalé, pas de menu.
    const dm = buildNav('DIRECTION_METIER', ALL_OFF)
    expect(groupIds(dm)).toEqual([])
    expect(dm.entries).toContainEqual({ kind: 'link', key: 'derogations' })
    // RISK_MANAGER : 4 items de gouvernance → regroupés dans un menu « GRC ».
    expect(groupIds(buildNav('RISK_MANAGER', ALL_OFF))).toEqual(['grc'])
  })
})

describe('buildNav — mode grc (module 2ᵉ/3ᵉ ligne actif)', () => {
  it('bascule en mode grc : menu Pilotage en tête (tableau de bord + cockpit), analyse cyber en menu', () => {
    const m = buildNav('RISK_MANAGER', ALL_ON)
    expect(m.mode).toBe('grc')
    // 1re entrée = menu « Pilotage » (tableau de bord + cockpit GRC + appétence RAS/RAD).
    // Le plan d'action unifié est le lien cœur « actions » (plus de doublon « plansActions »).
    expect(m.entries[0]).toEqual({ kind: 'group', id: 'pilotage', items: ['dashboard', 'pilotage', 'appetence', 'kri'] })
    // L'analyse cyber (cœur EBIOS) est regroupée dans un menu ; la cartographie des risques vit avec le registre.
    const analyses = m.entries.find(e => e.kind === 'group' && e.id === 'analyses')
    expect(analyses && analyses.kind === 'group' && analyses.items).toEqual(['analyses', 'risques', 'tiers', 'actions'])
  })

  it('la cartographie n’a plus d’entrée propre : c’est une vue du registre des risques (onglets Liste / Cartographie)', () => {
    const m = buildNav('RISK_MANAGER', ALL_ON)
    expect(allKeys(m)).not.toContain('cartographie')
    const reg = m.entries.find(e => e.kind === 'group' && e.id === 'registre')
    expect(reg && reg.kind === 'group' && reg.items[0]).toBe('registre')
    // Sur /cartographie, l'entrée « Registre des risques » reste allumée.
    expect(navPathFor('/cartographie')).toBe('/registre')
    expect(navPathFor('/cartographie/processus')).toBe('/cartographie/processus')
    expect(navPathFor('/registre')).toBe('/registre')
  })

  it('un lien n’est actif que s’il est la correspondance la plus précise : /reglementaire/suivi-regulateur n’active pas /reglementaire', () => {
    const hrefs = ['/reglementaire', '/reglementaire/suivi-regulateur', '/reglementaire/tests-resilience', '/controles', '/controles/campagnes']
    expect(activeNavHref('/reglementaire/suivi-regulateur', hrefs)).toBe('/reglementaire/suivi-regulateur')
    expect(activeNavHref('/reglementaire/suivi-regulateur/abc', hrefs)).toBe('/reglementaire/suivi-regulateur')
    expect(activeNavHref('/reglementaire', hrefs)).toBe('/reglementaire')
    expect(activeNavHref('/reglementaire/dora', hrefs)).toBe('/reglementaire')
    expect(activeNavHref('/controles/campagnes/12', hrefs)).toBe('/controles/campagnes')
    expect(activeNavHref('/controles', hrefs)).toBe('/controles')
    expect(activeNavHref('/autre', hrefs)).toBeNull()
    expect(activeNavHref('/controlesX', hrefs)).toBeNull()
  })

  it('suivi régulateur (plans d’action régulateurs) est dans le menu Réglementaire', () => {
    const m = buildNav('RISK_MANAGER', ALL_ON)
    const rg = m.entries.find(e => e.kind === 'group' && e.id === 'reglementaire')
    expect(rg && rg.kind === 'group' && rg.items).toContain('suiviRegulateur')
    for (const id of ['conformite', 'controleAudit']) {
      const g = m.entries.find(e => e.kind === 'group' && e.id === id)
      expect(g && g.kind === 'group' && g.items).not.toContain('suiviRegulateur')
    }
  })

  it('RISK_MANAGER (gouvernance) : découpage en ~6 entrées, tous les modules accessibles', () => {
    const m = buildNav('RISK_MANAGER', ALL_ON)
    const keys = allKeys(m)
    for (const k of ['registre', 'campagnes', 'pilotage', 'processus', 'controles', 'kri', 'audit', 'reglementaire', 'registreTic', 'conformite', 'derogations']) {
      expect(keys).toContain(k)
    }
    // Nouveau découpage « pilotage en tête » : 3 menus thématiques.
    expect(groupIds(m)).toEqual(expect.arrayContaining(['analyses', 'registre', 'controleAudit', 'conformite', 'reglementaire']))
    // Plus de mélange lien isolé / menu au même niveau : audit & incidents sont dans un menu.
    expect(groupIds(m)).not.toContain('cyber')
  })

  it('CONTROLEUR (2ᵉ ligne) voit les modules + le pilotage (lecture globale, #126) mais pas la gouvernance-écriture', () => {
    const m = buildNav('CONTROLEUR', ALL_ON)
    const keys = allKeys(m)
    expect(keys).toContain('controles')
    expect(keys).toContain('audit')
    // Pilotage = cockpit de LECTURE consolidée : désormais exposé (l'API /grc/rollup
    // le sert déjà) — cohérent avec la lecture globale du dispositif (#126).
    expect(keys).toContain('pilotage')
    // Mais pas la gouvernance-écriture ; les processus restent consultables (registres, lecture seule).
    expect(keys).not.toContain('conformite')
    expect(keys).not.toContain('derogations')
    expect(keys).toContain('processus')
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

describe('buildNav — appétence (RAS / RAD)', () => {
  it('visible pour la gouvernance dès qu’une source existe, jamais pour la 1re ligne', () => {
    const none = { registre: false, incidents: false, controles: false, audit: false, kri: false, reglementaire: false, profilsOperationnels: false }
    const pil = (role: Parameters<typeof buildNav>[0], mods: typeof none) => {
      const e = buildNav(role, mods).entries[0]
      return e.kind === 'group' ? e.items : [e.key]
    }
    expect(pil('RSSI', { ...none, kri: true })).toContain('appetence')
    expect(pil('RSSI', { ...none, profilsOperationnels: true })).toContain('appetence')
    expect(pil('LECTEUR', { ...none, registre: true })).not.toContain('appetence')
  })
})

describe('buildNav — regroupement KRI et registres', () => {
  it('distingue clairement les deux registres et les risques des analyses dans les cinq langues', () => {
    expect(fr.nav.grpRegistre).toBe('Registres')
    expect(fr.nav.registre).toBe('Registre des risques')
    expect(fr.nav.risks).toBe('Risques des analyses')
    for (const locale of [fr, en, de, es, itLocale]) {
      expect(locale.nav.grpRegistre).not.toBe(locale.nav.registre)
      expect(locale.nav.registre).not.toBe(locale.nav.registreTic)
      expect(locale.nav.risks).not.toBe(locale.nav.registre)
      expect(locale.nav.registreTic).toContain('DORA')
    }
  })
  it('place les KRI à côté de RAS/RAD dans Pilotage, sans lien dupliqué dans Contrôle & audit', () => {
    const model = buildNav('RISK_MANAGER', ALL_ON)
    const pilotage = model.entries.find(e => e.kind === 'group' && e.id === 'pilotage')
    const controleAudit = model.entries.find(e => e.kind === 'group' && e.id === 'controleAudit')
    expect(pilotage).toEqual({ kind: 'group', id: 'pilotage', items: ['dashboard', 'pilotage', 'appetence', 'kri'] })
    expect(controleAudit && controleAudit.kind === 'group' && controleAudit.items).not.toContain('kri')
    expect(allKeys(model).filter(k => k === 'kri')).toHaveLength(1)
  })

  it('regroupe les registres de risques et TIC, même si seul le module réglementaire est activé', () => {
    const both = buildNav('RSSI', ALL_ON)
    expect(both.entries.find(e => e.kind === 'group' && e.id === 'registre')).toEqual({
      kind: 'group', id: 'registre', items: ['registre', 'campagnes', 'processus', 'incidents', 'registreTic'],
    })
    for (const id of ['conformite', 'reglementaire']) {
      const g = both.entries.find(e => e.kind === 'group' && e.id === id)
      expect(g && g.kind === 'group' && g.items).not.toContain('registreTic')
    }

    const regulatoryOnly = buildNav('RSSI', { ...ALL_OFF, reglementaire: true })
    expect(allKeys(regulatoryOnly)).toContain('registreTic')
    expect(allKeys(regulatoryOnly)).not.toContain('registre')
  })

  it('incidents et registre IA sont dans le menu Registres (plus dans Contrôle & audit ni Conformité)', () => {
    const m = buildNav('RSSI', { ...ALL_ON, registreIa: true })
    const items = (id: string) => { const g = m.entries.find(e => e.kind === 'group' && e.id === id); return g && g.kind === 'group' ? g.items : [] }
    expect(items('registre')).toEqual(['registre', 'campagnes', 'processus', 'incidents', 'registreTic', 'registreIa'])
    expect(items('controleAudit')).not.toContain('incidents')
    expect(items('conformite')).not.toContain('registreIa')
    expect(allKeys(m).filter(k => k === 'incidents' || k === 'registreIa')).toHaveLength(2)
  })

  it('1ʳᵉ ligne : la déclaration d’incident reste atteignable (lien direct), sans les autres registres', () => {
    const m = buildNav('METIER', ALL_ON)
    expect(m.entries).toContainEqual({ kind: 'link', key: 'incidents' })
    expect(allKeys(m)).not.toContain('registreTic')
  })

  it('conserve les droits : aucun KRI ni registre TIC pour la première ligne', () => {
    for (const role of ['LECTEUR', 'METIER'] as const) {
      const keys = allKeys(buildNav(role, ALL_ON))
      expect(keys).not.toContain('kri')
      expect(keys).not.toContain('registreTic')
    }
  })
})

describe('buildNav — onglet Projets (module Projets 360)', () => {
  const none = { registre: false, incidents: false, controles: false, audit: false, kri: false, reglementaire: false, profilsOperationnels: false }
  const keys = (m: ReturnType<typeof buildNav>) => m.entries.flatMap(e => (e.kind === 'group' ? e.items : [e.key]))
  it('mode cyber : lien Projets juste après Analyses quand le module est actif', () => {
    const k = keys(buildNav('ANALYSTE', { ...none, projets: true }))
    expect(k.indexOf('projets')).toBe(k.indexOf('analyses') + 1)
    expect(keys(buildNav('ANALYSTE', none))).not.toContain('projets')
  })
  it('mode GRC : dans le groupe « Gestion des risques »', () => {
    const m = buildNav('RISK_MANAGER', { ...none, registre: true, projets: true })
    const g = m.entries.find(e => e.kind === 'group' && e.id === 'analyses')
    expect(g && g.kind === 'group' && g.items.slice(0, 2)).toEqual(['analyses', 'projets'])
  })

  it('reporting réglementaire : rattaché au menu Réglementaire, pas au Pilotage', () => {
    const groupe = (role: Parameters<typeof buildNav>[0], id: string) => {
      const g = buildNav(role, { ...none, registre: true, reglementaire: true }).entries.find(e => e.kind === 'group' && e.id === id)
      return g && g.kind === 'group' ? g.items : []
    }
    expect(groupe('RSSI', 'reglementaire')).toContain('rapports')
    expect(groupe('RSSI', 'pilotage')).not.toContain('rapports')
    expect(allKeys(buildNav('LECTEUR', { ...none, registre: true, reglementaire: true }))).not.toContain('rapports')
  })

  it('« Conformité & réglementaire » coupé en deux menus : Conformité (gouvernance) et Réglementaire (DORA, rapports) ; RGPD dans Registres', () => {
    const m = buildNav('ADMIN', { ...ALL_ON, homologations: true, recertification: true })
    const items = (id: string) => { const g = m.entries.find(e => e.kind === 'group' && e.id === id); return g && g.kind === 'group' ? g.items : [] }
    expect(groupIds(m)).not.toContain('conformiteReglementaire')
    expect(items('conformite')).toEqual(['conformite', 'referentiels', 'documents', 'profilsOperationnels', 'derogations', 'homologations'])
    expect(items('reglementaire')).toEqual(['reglementaire', 'suiviRegulateur', 'testsResilience', 'rapports'])
    expect(items('registre')).toContain('ropa')
  })
})

describe('questionnaires de contrôle', () => {
  it('le métier (1ʳᵉ ligne) les voit pour y répondre, la 2ᵉ ligne aussi ; un lecteur non ; rien sans le module', () => {
    expect(allKeys(buildNav('METIER' as never, ALL_ON))).toContain('questionnaires')
    expect(allKeys(buildNav('RISK_MANAGER', ALL_ON))).toContain('questionnaires')
    expect(allKeys(buildNav('LECTEUR', ALL_ON))).not.toContain('questionnaires')
    expect(allKeys(buildNav('RISK_MANAGER', { ...ALL_ON, controles: false }))).not.toContain('questionnaires')
  })
  it('revues d’habilitations masquées (module sans écran, lot P5 non livré), même activées', () => {
    for (const r of ['ADMIN', 'METIER', 'CONTROLEUR'] as const) expect(allKeys(buildNav(r, { ...ALL_ON, recertification: true }))).not.toContain('recertification')
  })
})
