import { describe, it, expect } from 'vitest'
import { DOCUMENT_TEMPLATES, getDocumentTemplate, templateFilename } from '@/lib/document-templates'
import { DOCUMENT_TYPES, sanitizeFilename } from '@/lib/document'

describe('DOCUMENT_TEMPLATES', () => {
  it('fournit les annexes contractuelles classiques (≥ 6)', () => {
    expect(DOCUMENT_TEMPLATES.length).toBeGreaterThanOrEqual(6)
  })
  it('ids et titres uniques', () => {
    expect(new Set(DOCUMENT_TEMPLATES.map(t => t.id)).size).toBe(DOCUMENT_TEMPLATES.length)
    expect(new Set(DOCUMENT_TEMPLATES.map(t => t.titre)).size).toBe(DOCUMENT_TEMPLATES.length)
  })
  it('chaque modèle a un type valide et un contenu Markdown structuré', () => {
    for (const t of DOCUMENT_TEMPLATES) {
      expect((DOCUMENT_TYPES as readonly string[]).includes(t.type)).toBe(true)
      expect(t.contenu).toContain('#') // au moins un titre Markdown
      expect(t.contenu.length).toBeGreaterThan(200)
      expect(t.description.trim().length).toBeGreaterThan(0)
    }
  })
  it('inclut le Plan d’Assurance Sécurité et une annexe RGPD/DPA', () => {
    const ids = DOCUMENT_TEMPLATES.map(t => t.id)
    expect(ids).toContain('pas')
    expect(ids).toContain('dpa-rgpd')
  })
})

describe('getDocumentTemplate', () => {
  it('retrouve un modèle par id, ou undefined', () => {
    expect(getDocumentTemplate('pas')?.titre).toBeTruthy()
    expect(getDocumentTemplate('inconnu')).toBeUndefined()
  })
})

describe('templateFilename', () => {
  it('produit un nom de fichier .md sûr', () => {
    const name = templateFilename(DOCUMENT_TEMPLATES[0])
    expect(name.endsWith('.md')).toBe(true)
    expect(sanitizeFilename(name)).toBe(name) // déjà sûr
  })
})
