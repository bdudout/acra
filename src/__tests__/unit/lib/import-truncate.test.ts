import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { describeZodIssues, groupTruncations, truncateStringsBySchema } from '@/lib/import-truncate'

const schema = z.object({
  title: z.string().trim().min(1).max(10),
  note: z.string().max(5).optional(),
  tags: z.array(z.string().max(3)).default([]),
  items: z.array(z.object({ name: z.string().max(4), n: z.coerce.number().int().min(1).max(4).optional() })).default([]),
})

describe('truncateStringsBySchema — texte trop long raccourci au plafond du schéma', () => {
  it('raccourcit les chaînes (objets, tableaux, imbriqués) et liste chaque troncature', () => {
    const { data, truncated } = truncateStringsBySchema(schema, { title: 'abcdefghijklmnop', note: 'ok', tags: ['abcdef', 'ab'], items: [{ name: 'abcdefg', n: '3' }, { name: 'abc' }] })
    expect(data).toEqual({ title: 'abcdefghij', note: 'ok', tags: ['abc', 'ab'], items: [{ name: 'abcd', n: '3' }, { name: 'abc' }] })
    expect(truncated.map(t => [t.path, t.max])).toEqual([['title', 10], ['tags.0', 3], ['items.0.name', 4]])
  })
  it('ne modifie pas l’entrée, ignore les champs inconnus et les valeurs non textuelles', () => {
    const input = { title: 'x'.repeat(30), extra: 'y'.repeat(99), items: 'pas un tableau' }
    const { data } = truncateStringsBySchema(schema, input)
    expect((data as { title: string }).title).toHaveLength(10)
    expect((data as { extra: string }).extra).toHaveLength(99)
    expect(input.title).toHaveLength(30)
  })
  it('groupTruncations : regroupe par champ (indices retirés) avec le nombre et le plafond', () => {
    const g = groupTruncations([{ path: 'securityBaseline.9.title', max: 1000, length: 1500 }, { path: 'securityBaseline.39.title', max: 1000, length: 1200 }, { path: 'risks.2.title', max: 255, length: 300 }])
    expect(g).toEqual([{ field: 'securityBaseline.title', count: 2, max: 1000 }, { field: 'risks.title', count: 1, max: 255 }])
  })
})

describe('describeZodIssues — erreurs de validation lisibles', () => {
  it('donne l’objet, le numéro d’élément (à partir de 1), le champ et la raison en clair', () => {
    const r = schema.safeParse({ title: '', items: [{ name: 'x'.repeat(9), n: 9 }] })
    expect(r.success).toBe(false)
    if (r.success) return
    const lines = describeZodIssues(r.error)
    expect(lines.some(l => l.startsWith('title'))).toBe(true)
    expect(lines.join(' | ')).toContain('items n°1 › name')
    expect(lines.join(' | ')).toMatch(/trop long \(max 4\)/)
    expect(lines.join(' | ')).toMatch(/hors limites/)
  })
})
