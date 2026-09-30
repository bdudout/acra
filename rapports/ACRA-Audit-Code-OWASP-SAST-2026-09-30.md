# ACRA — Audit code OWASP / CWE / SAST — 2026-09-30

> Re-audit statique ciblé (OWASP Top 10 2021, CWE Top 25, patterns SAST) de `src/` (Next.js 16 App Router, next-auth 4, Prisma 5, ~213 routes API) et des fichiers de déploiement.
> Prend la suite de `audit-annotations/FINDINGS_INDEX.md` (2026-07-06), `docs/audit-remediation-2026-09-21.md` et `rapports/ACRA-Contre-Audit-Securite-2026-09-20.md`. Les constats déjà clos ne sont pas re-listés.

## Synthèse

**Score de risque global : ~3,5 / 10 — MOYEN-BON.** Aucune injection SQL/commande, aucun secret en dur, aucune IDOR nouvelle, aucun `eval`/`innerHTML` sur donnée utilisateur. Les faiblesses restantes se concentrent sur **la protection anti-SSRF** (trois implémentations divergentes et incomplètes) et **une dépendance critique** (Next.js).

| ID | Sévérité | CVSS | CWE / OWASP | Sujet |
|----|----------|------|-------------|-------|
| N01 | ÉLEVÉ (advisory critique, exposition faible) | 9,8 advisory / ~4 contextuel | CWE-1104 / A06 | `next@16.3.4` dans la plage vulnérable GHSA-vcvr-r3jv-pc5j |
| N02 | MOYEN | 5,0 | CWE-918 / A10 | SSRF du connecteur d'entités REST/LDAP (pas de résolution DNS, liste de blocage incomplète, réponse relue) |
| N03 | MOYEN | ~4,7 | CWE-918 / A10 | Garde anti-SSRF webhooks/SSO/SAML contournable (IPv6 mappé, `::`, `localhost.`, CGNAT, rebinding) |
| N04 | FAIBLE | 3,7 | CWE-307, CWE-208 / A07 | Authentification par clé d'API : pas de limitation avant scrypt ; timing révèle l'existence d'un préfixe |
| N05 | FAIBLE | 3,1 | CWE-306, CWE-778 / A04 | `DELETE /api/account/delete` : pas de ré-authentification, pas de rate-limit, audit avant suppression |
| N06 | FAIBLE | 3,1 | CWE-434, CWE-345 / A04 | Upload de documents : MIME = `file.type` déclaré par le client, contenu non vérifié |
| N07 | INFO | 0 | — | Annotation `AUDIT [F004]` périmée dans `register/route.ts` (contredit le correctif actuel) |
| N08 | INFO | 0 | CWE-829 / A08 | Actions GitHub épinglées par tag (pas par SHA) ; override `brace-expansion` insuffisant |

---

## N01 — `next` 16.3.4 dans la plage vulnérable (advisory critique)

- **Preuve** : `package-lock.json` → `node_modules/next` = `16.3.4` ; `npm audit --package-lock-only` : *next 16.2.0 – 16.3.5, critical, « Remote Code Execution in next/og ImageResponse » (GHSA-vcvr-r3jv-pc5j)*, correctif disponible. Dernière version publiée : `16.3.8`.
- **Atteignabilité** : `grep` sur `next/og`, `ImageResponse`, `opengraph-image`, `twitter-image` → **aucun usage** dans `src/` (seul `src/app/apple-icon.png`, statique). L'exposition réelle est donc faible, mais une dépendance tierce ou une évolution future peut réactiver le chemin vulnérable.
- **Conséquence CI** : `scripts/audit-check.mjs` (job `npm-audit` de `.github/workflows/security.yml`, `.audit-allowlist.json` vide) échouera sur cette advisory → la CI est rouge ou le sera au prochain run.
- **FIX** : passer `next` à `^16.3.8` (patch de la même mineure ; lire `node_modules/next/dist/docs/` selon `AGENTS.md`), relancer `npm audit`, typecheck, tests et build. Ne pas ajouter d'exception à l'allowlist.
- Le même audit signale `brace-expansion` (high, DoS) : voir N08.

## N02 — SSRF du connecteur d'entités (REST/LDAP)

- **Fichiers** : `src/lib/entity-sync.ts:7-13` (`isPrivateHostname`), `:84-91` (`validateSyncEndpoint`), `:116-136` (`fetchRestEntities`), `:145+` (`fetchLdapEntities`) ; appelé par `src/app/api/organizations/[orgId]/entites/sync/route.ts` (`readConnector`, opération `preview`).
- **Constat** : le commentaire de `validateSyncEndpoint` dit « La résolution DNS doit être contrôlée une seconde fois au moment de la requête serveur », mais **aucune résolution n'est faite** (`grep lookup|resolve4` : seul `webhook.server.ts` en fait). La validation ne porte que sur le nom d'hôte littéral.
- **Reproduction** (exécutée sur la fonction réelle, Node 22) :

  | URL configurée | Résultat |
  |---|---|
  | `https://internal.corp/x` (résolu en 10.x par le DNS interne) | **ACCEPTÉE** |
  | `https://metadata.google.internal/x` | **ACCEPTÉE** |
  | `https://localhost./x` (point final) | **ACCEPTÉE** |
  | `https://100.64.0.1/x`, `https://198.18.0.1/x` (CGNAT / bench) | **ACCEPTÉES** |
  | tout domaine public dont l'enregistrement A pointe vers une IP privée | **ACCEPTÉ** |

- **Impact** : l'appel part du serveur, la réponse JSON est **relue** et les champs `displayName|cn|name|ou` renvoyés à l'appelant (`entities` dans la réponse du `preview`) : SSRF à lecture partielle vers tout service JSON interne accessible. Le rôle requis est **ADMIN d'une organisation** ; or en mode démo/inscription publique, chaque inscrit devient ADMIN de sa propre organisation — l'exposition dépasse donc les seuls administrateurs de confiance. LDAP : connexion TCP/TLS vers un hôte interne arbitraire (sonde de ports par temporisation), sans garde DNS non plus.
- **CVSS 3.1** : AV:N/AC:L/PR:L/UI:N/S:C/C:L/I:N/A:N = **5,0**.
- **FIX** : une seule primitive partagée `assertPublicHttpUrl(url)` dans `src/lib/` : (1) schéma https ; (2) `dns.lookup(host, { all: true })` ; (3) refus si **une** adresse résolue est non publique (voir liste N03) ; (4) **épingler** la connexion sur l'IP validée (agent undici avec `connect.lookup` personnalisé) pour supprimer la fenêtre de rebinding ; (5) garder `redirect: 'manual'` et la borne de 1 Mo déjà présents. Appliquer à REST et LDAP. Ajouter un test par ligne du tableau ci-dessus.

## N03 — Garde anti-SSRF des webhooks / issuer SSO / URL SAML contournable

- **Fichiers** : `src/lib/webhook.ts:101-162` (`isPrivateV4`, `isPrivateIp`, `isSafeWebhookUrl`), réutilisé par `src/lib/sso.ts:14` (`isSafeIssuerUrl`, donc `sso.server.ts:45` et `saml.ts:34`) ; livraison dans `src/lib/webhook.server.ts:103-135` ; SIEM : `src/lib/siem.server.ts:75-110`.
- **Reproduction** (fonctions réelles) :

  | Entrée | `isSafeWebhookUrl` |
  |---|---|
  | `https://[::ffff:127.0.0.1]/` → hostname normalisé `[::ffff:7f00:1]` | **true** (loopback) |
  | `https://[::ffff:a9fe:a9fe]/` (169.254.169.254, métadonnées cloud) | **true** |
  | `https://[::]/` | **true** |
  | `https://localhost./` | **true** |
  | `https://100.64.0.1/`, `https://198.18.0.1/` | **true** |

  `isPrivateIp('::ffff:7f00:1')` renvoie aussi `false` : la garde « IP résolue » de `deliverOne` (webhook.server.ts:113-114) est donc contournée par la même forme (le test existant ne couvre que la forme décimale `::ffff:127.0.0.1`). Les adresses `0.0.0.0/8` sont bloquées, mais pas `100.64/10`, `192.0.0.0/24`, `198.18/15`, `224/4`, `240/4`.
- **Résiduel connu** : la résolution DNS (`lookup`) et le `fetch` sont deux résolutions distinctes → rebinding possible (déjà documenté dans le code).
- **SIEM** : la liste d'hôtes autorisés `SIEM_ALLOWED_HOSTS` est **vide par défaut = non restreint** ; http/https quelconque. Acceptable (destinations internes légitimes) mais à rendre obligatoire en production (`docs/runbook-exploitation.md`).
- **Impact** : POST signé (JSON d'événement) vers un service interne choisi par un ADMIN d'organisation ; le code HTTP et l'erreur sont stockés (`dernierCode`, `derniereErreur`) → oracle de sondage interne. Le déclenchement exige un rôle ADMIN, d'où CVSS ~**4,7** (AV:N/AC:H/PR:H/UI:N/S:C/C:L/I:L/A:N).
- **FIX** : remplacer `isPrivateV4`/`isPrivateIp` par une implémentation unique qui **parse** l'adresse (`node:net.isIP`, conversion des formes `::ffff:x:y`, IPv4 décimales/hex) et teste des plages CIDR (RFC 1918, 100.64/10, 127/8, 169.254/16, 0/8, 192.0.0/24, 198.18/15, 224/4, 240/4, `::`, `::1`, fc00::/7, fe80::/10, `::ffff:0:0/96` ramené en IPv4). Retirer le trailing dot de l'hôte avant les tests `localhost`. Mutualiser avec N02.

## N04 — Authentification par clé d'API : pas de frein avant scrypt, timing du préfixe

- **Fichiers** : `src/lib/api-auth.server.ts:22-33`, `src/lib/mcp/auth.server.ts:26-33` (SCIM passe par `authenticateApiRequest(req, 'provision')`) ; `src/lib/api-key.ts:verifyApiKey`.
- **Constat** : le rate-limit MCP est appliqué **après** l'authentification (`mcp/route.ts`, clé `mcp:<keyId>`) ; l'API v1 et SCIM n'ont pas de limitation sur les **échecs**. Une requête avec un préfixe existant déclenche un `scrypt` (coût mémoire/CPU) ; un préfixe inconnu ne coûte qu'un `findUnique`. Le commentaire « Ne divulgue jamais si le préfixe existe » est donc inexact par le **temps de réponse**.
- **Impact** : amplification de DoS par quelqu'un qui connaît un préfixe (affiché masqué dans l'UI d'admin, donc non secret pour les administrateurs) ; le secret (≈144 bits) n'est pas attaquable par force brute. CVSS **3,7**.
- **FIX** : `rateLimit('apikey-fail:'+ip)` (ex. 30/15 min) **avant** `verifyApiKey` dans un helper commun aux trois surfaces ; faire un `verifyApiKey` factice sur un hash constant quand la clé n'existe pas pour égaliser le temps.

## N05 — Suppression de compte en libre-service

- **Fichier** : `src/app/api/account/delete/route.ts:10-56`.
- **Constat** : (a) pas de ré-authentification (mot de passe/OTP) pour une action irréversible → une session volée ou laissée ouverte suffit ; (b) pas de `rateLimit` ; (c) `auditLog('ACCOUNT_SELF_DELETED')` est écrit **avant** la transaction : si elle échoue, le journal affirme une suppression qui n'a pas eu lieu (résidu O02 du contre-audit). Borné par `canSelfDeleteAccount` (instance de démo + option activée) et par la suppression des seules organisations non partagées.
- **FIX** : exiger le mot de passe courant dans le corps, ajouter le rate-limit, écrire l'audit après le commit (ou dans la transaction).

## N06 — Upload de documents : type MIME non vérifié

- **Fichiers** : `src/app/api/documents/route.ts:57-101`, `src/app/api/audit/missions/[id]/rapports/route.ts:48-69`, `src/app/api/controles/campagnes/[id]/rapports/route.ts:44-65`, `src/lib/document.ts:mimeAutorise`.
- **Constat** : l'allowlist s'applique à `file.type`, valeur envoyée par le client ; aucune vérification de signature (magic bytes) ni d'extension cohérente. Atténué : liste de MIME sans HTML/SVG/JS, téléchargement en `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`, chemin de stockage généré côté serveur (`resolveSafe` anti-traversal), accès authentifié org-scopé. Risque résiduel : dépôt d'un exécutable renommé `.pdf` ouvert ensuite par un collègue.
- **FIX** : contrôle de signature (`%PDF-`, `PK\x03\x04` pour OOXML/ODF, `\x89PNG`, `\xFF\xD8`) cohérent avec le MIME annoncé ; envisager un antivirus (ClamAV) côté stockage.

## N07 — Annotation inline périmée

`src/app/api/auth/register/route.ts:17-27` porte toujours `AUDIT [F004] MEDIUM … inscription anonyme ouverte` et propose de « supprimer ce endpoint ». Le code actuel ferme le 1er compte SUPER_ADMIN (`resolveSignupDecision`, l.77-80) et n'ouvre l'inscription que sur instance de démo prouvée. **À supprimer ou reformuler** pour ne pas induire un futur relecteur en erreur. Reste connu et accepté : le `409 « Un compte existe déjà »` révèle l'existence d'un e-mail quand l'inscription est ouverte (F06/F07 résiduels).

## N08 — Chaîne d'approvisionnement

- `.github/workflows/*.yml` : `actions/checkout@v4`, `docker/build-push-action@v6`, `anchore/sbom-action@v0`, etc. sont référencées par **tag mobile**. Épingler par SHA de commit (aucun `.github/dependabot.yml` n'existe : en ajouter un pour npm, Docker et github-actions).
- `package.json` `overrides.brace-expansion: ^5.0.9` : `npm audit` classe 4.0.0–5.0.11 en **high** (DoS par expansion, GHSA-q2hr-2g5m-vwhr, GHSA-qhr7-859c-m2p7, GHSA-6j4f-fj2g-mc7p). Chaîne : `eslint`/`typescript-eslint` (dev) et `exceljs → archiver → readdir-glob → minimatch` (prod, mais glob non alimenté par l'utilisateur). Relever l'override vers la version corrigée (`npm audit fix`).
- `Dockerfile` : image `node:24-alpine` non épinglée par digest ; `npm ci` sans `--ignore-scripts`. Bonnes pratiques déjà en place : utilisateur non-root (`nextjs`), `HEALTHCHECK`, sortie `standalone`, SBOM (`docs/sbom.md`).

---

## Couverture et méthode

| Catégorie | Contrôle effectué | Résultat |
|---|---|---|
| A01 contrôle d'accès | Heuristique de garde d'auth sur les ~213 `route.ts` ; revue manuelle des 18 routes sans garde apparente (`tests-resilience`, `maturite` : garde via `*Context()` ; `auth/*`, `health`, `openapi.json`, `scim/ServiceProviderConfig` : publiques voulues ; `ai-suggest` : tombstone) | OK — aucune route métier sans garde |
| A02 crypto | `createHash md5/sha1`, `ECB`, `createCipher`, `Math.random` | OK (AES-256-GCM, bcrypt 12, scrypt ; `Math.random` limité à des ids d'UI, `mcp-${Date.now()}-${Math.random()}` = clé d'idempotence non secrète) |
| A03 injection | `$queryRaw`, `exec/spawn/eval/new Function`, `dangerouslySetInnerHTML` | OK — 2 `$queryRaw` paramétrés ; `innerHTML` uniquement sur constantes (thème sous nonce, JSON-LD statique) |
| A05 configuration | `next.config.js`, `csp.ts`, `middleware.ts`, `Caddyfile`, `docker-compose*.yml` | OK — CSP nonce + strict-dynamic, HSTS, XFO DENY, nosniff ; Postgres non publié ; app sur 127.0.0.1 en production |
| A06 composants | `npm audit --package-lock-only` | 2 advisories (N01, N08) |
| A07 auth | cookie `sameSite: lax`, JWT 8 h, `sessionVersion`, rate-limit email + IP, cron `timingSafeEqual` fail-closed | OK hors N04 |
| A08 intégrité | CI/CD, SAML | N08 ; SAML **inerte** (503 tant que `@node-saml` n'est pas câblé) — à réauditer avant activation |
| A10 SSRF | toutes les sorties réseau serveur (`fetch`, nodemailer, ldapts) | N02, N03 |
| Fichiers/DoS | `xlsx-guard.ts` (annuaire zip, plafonds, zip64), limite 25 Mo documents, 14 Mo base64 import | OK |
| Export tableur | `spreadsheet-safe.ts` / `sanitizeForSpreadsheet` | OK sur les 11 exports CSV |

**Limites** : analyse statique uniquement (pas de DAST, `node_modules` non installé, donc ni `tsc` ni suite de tests exécutés) ; la passe sémantique a été faite directement sur les fichiers lus (l'appel API `claude-fable-5` du protocole n'a pas été exécuté faute de clé dans le conteneur) ; ~25 fichiers lus en profondeur. Non relus cette fois : RBAC ligne à ligne des routes déjà couvertes par les audits du 20-21/09, outils MCP (`lib/mcp/tools*`), serveur SCIM, rendu PDF/DOCX, parseurs d'import en détail.

## Priorités de remédiation

| Ordre | ID | Effort | Livrable |
|---|---|---|---|
| 1 | N01 | 0,5 j | `next ^16.3.8` + `npm audit` propre + CI verte |
| 2 | N02 + N03 | 1-2 j | Helper `assertPublicHttpUrl` unique (parse CIDR, résolution DNS, épinglage), branché sur entity-sync, webhooks, SSO, SAML, + tests du tableau ci-dessus |
| 3 | N04 | 0,5 j | Rate-limit des échecs avant scrypt (API v1, MCP, SCIM) |
| 4 | N05, N06 | 0,5 j | Ré-auth + rate-limit sur la suppression ; contrôle de signature à l'upload |
| 5 | N07, N08 | 0,5 j | Nettoyage d'annotation, SHA d'actions, override `brace-expansion` |
