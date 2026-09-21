# Chantiers ACRA — suivi de développement

Dernière mise à jour : 20 septembre 2026. Ce document sert de backlog de travail et de support de priorisation. Les éléments « en cours » ne sont pas réputés disponibles avant tests complets, revue et publication d’une release stable.

## En cours — sécurité et gouvernance

| Chantier | État | Critères de fin |
|---|---|---|
| Dashboard des dérogations | En cours | Compteurs actif / échéance proche / expiré / en revue, priorités visibles, responsive, isolation multi-organisation, tests UI et logique. |
| Suppression autonome de compte démo | En cours | Désactivée par défaut ; activation super-admin ; uniquement en démo ; confirmation explicite ; suppression transactionnelle du compte, sessions, jetons, organisation et données associées ; audit/SIEM ; tests. |
| Appareil de confiance après OTP e-mail | À développer | Réglage super-admin désactivé par défaut ; jeton opaque haché, expiration, révocation, gestion des appareils ; OTP maintenu pour un nouvel appareil ; tests d’authentification. |

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
| Haute | Tests IDOR continus | Étendre les tests à deux comptes et deux organisations à l’ensemble des ressources organisationnelles sensibles. |
| Moyenne | Rate limiting distribué | Remplacer le store mémoire par un store partagé avant un passage multi-instance. |
| Moyenne | SIEM | Encadrer les destinations SIEM internes par une allowlist réseau et formaliser le runbook. |
| Moyenne | IA gouvernée | Ne pas activer d’IA externe par défaut ; étudier une API MCP avec identité technique, RBAC, journalisation, révocation et choix explicite de localisation des données. |

## Principes non négociables

- Toute évolution suit TDD, i18n dans les cinq langues, RBAC et isolation multi-organisation.
- Aucun déploiement démo sans CI verte, release stable et recette publique.
- Les données d’analyse ne sont jamais transmises à une IA externe par défaut.
