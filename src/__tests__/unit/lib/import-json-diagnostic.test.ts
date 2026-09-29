import { describe, expect, it } from 'vitest'
import { diagnoseJsonText } from '@/lib/import-json-diagnostic'

const bad = (raw: string) => { const r = diagnoseJsonText(raw); if (r.ok) throw new Error('attendu : invalide'); return r }

describe('diagnoseJsonText', () => {
  it('JSON valide (BOM toléré) : valeur renvoyée', () => {
    expect(diagnoseJsonText('{"nom":"A"}')).toEqual({ ok: true, value: { nom: 'A' } })
    expect(diagnoseJsonText('﻿{"nom":"A"}')).toEqual({ ok: true, value: { nom: 'A' } })
  })
  it('fichier vide ou blanc', () => {
    expect(bad('').code).toBe('json_empty')
    expect(bad('  \n ').code).toBe('json_empty')
  })
  it('page web enregistrée à la place de l’export', () => {
    expect(bad('<!DOCTYPE html><html><body>Connexion</body></html>').code).toBe('json_html')
    expect(bad('  <html lang="fr">').code).toBe('json_html')
  })
  it('contenu binaire (classeur, PDF…) pris pour un JSON', () => {
    expect(bad('PK\u0003\u0004\u0014\u0000\u0000\u0000').code).toBe('json_binary')
    expect(bad('%PDF-1.7\n').code).toBe('json_binary')
  })
  it('erreur de syntaxe : ligne, colonne et extrait localisés', () => {
    const r = bad('{\n  "nom": "A",\n  "risques": [1, 2,,]\n}')
    expect(r).toMatchObject({ code: 'json_invalid', line: 3 })
    expect(r.column).toBeGreaterThan(10)
    expect(r.snippet).toContain('[1, 2')
  })
  it('causes fréquentes reconnues : virgule finale, apostrophes, commentaires, fin de fichier tronquée', () => {
    expect(bad('{"a": 1,}').hint).toBe('trailing_comma')
    expect(bad("{'nom': 'A'}").hint).toBe('single_quotes')
    expect(bad('{\n // note\n "a": 1}').hint).toBe('comments')
    expect(bad('{"nom": "A", "risques": [').hint).toBe('truncated')
  })
  it('extrait borné et sans retour à la ligne', () => {
    const r = bad(`{"a": "${'x'.repeat(500)}" "b": 1}`)
    expect(r.snippet!.length).toBeLessThanOrEqual(60)
    expect(r.snippet).not.toMatch(/\n/)
  })
})
