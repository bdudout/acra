import { describe, it, expect } from 'vitest'
import { sectorExemplesFor, withSectorExemples, SECTOR_FAMILIES, type SectorExempleCategory } from '@/lib/exemples-sectoriels'
import { rankExemples } from '@/lib/exemples-context'
import { CATEGORIES_BIENS_SUPPORTS } from '@/lib/ebios-data'
import enDict from '@/lib/i18n/exemples-sectoriels/en'
import deDict from '@/lib/i18n/exemples-sectoriels/de'
import esDict from '@/lib/i18n/exemples-sectoriels/es'
import itDict from '@/lib/i18n/exemples-sectoriels/it'

// ─────────────────────────────────────────────────────────────────────────────
// Packs d'exemples sectoriels : contenu spécifique injecté selon le secteur de
// l'analyse (santé, finance, industrie/OT, public). Données pures (pas d'IA).
// ─────────────────────────────────────────────────────────────────────────────

const VALID_BS_TYPES = new Set<string>(CATEGORIES_BIENS_SUPPORTS.map(c => c.value))

describe('sectorExemplesFor — sélection par famille de secteur', () => {
  it('santé : propose des valeurs métier spécifiques (DPI / patient)', () => {
    const vm = sectorExemplesFor('Santé / Hôpital public', 'valeursMetier')
    expect(vm.length).toBeGreaterThan(0)
    expect(vm.some(v => /patient|dpi|soin|médicament|medicament/i.test(`${v.nom} ${v.description}`))).toBe(true)
  })
  it('banque : propose des biens supports spécifiques (SWIFT / core banking)', () => {
    const bs = sectorExemplesFor('Banque / Finance', 'biensSupports')
    expect(bs.length).toBeGreaterThan(0)
    expect(bs.some(b => /swift|core banking|banque en ligne|dab/i.test(`${b.nom} ${b.description}`))).toBe(true)
  })
  it('industrie/énergie : propose des sources de risque OT (étatique/sabotage)', () => {
    const sr = sectorExemplesFor('Énergie / Utilities', 'sourcesRisque')
    expect(sr.length).toBeGreaterThan(0)
    expect(sectorExemplesFor('Industrie / Manufacturing', 'valeursMetier').length).toBeGreaterThan(0)
  })
  it('public : propose des scénarios stratégiques (téléservices / administrés)', () => {
    const sc = sectorExemplesFor('Administration / Collectivité', 'scenariosStrategiques')
    expect(sc.length).toBeGreaterThan(0)
  })
  it('secteur inconnu ou vide → []', () => {
    expect(sectorExemplesFor('', 'valeursMetier')).toEqual([])
    expect(sectorExemplesFor(null, 'valeursMetier')).toEqual([])
    expect(sectorExemplesFor('Secteur exotique', 'valeursMetier')).toEqual([])
  })
  it('catégorie absente → []', () => {
    // @ts-expect-error catégorie volontairement invalide
    expect(sectorExemplesFor('Santé', 'inexistante')).toEqual([])
  })
})

describe('exemples sectoriels — intégrité des données', () => {
  it('toutes les familles couvrent les catégories de base', () => {
    for (const fam of SECTOR_FAMILIES) {
      expect(sectorExemplesFor(fam.match[0], 'valeursMetier').length).toBeGreaterThan(0)
      expect(sectorExemplesFor(fam.match[0], 'biensSupports').length).toBeGreaterThan(0)
      expect(sectorExemplesFor(fam.match[0], 'evenementsRedoutes').length).toBeGreaterThan(0)
    }
  })
  it('valeurs métier : type valide + cotations DICT 1..4', () => {
    const vm = sectorExemplesFor('Santé', 'valeursMetier')
    for (const v of vm) {
      expect(['PROCESSUS', 'INFORMATION']).toContain(v.type)
      for (const c of [v.disponibilite, v.integrite, v.confidentialite, v.tracabilite]) {
        expect(c).toBeGreaterThanOrEqual(1)
        expect(c).toBeLessThanOrEqual(4)
      }
    }
  })
  it('biens supports : type dans le référentiel CATEGORIES_BIENS_SUPPORTS', () => {
    for (const fam of SECTOR_FAMILIES) {
      for (const b of sectorExemplesFor(fam.match[0], 'biensSupports')) {
        expect(VALID_BS_TYPES.has(b.type as string)).toBe(true)
      }
    }
  })
  it('événements redoutés : gravité 1..4 et impacts non vides', () => {
    const er = sectorExemplesFor('Banque', 'evenementsRedoutes')
    for (const e of er) {
      expect(e.graviteDefaut).toBeGreaterThanOrEqual(1)
      expect(e.graviteDefaut).toBeLessThanOrEqual(4)
      expect(Array.isArray(e.impacts)).toBe(true)
      expect((e.impacts as unknown[]).length).toBeGreaterThan(0)
    }
  })
})

describe('withSectorExemples — fusion + déduplication', () => {
  const generic = [
    { nom: 'Gestion des commandes clients', description: 'Facturation' },
    { nom: 'Processus de paie', description: 'Salaires' },
  ]
  it('préfixe les exemples sectoriels au catalogue générique', () => {
    const merged = withSectorExemples(generic, 'Santé', 'valeursMetier')
    expect(merged.length).toBeGreaterThan(generic.length)
    expect(/patient|dpi|soin/i.test(merged[0].nom!)).toBe(true)
    // le générique est conservé en fin
    expect(merged.some(m => m.nom === 'Gestion des commandes clients')).toBe(true)
  })
  it('renvoie le catalogue inchangé si aucun pack ne correspond', () => {
    expect(withSectorExemples(generic, 'Secteur exotique', 'valeursMetier')).toEqual(generic)
    expect(withSectorExemples(generic, '', 'valeursMetier')).toEqual(generic)
  })
  it('déduplique par nom (le sectoriel l’emporte)', () => {
    const g = [{ nom: 'Dossier Patient Informatisé (DPI)', description: 'doublon' }]
    const merged = withSectorExemples(g, 'Santé', 'valeursMetier')
    expect(merged.filter(m => m.nom === 'Dossier Patient Informatisé (DPI)')).toHaveLength(1)
  })
})

describe('i18n des packs sectoriels', () => {
  const CATEGORIES: SectorExempleCategory[] = ['valeursMetier', 'biensSupports', 'evenementsRedoutes', 'sourcesRisque', 'scenariosStrategiques']

  it('locale=fr renvoie la donnée source (FR)', () => {
    expect(sectorExemplesFor('Santé', 'valeursMetier', 'fr')[0].nom).toBe('Prise en charge des patients aux urgences')
  })
  it('locale=en traduit nom + description', () => {
    const vm = sectorExemplesFor('Santé', 'valeursMetier', 'en')
    expect(vm[0].nom).toBe('Emergency patient care')
    expect(String(vm[0].description)).toMatch(/emergency/i)
  })
  it('locale=de/es/it traduisent (différent du FR)', () => {
    expect(sectorExemplesFor('Banque', 'biensSupports', 'de')[1].nom).toBe('SWIFT-Gateway')
    expect(sectorExemplesFor('Énergie', 'valeursMetier', 'es')[1].nom).toMatch(/SCADA/)
    expect(sectorExemplesFor('Administration', 'valeursMetier', 'it')[0].nom).toMatch(/cittadini/i)
  })
  it('traduit aussi les impacts (tableaux)', () => {
    const er = sectorExemplesFor('Santé', 'evenementsRedoutes', 'en')
    expect((er[0].impacts as string[])[1]).toMatch(/life-threatening/i)
  })
  it('repli sur le FR si une clé de traduction est absente', () => {
    // 'tracabilite' / champs enum non traduits : type reste l'enum d'origine
    expect(sectorExemplesFor('Santé', 'valeursMetier', 'en')[0].type).toBe('PROCESSUS')
  })

  it('parité des clés : en/de/es/it couvrent exactement les mêmes clés', () => {
    const keys = (d: Record<string, string>) => Object.keys(d).sort()
    const ref = keys(enDict)
    expect(keys(deDict)).toEqual(ref)
    expect(keys(esDict)).toEqual(ref)
    expect(keys(itDict)).toEqual(ref)
  })
  it('chaque champ FR traduisible a une clé dans tous les dictionnaires', () => {
    const TEXT_FIELDS = ['nom', 'description', 'motivation', 'ressources']
    const missing: string[] = []
    for (const fam of SECTOR_FAMILIES) {
      for (const cat of CATEGORIES) {
        const items = sectorExemplesFor(fam.match[0], cat, 'fr')
        items.forEach((item, idx) => {
          const prefix = `${fam.key}.${cat}.${idx}`
          for (const f of TEXT_FIELDS) {
            if (typeof item[f] === 'string') {
              for (const [name, d] of [['en', enDict], ['de', deDict], ['es', esDict], ['it', itDict]] as const) {
                if (!(`${prefix}.${f}` in d)) missing.push(`${name}:${prefix}.${f}`)
              }
            }
          }
          if (Array.isArray(item.impacts)) {
            (item.impacts as string[]).forEach((_, j) => {
              for (const [name, d] of [['en', enDict], ['de', deDict], ['es', esDict], ['it', itDict]] as const) {
                if (!(`${prefix}.impacts.${j}` in d)) missing.push(`${name}:${prefix}.impacts.${j}`)
              }
            })
          }
        })
      }
    }
    expect(missing).toEqual([])
  })
})

describe('intégration : les exemples sectoriels remontent en tête via rankExemples', () => {
  it('santé : les valeurs métier sectorielles sont marquées pertinentes et en tête', () => {
    const generic = [
      { nom: 'Gestion des commandes clients', description: 'Facturation' },
      { nom: 'Processus de paie', description: 'Salaires' },
    ]
    const merged = [...sectorExemplesFor('Santé', 'valeursMetier'), ...generic]
    const ranked = rankExemples(merged, { secteur: 'Santé' })
    expect(ranked[0].pertinent).toBe(true)
    expect(/patient|dpi|soin|médicament|medicament|imagerie|urgence/i.test(String(ranked[0].nom))).toBe(true)
  })
})
