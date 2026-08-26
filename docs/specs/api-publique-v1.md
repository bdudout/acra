# Spec — API publique v1 (accès machine)

Première brique de la priorité P1 (ouvrir le système à l'interopérabilité).

## Authentification
- Clé d'API au format `acra_<prefix>_<secret>`, présentée en `Authorization: Bearer …`.
- Seul le **hash SHA-256** du jeton complet est stocké ; le **préfixe** (public,
  indexé) sert au lookup. Le secret n'est montré **qu'une fois**, à la création.
- Portée par **organisation** ; **scopes** `read` / `write` ; expiration et
  révocation. Vérification à temps constant (`timingSafeEqual`).
- Point unique : `authenticateApiRequest(req, scope)` (`lib/api-auth.server.ts`).
- Les routes `/api/v1/*` sont **exemptées du middleware de session** (comme les
  crons) : `isPublicPath` les laisse passer, l'auth se fait par clé dans le handler.

## Endpoints (lecture, v1)
- `GET /api/v1/risks` — registre de risques (niveaux inhérent/résiduel).
- `GET /api/v1/controls` — bibliothèque de contrôles (échéance, efficacité).
- `GET /api/v1/incidents` — incidents & pertes (LDC, perte nette calculée).
- `GET /api/v1/openapi.json` — spécification OpenAPI 3.0 (publique).
Réponse : `{ data: [...], count }`. Erreurs : 401 (clé absente/invalide/révoquée/
expirée), 403 (scope insuffisant).

## Gestion des clés (ADMIN, organisation active)
- `GET/POST /api/config/api-keys` — lister (masquées) / créer (secret rendu une fois).
- `DELETE /api/config/api-keys/[id]` — révoquer.
- UI : section « Clés d'API » dans `/configuration` (composant `ApiKeysManager`).

## Modèle
`ApiKey { organizationId, name, prefix @unique, hashedKey, scopes, createdBy,
lastUsedAt, expiresAt, revokedAt }` — migration `20260826120000_api_key`.

## Vérifié (runtime)
Clé valide → 200 (risks/controls/incidents) ; absente/mauvais secret/révoquée →
401 ; scope OK ; OpenAPI 200 ; création → secret une fois puis masqué (jamais
re-divulgué) ; `lastUsedAt` renseigné ; révocation effective.

## Suite P1 (prochaines PR)
Endpoints d'écriture (scope write) + **import en masse** ; **webhooks** sortants ;
**SSO** OIDC/SAML + SCIM ; pagination & filtres ; quotas / rate-limit par clé.
