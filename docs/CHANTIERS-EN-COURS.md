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
| Haute | SBOM | Produire un SBOM CycloneDX ou SPDX à chaque release, incluant dépendances applicatives et image ; signer/archiver l’artefact ; documenter la consommation, en cohérence avec les bonnes pratiques ANSSI. |
| Haute | Cyber Resilience Act (CRA) | Réaliser une analyse d’applicabilité et un plan de conformité : catégorie produit, exigences essentielles, gestion des vulnérabilités, SBOM, mises à jour de sécurité, signalement et documentation technique. |
| Haute | Tests IDOR continus | **En cours.** Couvert : (1) famille `/api/organizations/[orgId]/**` — GET via `getAnalyseScope` (`org-resource-scope.route.test.ts`) + toutes mutations/GET via `getEffectiveRoleForOrg` (`org-resource-scope-mutations.route.test.ts`, 16 handlers) → 403 pour une org étrangère ; (2) ressources scopées par **analyse** `/api/analyses/[id]/**` — root, workshop, revisions, dérogations, conformité, access via `analyseAccessWhere` (`analyse-resource-scope.route.test.ts`, 12 handlers) → 404 (analyse invisible) pour une analyse d’une autre org. Tous refusés **avant accès DB** ; aucun trou détecté. **Reste** : API publique v1 (clé d’API scopée à une org — moindre risque IDOR, à confirmer). |
| Moyenne | Rate limiting distribué | Remplacer le store mémoire par un store partagé avant un passage multi-instance. |
| Moyenne | SIEM | Encadrer les destinations SIEM internes par une allowlist réseau et formaliser le runbook. |
| Moyenne | IA gouvernée | Ne pas activer d’IA externe par défaut ; étudier une API MCP avec identité technique, RBAC, journalisation, révocation et choix explicite de localisation des données. |

## Principes non négociables

- Toute évolution suit TDD, i18n dans les cinq langues, RBAC et isolation multi-organisation.
- Aucun déploiement démo sans CI verte, release stable et recette publique.
- Les données d’analyse ne sont jamais transmises à une IA externe par défaut.
