import { describe, it, expect } from 'vitest'
import {
  DOCUMENT_TYPES, DOCUMENT_PORTEES, MAX_DOCUMENT_SIZE, ALLOWED_DOCUMENT_MIME,
  sanitizeFilename, mimeAutorise, validateDocumentMeta, cleanDocumentMeta, storageKeyFor,
} from '../../../lib/document'

describe('sanitizeFilename', () => {
  it('retire tout chemin et ne garde que des caractères sûrs', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd')
    expect(sanitizeFilename('Ma PSSI (v2).pdf')).toBe('Ma-PSSI-v2.pdf')
    expect(sanitizeFilename('rapport\\annexe.docx')).toBe('annexe.docx')
  })
  it('borne la longueur et fournit un repli', () => {
    expect(sanitizeFilename('')).toBe('document')
    expect(sanitizeFilename('a'.repeat(300)).length).toBeLessThanOrEqual(120)
  })
})

describe('mimeAutorise', () => {
  it('accepte les formats bureautiques, refuse les exécutables', () => {
    expect(mimeAutorise('application/pdf')).toBe(true)
    expect(ALLOWED_DOCUMENT_MIME.has('application/pdf')).toBe(true)
    expect(mimeAutorise('application/x-msdownload')).toBe(false)
    expect(mimeAutorise('')).toBe(false)
  })
})

describe('validateDocumentMeta', () => {
  it('exige un titre', () => {
    expect(validateDocumentMeta({ titre: '', portee: 'ORG' })).toBe('titre_requis')
    expect(validateDocumentMeta({ titre: 'PSSI', portee: 'ORG' })).toBeNull()
  })
  it('valide type et portée', () => {
    expect(validateDocumentMeta({ titre: 'x', type: 'ZZZ', portee: 'ORG' })).toBe('type_invalide')
    expect(validateDocumentMeta({ titre: 'x', portee: 'ZZZ' })).toBe('portee_invalide')
  })
  it('exige la cible selon la portée', () => {
    expect(validateDocumentMeta({ titre: 'x', portee: 'REFERENTIEL' })).toBe('referentiel_requis')
    expect(validateDocumentMeta({ titre: 'x', portee: 'REFERENTIEL', referentielId: 'r1' })).toBeNull()
    expect(validateDocumentMeta({ titre: 'x', portee: 'RISQUE' })).toBe('risque_requis')
    expect(validateDocumentMeta({ titre: 'x', portee: 'RISQUE', risqueId: 'q1' })).toBeNull()
  })
  it('rejette une taille hors bornes ou un mime interdit', () => {
    expect(validateDocumentMeta({ titre: 'x', portee: 'ORG', taille: MAX_DOCUMENT_SIZE + 1 })).toBe('fichier_trop_gros')
    expect(validateDocumentMeta({ titre: 'x', portee: 'ORG', taille: 0 })).toBe('fichier_vide')
    expect(validateDocumentMeta({ titre: 'x', portee: 'ORG', mime: 'application/x-sh' })).toBe('mime_interdit')
  })
})

describe('cleanDocumentMeta', () => {
  it('normalise et fixe les cibles selon la portée', () => {
    const c = cleanDocumentMeta({ titre: '  PSSI 2026 ', type: 'PSSI', portee: 'REFERENTIEL', referentielId: 'r1', risqueId: 'q1', version: ' v1 ' })
    expect(c.titre).toBe('PSSI 2026')
    expect(c.type).toBe('PSSI')
    expect(c.referentielId).toBe('r1')
    expect(c.risqueId).toBeNull() // portée REFERENTIEL → on ignore la cible risque
    expect(c.version).toBe('v1')
  })
  it('type inconnu → AUTRE', () => {
    expect(cleanDocumentMeta({ titre: 'x', type: 'ZZZ', portee: 'ORG' }).type).toBe('AUTRE')
  })
  it('expose les listes', () => {
    expect(DOCUMENT_TYPES).toContain('PSSI')
    expect(DOCUMENT_PORTEES).toEqual(['REFERENTIEL', 'RISQUE', 'ORG'])
  })
})

describe('storageKeyFor', () => {
  it('construit une clé déterministe basée sur les identifiants, jamais le chemin d’origine', () => {
    const k = storageKeyFor('org1', 'doc1', '../../evil.pdf')
    expect(k).toBe('org1/doc1/evil.pdf')
    expect(k).not.toContain('..')
  })
})
