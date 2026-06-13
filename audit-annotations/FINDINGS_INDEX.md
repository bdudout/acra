# ACRA — Index des findings de sécurité (audit code source)

> Audit statique OWASP Top 10 2021 / CWE Top 25 / patterns SAST.
> Date : 2026-06-10. Périmètre : `ebios-rm/src` (~27,7k LOC), Next.js 16 (App Router) + Prisma + next-auth.
> Les annotations `// AUDIT [Fxxx]` sont insérées **en place** dans les fichiers source concernés
> (commentaires uniquement, aucune logique modifiée) pour que les agents qui éditent le code
> voient le contexte de la vulnérabilité directement à la ligne concernée.

## Score de risque global : 4.6 / 10 — MOYEN
Base de code globalement bien durcie (Prisma paramétré, bcrypt cost 12, RBAC/IDOR
cohérents, CSP solide, sanitisation CSV sur l'export d'analyse). Les findings sont
surtout des **incohérences de durcissement** (un endroit sécurisé, son jumeau oublié)
et des défauts de configuration, plutôt que des failles béantes.

## Tableau de synthèse

| ID | Sévérité | CVSS | Catégorie | Fichier:ancre | Statut |
|----|----------|------|-----------|---------------|--------|
| F001 | MEDIUM | 5.5 | CWE-200/538 — Secrets dans l'artefact de build | `.next/standalone/ebios-rm/.env` (généré) | Index only |
| F002 | HIGH | 6.5 | CWE-1236 / A03 — CSV/Formula injection | `src/app/api/admin/audit-log/export/route.ts` → `escapeCsv` | ✅ **CORRIGÉ** (toCsvCell + test) |
| F003 | MEDIUM | 5.3 | CWE-290/307 / A07 — Rate-limit/lockout contournable | `src/lib/logger.ts` `getClientIp` · `src/lib/auth.ts` `emailKey` · `src/app/api/auth/register/route.ts` | Annoté |
| F004 | MEDIUM | 6.5 | CWE-862/269 / A01 — Inscription ouverte + 1er compte ADMIN | `src/app/api/auth/register/route.ts` | ⚠️ Risque accepté (décision exploitant) |
| F005 | MEDIUM | 5.5 | CWE-312 / A02 — Secrets SSO/SMS en clair (+ loggés) | `src/app/api/admin/sso-config/route.ts` · `.../password-policy/route.ts` | ✅ **CORRIGÉ** (AES-256-GCM au repos + redaction logs) |
| F006 | LOW | 4.3 | CWE-915 / A08 — Mass assignment partiel | `src/app/api/analyses/[id]/workshop/[num]/route.ts` (case 2/3/4) | ✅ **CORRIGÉ** (allowlist workshop-sanitize + tests) |
| F007 | LOW | 3.5 | LLM01 / CWE-1427 — Injection de prompt | `src/app/api/ai-suggest/route.ts` | ✅ Atténué (séparation données/instructions) |

---

## Détails

### F001 — Secrets dupliqués dans la sortie de build standalone — MEDIUM (CVSS 5.5)
**CWE-200 / CWE-538 — Exposition d'informations.**
Le fichier `.next/standalone/ebios-rm/.env` présent sur disque contient les **vrais
secrets en clair** : `NEXTAUTH_SECRET`, `DATABASE_URL` (mot de passe Postgres),
`ANTHROPIC_API_KEY`.
- **Atténuation confirmée** : `.dockerignore` exclut `.env` ET `.next` → l'image Docker
  ne contient pas ces secrets (le runtime les reçoit via `docker-compose environment`).
- **Risque résiduel** : tout déploiement **manuel** du dossier `.next/standalone`
  (rsync/scp du standalone, exécution directe de `node server.js` hors Docker) embarque
  ce `.env`. Idem pour les sauvegardes/partages du working tree.
- **FIX** : ne jamais laisser de `.env` réel dans `.next/standalone` ; nettoyer la sortie
  de build (`find .next/standalone -name .env -delete` en post-build), injecter les
  secrets uniquement à l'exécution. **Faire tourner ces 3 secrets** s'ils ont pu fuiter.
- *Non annoté inline : fichier généré (serait écrasé au prochain build). Cause traitée en ops.*

### F002 — CSV / Formula injection dans l'export du journal d'audit — HIGH (CVSS 6.5)
**CWE-1236 / OWASP A03:2021.**
`escapeCsv()` n'échappe que `, " \n` mais ne neutralise pas les déclencheurs de formule
(`= + - @ TAB CR`). Les colonnes `userEmail` / `details` proviennent d'entrées
attaquant (ex. inscription avec email `=cmd|'/C calc'!A1`). Quand un **ADMIN** ouvre le
CSV exporté dans Excel/LibreOffice → exécution de formule. Incohérent avec l'export
d'analyse (`export/[id]/route.ts`) qui, lui, utilise déjà `sanitizeForSpreadsheet()`.
- **FIX** : réutiliser `sanitizeForSpreadsheet()` de `src/lib/spreadsheet-safe.ts` dans `escapeCsv`.

### F003 — Anti-brute-force / rate-limiting contournable — MEDIUM (CVSS 5.3)
**CWE-290 (spoof) + CWE-307 (brute force).** Trois angles :
1. `getClientIp` (logger.ts) fait confiance à `X-Forwarded-For`/`X-Real-IP` (falsifiables)
   → contournement des limites par IP **et** empoisonnement de l'audit trail.
2. Le rate-limit de **login** (auth.ts) est par **email uniquement** (pas d'IP) →
   credential-stuffing/spraying possible sur de nombreux emails depuis une IP.
3. Stores `rate-limit` et `login-lockout` **in-memory** → non partagés entre instances,
   réinitialisés à chaque redéploiement.
- **FIX** : IP de confiance (dernier hop / allowlist proxy), 2ᵉ clé de limit par IP au
  login, store Redis en multi-instance, CAPTCHA après N échecs.

### F004 — Inscription anonyme ouverte + amorçage ADMIN — MEDIUM (CVSS 6.5)
**CWE-862 + CWE-269 / OWASP A01:2021.**
`/api/auth/register` est public (cf. `public-paths.ts`). N'importe quel anonyme crée un
compte ANALYSTE. Pire : si la table user est vide (déploiement neuf / base reset), le
**premier inscrit devient ADMIN** (`userCount === 0`) → course à l'amorçage : un attaquant
plus rapide que l'exploitant prend le contrôle complet.
- **FIX** : provisionner l'ADMIN initial hors-ligne (seed/CLI/env), gater l'inscription
  (invitation / domaine autorisé / feature-flag) ou la retirer au profit de `/api/admin/users`.

### F005 — Secrets SSO/SMS stockés (et loggés) en clair — MEDIUM (CVSS 5.5)
**CWE-312 / OWASP A02:2021.**
`oidcClientSecret`, `samlCertificate`, `smsApiKey`, `smsApiSecret` sont persistés en clair
(`upsert({ ...parsed.data })`). De plus, `password-policy` PUT journalise
`details: { ...parsed.data }` → `smsApiKey`/`smsApiSecret` **en clair dans la table AuditLog**
(SSO redacte déjà son secret côté audit, pas password-policy).
- **FIX** : chiffrer au repos (AES-GCM + clé KMS/env) ou secret manager ; redacter les
  secrets SMS du payload d'audit (pattern `auditData` déjà présent dans sso-config).

### F006 — Mass assignment partiel dans le workshop — LOW (CVSS 4.3)
**CWE-915 / OWASP A08:2021.**
Les cas A2/A3/A4 (`workshop/[num]/route.ts`) font `const { ...UI } = s; return { ...rest }`
— seuls quelques champs UI sont retirés, le reste de l'objet client part vers Prisma.
A5 (mesures) et `import/route.ts` appliquent une allowlist explicite + bornage. Prisma
rejette les champs inconnus, donc impact limité, mais durcissement incohérent.
- **FIX** : aligner A2/A3/A4 sur le pattern allowlist `cleanXxx` (String/Number + slice).

### F007 — Injection de prompt dans les suggestions IA — LOW (CVSS 3.5)
**OWASP LLM01 / CWE-1427.**
`contexte` et `question` (utilisateur) sont interpolés directement dans le system/user
prompt envoyé à l'API. Détournement possible du modèle / gaspillage de budget. Impact
faible (réponse renvoyée au même user, taille bornée 500/300, rate-limit IA 20/h).
- **FIX** : séparer données/instructions (bloc utilisateur balisé), instruire le modèle
  d'ignorer les instructions issues du contexte, valider la sortie.

---

## Points positifs (defense-in-depth en place)
- **Aucune injection SQL** : tout passe par Prisma (requêtes paramétrées), y compris la recherche.
- **Auth** : bcrypt cost 12, session JWT 8h, rafraîchissement rôle/isActive/mustChangePassword
  à chaque requête, invalidation immédiate des comptes suspendus, cookies `httpOnly`+`sameSite=lax`+`secure` (selon schéma).
- **RBAC / IDOR** : contrôle d'accès centralisé (`permissions.ts`) appliqué de façon cohérente
  sur toutes les routes `analyses/*` (view/edit/approve/manage-access) et `admin/*` (`canAdmin`).
- **Export analyse** : sanitisation CSV/XLSX anti-formule (`spreadsheet-safe.ts`), noms de fichiers nettoyés.
- **Validation** : Zod sur register/profile/password/policy/sso ; bornage des tailles d'import (2 Mo).
- **En-têtes** : CSP solide (`object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`,
  pas de `unsafe-eval`), X-Frame-Options DENY, nosniff, HSTS en prod, API `no-store`.
- **Secrets de prod** : `.dockerignore` exclut `.env`/`.next` ; secrets non journalisés côté SSO.

## Score de maturité sécurité (SMS) : 3.0 / 4
| Axe | Score | Note |
|-----|-------|------|
| Auth | 3 | bcrypt, lockout, expiration, suspension — manque MFA effectif + anti-brute-force IP |
| Data Protection | 2 | hash fort, sanitisation export — mais secrets SSO/SMS en clair (F005) |
| Dépendances | 2 | listées/épinglées — pas de SBOM/audit automatisé visible |
| Configuration | 3 | en-têtes/CSP/dockerignore solides — F001/F004 à corriger |
| Logging | 4 | audit trail structuré (Winston + DB), redaction partielle |

## Prochaines actions prioritaires
1. **F002** (HIGH) — réutiliser `sanitizeForSpreadsheet` dans l'export audit-log (correctif trivial, fort ROI).
2. **F004** — neutraliser l'amorçage ADMIN public + décider du modèle d'inscription.
3. **F001** — purger `.env` de `.next/standalone`, rotation des 3 secrets.
4. **F005** — chiffrer/redacter les secrets SSO/SMS.
5. **F003** — IP de confiance + rate-limit IP au login + store Redis.
6. **F006/F007** — durcissement defense-in-depth (allowlist workshop, séparation prompt).
