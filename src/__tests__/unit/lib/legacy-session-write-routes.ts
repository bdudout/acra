// Routes d'écriture (POST/PUT/PATCH/DELETE) qui lisent encore la session elles-mêmes
// (`getServerSession`) au lieu de passer par `withAccess` (T3 phase 2, 2026-10-16).
// Liste FIGÉE : elle ne peut que décroître. Une route migrée doit en être retirée
// (le cliquet échoue sinon) ; une nouvelle route d'écriture n'y est jamais ajoutée.
export const LEGACY_SESSION_WRITE_ROUTES: readonly string[] = [
  'src/app/api/invitations/[token]/route.ts',
]
