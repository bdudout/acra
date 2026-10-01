import { describe, it, expect } from 'vitest'
import { listAuditTemplates } from '@/lib/audit-templates'
import { PROGRAMMES_AUDIT } from '@/lib/audit-programmes-catalogue'

describe('modèles de mission d’audit unifiés', () => {
  it('programmes par référentiel + missions du catalogue des secteurs choisis, clés uniques', () => {
    const { templates } = listAuditTemplates(['TELECOM'], 'it')
    expect(new Set(templates.map(t => t.key)).size).toBe(templates.length)
    expect(templates.filter(t => t.origin === 'REFERENTIEL')).toHaveLength(PROGRAMMES_AUDIT.length)
    const telecom = templates.find(t => t.key === 'telecom.audit.network-change')!
    expect(telecom.title).toBe('Audit della gestione dei cambiamenti sulla rete')
    expect(telecom.points.length).toBeGreaterThanOrEqual(4)
    expect(templates.some(t => t.key.startsWith('finance.'))).toBe(false)
  })
  it('entrées par processus et par risque : chaque mission du catalogue pointe un processus et des risques listés', () => {
    const { templates, processes, risks } = listAuditTemplates(['FINANCE'], 'fr')
    for (const x of templates.filter(t => t.origin === 'CATALOGUE')) {
      expect(processes.some(p => p.key === x.processKey), x.key).toBe(true)
      expect(x.riskKeys.length, x.key).toBeGreaterThan(0)
      expect(x.riskKeys.every(k => risks.some(r => r.key === k)), x.key).toBe(true)
    }
  })
})
