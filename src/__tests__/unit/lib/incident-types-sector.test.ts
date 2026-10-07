import { describe, expect, it } from 'vitest'
import { INCIDENT_TYPES, INCIDENT_CHECKLIST, searchIncidentTypes, incidentTemplate, type IncidentLocale } from '@/lib/incident-types-catalogue'
import { SECTOR_CODES } from '@/lib/sector-suggestions'
import { CATALOGUE_REGIMES } from '@/lib/notification-regimes'

const LOCALES: IncidentLocale[] = ['fr', 'en', 'de', 'es', 'it']

describe('incidents types propres à un secteur', () => {
  it('chaque secteur propose au moins 3 incidents types, libellés ×5, clés préfixées par le secteur, jamais de fait inventé', () => {
    const regimes = new Set(CATALOGUE_REGIMES.map(r => r.code))
    for (const sector of SECTOR_CODES) {
      const own = INCIDENT_TYPES.filter(t => t.sector === sector)
      expect(own.length, sector).toBeGreaterThanOrEqual(3)
      for (const t of own) {
        expect(t.key.startsWith(`${sector.toLowerCase()}.`), t.key).toBe(true)
        for (const l of LOCALES) expect(t.title[l].trim(), `${t.key}/${l}`).not.toBe('')
        for (const id of t.aCompleter) expect(INCIDENT_CHECKLIST[id], `${t.key} → ${id}`).toBeDefined()
        for (const r of t.regimes) expect(regimes.has(r), `${t.key} → ${r}`).toBe(true)
        expect(incidentTemplate(t.key, 'fr')!.significatif).toBe(false)
      }
    }
  })
  it('la recherche filtrée par secteurs garde le socle générique et les secteurs choisis, écarte les autres', () => {
    const all = searchIncidentTypes('', 'fr')
    const forHealth = searchIncidentTypes('', 'fr', ['SANTE'])
    expect(forHealth.some(t => t.sector === 'SANTE')).toBe(true)
    expect(forHealth.some(t => t.sector === 'DEFENSE')).toBe(false)
    expect(forHealth.filter(t => !t.sector).length).toBe(all.filter(t => !t.sector).length)
    expect(searchIncidentTypes('', 'fr', [])).toEqual(all)           // aucun secteur choisi : tout est proposé
    expect(searchIncidentTypes('', 'fr', ['SANTE', 'DEFENSE']).some(t => t.sector === 'DEFENSE')).toBe(true) // multisecteur
  })
})
