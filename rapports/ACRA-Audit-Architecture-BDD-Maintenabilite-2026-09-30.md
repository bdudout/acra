# ACRA — Audit sécurité, maintenabilité et base de données — 2026-09-30

> Complète `rapports/ACRA-Audit-Code-OWASP-SAST-2026-09-30.md` (sécurité applicative, N01-N08 corrigés le même jour).
> Périmètre : `prisma/schema.prisma` (2 184 lignes, 57 modèles, 154 migrations), `src/` (≈125 000 lignes hors tests, 213 routes API, 282 fichiers dans `src/lib/`), CI.
> Méthode : lecture du code, **plus exécution réelle** : les 154 migrations ont été appliquées sur PostgreSQL 16 local, la dérive schéma/base mesurée avec `prisma migrate diff`, les FK et index inspectés dans `pg_catalog`, et 1 million de lignes de journal d'audit générées pour mesurer les plans (`EXPLAIN ANALYZE`).

## Statut de remédiation (2026-09-30)

**Corrigés** : S4, S1 (suppression), D1, D2 (verrou de ligne sur les 4 écritures par fusion), D5, D6. Vérifiés sur PostgreSQL 16 : la suppression d'un auteur d'analyse est refusée par la FK (`P2003`) ; 20 éditions concurrentes de la conformité → 4/20 conservées sans verrou, 20/20 avec. `tsc` propre, 364 fichiers / 3 001 tests verts, zéro dérive schéma ↔ migrations.
**Reste** : inscrit au backlog `docs/CHANTIERS-EN-COURS.md`, section « Backlog technique » (T1 à T22), avec problème, solution et critère de fin.

## Synthèse

| Axe | Note | En une phrase |
|---|---|---|
| Sécurité (complément) | 5,5 / 10 | Deux constats ÉLEVÉS nouveaux sur la suppression d'utilisateur : destruction d'analyses d'une autre organisation, et chemin d'escalade vers SUPER_ADMIN. |
| Base de données | 5,5 / 10 | Schéma cohérent et migrations saines, mais modélisation en blobs JSON (97 champs `Json`) et statuts en texte libre sans contrainte ; intégrité perdable (cascade utilisateur → analyses, mises à jour perdues sur la conformité). |
| Scalabilité | 4 / 10 | Mono-instance de fait : verrouillage de compte et rate-limit en mémoire, fichiers sur disque local, arbre d'organisations rechargé en entier à chaque requête, listes non paginées. |
| Maintenabilité | 6 / 10 | Très bonne couverture de tests (363 fichiers, ~3 000 tests) et documentation riche ; mais pas de lint, typage contourné (`as any` ×341, `prisma as any` ×65), garde d'accès recopiée dans 174 routes, composants de 1 000 à 1 800 lignes. |

### Priorités

| # | ID | Sévérité | Sujet | Effort |
|---|---|---|---|---|
| 1 | S1 | ÉLEVÉ | Suppression d'utilisateur → cascade sur ses analyses, y compris hors du périmètre de l'admin | 0,5 j |
| 1 | S4 | ÉLEVÉ | Un ADMIN peut supprimer un SUPER_ADMIN ; au redémarrage, le plus ancien ADMIN est promu SUPER_ADMIN | 0,5 j |
| 2 | D1 | ÉLEVÉ | `Analyse.user onDelete: Cascade` : départ d'un collaborateur = perte des analyses | 0,5 j (+ migration) |
| 3 | D2 | MOYEN | Conformité : réécriture du tableau JSON complet sans verrou → mises à jour perdues | 1 j |
| 4 | P1 | MOYEN | État en mémoire (lockout, rate-limit, caches) et stockage local : pas de scale horizontal | 2-3 j |
| 5 | P2 | MOYEN | Chaque requête charge **toutes** les organisations de l'instance | 1 j |
| 6 | M1 | MOYEN | Pas de lint ni de config ESLint ; 152 `eslint-disable` sans effet | 0,5 j |
| 7 | M2 | MOYEN | Garde d'accès recopiée dans 174 routes (origine des bugs F01/F02 de septembre) | 3-5 j progressif |

---

## 1. Sécurité (complément)

### S1 — ÉLEVÉ — Destruction inter-organisations par suppression d'utilisateur (CWE-863, CWE-639)

- **Fichiers** : `src/app/api/admin/users/route.ts:36-43` (`canManageTarget`), `:320-346` (`DELETE`), `prisma/schema.prisma` (`Analyse.user … onDelete: Cascade`).
- **Constat** : un ADMIN (rôle global ADMIN, non SUPER_ADMIN) peut supprimer **définitivement** tout compte ayant **au moins une** appartenance dans son périmètre (`count > 0`). Or la suppression d'un `User` supprime en cascade (vérifié dans `pg_constraint`) :
  - toutes les `Analyse` dont il est propriétaire, **quelle que soit leur organisation**, avec leurs ateliers, risques, mesures, révisions et dérogations ;
  - ses appartenances aux autres organisations et ses accès partagés.
- **Scénario** : groupe multi-filiales. L'admin de la filiale A supprime le compte du RSSI groupe (membre de A et B). Toutes les analyses que ce RSSI a créées dans B disparaissent, sans trace dans B. Le journal `USER_DELETED` est rattaché à l'organisation de l'admin.
- **Aggravant** : la décision utilise le **rôle global** (`canAdmin(role)`), pas le rôle effectif dans l'organisation (même classe de défaut que F01, corrigé le 21/09 sur les analyses).
- **CVSS 3.1** : AV:N/AC:L/PR:H/UI:N/S:C/C:N/I:H/A:H ≈ **7,6**.
- **FIX** :
  1. Un admin non SUPER_ADMIN ne supprime un compte que si **toutes** ses appartenances sont dans son périmètre ; sinon il retire seulement l'appartenance (comme le déprovisioning SCIM corrigé en F02).
  2. Refuser la suppression tant que le compte possède des analyses, ou les réattribuer (voir D1).
  3. Préférer la désactivation (`isActive=false`) à la suppression physique.

### S4 — ÉLEVÉ — Suppression d'un SUPER_ADMIN par un ADMIN, puis auto-promotion au démarrage (CWE-269, CWE-285)

- **Fichiers** : `src/app/api/admin/users/route.ts:320-346` (`DELETE`), `src/lib/org-bootstrap.ts:14-31` (`ensureSuperAdmin`, appelé par `src/instrumentation.ts` à chaque démarrage).
- **Constat** :
  1. `PATCH` interdit à un non-SUPER_ADMIN de modifier un SUPER_ADMIN et protège le dernier (l.288-295). **`DELETE` ne fait aucun de ces contrôles** : il ne lit pas `target.role`. Un ADMIN peut donc supprimer un SUPER_ADMIN qui a une appartenance dans son périmètre, y compris le dernier.
  2. Au redémarrage suivant (déploiement, mise à jour, crash), `ensureSuperAdmin()` constate qu'il n'existe plus de SUPER_ADMIN et **promeut silencieusement l'ADMIN actif le plus ancien**, sans entrée au journal d'audit (seulement un `console.info`).
- **Scénario** : l'ADMIN le plus ancien de l'instance supprime le SUPER_ADMIN, puis attend la prochaine mise à jour. Il obtient alors le contrôle de l'instance : configuration SSO, clés d'API, mises à jour, toutes les organisations.
- **CVSS 3.1** : AV:N/AC:H/PR:H/UI:N/S:C/C:H/I:H/A:H ≈ **8,0** (condition : un redémarrage, fréquent).
- **FIX** : dans `DELETE`, reprendre les règles de `PATCH` (cible SUPER_ADMIN réservée à un SUPER_ADMIN, dernier SUPER_ADMIN non supprimable). `ensureSuperAdmin` ne doit plus promouvoir un compte existant : ne rien faire et loguer une alerte ou refuser de démarrer, la récupération passant par `scripts/create-admin.mjs`. Au minimum, écrire un `auditLog('ROLE_CHANGED', …)` et le transférer au SIEM.

### S2 — FAIBLE — `(prisma as any)` sur des tables de sécurité

65 accès contournent le typage Prisma, dont `passwordPolicy`, `sSOConfig`, `user` dans `auth.ts`, `register`, `saml.server.ts`, `sso.server.ts`. Une faute de frappe sur un champ de politique (MFA, verrouillage) passerait la compilation et renverrait `undefined`, ce qui produit souvent un comportement permissif. Les modèles existent tous dans le client généré : ces casts sont des reliquats. **FIX** : les retirer (mécanique, typecheck en garde-fou).

### S3 — INFO — Validation des corps de requête hétérogène

26 routes sur 132 qui lisent `req.json()` n'utilisent ni schéma zod ni fonction `sanitize*/clean*`. Pas de faille identifiée (Prisma paramètre tout), mais c'est là que se logent les assignations en masse (F006 historique). **FIX** : schéma zod obligatoire à l'entrée de chaque route (voir M2).

---

## 2. Base de données

### Points forts
- 154 migrations **rejouables de bout en bout** sur une base vide (vérifié), `migration_lock.toml` présent.
- Clés étrangères systématiques vers `Organization` avec `onDelete: Cascade` (isolation par locataire cohérente), index sur `organizationId` presque partout.
- Unicités métier présentes (`Conformite(organizationId, referentiel, entite)`, `OrgMembership(userId, organizationId)`, `AnalyseAcces(analyseId, userId)`).
- Chemin matérialisé (`Organization.path`) pour les arbres, suppression douce (`deletedAt`) sur les analyses, secrets chiffrés au repos.

### D1 — ÉLEVÉ — `Analyse.user onDelete: Cascade`

Un référentiel GRC doit survivre au départ de ses auteurs (obligations de preuve DORA / ISO 27001 §7.5). Aujourd'hui, supprimer un compte détruit ses analyses, y compris celles déjà approuvées. **FIX** : `userId` nullable + `onDelete: SetNull` (ou `Restrict`), plus un « propriétaire » réattribuable ; migration sans perte (`ALTER … DROP NOT NULL`, nouvelle FK).

### D2 — MOYEN — Conformité en blob JSON : mises à jour perdues et amplification d'écriture

- `Conformite.entries` stocke **tous** les points d'un référentiel (souvent 90 à plus de 1 000 exigences) dans un seul tableau JSON. `PATCH /api/organizations/[orgId]/conformite` (l.98-103) fait : lecture → modification en mémoire → réécriture du tableau entier, **sans transaction ni numéro de version**.
- Deux auditeurs qui éditent deux exigences différentes en même temps : la seconde écriture écrase la première. C'est silencieux et fréquent en campagne de conformité.
- Chaque modification réécrit tout le blob, et en mode instantané copie aussi tout le blob dans `ConformiteSnapshot`. Le volume croît en *O(éditions × taille du référentiel)*.
- **FIX court terme** : verrou optimiste (`WHERE updatedAt = :lu`, 409 si changé) ou `SELECT … FOR UPDATE` dans une transaction.
- **FIX cible** : table `ConformiteEntree(conformiteId, ref, statut, commentaire, traitement, updatedAt, updatedById)` avec `@@unique([conformiteId, ref])` ; instantanés en différentiel.

### D3 — MOYEN — Modélisation « JSON d'abord » et statuts en texte libre

- **97 champs `Json`**, dont 19 dans `OrganizationConfig`, 10 dans `AuditMission`, 9 dans `Incident`, 7 dans `Configuration`. Conséquences :
  - pas d'intégrité référentielle à l'intérieur (ids de risques dans `TestResilience.riskItemIds`, de mesures dans les blobs d'ateliers) ;
  - pas d'index ni de requête SQL possible ;
  - des validateurs applicatifs (`sanitize*`) recopiés par module.
- **Statuts et types en `String`** commentés (`// EN_ATTENTE | ACCEPTES | REFUSES`) : seulement 10 `enum` Prisma et **2 contraintes CHECK** en base. Une valeur hors liste insérée par un script, un import ou une future route est acceptée sans erreur.
- **FIX** : convertir en `enum` les statuts à cycle de vie (`risquesResiduelsStatut`, `RiskItem.statut/provenance`, `methode`, `mentionProtection`…). Sortir des blobs les données qui ont une identité (entrées de conformité, liens risque↔test, constats), en commençant par D2.

### D4 — FAIBLE — Clés de locataire faibles

- `Analyse.organizationId` est **nullable** (héritage). Le FK est `SET NULL` alors que le commentaire de `admin/organizations/[id]/route.ts:159` le dit « restrictive ». Aujourd'hui les deux chemins de suppression suppriment explicitement les analyses avant, mais tout nouveau chemin créera des analyses orphelines sans organisation.
- **6 modèles** portent `organizationId` **sans FK** : `McpProposal`, `CampagneEvaluation`, `ControleExecution`, `AuditConstat`, `KriMesure`, `AuditLog`. Pour `AuditLog` c'est voulu (le journal survit), pour les autres ils ne sont nettoyés que via le parent.
- **FIX** : rendre `Analyse.organizationId` obligatoire (rattacher les `NULL` à `global` par migration) avec `onDelete: Restrict`. Ajouter les FK manquantes ou documenter qu'elles sont dénormalisées.

### D5 — FAIBLE — Dérive schéma ↔ migrations

`prisma migrate diff` (base migrée → schéma) produit :
```sql
DROP INDEX "AuditConstat_referentielCode_idx";
DROP INDEX "Controle_referentielCode_idx";
```
Deux index créés par une migration ne sont plus déclarés dans `schema.prisma`. Le prochain `prisma migrate dev` générera leur suppression sans que personne l'ait décidé. **FIX** : les redéclarer (`@@index([referentielCode])`) ou les supprimer par une migration explicite. **Ajouter `prisma migrate diff --exit-code` à la CI.**

### D6 — FAIBLE — FK sans index

`Account.userId`, `Session.userId`, `AnalyseAcces.userId` (seul l'index composite `(analyseId, userId)` existe, inutilisable pour « les analyses partagées avec moi »). La requête d'accès `analyseAccessWhere` filtre justement sur `accesUtilisateurs.some.userId`. **FIX** : `@@index([userId])` sur ces trois tables.

### D7 — FAIBLE — Journal d'audit sans rétention

Mesures sur **1 000 000** de lignes générées :

| Requête (route `/api/admin/audit-log`) | Temps | Commentaire |
|---|---|---|
| Page 1, 2 organisations | 12-18 ms | l'index `createdAt` est parcouru en filtrant ~98 000 lignes |
| `count(*)` du périmètre | 2 ms | OK |
| Liste des actions (`DISTINCT action`) | **82 ms** | parcours séquentiel complet **à chaque affichage** |
| Page profonde (`OFFSET 500000`) | **89 ms** | pagination par offset, linéaire |

C'est acceptable aujourd'hui, mais linéaire : aucune purge ni archivage, et tous les événements MCP ou API alimentent la table. **FIX** : rétention paramétrable avec export SIEM avant purge, pagination par curseur (`createdAt, id`), liste des actions tirée de l'énumération `AuditAction` (pas de `DISTINCT`), partitionnement mensuel au-delà de ~10 M lignes.

### D8 — INFO
- `Organization.logo` (data URL, `Text`) est stocké dans la ligne de l'organisation : il est rechargé par toute requête sans `select`. À déplacer vers le stockage de documents.
- Deux magasins de configuration concurrents : `Configuration` (7 Json, sans FK) et `OrganizationConfig` (19 Json, 130 lignes, « table fourre-tout »).
- L'index `Organization.path` n'est jamais utilisé : le préfixe est calculé en JavaScript (`org-context.ts:98`, voir P2).

---

## 3. Scalabilité

### P1 — MOYEN — L'application n'est pas sans état : un seul conteneur possible

| État | Où | Effet en multi-instance |
|---|---|---|
| Verrouillage de compte après N échecs | `src/lib/login-lockout.ts` (Map en mémoire) | contournable (N essais par instance), perdu au redémarrage |
| Rate-limit | `InMemoryRateLimitStore` ; `RedisRateLimitStore` existe mais `configureRateLimitStore()` **n'est appelé nulle part** | limites divisées par le nombre d'instances |
| Caches de config (SIEM, etc.) | variables de module | incohérences jusqu'à expiration |
| Fichiers (documents, rapports) | volume local `.data/documents` ; l'adaptateur S3 référencé (`document-storage-s3.ts`) **n'existe pas** | fichiers visibles d'une seule instance |

**FIX** : brancher Redis dans `src/instrumentation.ts` (rate-limit et lockout via le même store), écrire l'adaptateur S3 (OVH Object Storage), et tant que ce n'est pas fait, documenter « une seule réplique » dans le runbook.

### P2 — MOYEN — Toutes les organisations chargées à chaque requête

`resolveOrgContext`, `getEffectiveRoleForOrg` et `getAccessibleOrgIds` (`src/lib/org-context.server.ts:58, 132, 157`) exécutent `prisma.organization.findMany()` **sans filtre** puis calculent l'arbre en mémoire. Une route typique en appelle deux (par exemple `analysis-imports/preview` : `getAnalyseScope` puis `getEffectiveRoleForOrg`). En mode démo, chaque inscription crée une organisation : le coût de **chaque** appel API croît avec le nombre total d'inscrits. **FIX** : requête par préfixe de `path` (`WHERE path LIKE '/…/%'`) avec un index `text_pattern_ops` : l'image `postgres:16-alpine` utilise par défaut une collation `en_US.utf8`, avec laquelle l'index btree actuel sur `path` n'est pas utilisable pour un `LIKE 'x%'`, mémoïsation par requête (`React.cache`).

### P3 — MOYEN — Listes non paginées

133 des 184 `findMany` n'ont pas de `take`. Exemple structurant : `GET /api/analyses` charge **toutes** les analyses visibles avec **tous** leurs risques et toutes leurs mesures (`select` de `risques` et `mesures`) pour calculer des compteurs côté Node. Même schéma dans `grc/rollup` (8 requêtes), `grc-consolide.server.ts` et `action-items.server.ts`. **FIX** : agrégats SQL (`groupBy`, `_count` filtré), pagination par curseur sur les listes, plafond `take` par défaut dans un helper.

### P4 — INFO
Pas de pool de connexions dimensionné explicitement (`connection_limit` absent de `DATABASE_URL` dans `.env.example`). Pas de lecture sur réplique. À traiter après P1.

---

## 4. Maintenabilité

### Points forts
- **Tests** : 363 fichiers unitaires (~3 000 tests, environ 110 s) et 17 fichiers e2e Playwright ; en CI : typecheck strict, tests, build, e2e, audit npm, parité i18n.
- **TypeScript `strict`**, aucun `@ts-ignore`.
- **Documentation** : `docs/ARCHITECTURE.md`, specs, runbook, traçabilité des remédiations. Commentaires en tête de fichier qui donnent le *pourquoi*.
- Séparation « logique pure testée » (`lib/*.ts`) / « couche serveur » (`*.server.ts`), bien appliquée.

### M1 — MOYEN — Lint absent

`npm run lint` n'existe pas, il n'y a **aucun** `eslint.config.*` (ESLint 9 refuse de démarrer sans), la CI ne lint pas. Les **152 `eslint-disable`** du code sont donc sans effet et masquent que les règles ne tournent plus (règles React hooks, `no-floating-promises`, imports inutilisés). **FIX** : `eslint.config.mjs` avec `eslint-config-next` + `typescript-eslint`, job CI ; activer d'abord en avertissement.

### M2 — MOYEN — Contrôle d'accès recopié route par route

174 routes appellent `getServerSession` et reconstruisent chacune la même chaîne : session → rôle → organisation → rôle effectif → module actif → rate-limit → validation. On relève **274** `session.user as any` / `as {…}`. Les failles de septembre (F01 rôle global au lieu du rôle d'organisation, F02 SCIM, S1 ci-dessus) viennent toutes d'une route qui a recopié une variante fausse. **FIX** : un wrapper unique, par exemple :
```ts
export const PATCH = withAccess({ module: 'conformite', perm: 'edit', body: schema, rateLimit: LIMIT_API_WRITE },
  async ({ ctx, body }) => { … })
```
qui impose le rôle **effectif**, le schéma zod et le rate-limit. Migrer route par route, en commençant par les écritures.

### M3 — FAIBLE — Typage contourné
`as any` ×341, `: any` ×258, `(prisma as any)` ×65 (voir S2). Une session typée (`declare module 'next-auth'` avec `id`, `role`, `sessionVersion`) supprimerait à elle seule la plupart des 274 casts de session.

### M4 — FAIBLE — Fichiers trop gros et `lib/` plat
15 fichiers de code (hors i18n et données) dépassent 600 lignes : `configuration/page.tsx` (1 860), `Atelier1.tsx` (1 427), `Atelier3.tsx` (1 392), `pdf-template.tsx` (1 336), `Atelier5.tsx` (1 169), `admin/security/page.tsx` (1 019)… `src/lib/` contient **282 fichiers à plat**. **FIX** : regrouper par domaine (`lib/conformite/`, `lib/audit/`, `lib/auth/`…) au fil des modifications ; découper les ateliers en sous-composants par section.

### M5 — FAIBLE — Duplications ciblées
- La lecture de `passwordPolicy.findUnique({ id: 'global' })` apparaît 15 fois, chacune remappant ses champs → un seul `loadPasswordPolicy()`.
- Trois gardes SSRF divergentes existaient (unifiées le 30/09 dans `ip-safety.ts`) : même risque pour les gardes d'accès (M2).
- La couverture de code n'est pas mesurée en CI (`test:coverage` existe mais n'est pas lancé ni seuillé).

### M6 — INFO
`middleware.ts` est une convention **dépréciée** en Next 16.3 (avertissement au build : « use proxy instead »). Migration via `npx @next/codemod@canary middleware-to-proxy .` à planifier, en vérifiant le CSP à nonce.

---

## Feuille de route

| Horizon | Actions |
|---|---|
| Immédiat (sprint) | S4 · S1 + D1 (suppression d'utilisateur sûre, analyses conservées) · D2 verrou optimiste · D5 réaligner les index et ajouter `migrate diff` en CI · D6 index FK · M1 ESLint en CI |
| Court terme (1-2 mois) | P1 Redis + adaptateur S3 · P2 portée d'organisation par préfixe de `path` · P3 pagination et agrégats SQL · S2/M3 retrait des `as any` et session typée · D7 rétention du journal |
| Moyen terme | M2 wrapper `withAccess` généralisé · D3 enums et sortie des blobs (table `ConformiteEntree` d'abord) · D4 `organizationId` obligatoire · M4 découpage · M6 migration `proxy` |

## Limites
- Pas de test de charge HTTP de bout en bout. Les mesures de volume portent sur le journal d'audit (1 M lignes) ; les autres constats de scalabilité sont déduits du code.
- Les requêtes générées par Prisma n'ont pas été tracées en exécution (pas de `log: ['query']`).
- La base de test (PostgreSQL 16 local, collation `C.UTF-8`) peut différer de la production pour la collation ; à vérifier avec `SHOW lc_collate` sur le VPS avant d'appliquer P2.
