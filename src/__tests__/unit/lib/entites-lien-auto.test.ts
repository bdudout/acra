// Lien automatique au référentiel à l'écriture (consolidation, lot E5) : texte identique (nom, alias, code) d'une entité
// ACTIVE de l'organisation → entiteId ; sinon null ; une erreur de lecture ne bloque jamais la saisie.
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: vi.fn() }))
import { entiteIdPourTexte } from '@/lib/entites.server'

type Ligne = { id: string; nom: string; type: string; alias: unknown; codeExterne: string | null; parentId: string | null; source: string; valideAu: Date | null }
const rows: Ligne[] = [
  { id: 'dsi', nom: 'Direction des SI', type: 'SERVICE', alias: ['DSI'], codeExterne: 'D1', parentId: null, source: 'MANUEL', valideAu: null },
  { id: 'old', nom: 'Achats', type: 'DIRECTION', alias: [], codeExterne: null, parentId: null, source: 'MANUEL', valideAu: new Date('2020-01-01') },
]
const db = (r: Ligne[] = rows) => ({ entite: { findMany: vi.fn(async (_a: object) => r) } })

describe('entiteIdPourTexte', () => {
  it('nom, alias ou code identique d’une entité active → son id, bornée à l’organisation', async () => {
    const d = db()
    expect(await entiteIdPourTexte('o1', ' dsi ', d)).toBe('dsi')
    expect(d.entite.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'o1' } }))
    expect(await entiteIdPourTexte('o1', 'D1', db())).toBe('dsi')
  })
  it('entité close, texte proche ou vide → null ; erreur de lecture → null', async () => {
    expect(await entiteIdPourTexte('o1', 'Achats', db())).toBeNull()
    expect(await entiteIdPourTexte('o1', 'Direction SI', db())).toBeNull()
    expect(await entiteIdPourTexte('o1', '', db())).toBeNull()
    expect(await entiteIdPourTexte('o1', 'DSI', { entite: { findMany: vi.fn(async (_a: object): Promise<Ligne[]> => { throw new Error('db') }) } })).toBeNull()
  })
})
