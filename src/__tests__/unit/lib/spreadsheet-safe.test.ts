import { describe, it, expect } from 'vitest'
import { sanitizeForSpreadsheet, toCsvCell } from '@/lib/spreadsheet-safe'

describe('sanitizeForSpreadsheet — neutralisation de l\'injection de formules (CWE-1236)', () => {
  it('laisse passer une chaîne normale inchangée', () => {
    expect(sanitizeForSpreadsheet('CHU Métropole')).toBe('CHU Métropole')
    expect(sanitizeForSpreadsheet('Risque 12 - élevé')).toBe('Risque 12 - élevé')
  })

  it('préfixe une apostrophe devant les caractères de formule en tête', () => {
    expect(sanitizeForSpreadsheet('=1+1')).toBe("'=1+1")
    expect(sanitizeForSpreadsheet('+cmd')).toBe("'+cmd")
    expect(sanitizeForSpreadsheet('-2+3')).toBe("'-2+3")
    expect(sanitizeForSpreadsheet('@SUM(A1)')).toBe("'@SUM(A1)")
  })

  it('neutralise les payloads classiques d\'exécution', () => {
    expect(sanitizeForSpreadsheet('=cmd|\'/c calc\'!A1')).toBe("'=cmd|'/c calc'!A1")
    expect(sanitizeForSpreadsheet('=HYPERLINK("http://evil","x")')).toBe('\'=HYPERLINK("http://evil","x")')
  })

  it('neutralise les caractères de contrôle en tête (tab, CR, LF)', () => {
    expect(sanitizeForSpreadsheet('\t=1+1')).toBe("'\t=1+1")
    expect(sanitizeForSpreadsheet('\r=1+1')).toBe("'\r=1+1")
  })

  it('gère null / undefined / nombres sans planter', () => {
    expect(sanitizeForSpreadsheet(null)).toBe('')
    expect(sanitizeForSpreadsheet(undefined)).toBe('')
    expect(sanitizeForSpreadsheet(42)).toBe('42')
    expect(sanitizeForSpreadsheet(0)).toBe('0')
  })

  it('ne préfixe pas un nombre négatif réel passé en number (valeur numérique)', () => {
    // Les valeurs numériques restent des nombres ; seules les chaînes sont neutralisées
    expect(sanitizeForSpreadsheet(-5)).toBe('-5')
  })
})

describe('toCsvCell — cellule CSV sûre (anti-formule + échappement RFC 4180)', () => {
  it('neutralise une formule sans guillemets parasites quand inutile', () => {
    expect(toCsvCell('=cmd|\'/c calc\'!A1')).toBe("'=cmd|'/c calc'!A1")
    expect(toCsvCell('+cmd')).toBe("'+cmd")
    expect(toCsvCell('@SUM(A1)')).toBe("'@SUM(A1)")
  })

  it('entoure de guillemets et double les guillemets internes quand nécessaire', () => {
    expect(toCsvCell('a,b')).toBe('"a,b"')
    expect(toCsvCell('dit "bonjour"')).toBe('"dit ""bonjour"""')
    expect(toCsvCell('ligne1\nligne2')).toBe('"ligne1\nligne2"')
  })

  it('neutralise ET échappe un payload combinant formule + virgule + guillemets', () => {
    // =HYPERLINK("http://evil","x") : doit être préfixé ' ET mis entre guillemets
    expect(toCsvCell('=HYPERLINK("http://evil","x")'))
      .toBe('"\'=HYPERLINK(""http://evil"",""x"")"')
  })

  it('laisse passer une chaîne normale et les nombres', () => {
    expect(toCsvCell('CHU Métropole')).toBe('CHU Métropole')
    expect(toCsvCell(42)).toBe('42')
    expect(toCsvCell(null)).toBe('')
    expect(toCsvCell(undefined)).toBe('')
  })
})
