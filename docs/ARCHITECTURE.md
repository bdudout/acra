# Carte du code ACRA — pour agents & IA

> But de ce document : permettre à **plusieurs agents/IA de travailler en parallèle**
> sur le code sans tout relire. Il répond à « **où vit quoi ?** » et « **quels patterns
> respecter ?** ». Il complète, sans les remplacer :
> - [`CONTRIBUTING.md`](../CONTRIBUTING.md) — *comment* contribuer (TDD, PR, i18n) ;
> - [`docs/ara-grc-spec.md`](ara-grc-spec.md) — *pourquoi* / quels modules GRC (M0→M5) ;
> - [`CLAUDE.md`](../../CLAUDE.md) (racine) + [`CLAUDE.md`](../CLAUDE.md) (app) — règles impératives.
>
> ⚠️ Ce fichier décrit une intention d'organisation ; en cas de doute, **le code fait foi**.
> Si vous constatez un écart, corrigez le code *ou* ce document.

---

## 1. Stack & démarrage

- **Next.js 16 (App Router)** — ⚠️ lire `node_modules/next/dist/docs/` avant d'écrire du
  code Next (voir `AGENTS.md`), les conventions diffèrent des versions connues.
- **React 18** (composants serveur par défaut ; `'use client'` explicite sinon).
- **Prisma** + **PostgreSQL** (49 modèles, `prisma/schema.prisma`).
- **NextAuth** (Credentials + SSO OIDC ; SAML en chantier de maintenance).
- **Tailwind** pour le style ; **lucide-react** pour les icônes.
- **Vitest** + Testing Library pour les tests.

```bash
docker-compose up -d   # PostgreSQL (démarrer Docker Desktop d'abord)
npm run dev            # app sur :3000
npm test               # tests (obligatoire avant de considérer une feature finie)
```

---

## 2. Arborescence

```
src/
  app/          Pages (App Router) + routes API (~45 pages, ~150 routes API)
    api/        Endpoints REST : auth de session OU clé d'API (voir §5)
    <domaine>/  Une page = un composant client « …Manager / …Client / …View »
  components/   ~80 composants React (chacun a un en-tête décrivant son rôle)
  lib/          ~185 modules de logique métier — cœur du projet (voir §4)
    i18n/       Traductions fr/en/de/es/it + contexte React
  __tests__/    Tests Vitest (unit/lib, unit/components, unit/api)
prisma/         schema.prisma + migrations
docs/           Specs & documentation (ce fichier, ara-grc-spec, dérogations…)
```

**Convention `lib/`** : un module `xxx.ts` = **cœur pur** (testable sans DB) ;
`xxx.server.ts` = **couche serveur** (accès Prisma, `getServerSession`). Garder la
logique décidable dans le `.ts` pur et testée ; le `.server.ts` orchestre l'I/O.

---

## 3. Modèle de domaine (le vocabulaire)

ACRA est un **monolithe modulaire** : un socle EBIOS RM cyber + des modules GRC
activables (cf. `ara-grc-spec.md`). Les concepts à connaître :

- **Analyse** EBIOS RM = 5 **ateliers** (`ATELIERS_META`, `atelier-icons`). Une analyse
  peut être un **socle** de sécurité réutilisable.
- **Modules GRC** (préfixes `Mx` dans les commentaires `lib/`) :
  - **M1** Cartographie des risques / registre (`cartographie`, `risk-*`, `registre-catalogue`) ;
  - **M2** Incidents & pertes (`incident`, `dora*`) + roll-up (`grc-rollup`) ;
  - **M3** Contrôle permanent N1/N2 (`controle`, `campagne*`) ;
  - **M4** Audit interne (`audit`, `audit-programmes-catalogue`) ;
  - **M5** = le module cyber ACRA historique (les ateliers).
- **Conformité** : un **référentiel** (`referentiel*`) porte des **exigences** ; chaque
  contrôle a un **statut** et, sur un écart, un **traitement**.
- **Plan d'action unifié** (`plan-action`, `action-items`) : couche transverse qui
  agrège **toutes** les actions à mener par **origine** (risque, conformité, contrôle,
  audit, régulateur, incident, orpheline). Voir §6.
- **Traitement d'un écart** : 3 types — **plan d'action**, **dérogation** (workflow RSSI
  formel, `derogation`), **acceptation** de risque.
- **Écosystème / tiers** (`tiers`, `ecosystem-*`) et **Registre TIC** DORA (`registre-tic`,
  `tiers-tic-link`).
- **Régulatoire** : DORA (`dora*`), RGPD/RoPA (`ropa*`, `rgpd-sensitive`), NIS2
  (`nis2-mapping`), SoA (`soa-*`), suivi régulateur (`suivi-regulateur`).
- **Multi-organisation** : arbre d'orgs, config résolue à un seul point (voir §7 et
  `docs/MULTI-ORGANISATION.md`).

---

## 4. Index `lib/` par domaine (où chercher la logique)

> Chaque fichier porte un en-tête décrivant son rôle ; ci-dessous le regroupement.

| Domaine | Modules clés |
|---|---|
| **EBIOS / ateliers** | `ebios-data`, `ebios-gravite`, `atelier-icons`, `exemples-*`, `biens-supports`, `vraisemblance-methode` |
| **Risques (M1)** | `cartographie`, `risk-item`, `risk-action`, `risk-scale`, `risk-filters`, `risk-current`, `risk-publication`, `registre-catalogue`, `appetit`, `taxonomie` |
| **Incidents (M2)** | `incident`, `incident-dedup`, `kri`, `grc-rollup`, `grc-consolide.server` |
| **Contrôle (M3)** | `controle`, `controles-catalogue`, `campagne`, `campagne-controle`, `archivage` |
| **Audit (M4)** | `audit`, `audit-programmes-catalogue`, `audit-redact`, `rapport-controle-interne*` |
| **Conformité** | `conformite*`, `referentiel*`, `couverture-referentiel`, `derogation*`, `conformite-traitement`, `socle-etat` |
| **Plan d'action unifié** | `plan-action`, `plan-action.server`, `action-items`, `action-items.server`, `promotable-actions.server`, `mesure-categorie` |
| **Régulatoire** | `dora`, `dora-reporting`, `dora-its-export`, `nis2-mapping`, `ropa`, `ropa-catalogue`, `rgpd-sensitive`, `suivi-regulateur`, `registre-tic`, `tic-questionnaire`, `soa-*`, `politique-defaut` |
| **Écosystème / tiers** | `tiers`, `tiers.server`, `ecosystem-*`, `tiers-tic-link`, `operateur-ae` |
| **Sécurité / accès** | `auth`, `auth-cookies`, `permissions` (RBAC), `mfa*`, `sso*`, `saml*`, `scim*`, `login-lockout`, `password-policy`, `rate-limit`, `secret-crypto`, `recovery`, `api-auth.server`, `api-key`, `cron-auth`, `csp` |
| **Multi-org / config** | `org-*`, `module-policy`, `configuration-*`, `nav-modules-cache`, `navigation`, `branding*` |
| **Interop** | `api-import`, `import-sanitize`, `webhook*`, `siem*`, `suggestions` |
| **Exports** | `export-pdf`, `pdf-*`, `*-pdf-template.tsx`, `analyse-docx`, `analyse-pptx`, `markdown-docx`, `*-pptx`, `carto-export`, `ras-export`, `comite-pack`, `soa-export` |
| **Cockpits** | `grc-cockpit`, `comite-pack`, `ras-export`, `donut`, `sr-ov-radar`, `most-frequent` |
| **UI transverse** | `table-sort`, `table-filter` (tri/filtre « façon tableur »), `format`, `form-defaults`, `contrast-color`, `theme*`, `i18n/`, `useAutoSave`, `useAddedFeedback` |

---

## 5. Routes API — patterns d'authentification

Deux familles, **ne pas les mélanger** :

1. **Session utilisateur** (UI) : `getServerSession(authOptions)` puis résolution du
   périmètre org via `lib/org-context.server` (`getAnalyseScope`, scope org). RBAC via
   `lib/permissions`. La plupart des routes sous `/api/**`.
2. **Clé d'API** (machine, API publique v1, `/api/v1/**`) : `lib/api-auth.server`
   (Bearer), scopes `read | write | provision`. Import en masse via `lib/api-import`.

Autres gardes : endpoints **cron** → `lib/cron-auth` ; instances **démo** →
`isDemoInstance()` (`lib/demo-server`). Journaliser les actions sensibles via
`auditLog` (`lib/logger`). Une route qui embarque de la logique décidable doit
l'**extraire en fonction pure testée** (cf. CLAUDE.md).

---

## 6. Plan d'action unifié (à comprendre avant d'y toucher)

- Store **`PlanAction`** + **liens polymorphes** `PlanActionLien` (types : `ANALYSE`,
  `CONFORMITE`, `CONTROLE`, `AUDIT`, `RISQUE`, `INCIDENT`).
- `lib/action-items` **agrège** 7 origines en une liste unifiée (vue `/actions` =
  `PlansActionsView`). Filtrage à facettes + tri/filtre colonne (`table-sort`/`table-filter`).
- **Promotion** : une mesure d'analyse ou un incident (pas encore un `PlanAction`) peut
  être **promu** en `PlanAction` rattaché (`promotable-actions.server`, `TraitementPopover`).
- ⚠️ **Décision assumée** : les traitements de conformité de type `PLAN_ACTION` ne sont
  **pas** migrés de force dans `PlanAction` (friction `CLOTURE` + double-source).
  `PlanAction` est la **couche unifiante**, pas un stockage imposé. Voir la mémoire
  projet `plan-action-unifie` et l'en-tête de `TraitementPopover.tsx`.

---

## 7. Patterns transverses à respecter

- **Config à 3 niveaux** (défaut → toggle org → politique d'instance) résolue en **un
  seul point** (`getOrgConfig`) : lire `orgConfig.<feature>Active`, ne **jamais**
  disperser les vérifications. Détail dans `CLAUDE.md` (racine).
- **i18n obligatoire** : toute string UI passe par `t.xxx` ; ajouter les clés dans les
  **5** fichiers `lib/i18n/` (fr, en, de, es, it). Contenu réglementaire/normatif :
  terminologie **officielle** EUR-Lex/ISO, jamais de traduction maison, citer la version.
- **RBAC** : `lib/permissions`. Échelles/matrice → ADMIN ; approbation → RISK_MANAGER &
  RSSI ; dérogation → workflow dédié (`lib/derogation`).
- **Colonnes de DB sans accent** (Prisma) : `valeursMetier`, pas `valeursMétier`.
- **TDD** : test d'abord (`src/__tests__/unit/**`), mock `next/navigation`, `next/link`,
  `@/lib/i18n/context` pour les composants. Corriger toute erreur TS rencontrée.
- **Tables « façon tableur »** : réutiliser `ColumnMenu` + `lib/table-sort` +
  `lib/table-filter` (ne pas réinventer le tri/filtre par colonne).
- **Auto-save** : `useAutoSave` dans les composants d'atelier.

---

## 8. Où ajouter une feature (raccourci)

| Je veux… | Je touche… |
|---|---|
| un champ d'atelier | modèle Prisma + migration, page atelier, i18n ×5, test |
| une route API | `src/app/api/**/route.ts` (auth §5), extraire la logique en `lib/*.ts` pur + test |
| un module métier | `lib/<domaine>.ts` (pur, testé) + `lib/<domaine>.server.ts` (I/O) + composant `…Manager` |
| une table triable/filtrable | `ColumnMenu` + `table-sort`/`table-filter` |
| une activation de module | modèle config à 3 niveaux (§7), jamais de garde dispersée |
| une langue | cf. `CONTRIBUTING.md` → « New i18n language » |

Voir aussi `CONTRIBUTING.md` (« Adding a feature ») pour la checklist détaillée.
