# Chantiers ACRA — suivi de développement

Dernière mise à jour : 21 septembre 2026. Ce document sert de backlog de travail et de support de priorisation. Les éléments « en cours » ne sont pas réputés disponibles avant tests complets, revue et publication d’une release stable.

## Sécurité et gouvernance — implémenté, recette runtime en attente

Les trois chantiers ci-dessous sont implémentés et **validés par les tests automatisés** (logique pure, composants, suite complète verte, `tsc` propre). Il reste la **recette runtime** (parcours à deux comptes démo sur base réelle) — non exécutée ici car Docker n’était pas démarré.

| Chantier | État | Vérifications faites | Reste à faire |
|---|---|---|---|
| Dashboard des dérogations | Implémenté, tests auto OK | Compteurs actif / échéance proche / expiré / en revue (`buildDerogationDashboard`), états terminaux non comptés « en revue », page scopée `visibleOrgIds` (isolation multi-org), tests logique + composant. | Recette visuelle responsive sur données réelles. |
| Suppression autonome de compte démo | Implémenté, tests auto OK | Toggle `selfServiceAccountDeletion` `@default(false)` ; garde démo-only + authentifié (`canSelfDeleteAccount`) ; suppression **transactionnelle** du compte et de ses seules organisations démo non partagées (`deletableOrganizationIds`) ; audit `ACCOUNT_SELF_DELETED` ; tests logique + composant. | Recette sur vraie base : suppression réelle + vérification de l’isolation. |
| Appareil de confiance après OTP e-mail | Implémenté, tests auto OK | Toggle `trustedDeviceEnabled` `@default(false)` ; garde MFA + OTP e-mail + OTP récent (`canIssueTrustedDevice`) ; jeton opaque haché, cookie **HttpOnly**, expiration 1–90 j ; invalidation au changement/réinitialisation de mot de passe ; audit `TRUSTED_DEVICE_CREATED` ; tests. | Interface de révocation par utilisateur ; recette multi-navigateurs (appareil approuvé → nouvel appareil redemande l’OTP). |

## À faire avant la prochaine publication

- Démarrer Docker Desktop, appliquer les deux migrations (`password_reset`/`self-service`, `trusted_devices`) et exécuter une recette intégrée locale.
- Jouer un parcours à deux comptes démo : isolation organisationnelle, suppression réelle d’un compte, appareil approuvé puis nouvel appareil, expiration et réinitialisation de mot de passe.
- Pousser le commit, vérifier la CI GitHub, créer une release stable puis déployer seulement après recette et validation explicite.

## Préparation de la démo et CLUSIR

- Stabiliser les parcours EBIOS RM cyber et conformité retenus pour la démo.
- Conserver les modules GRC avancés hors du parcours de démonstration, sauf conformité, référentiels/PSSI, documents, dérogations et plans d’action.
- Maintenir l’isolation stricte : chaque inscrit démo ne voit et ne modifie que son organisation.
- Préserver une chaîne de release immuable, recette publique et retour arrière.
- Finaliser la documentation opératoire de mise à jour GitHub → release stable → VPS.

## Sécurité et conformité à planifier

| Priorité | Sujet | Attendu |
|---|---|---|
| Haute | SBOM | **Fait.** `release.yml` produit à chaque release : SBOM **CycloneDX** de l'image (`sbom.cdx.json`, via Syft, npm + couches OS), attestations **SBOM SPDX + provenance SLSA** attachées à l'image (buildkit), archivage en asset de release avec **SHA256** dans `release.json`, et **signature cosign souveraine** (sans journal public, si `COSIGN_PRIVATE_KEY` configurée). Documentation consommation/vérification/ANSSI : `docs/sbom.md` (+ lien runbook). **Reste (ops)** : provisionner la clé cosign ; valider le workflow sur une release rc réelle. |
| Haute | Cyber Resilience Act (CRA) | **Analyse livrée** (`docs/cra-applicabilite.md`) : arbre d'applicabilité par modèle de mise sur le marché (auto-hébergé commercial → fabricant / OSS non commercial → exemption / SaaS → NIS2), catégorisation produit (« par défaut » présumée, hors annexes III/IV → auto-évaluation module A), correspondance des **exigences essentielles** (Annexe I) aux contrôles en place, **traitement des vulnérabilités** (SBOM, CVD, signalement) et plan de conformité jalonné. Livré aussi : **`public/.well-known/security.txt`** (RFC 9116) adossé à `SECURITY.md`. **Écarts prioritaires** : trancher le modèle économique (décision + juridique), **procédure de signalement** ENISA/CSIRT (~sept. 2026), dossier technique (Annexe VII) + SLA de correction/EOL. Libellés d'articles à confirmer sur EUR-Lex. |
| Haute | Tests IDOR continus | **En cours.** Couvert : (1) famille `/api/organizations/[orgId]/**` — GET via `getAnalyseScope` (`org-resource-scope.route.test.ts`) + toutes mutations/GET via `getEffectiveRoleForOrg` (`org-resource-scope-mutations.route.test.ts`, 16 handlers) → 403 pour une org étrangère ; (2) ressources scopées par **analyse** `/api/analyses/[id]/**` — root, workshop, revisions, dérogations, conformité, access via `analyseAccessWhere` (`analyse-resource-scope.route.test.ts`, 12 handlers) → 404 (analyse invisible) pour une analyse d’une autre org. Tous refusés **avant accès DB** ; aucun trou détecté. (3) API publique v1 : **aucune surface IDOR** — `organizationId` provient exclusivement de la clé d’API (`auth.organizationId`), jamais d’un paramètre client ; requêtes/écritures scopées `{ organizationId: auth.organizationId }`. Isolation structurelle vérifiée. **Chantier couvert** ; à maintenir (ajouter un test à chaque nouvelle ressource org/analyse). |
| Moyenne | Rate limiting distribué | **Fait (câblage à activer en multi-instance).** `lib/rate-limit` expose une abstraction `RateLimitStore` **asynchrone** transmettant la limite (corrige l'ancien cast synchrone qui rendait tout store externe inopérant), un point d'injection unique `configureRateLimitStore(store)`, et un store mémoire par défaut. Store partagé fourni : `RedisRateLimitStore` (`lib/rate-limit-redis.ts`, INCR+PEXPIRE, client Redis injecté — **zéro dépendance ajoutée**), testé avec un faux client. Les 23 call sites passent en `await rateLimit(...)`. **Reste (ops)** : au passage multi-instance, câbler au démarrage `configureRateLimitStore(new RedisRateLimitStore(client))` et provisionner Redis. |
| Moyenne | SIEM | **Fait.** Allowlist réseau des destinations SIEM (défense SSRF) : env `SIEM_ALLOWED_HOSTS` (hôtes exacts + CIDR IPv4) appliquée au point de livraison unique (`deliverSiemEvent`) — endpoint hors allowlist ⇒ `destination_not_allowed`. Vide ⇒ non restreint (rétrocompatible). Fonctions pures testées (`parseSiemAllowlist`, `isSiemDestinationAllowed`). Runbook formalisé (`runbook-exploitation.md` § SIEM : réglage, vérification, risque DNS-rebinding → préférer CIDR + egress réseau). |
| Moyenne | IA gouvernée / MCP | **En cours — phases 1-3 livrées.** Interrupteurs d'instance **API v1 et MCP** (SUPER_ADMIN, **OFF par défaut**) + gate `isApiEnabled`/`isMcpEnabled` (fail-closed) + UI `/admin/instance`. **Cadrage validé** (`docs/mcp-cadrage.md`). **Phase 1 (§10.1, socle)** : scope d'API **`mcp`** (moindre privilège ; UI + i18n) ; **endpoint `/api/mcp`** (JSON-RPC 2.0, sans dépendance ajoutée) gardé `mcpEnabled` + clé + scope `mcp` + **org-scope strict** ; **rate limit** `mcp:<keyId>` ; **audit `MCP_TOOL_INVOKED`** (+ SIEM) ; outil `read_referentiels`. Cœur protocole **pur** (`lib/mcp/protocol.ts`). **Phase 2 (§10.2, contexte)** : `read_taxonomie` (vocabulaire méthode), `read_sector_examples` (catalogue sectoriel livré), `read_risk_posture` (synthèse **org-scopée**, lecture seule) — `lib/mcp/tools-context.server.ts`. **Phase 3 (§10.3, écritures validées)** : modèle **`McpProposal`** (+ migration) ; outil **`propose_risk`** (dépose une proposition, **jamais** de mutation directe) ; **file de validation UI** `/mcp-propositions` + API `mcp-proposals` (accept/reject sous **RBAC de l'analyse cible**, rôle effectif F01) ; audit `MCP_PROPOSAL_REVIEWED` ; **point d'entrée de navigation** vers `/mcp-propositions` (menu utilisateur, rôles éditeurs). **Reste** (phases 4-5) : autres `propose_*` (`propose_measure`, `propose_plan_action`, `propose_conformite_treatment`), `recommend_risks_scenarios`, intake assisté + tests IDOR MCP étendus. |

## Principes non négociables

- Toute évolution suit TDD, i18n dans les cinq langues, RBAC et isolation multi-organisation.
- Aucun déploiement démo sans CI verte, release stable et recette publique.
- Les données d’analyse ne sont jamais transmises à une IA externe par défaut.
