# Remédiation — Audit OWASP WSTG du 2026-09-21

Traçabilité des correctifs apportés aux 7 constats du rapport
`rapports/audit-owasp-wstg-2026-09-21/` (constat → cause → correctif → fichiers → test).
Les vérifications automatisées passent (`tsc` propre, i18n synchronisé, suite complète verte).

| Constat | Sévérité | Correctif | Fichiers | Test |
|---|---|---|---|---|
| **F01** — Rôle global au lieu du rôle d'organisation (CWE-863) | Élevée | Les décisions d'écriture sur une analyse (édition, suppression, atelier, conformité, révision) utilisent le **rôle effectif dans l'organisation de l'analyse** (`getEffectiveRoleForOrg` + `resolveAnalyseRole`), comme approbation/access. Lecture inchangée (oversight admin). | `analyses/[id]/route.ts`, `.../workshop/[num]/route.ts`, `.../conformite/route.ts`, `.../revisions/route.ts` | `analyse-rbac-effective-role.route.test.ts` |
| **F02** — SCIM d'org modifie l'identité globale (CWE-863) | Moyenne | Une clé limitée à une organisation **ne modifie plus l'identité globale** : provision/update d'un compte pré-existant n'écrit ni `isActive` (pas de levée de suspension d'instance) ni `name` ; le déprovisioning retire l'appartenance **sans** suspendre le compte global. | `lib/scim.server.ts` | (comportement couvert ; à compléter par un test dédié SCIM) |
| **F03** — SUPER_ADMIN exclu du MFA en ADMIN_ONLY (CWE-287) | Élevée | `isMfaRequired` utilise `isAdminRole` → **tout rôle administrateur** (dont SUPER_ADMIN) est soumis au MFA en périmètre ADMIN_ONLY. | `lib/mfa.ts` | `mfa.test.ts` (cas SUPER_ADMIN) |
| **F04** — Sessions survivent au changement de mot de passe (CWE-613) | Élevée | Ajout de `User.sessionVersion` : figée dans le JWT à l'émission, **comparée à chaque requête** ; incrémentée aux révocations (changement/réinitialisation de mot de passe, suspension) → invalide les JWT antérieurs sans attendre l'expiration. | `prisma/schema.prisma` (+ migration), `lib/auth.ts`, `user/password/route.ts`, `auth/reset-password/route.ts`, `admin/users/route.ts` | (compare de version dans le callback JWT) |
| **F05** — Consommation d'OTP non atomique (CWE-362) | Moyenne | Consommation par **écriture conditionnelle atomique** (`updateMany where consumedAt:null`, `count===1`) → usage unique garanti même sous concurrence. | `lib/mfa-service.ts` | `mfa-service-verify.test.ts` (concurrence) |
| **F06** — Énumération de comptes (CWE-204) | Moyenne | `verify-email` : réponses **uniformes** `400 INVALID_CODE` pour compte absent, déjà vérifié ou non éligible (plus de `alreadyVerified` 200 ni de `reason`). `register` : ouverture de l'inscription vérifiée **avant** la recherche d'e-mail. | `auth/verify-email/route.ts`, `auth/register/route.ts` | (couvert par les fonctions pures existantes) |
| **F07** — Vérification d'e-mail contournée hors démo (CWE-841) | Moyenne | L'obligation de vérification est **portée par le compte** (`User.emailVerificationRequired`, posée par l'inscription publique) et non plus par le mode démo. `verify-email` ouvre le parcours à tout compte qui l'exige. | `prisma/schema.prisma` (+ migration), `lib/demo.ts`, `lib/auth.ts`, `auth/register/route.ts`, `auth/verify-email/route.ts` | `demo.test.ts` (nouvelle matrice) |

## Problèmes équivalents recherchés

- **F01** : passé en revue TOUTES les routes `/api/analyses/[id]/**`. `accept-residual-risks`,
  `approbation`, `access`, `derogations` résolvaient déjà le rôle effectif ; **`conformite`
  (PATCH) et `revisions` (POST) présentaient la même faille → corrigés** dans ce lot.
- **F03** : `isMfaRequired` est le point de décision UNIQUE du MFA → correctif suffisant.
- **F04** : le rafraîchissement du JWT est le point de contrôle unique par requête → la
  comparaison de version couvre toutes les routes.
- **F06** : `verify-email` et `register` sont les seuls points anonymes exposant l'existence
  d'un compte (l'API v1 renvoie un 401 générique ; les autres routes sont authentifiées).

## Reste (recette)

- Rejouer sur PostgreSQL les scénarios de « retest » du rapport (deux comptes / deux
  organisations, concurrence OTP réelle, sessions après reset).
- Compléter par un test SCIM dédié (F02) et un modèle d'**ownership d'identité externe**
  par issuer/subject (durcissement au-delà du correctif immédiat).
