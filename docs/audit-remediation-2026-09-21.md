# Remédiation — Audit OWASP WSTG du 2026-09-21

Traçabilité des correctifs apportés aux 7 constats du rapport
`rapports/audit-owasp-wstg-2026-09-21/` (constat → cause → correctif → fichiers → test).
Les vérifications automatisées passent (`tsc` propre, i18n synchronisé, suite complète verte).

| Constat | Sévérité | Correctif | Fichiers | Test |
|---|---|---|---|---|
| **F01** — Rôle global au lieu du rôle d'organisation (CWE-863) | Élevée | Les décisions de **lecture ET d'écriture** sur une analyse (détail, édition, suppression, atelier, conformité, révision) utilisent le **rôle effectif dans l'organisation de l'analyse** (`getEffectiveRoleForOrg` + `resolveAnalyseRole`), comme approbation/access. *(La lecture `GET` — `canViewAnalyse` — a été alignée sur le rôle effectif suite au contre-audit, cf. §Contre-audit.)* | `analyses/[id]/route.ts`, `.../workshop/[num]/route.ts`, `.../conformite/route.ts`, `.../revisions/route.ts` | `analyse-rbac-effective-role.route.test.ts` |
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

## Contre-audit (2026-09-21) — résidus traités

Le contre-audit (`rapports/contre-audit-owasp-wstg-2026-09-21/`) a confirmé les
correctifs et relevé des **résidus** dans le code déjà livré. Trois d'entre eux,
clairement corrigibles et testables, sont **clos** ici :

| Réf | Résidu | Correctif | Fichiers | Tests |
|---|---|---|---|---|
| **O01** | `loadLoginPolicy` : sur **erreur de lecture** de la politique, repli **permissif** → connexion sans OTP possible. | Décision extraite en résolveur **pur** `resolveLoginPolicy` : politique **absente** → neutre ; **erreur de lecture** → **fail-closed** (MFA imposée, scope ALL). | `lib/login-policy.ts` (nouveau), `lib/auth.ts` | `login-policy.test.ts` |
| **F04 (résidu)** | `admin/users action=reset-password` n'incrémentait **pas** `sessionVersion` ni ne révoquait les appareils de confiance. | Réinitialisation admin passée en **transaction** : `sessionVersion { increment: 1 }` + `trustedDevice.deleteMany` (aligné sur `user/password`). | `admin/users/route.ts` | `admin-users-reset-password.route.test.ts` |
| **F01 (résidu)** | `GET /api/analyses/[id]` : `canViewAnalyse` utilisait encore le **rôle global** (un rôle de gouvernance global ouvrait la lecture d'une org où le rôle effectif est inférieur). | Lecture alignée sur le **rôle effectif** (comme PATCH/DELETE). | `analyses/[id]/route.ts` | `analyse-rbac-effective-role.route.test.ts` (cas GET) |

**Résidus restants** (documentés, non clos ici) : F06/F07 (énumération sur inscription
ouverte ; rattrapage des anciens comptes non vérifiés — arbitrage UX / migration de
données), O02 (suppression de compte hors transaction), O03 (SSRF webhooks : DNS non
épinglé, IPv6), O04/O05 (upload, appareils de confiance). Voir le contre-rapport.

## Reste (recette)

- Rejouer sur PostgreSQL les scénarios de « retest » du rapport (deux comptes / deux
  organisations, concurrence OTP réelle, sessions après reset).
- Compléter par un test SCIM dédié (F02) et un modèle d'**ownership d'identité externe**
  par issuer/subject (durcissement au-delà du correctif immédiat).
