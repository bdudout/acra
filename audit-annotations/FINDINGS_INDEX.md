# ACRA — Index des findings de sécurité (re-audit code source)

> Audit statique OWASP Top 10 2021 / CWE Top 25 2024 / patterns SAST + revue sémantique.
> **Date : 2026-07-06** (re-audit). Périmètre : `ebios-rm/src` (Next.js 16 App Router, next-auth 4, Prisma 5), 42 routes API.
> Focus : posture globale + **ajouts récents** (mention de protection, versions/révisions, radar SR/OV, opérateurs ET/OU, méthodes de vraisemblance, packs sectoriels, autorités NIS2, CSP nonce).
> Annotations `// AUDIT [Fxxx]` présentes en place dans les fichiers concernés (issues de l'audit précédent, toujours valides).

## Score de risque global : ~2.8 / 10 — 🟢 FAIBLE
Posture **nettement améliorée** depuis l'audit du 2026-06-10 (4.6/10 MOYEN). Le finding ÉLEVÉ (injection CSV) et deux MOYENS (secrets en clair, mass-assignment) ont été corrigés ; la feature IA a été retirée (endpoint tombstone). Les items résiduels sont des **incohérences de durcissement** et **choix d'exploitation**, pas des failles béantes. **Aucune injection SQL/commande, aucun secret en dur, aucune IDOR.**

## Delta depuis l'audit 2026-06-10

| Finding précédent | Statut actuel (vérifié) |
|---|---|
| F002 HIGH — CSV/Formula injection (export audit-log) | ✅ **CORRIGÉ** (`sanitizeForSpreadsheet`/toCsvCell) |
| F005 MEDIUM — Secrets SSO/SMS en clair | ✅ **CORRIGÉ** — chiffrés au repos **AES-256-GCM** (`secret-crypto.ts`, IV+tag, scrypt) |
| F006 LOW — Mass-assignment A2/A3/A4 | ✅ **CORRIGÉ** — allowlists `cleanSourceRisque/…` (`workshop-sanitize.ts`) |
| F007 LOW — Injection de prompt IA | ✅ **ÉLIMINÉ** — `ai-suggest` = tombstone (404, aucun appel LLM) |
| F003 MEDIUM — Rate-limit/lockout contournable | 🟡 **OUVERT** → R01 |
| F004 MEDIUM — Inscription ouverte + 1er compte ADMIN | 🟡 **OUVERT** (risque accepté) → R02 |
| F001 MEDIUM — Secrets dans `.next/standalone/.env` | 🟠 **OPS** (artefact de build) → R06 |

## Findings actifs

| ID | Sévérité | CVSS | Catégorie | Fichier:Ligne |
|----|----------|------|-----------|---------------|
| R01 | ✅ CORRIGÉ | 5.3→2.0 | A07 / CWE-307,290,770 | src/lib/auth.ts (clé par IP ajoutée) |
| R02 | ⚠️ RISQUE ACCEPTÉ | 6.5 | A01 / CWE-269,862 | src/app/api/auth/register/route.ts:88-98 |
| R03 | 🟢 FAIBLE | 4.3 | A04 / CWE-400 | src/app/api/analyses/[id]/workshop/[num]/route.ts · import/route.ts |
| R04 | 🟢 FAIBLE | 3.1 | A04 / CWE-20 | src/lib/workshop-sanitize.ts (json) |
| R05 | 🟢 FAIBLE | 2.0 | A02 / CWE-330 | src/components/workshops/Atelier{1..5}.tsx (uid) |
| R06 | 🟠 OPS | 5.5 | A05 / CWE-200,538 | .next/standalone/**/.env (généré) |
| R07 | ⚪ INFO | 0.0 | A03 / CWE-79 | src/app/layout.tsx:83 · src/app/page.tsx:59 |

---

### R01 — ✅ CORRIGÉ (2026-07-06) — Anti-brute-force renforcé (clé de rate-limit par IP)
**CWE-307/290/770 · A07:2021 · CVSS résiduel ~2.0**
Le login n'était limité que **par email** → credential-stuffing / password-spraying possible sur de nombreux emails depuis une même IP. **Correctif** : ajout d'une **2ᵉ clé de rate-limit par IP** (`login:ip:<ip>`, 50 tentatives / 15 min) dans `authorize()` (`auth.ts`), en plus de la clé email (10/15 min). Le store est déjà abstrait (Redis-ready) pour le multi-instance. **Vérifié en runtime** : 55 tentatives multi-emails depuis une IP fixe → blocage `TOO_MANY_ATTEMPTS` à la 51ᵉ (avant : illimité).
*Résiduel (déploiement) :* `getClientIp` dérive l'IP d'en-têtes de proxy — à n'utiliser que derrière un reverse-proxy de confiance (question d'infra, pas de code) ; store Redis à brancher en multi-instance.

### R02 — ⚠️ RISQUE ACCEPTÉ (2026-07-06) — Amorçage de privilège : 1er inscrit anonyme = SUPER_ADMIN
**CWE-269/862 · A01:2021 · CVSS 6.5 (AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:L)**
`/api/auth/register` est public ; si la table `user` est vide (déploiement neuf / reset), `role: isFirstUser ? 'SUPER_ADMIN' : 'ANALYSTE'` (`register/route.ts:98`) → **course à l'amorçage** : un attaquant plus rapide que l'exploitant prend le contrôle complet. Atténué par `rateLimit(register:${ip}, 5/h)`. *(Annoté inline F004b.)*
**Décision (2026-07-06) : RISQUE ACCEPTÉ par l'exploitant.** Le premier déploiement est réalisé en environnement maîtrisé (le premier compte est créé par l'exploitant immédiatement après l'installation) ; la fenêtre d'amorçage est donc contrôlée. Mitigation opérationnelle recommandée : créer le compte SUPER_ADMIN dès la fin de l'installation, avant toute exposition réseau.
**FIX (si non accepté) :** provisionner l'ADMIN initial hors-ligne (seed/CLI/env) ; ne jamais attribuer SUPER_ADMIN via un endpoint public ; gater l'inscription (invitation/domaine autorisé/feature-flag).

### R03 — 🟢 FAIBLE — Cardinalité des tableaux / taille des corps JSON non bornées
**CWE-400 · A04:2021 · CVSS 4.3 (AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:N/A:L)**
Les champs texte sont bornés (`slice`), mais **le nombre d'items** des tableaux (`sourcesRisque`, `scenarios*`, `actionsElementaires`, `mesures`) et la taille globale de `req.json()` ne le sont pas → consommation mémoire/CPU (`createMany`) par un utilisateur authentifié disposant du droit d'édition. **NOUVEAU (re-audit).**
**FIX :** borner la cardinalité (ex. ≤ 500/catégorie) avant `createMany` ; limite de taille de corps (handler/reverse-proxy).

### R04 — 🟢 FAIBLE — Blobs JSON stockés sans validation de schéma
**CWE-20 · A04:2021 · CVSS 3.1 (AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:L/A:N)**
`json()` (`workshop-sanitize.ts`) ne valide que le type ; les blobs `actionsElementaires`/`mesuresEcosysteme` conservent des **clés arbitraires** du client. Atténué en profondeur : normalisation à la lecture (`normalizeOperateur/Methode`, `aggregateVraisemblance` bornée) + échappement au rendu (React/PDF). Aucun sink dangereux. **NOUVEAU (re-audit).**
**FIX :** allowlist des clés dans les blobs (comme les mesures A5).

### R05 — 🟢 FAIBLE — `Math.random()` pour les IDs d'éléments d'UI
**CWE-330 · A02:2021 · CVSS 2.0** — `uid()` (Atelier1-5), `actions/page.tsx:97`. Usage **non-cryptographique** (clés React / ids d'items JSON), non exploitable. Signalé pour **cohérence** avec `crypto.randomUUID()` déjà adopté à l'import (#109).
**FIX (hygiène) :** aligner `uid()` sur `crypto.randomUUID()`.

### R06 — 🟠 OPS — Secrets dans l'artefact de build standalone
**CWE-200/538 · A05:2021 · CVSS 5.5** — `.next/standalone/**/.env` (généré) peut contenir des secrets en clair. Atténué : `.dockerignore` exclut `.env`/`.next` (image Docker saine). Risque résiduel = déploiement manuel du standalone. **Traitement en ops** (non annoté inline : fichier généré).
**FIX :** purge post-build (`find .next/standalone -name .env -delete`), injection des secrets au runtime uniquement.

### R07 — ⚪ INFO — `dangerouslySetInnerHTML` (thème + JSON-LD statiques)
`layout.tsx:83` (script de thème **sous nonce** #108, constante), `page.tsx:59` (`JSON.stringify` d'un objet JSON-LD statique). Aucune donnée utilisateur → non exploitable.

---

## Points forts (defense-in-depth)
- **A01 contrôle d'accès :** `analyseAccessWhere` (isolation multi-org + propriété + partage), gardes `canViewAnalyse/canEditAnalyse`, guard de scope org (`visibleOrgIds`). Aucune IDOR.
- **A02 crypto :** secrets chiffrés au repos en **AES-256-GCM** (scrypt + IV + tag) ; bcrypt coût 12 ; aucun secret en dur.
- **A03 injection :** Prisma paramétré ; unique `$queryRaw` = `SELECT 1` ; aucun `exec/eval/child_process`.
- **A05 config :** CSP **nonce + strict-dynamic** (prod), HSTS, `X-Frame-Options: DENY`, nosniff, Referrer-Policy ; pas de CORS permissif.
- **A06 deps :** `npm audit` = 0 CVE critique/élevée (prod), audit intégré à la CI.
- **A07 auth :** MFA, verrouillage de compte, journal d'audit ; sessions JWT courtes.
- **A08/A09 :** allowlists de sanitisation (workshop, mesures, révisions) ; journal d'audit structuré (`ANALYSE_REVISED`…).
- **Décision « no AI » respectée :** `ai-suggest` = tombstone (404).

## Score de maturité sécurité (SMS) : 3.4 / 4
| Axe | Score | Note |
|-----|-------|------|
| Auth | 4 | bcrypt 12, MFA, lockout, audit trail — reste anti-brute-force IP/multi-instance (R01) |
| Data Protection | 4 | hash fort + chiffrement AES-GCM au repos + mention de protection/classification |
| Dépendances | 3 | 0 CVE critique/élevée, npm audit CI — pas de SBOM automatisé |
| Configuration | 3 | CSP nonce/HSTS/dockerignore — R02 (amorçage) & R06 (build) |
| Logging | 3 | audit trail structuré, redaction — pas de SIEM/alerting temps réel |

## Actions prioritaires
1. **R02** — neutraliser l'amorçage SUPER_ADMIN public (seed hors-ligne) et décider du modèle d'inscription.
2. **R01** — IP de confiance + rate-limit par IP au login + store Redis (multi-instance).
3. **R03** — borner la cardinalité des tableaux avant `createMany`.
4. **R06** — purge `.env` du standalone + rotation si fuite possible.
5. **R04/R05** — durcissement defense-in-depth (allowlist blobs JSON, `crypto.randomUUID`).
