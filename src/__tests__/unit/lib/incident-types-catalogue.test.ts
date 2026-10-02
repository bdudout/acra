import { describe, expect, it } from 'vitest'
import { INCIDENT_TYPES, INCIDENT_CHECKLIST, searchIncidentTypes, incidentTypeByKey, incidentTemplate, type IncidentLocale } from '@/lib/incident-types-catalogue'
import { TYPES_EVENEMENT } from '@/lib/incidents-config'
import { CATALOGUE_REGIMES } from '@/lib/notification-regimes'

const LOCALES: IncidentLocale[] = ['fr', 'en', 'de', 'es', 'it']

describe('catalogue d’incidents types', () => {
  it('couvre le cyber (hameçonnage, rançongiciel, déni de service, fuite…) et les autres risques (panne, fraude, sinistre, erreur…)', () => {
    const keys = INCIDENT_TYPES.map(t => t.key)
    for (const k of ['cyber.phishing', 'cyber.ransomware', 'cyber.ddos', 'cyber.data-exfiltration', 'cyber.vulnerability-exploited', 'ops.it-outage', 'ops.third-party-outage', 'fraud.payment', 'ops.site-disaster', 'ops.processing-error']) expect(keys).toContain(k)
    expect(INCIDENT_TYPES.filter(t => t.categorie === 'CYBER').length).toBeGreaterThanOrEqual(10)
    expect(INCIDENT_TYPES.length).toBeGreaterThanOrEqual(26)
  })
  it('clés uniques et stables ; catégorie = type d’événement existant ; régimes suggérés = régimes du catalogue ; cause racine valide ; libellés ×5 non vides', () => {
    expect(new Set(INCIDENT_TYPES.map(t => t.key)).size).toBe(INCIDENT_TYPES.length)
    const regimes = new Set(CATALOGUE_REGIMES.map(r => r.code))
    for (const t of INCIDENT_TYPES) {
      expect(t.key).toMatch(/^[a-z]+\.[a-z0-9-]+$/)
      expect((TYPES_EVENEMENT as readonly string[]).includes(t.categorie), t.key).toBe(true)
      expect(['PROCESSUS', 'PERSONNES', 'SYSTEMES', 'EXTERNE', 'TIERS']).toContain(t.causeRacine)
      for (const r of t.regimes) expect(regimes.has(r), `${t.key} → ${r}`).toBe(true)
      for (const id of t.aCompleter) expect(INCIDENT_CHECKLIST[id], id).toBeDefined()
      for (const l of LOCALES) expect(t.title[l].trim(), `${t.key}/${l}`).not.toBe('')
    }
    for (const id of Object.keys(INCIDENT_CHECKLIST)) for (const l of LOCALES) expect(INCIDENT_CHECKLIST[id][l].trim()).not.toBe('')
  })
  it('règles de cohérence : fuite/exfiltration = données personnelles + RGPD ; vulnérabilité exploitée = CRA ; cyber lié aux TIC = NIS2 ; panne purement physique = non TIC', () => {
    expect(incidentTypeByKey('cyber.data-exfiltration')).toMatchObject({ donnees: true })
    expect(incidentTypeByKey('cyber.data-exfiltration')!.regimes).toContain('RGPD_33')
    expect(incidentTypeByKey('cyber.vulnerability-exploited')!.regimes).toContain('CRA_14')
    expect(incidentTypeByKey('cyber.ransomware')!.regimes).toContain('NIS2')
    expect(incidentTypeByKey('ops.site-disaster')!.tic).toBe(false)
    expect(incidentTypeByKey('ops.it-outage')!.tic).toBe(true)
  })
  it('recherche tolérante : accents, casse, mots multiples, synonymes (hameçonnage / phishing / DDoS) et langue de l’utilisateur', () => {
    expect(searchIncidentTypes('phishing', 'fr').map(t => t.key)).toContain('cyber.phishing')
    expect(searchIncidentTypes('HAMECONNAGE', 'fr').map(t => t.key)).toContain('cyber.phishing')
    expect(searchIncidentTypes('deni service', 'fr').map(t => t.key)).toContain('cyber.ddos')
    expect(searchIncidentTypes('ransomware', 'en').map(t => t.key)).toContain('cyber.ransomware')
    expect(searchIncidentTypes('incendie', 'fr').map(t => t.key)).toContain('ops.site-disaster')
    expect(searchIncidentTypes('', 'fr')).toHaveLength(INCIDENT_TYPES.length)
    expect(searchIncidentTypes('zzzzqq', 'fr')).toEqual([])
  })
  it('modèle de déclaration : intitulé localisé, description avec la liste « à compléter », type d’événement et attributs prérenseignés ; aucun fait inventé', () => {
    const tpl = incidentTemplate('cyber.data-exfiltration', 'fr')!
    expect(tpl.intitule).toContain('exfiltration'); expect(tpl.description).toContain('À compléter'); expect(tpl.description).toContain('Données concernées')
    expect(tpl).toMatchObject({ typeEvenement: 'CYBER', donneesPersonnelles: true, catalogueKey: 'cyber.data-exfiltration' })
    expect(tpl.significatif).toBe(false) // le caractère significatif / majeur reste une décision de l'entité
    expect(incidentTemplate('inconnu', 'fr')).toBeNull()
    expect(incidentTemplate('cyber.ddos', 'en')!.description).toContain('To complete')
  })
})
