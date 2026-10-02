import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// La page « Mon profil » est ouverte à TOUT utilisateur connecté : elle ne doit appeler aucune route /api/admin/*
// (403 + erreur console pour un non-admin, et politique de mot de passe affichée par défaut au lieu de celle de l'instance).
describe('page profil — routes appelées', () => {
  const source = readFileSync('src/app/profile/page.tsx', 'utf8')
  it('n’appelle aucune route /api/admin/*', () => {
    expect(source).not.toMatch(/fetch\(\s*['"`]\/api\/admin\//)
  })
  it('lit la politique de mot de passe via la route publique /api/auth/password-policy', () => {
    expect(source).toContain("/api/auth/password-policy")
  })
})
