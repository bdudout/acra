# Gouvernance de la documentation ACRA

Cette règle légère maintient la documentation comme un produit : exacte, traçable
et utile à l'exploitation. Elle s'applique aux documents Markdown versionnés avec
le code ; les rapports d'audit archivés sont des preuves, pas la source de vérité
fonctionnelle.

## Sources de vérité

| Sujet | Source de vérité | Document d'appui |
|---|---|---|
| Comportement livré | Code, tests et migrations | `docs/ARCHITECTURE.md` |
| Vision et décisions produit | Décision datée | `docs/ara-grc-spec.md` et specs concernées |
| Contrat machine | Route et tests d'intégration | `GET /api/v1/openapi.json`, `docs/specs/api-publique-v1.md` |
| Déploiement et reprise | `docker-compose.yml`, scripts et test de restauration | `README.md`, `docs/runbook-exploitation.md` |
| Règles de contribution | `AGENTS.md` / `CLAUDE.md` | `CONTRIBUTING.md` |

En cas d'écart, le code fait foi pour le comportement présent. La documentation
doit être corrigée dans le même lot, sauf si elle nécessite une décision de produit
ou d'exploitation : l'écart est alors consigné avec un responsable et une échéance.

## Statut et cycle de revue

- Toute spécification porte un statut explicite : **livré**, **en cours**,
  **historique** ou **à cadrer**. Une vision passée ne doit pas être lue comme un
  état du produit.
- Revoir les documents de déploiement, sécurité et reprise avant chaque mise en
  production et au moins tous les six mois.
- Revoir les contrats d'API à chaque changement de route, de champ ou de règle
  d'autorisation ; mettre à jour OpenAPI et l'exemple correspondant ensemble.
- Toute affirmation réglementaire cite l'acte et sa version officiels. Ne pas
  transformer une capacité ACRA en attestation de conformité.

## Critères de qualité avant livraison

- Les liens locaux et les captures référencées existent.
- Les versions, nombres et noms de modules importants sont vérifiés contre le
  dépôt, ou datés comme photographie historique.
- Les procédures dangereuses précisent le périmètre, les prérequis et une issue
  de contrôle (ex. restauration testée, health check, journal consulté).
- Les recommandations d'infrastructure distinguent clairement ce que fournit
  ACRA de ce que l'exploitant doit configurer (TLS, réseau privé, coffre de
  secrets, chiffrement au repos, supervision).

## Références de bonnes pratiques

- [NIST SSDF — SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final) : pratiques de développement sécurisé et gestion des défauts.
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) : exigences vérifiables de sécurité applicative.
- [ANSSI — Guide d'hygiène informatique](https://cyber.gouv.fr/publications/guide-dhygiene-informatique) : exploitation, segmentation, sauvegardes et administration.
