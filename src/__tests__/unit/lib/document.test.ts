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

import { contentMatchesMime } from '@/lib/document'

describe('contentMatchesMime (N06 — signature vs MIME annoncé)', () => {
  const b = (...n: number[]) => Uint8Array.from(n)
  const text = (s: string) => new TextEncoder().encode(s)
  it('accepte les signatures cohérentes', () => {
    expect(contentMatchesMime('application/pdf', text('%PDF-1.7\n'))).toBe(true)
    expect(contentMatchesMime('image/png', b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe(true)
    expect(contentMatchesMime('image/jpeg', b(0xff, 0xd8, 0xff, 0xe0))).toBe(true)
    expect(contentMatchesMime('application/vnd.openxmlformats-officedocument.wordprocessingml.document', b(0x50, 0x4b, 0x03, 0x04))).toBe(true)
    expect(contentMatchesMime('application/msword', b(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1))).toBe(true)
    expect(contentMatchesMime('text/plain', text('Politique de sécurité\n'))).toBe(true)
  })
  it('refuse un exécutable ou une archive déguisés', () => {
    expect(contentMatchesMime('application/pdf', b(0x4d, 0x5a, 0x90, 0x00))).toBe(false)
    expect(contentMatchesMime('text/plain', b(0x4d, 0x5a, 0x90, 0x00))).toBe(false)
    expect(contentMatchesMime('text/csv', b(0x7f, 0x45, 0x4c, 0x46))).toBe(false)
    expect(contentMatchesMime('text/plain', b(0x50, 0x4b, 0x03, 0x04))).toBe(false)
    expect(contentMatchesMime('image/png', text('<svg onload=alert(1)>'))).toBe(false)
    expect(contentMatchesMime('text/plain', b(0x41, 0x00, 0x42))).toBe(false)
    expect(contentMatchesMime('application/x-unknown', text('x'))).toBe(false)
  })
})
