# Audit de documentation — 17 septembre 2026

## Objet et méthode

Audit des documents Markdown ACRA au regard du dépôt livré, des scripts de
déploiement et des attentes actuelles de documentation d'un produit GRC : contrat
vérifiable, sécurité exploitable, reprise testable et séparation explicite entre
capacités du produit et responsabilités de l'exploitant. Références :
[NIST SSDF](https://csrc.nist.gov/pubs/sp/800/218/final),
[OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
et [guide d'hygiène ANSSI](https://cyber.gouv.fr/publications/guide-dhygiene-informatique).

Périmètre vérifié : `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `docs/`,
`docs/specs/`, `docker-compose.yml`, scripts, routes API, configuration Next et
workflow CI. Les fichiers binaires et les preuves d'audit archivées ne sont pas
réévalués ici.

## Résultat

| Axe | Niveau | Constat |
|---|---|---|
| Documentation du produit | Bon | Parcours EBIOS/GRC, rôles, déploiement, runbook et API sont présents. |
| Traçabilité code ↔ document | Bon après correction | Carte d'architecture, specs ciblées et commentaires de contrat existent. |
| Sécurité d'exploitation | À renforcer | Les responsabilités de réseau, sauvegarde et amorçage admin doivent rester visibles. |
| Gouvernance documentaire | À structurer | Pas de statut homogène ni cycle de revue avant cet audit. |
| Assurance continue | À renforcer | CI couvre types, i18n et tests ; elle ne vérifie ni liens Markdown ni dérive doc/contrat. |

## Écarts traités dans ce lot

1. `docs/ARCHITECTURE.md` annonçait **Next.js 14** alors que `package.json`
   référence Next.js 16 : corrigé.
2. `docs/ara-grc-spec.md` était une photographie de juillet 2026, avec des
   volumétriques désormais obsolètes : marqué explicitement **historique** et
   relié à la carte courante.
3. Le README présentait SAML comme disponible au même niveau qu'OIDC alors que
   la spécification SSO indique un chantier en maintenance : formulation corrigée.
4. Le runbook qualifiait à tort le service de sauvegarde de manuel alors que le
   compose le planifie quotidiennement : procédure corrigée ; la supervision et
   la restauration testée restent requises.
5. Le compose publie PostgreSQL sur `5432`, contrairement à l'architecture
   cible « base privée » : le README l'explicite désormais et le profil
   `docker-compose.production.yml` retire cette publication.
6. La gouvernance, les sources de vérité et les critères de revue sont désormais
   définis dans [`GOUVERNANCE-DOCUMENTATION.md`](GOUVERNANCE-DOCUMENTATION.md).

## Delta à décider ou à réaliser

| Priorité | Delta | Action recommandée | Décision requise |
|---|---|---|---|
| Traité | Publication par défaut de PostgreSQL | `docker-compose.production.yml` retire `db.ports` et lie ACRA à `127.0.0.1`. | Non : profil séparé, développement inchangé. |
| Traité | Initialisation du premier SUPER_ADMIN | La route publique est fermée sur une production vide ; `scripts/create-admin.mjs` crée localement le compte et son appartenance racine. | Non : démo conservée. |
| P1 | Assurance documentaire en CI | Ajouter un contrôle de liens locaux et de références d'images, puis une vérification ciblée du contrat OpenAPI. | Non, si l'ajout de dépendance/outillage est accepté. |
| P1 | Reprise mesurable | Définir RPO/RTO, une fréquence de test de restauration et la preuve à conserver. | Oui : dépend de l'offre d'exploitation. |
| P2 | Politique de sécurité éditeur | Compléter `SECURITY.md` avec canal, PGP ou portail, périmètre, SLA réalistes et politique de divulgation. | Oui : engagement public de l'éditeur. |
| P2 | Chaîne d'approvisionnement | Publier SBOM par release, provenance des images et politique de mises à jour des dépendances. | Oui : choix de chaîne CI/CD et de distribution. |

## Prochaine revue

Déclencher une revue ciblée lors de la prochaine évolution d'API, de SSO, de
déploiement ou de sauvegarde ; sinon avant la prochaine mise en production et au
plus tard le 17 mars 2027.
