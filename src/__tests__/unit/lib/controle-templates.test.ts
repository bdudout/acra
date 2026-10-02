import { describe, it, expect } from 'vitest'
import { listControlTemplates, referentielTemplateKey } from '@/lib/controle-templates'
import { CATALOGUES_CONTROLES } from '@/lib/controles-catalogue'

describe('catalogue unifié des contrôles-types', () => {
  it('rassemble les socles par référentiel et les contrôles du catalogue, chacun une fois (clés uniques)', () => {
    const { templates, referentiels } = listControlTemplates(['FINANCE', 'ENERGIE'], 'en')
    expect(new Set(templates.map(t => t.key)).size).toBe(templates.length)
    expect(referentiels.map(r => r.id)).toEqual(CATALOGUES_CONTROLES.map(c => c.id))
    expect(templates.filter(t => t.origin === 'REFERENTIEL')).toHaveLength(CATALOGUES_CONTROLES.reduce((n, c) => n + c.controles.length, 0))
    expect(templates.some(t => t.key === 'finance.control.reconciliation')).toBe(true)
    expect(templates.some(t => t.key === 'sante.control.record-access')).toBe(false)
  })
  it('un modèle par référentiel garde son lien aux exigences ; sa clé dépend du socle et du rang', () => {
    const iso = listControlTemplates(null, 'fr').templates.find(t => t.key === referentielTemplateKey('ISO27001', 0))!
    expect(iso.referentiel).toMatchObject({ id: 'ISO27001', code: 'ISO27001' })
    expect(iso.referentiel!.exigenceRefs.length).toBeGreaterThan(0)
    expect(iso.contentLocale).toBe('fr')
  })
  it('un contrôle du catalogue est rattaché à un processus connu et aux risques qu’il couvre (traduit)', () => {
    const { templates, processes, risks } = listControlTemplates('FINANCE', 'de')
    const x = templates.find(t => t.key === 'core.control.access-review')!
    expect(processes.some(p => p.key === x.processKey)).toBe(true)
    expect(x.riskKeys.every(k => risks.some(r => r.key === k))).toBe(true)
    expect(x.title).toBe('Regelmäßige Überprüfung der Zugriffsrechte')
  })
})
