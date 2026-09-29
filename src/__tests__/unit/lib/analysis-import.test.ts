import { describe, expect, it } from 'vitest'
import { parseAnalysisImportRequest, summarizeAnalysisImport } from '@/lib/analysis-import'

describe('parseAnalysisImportRequest', () => {
  it('refuse une demande sans clé d’idempotence et limite les objets importés', () => {
    expect(() => parseAnalysisImportRequest({ analysis: { title: 'A' } })).toThrow()
    expect(parseAnalysisImportRequest({ idempotencyKey: 'migration-2026-001', analysis: { title: 'A' }, risks: [{ title: 'R', gravity: 4, likelihood: 3 }] })).toMatchObject({ idempotencyKey: 'migration-2026-001', risks: [{ title: 'R', gravity: 4 }] })
  })

  it('refuse les identifiants externes dupliqués plutôt que de lier silencieusement le dernier objet', () => {
    expect(() => parseAnalysisImportRequest({
      idempotencyKey: 'migration-2026-duplicates', analysis: { title: 'A' },
      risks: [
        { externalId: 'R-1', title: 'Premier risque' },
        { externalId: 'R-1', title: 'Second risque' },
      ],
    })).toThrow('duplicate_external_id:risks:R-1')

    expect(() => parseAnalysisImportRequest({
      idempotencyKey: 'migration-2026-duplicates-actions', analysis: { title: 'A' },
      actions: [
        { externalId: 'A-1', title: 'Première action' },
        { externalId: 'A-1', title: 'Seconde action' },
      ],
    })).toThrow('duplicate_external_id:actions:A-1')
  })

  it('conserve les identifiants externes de chaque collection du paquet canonique', () => {
    expect(parseAnalysisImportRequest({
      idempotencyKey: 'migration-2026-all-external-ids', analysis: { title: 'A' },
      vulnerabilities: [{ externalId: 'V-1', riskExternalId: 'R-1', title: 'Vulnérabilité' }],
      measures: [{ externalId: 'M-1', title: 'Mesure' }],
    })).toMatchObject({
      vulnerabilities: [{ externalId: 'V-1' }],
      measures: [{ externalId: 'M-1' }],
    })
  })
})

describe('summarizeAnalysisImport', () => {
  it('annonce les créations et les références impossibles à relier sans écrire', () => {
    const summary = summarizeAnalysisImport(parseAnalysisImportRequest({
      idempotencyKey: 'migration-2026-002', analysis: { title: 'A' },
      risks: [{ externalId: 'R-1', title: 'Risque' }],
      vulnerabilities: [{ riskExternalId: 'R-404', title: 'Vulnérabilité' }],
      actions: [{ externalId: 'A-1', riskExternalId: 'R-404', title: 'Action' }],
    }))
    expect(summary.created).toMatchObject({ risks: 1, vulnerabilities: 1, actions: 1 })
    expect(summary.warnings).toContain('vulnerability_risk_reference_not_found:R-404')
    expect(summary.warnings).toContain('action_risk_reference_not_found:R-404')
  })

  it('compte un seul lien lorsque le rattachement implicite de l’action est aussi fourni explicitement', () => {
    const summary = summarizeAnalysisImport(parseAnalysisImportRequest({
      idempotencyKey: 'migration-2026-links', analysis: { title: 'A' },
      risks: [{ externalId: 'R-1', title: 'Risque' }],
      actions: [{ externalId: 'A-1', riskExternalId: 'R-1', title: 'Action' }],
      links: [
        { riskExternalId: 'R-1', actionExternalId: 'A-1' },
        { riskExternalId: 'R-1', actionExternalId: 'A-1' },
      ],
    }))

    expect(summary.created.links).toBe(1)
  })
})

describe('format v3 : ateliers', () => {
  const base = { idempotencyKey: 'cle-idempotence-1', analysis: { title: 'Dossier' }, risks: [{ externalId: 'R1', title: 'Risque' }] }
  it('un paquet sans contenu d’atelier garde l’empreinte d’avant le format v3 (reçus déjà enregistrés rejouables)', async () => {
    const { analysisImportPayloadHash, parseAnalysisImportRequest } = await import('@/lib/analysis-import')
    const { createHash } = await import('crypto')
    const parsed = parseAnalysisImportRequest(base)
    const legacy = { idempotencyKey: parsed.idempotencyKey, analysis: parsed.analysis, risks: parsed.risks, vulnerabilities: [], measures: [], actions: [], links: [] }
    expect(analysisImportPayloadHash(parsed)).toBe(createHash('sha256').update(JSON.stringify(legacy)).digest('hex'))
  })
  it('un contenu d’atelier change l’empreinte ; deux références qui ne diffèrent que par l’écriture sont un doublon', async () => {
    const { analysisImportPayloadHash, parseAnalysisImportRequest } = await import('@/lib/analysis-import')
    const withVm = parseAnalysisImportRequest({ ...base, businessValues: [{ externalId: 'VM_01', title: 'Planification' }] })
    expect(analysisImportPayloadHash(withVm)).not.toBe(analysisImportPayloadHash(parseAnalysisImportRequest(base)))
    expect(() => parseAnalysisImportRequest({ ...base, businessValues: [{ externalId: 'VM_01', title: 'A' }, { externalId: 'VM01', title: 'B' }] })).toThrow(/duplicate_external_id:businessValues/)
  })
})
