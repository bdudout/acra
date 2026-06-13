# Contributing to ACRA

Thank you for your interest in contributing! This guide explains how to work on the codebase.

## Table of Contents

- [Getting started](#getting-started)
- [Development rules](#development-rules)
- [Project conventions](#project-conventions)
- [Adding a feature](#adding-a-feature)
- [Pull request checklist](#pull-request-checklist)

---

## Getting started

```bash
git clone https://github.com/votre-org/acra.git
cd acra/ebios-rm
npm install

# Start the database
docker run -d --name acra-db \
  -e POSTGRES_USER=ebios -e POSTGRES_PASSWORD=ebios_secret \
  -e POSTGRES_DB=ebios_rm -p 5432:5432 postgres:16-alpine

cp .env.example .env.local
# Fill in DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL

npx prisma migrate deploy
npx prisma generate
npm run dev
```

---

## Development rules

### 🔴 TDD — Tests first (mandatory)

Every feature or bug fix must have a test written **before** the implementation:

1. Write the test in `src/__tests__/unit/`
2. Run `npm test` — it must **fail** (red)
3. Implement the feature
4. Run `npm test` — it must **pass** (green)
5. Refactor if needed

```bash
npm test              # run once
npm run test:watch    # watch mode during development
npm run test:coverage # coverage report
```

### 🔴 No accents in Prisma column names

Prisma does not support accented characters in field names.

```
✅ valeursMetier    ❌ valeursMétier
✅ scenariosStrateg ❌ scénarios
```

Always check before writing a migration.

### 🔴 Fix TypeScript errors when you see them

If you encounter a pre-existing TypeScript error while working on a file, fix it before moving on. Do not leave `any` types or ignored errors.

---

## Project conventions

### i18n — all UI strings must be translated

Every user-visible string must go through the i18n system. When adding UI text:

1. Add the key in `src/lib/i18n/fr.ts` (French, the source language)
2. Add the same key in `en.ts`, `de.ts`, `es.ts`, `it.ts`
3. Use `t.yourKey` in the component (never hardcode strings)

```typescript
// ✅ correct
const { t } = useTranslation()
<button>{t.workshop.a1.saveBtn}</button>

// ❌ wrong
<button>Enregistrer</button>
```

Arrays with translated labels must be **inside** the component (after `useTranslation()`). Static arrays (colors, style classes) can stay outside.

### RBAC — check permissions.ts

The permission matrix is in `src/lib/permissions.ts`. Do not add ad-hoc role checks in components — use the helpers:

```typescript
import { canEditAnalyse, canAdmin } from '@/lib/permissions'
```

Scale editing (gravité, vraisemblance, risk matrix) is restricted to `ADMIN` only.

### Database — use Prisma migrations

Never modify the database schema directly. Always:

```bash
# After editing prisma/schema.prisma
npx prisma migrate dev --name describe_your_change
npx prisma generate
```

### Auto-save — present in all workshop components

All 5 atelier components use `useAutoSave()`. When adding new state to an atelier, make sure it is included in the auto-save data object.

---

## Adding a feature

### New workshop field

1. Add the field to `prisma/schema.prisma`
2. Create a migration: `npx prisma migrate dev --name add_field_name`
3. Run `prisma generate`
4. Update the API route in `src/app/api/ateliers/[id]/route.ts` (relevant case)
5. Update the workshop component in `src/components/workshops/AtelierN.tsx`
6. Add i18n keys in all 5 language files
7. Write a test

### New API route

Routes live in `src/app/api/`. Follow the existing pattern:
- Import `getServerSession` and check auth first
- Validate input with Zod
- Use `canEditAnalyse` / `canAdmin` for permission checks
- Return consistent `NextResponse.json(...)` shapes

### New i18n language

1. Copy `src/lib/i18n/fr.ts` to `src/lib/i18n/xx.ts`
2. Translate all string values (keep all keys identical)
3. Add the language to `src/lib/i18n/index.ts` and the `LanguageSwitcher` component

---

## Pull request checklist

Before opening a PR, make sure:

- [ ] Tests written and passing (`npm test`)
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] i18n keys added in all 5 language files (if UI strings added)
- [ ] No accent characters in Prisma column names (if schema changed)
- [ ] Migration created and committed (if schema changed)
- [ ] No secrets or `.env` files committed
- [ ] `CONTRIBUTING.md` and `CLAUDE.md` still accurate

---

## Code style

- TypeScript strict mode — no implicit `any`
- Tailwind CSS for all styling — no inline styles
- React Server Components where possible; `'use client'` only when needed (hooks, event handlers)
- Named exports for components, default export for pages
- JSDoc on all exported functions in `src/lib/`

---

## Questions?

Open an issue or start a discussion on GitHub.
