# SSO d'entreprise — OIDC (câblage)

Complète l'échafaudage d'instance existant (`SSOConfig` singleton, page
`/admin/security`, secret chiffré au repos) en **branchant le flux NextAuth**.
Le SSO passe de « coming soon » à **fonctionnel** pour OIDC. (SAML : à câbler
ultérieurement — l'UI et le stockage existent déjà.)

## Modèle & config

`SSOConfig` (id `'global'`, réglé par le **SUPER_ADMIN** dans `/admin/security`) :
`enabled`, `protocol`, `oidcIssuerUrl`, `oidcClientId`, `oidcClientSecret`
(**chiffré** AES-256-GCM, `lib/secret-crypto.ts`), `oidcScopes`, `autoProvision`,
`defaultRole`, `allowedDomains` (liste séparée par virgule ; **vide = tous
domaines**). API `GET/PUT /api/admin/sso-config` (déjà en place).

## Câblage NextAuth (ce lot)

- **Provider dynamique** : `src/app/api/auth/[...nextauth]/route.ts` est désormais
  un handler qui, **par requête**, ajoute le provider OIDC **uniquement si**
  `loadSsoOidcConfig()` renvoie une config active. SSO désactivé (défaut) ⇒
  providers inchangés ⇒ **comportement identique** au login Credentials.
  `authOptions` (base) reste la source de vérité pour `getServerSession` partout.
- **Provider** (`buildSsoProvider`, `lib/sso.server.ts`) : `type: 'oauth'` +
  `wellKnown: {issuer}/.well-known/openid-configuration`, `idToken: true`,
  `checks: ['pkce','state']`, `allowDangerousEmailAccountLinking: true` (lien par
  e-mail borné par l'allowlist + `email_verified`). `profile()` persiste le rôle
  par défaut dès la création.
- **Gate d'admission** (`callbacks.signIn` → `ssoSignInDecision`) : n'affecte QUE
  le provider `sso`. Applique allowlist de domaines, `email_verified`, et la règle
  d'auto-provisioning (lier / créer / refuser). Refus ⇒ `false` (motif audité).
- **Provisioning JIT** (`events.createUser` → `finalizeSsoProvisionedUser`) : force
  `defaultRole` + `emailVerified` pour le compte créé par SSO. No-op si SSO off.
- **Garde SSRF** : `isSafeIssuerUrl` (issuer https public, pas d'IP privée/loopback)
  vérifiée au chargement de la config.
- **UI** : bouton « Se connecter via SSO » sur `/auth/signin`, affiché seulement si
  `GET /api/auth/sso-enabled` = true. Refus SSO ⇒ redirection `?error=` ⇒ message.

## RBAC piloté par l'IdP (groupes → rôles)

Un AD / SailPoint / Okta peut **gouverner les droits** : les groupes de
l'utilisateur voyagent dans le jeton et sont mappés à un rôle ACRA **à chaque
connexion**.

- Config (`SSOConfig`) : `oidcGroupsClaim` (nom du claim portant les groupes,
  défaut `groups`) + `roleMapping` (JSON `{ "<groupe idp>": "<rôle acra>" }`,
  édité dans `/admin/security` en texte `groupe=RÔLE`, une paire par ligne).
- Cœur pur (`lib/sso.ts`) : `cleanRoleMapping` (ne garde que les rôles
  assignables — **SUPER_ADMIN exclu**), `resolveSsoRole` (plus haut privilège si
  plusieurs groupes ; `defaultRole` si mapping configuré mais aucun match ;
  **null** si aucun mapping = pas de gouvernance par groupes → on ne touche pas au
  rôle existant).
- Application (`lib/sso.server.ts` `syncSsoRoleFromClaims`, appelé dans le
  callback `jwt` pour le provider `sso`) : met à jour `user.role` à chaque
  connexion SSO. No-op si aucun mapping → login classique et rôles gérés en
  interne inchangés. Scopes : penser à demander le scope `groups` côté IdP si
  nécessaire.

## Cœur pur testé (`lib/sso.ts`)

`isSafeIssuerUrl`, `emailDomain`, `parseAllowedDomains`, `emailDomainAllowed`
(liste vide = tout), `resolveJitProvisioning`. Server (`lib/sso.server.ts`) :
`loadSsoOidcConfig` (gating enabled/protocole/complétude/SSRF), `ssoSignInDecision`,
`finalizeSsoProvisionedUser` — testés avec Prisma mocké.

## Vérification

- Suite : cœur pur + serveur (mock). Tsc clean.
- Live : SSO **désactivé** ⇒ `/api/auth/providers` = `['credentials']`, login
  classique intact (bad creds → 401 `CredentialsSignin`). SSO **activé** (issuer
  Google de test) ⇒ providers = `['credentials','sso']`, l'initiation
  `POST /api/auth/signin/sso` redirige vers l'**authorize** de l'IdP
  (`client_id`, `scope`, PKCE, `state`) — flux OAuth correctement formé.

## Reste à valider avec un IdP réel

Round-trip complet (callback → JIT create/link → session) : nécessite un client
OIDC enregistré chez un IdP (Azure AD / Okta / Google Workspace) et
`NEXTAUTH_URL` = origine publique. En prod, préférer un secret via variable
d'environnement au secret en base (déjà chiffré). Redirect URI à enregistrer chez
l'IdP : `{origin}/api/auth/callback/sso`.
