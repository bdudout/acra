// Lot B de docs/specs/stockage-supervision-nettoyage.md : règles de nettoyage « sans impact » (PUR — aucune requête).
import { describe, it, expect } from 'vitest'
import { CLEANUP_CATEGORIES, NEVER_CLEANED_MODELS, planCleanup, defaultAutoCategories, sanitizeCategories } from '@/lib/cache-cleanup'

const NOW = new Date('2026-10-05T12:00:00.000Z')
const H = 3600_000
const ago = (ms: number) => new Date(NOW.getTime() - ms)
const byId = (id: string) => planCleanup(NOW).find(p => p.id === id)!

describe('catégories', () => {
  it('B1–B8 présentes, modèles distincts, jamais un modèle exclu', () => {
    expect(CLEANUP_CATEGORIES.map(c => c.id)).toEqual(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8'])
    for (const c of CLEANUP_CATEGORIES) expect(NEVER_CLEANED_MODELS, c.model).not.toContain(c.model)
  })
  it('liste figée des modèles jamais purgés (traçabilité, métier, pilotage)', () => {
    expect([...NEVER_CLEANED_MODELS].sort()).toEqual(['Analyse', 'AppetenceSnapshot', 'AuditLog', 'ConformiteSnapshot', 'Document', 'InstanceEvent', 'McpProposal', 'Organization', 'PlanAction', 'RapportEdition', 'Risque', 'User'].sort())
  })
  it('automatique par défaut : tout sauf B8 (les accusés d’import restent consultables)', () => {
    expect(defaultAutoCategories()).toEqual(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7'])
  })
})

describe('règles aux bornes de la grâce', () => {
  it('B1 jetons de réinitialisation : utilisé ou expiré depuis plus de 24 h', () => {
    const p = byId('B1'); expect(p.model).toBe('passwordResetToken')
    expect(p.where).toEqual({ OR: [{ usedAt: { lt: ago(24 * H) } }, { expiresAt: { lt: ago(24 * H) } }] })
  })
  it('B2 jetons de vérification : expirés depuis plus de 24 h', () => {
    expect(byId('B2').where).toEqual({ expires: { lt: ago(24 * H) } }); expect(byId('B2').idField).toBe('token')
  })
  it('B3 défis MFA : consommés ou expirés depuis plus d’1 h', () => {
    expect(byId('B3').where).toEqual({ OR: [{ consumedAt: { lt: ago(H) } }, { expiresAt: { lt: ago(H) } }] })
  })
  it('B4 sessions : expirées depuis plus de 24 h', () => {
    expect(byId('B4').where).toEqual({ expires: { lt: ago(24 * H) } })
  })
  it('B5 appareils de confiance : expirés depuis plus de 7 jours', () => {
    expect(byId('B5').where).toEqual({ expiresAt: { lt: ago(7 * 24 * H) } })
  })
  it('B6 invitations : jamais acceptées et expirées depuis plus de 30 jours', () => {
    expect(byId('B6').where).toEqual({ acceptedAt: null, expiresAt: { lt: ago(30 * 24 * H) } })
  })
  it('B7 livraisons de webhooks : LIVRE > 30 j ou ECHEC > 90 j ; jamais EN_ATTENTE', () => {
    const w = byId('B7').where as { OR: Array<{ statut: string }> }
    expect(w).toEqual({ OR: [{ statut: 'LIVRE', createdAt: { lt: ago(30 * 24 * H) } }, { statut: 'ECHEC', createdAt: { lt: ago(90 * 24 * H) } }] })
    expect(JSON.stringify(w)).not.toContain('EN_ATTENTE')
  })
  it('B8 accusés d’import : plus de 30 jours', () => {
    expect(byId('B8').where).toEqual({ createdAt: { lt: ago(30 * 24 * H) } })
  })
})

describe('planCleanup / sanitizeCategories', () => {
  it('ne planifie que les catégories demandées', () => {
    expect(planCleanup(NOW, ['B4', 'B1']).map(p => p.id)).toEqual(['B1', 'B4'])
  })
  it('ignore les identifiants inconnus (aucune injection de modèle)', () => {
    expect(sanitizeCategories(['B1', 'AuditLog', 'B99', 7, null, 'B1'])).toEqual(['B1'])
    expect(sanitizeCategories('B1')).toEqual(defaultAutoCategories())
    expect(planCleanup(NOW, sanitizeCategories(['AuditLog']))).toEqual([])
  })
})
