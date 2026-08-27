# SCIM 2.0 — Provisioning / déprovisioning

Permet à un IdP / IGA (SailPoint, Azure AD, Okta) de **créer, mettre à jour et
désactiver** les comptes ACRA automatiquement (cycle de vie complet, hors login).
Complète le SSO OIDC + le mapping de rôles : le SSO authentifie et synchronise le
rôle à la connexion ; SCIM gère l'existence des comptes (arrivées/départs).

## Portée & auth

**Per-organisation** (comme les clés d'API et webhooks). L'IdP s'authentifie avec
une **clé d'API à scope `provision`** (`Authorization: Bearer acra_<prefix>_<secret>`,
créée dans `/configuration` → Clés d'API, case « provisioning SCIM »). Les comptes
sont provisionnés **dans l'organisation de la clé**, via `OrgMembership`. Le compte
`User` (e-mail unique) est partagé entre organisations.

`/api/scim/` est exempté de l'auth par session (middleware) ; chaque route
authentifie la clé et exige le scope `provision`.

## Endpoints (`/api/scim/v2`)

| Méthode | Chemin | Effet |
|---|---|---|
| GET | `/ServiceProviderConfig` | Capacités annoncées (patch, filter, bearer). |
| GET | `/Users?filter=userName eq "x"` | Recherche par e-mail dans l'org (0/1). |
| POST | `/Users` | **Provisionne** : crée le compte si besoin + appartenance (rôle `LECTEUR`), réactive. `409` si déjà membre. |
| GET | `/Users/{id}` | Lit le compte (s'il est membre de l'org). |
| PUT | `/Users/{id}` | Remplacement (nom, `active`). |
| PATCH | `/Users/{id}` | Ops SCIM — surtout `replace active=false` (**déprovisioning** Azure AD). |
| DELETE | `/Users/{id}` | **Déprovisionne** (retire l'appartenance à l'org). |

Réponses au format `application/scim+json` (enveloppes ListResponse / Error).

## Sémantique du déprovisioning

`active=false` (PATCH/PUT) ou `DELETE` → **retire l'appartenance à CETTE org**
(révoque l'accès). Si c'était la **dernière** appartenance du compte, `User.isActive`
passe à `false` (blocage global du login). Un `GET /Users/{id}` renvoie alors `404`
(l'IdP voit le compte retiré de l'org).

## Cœur pur testé (`lib/scim.ts`)

`scimUserToAcra` (userName/emails → e-mail, name, active), `acraUserToScim`,
`parseScimUserNameFilter` (`userName eq`), `applyScimPatch` (replace active/nom,
value objet), enveloppes `scimListResponse` / `scimError`. La couche serveur
(`lib/scim.server.ts`) porte la persistance per-org (create User + OrgMembership,
retrait d'appartenance, désactivation si dernière).

## Vérification

- Suite : 12 tests purs. `tsc` clean.
- **Live** (org StarBank, clé scope provision) : no-auth → 401 ; ServiceProviderConfig
  → 200 ; POST provision → 201 (User + membership) ; filtre `userName eq` → 1 ;
  POST en double → 409 ; PATCH `active=false` → `active:false`, appartenance retirée,
  `User.isActive=false` (dernière appartenance) ; GET après déprovisioning → 404.

## Limites / évolutions

v1 : ressource **Users** uniquement, rôle provisionné = `LECTEUR` (le rôle fin est
géré à la connexion via le mapping de groupes OIDC). Évolutions possibles : ressource
**Groups**, mapping SCIM `roles`/groupes → rôle ACRA, pagination des listes.
