# Cyber Resilience Act — Analyse d'applicabilité & plan de conformité (ACRA)

> **Nature du document** : auto-évaluation **technique** préparatoire, destinée à
> outiller une décision et une **validation juridique**. Ce n'est PAS un avis
> juridique. Les libellés exacts d'articles/annexes doivent être repris de la
> source officielle **EUR-Lex** (Règlement (UE) 2024/2847). Les dates ci-dessous
> sont indicatives et **à confirmer** sur EUR-Lex.

## 1. Le CRA en bref

- **Texte** : Règlement (UE) 2024/2847 (« Cyber Resilience Act »), horizontal, sur
  les exigences de cybersécurité des **produits comportant des éléments numériques**
  (PEN — matériel et logiciels) mis à disposition sur le marché de l'UE.
- **Calendrier indicatif** (à vérifier) : entrée en vigueur déc. 2024 ; obligations
  de **signalement** des vulnérabilités activement exploitées et incidents graves
  ~**sept. 2026** ; **pleine application** des exigences essentielles ~**déc. 2027**.
- **Logique** : exigences essentielles de sécurité (Annexe I, partie I), obligations
  de **traitement des vulnérabilités** (Annexe I, partie II), **documentation
  technique** (Annexe VII), **évaluation de conformité**, marquage **CE** et
  **déclaration UE de conformité**, obligations de signalement.

## 2. Applicabilité à ACRA — arbre de décision

L'applicabilité dépend du **modèle de mise sur le marché**. ACRA existe sous
plusieurs formes ; il faut trancher laquelle est « mise sur le marché » et à quel
titre :

| Forme de distribution | Statut CRA probable | Conséquence |
|---|---|---|
| **Logiciel auto-hébergé distribué** (image `ghcr.io/bdudout/acra`, sources) **dans une activité commerciale** (vente, support payant, offre pro) | **PEN dans le champ** → ACRA = fabricant | Exigences essentielles + doc technique + conformité + signalement |
| **Open source non commercial** (développé/fourni hors activité commerciale) | **Hors champ** (exemption OSS) ; rôle possible d'**« intendant de logiciel libre »** (obligations allégées) | Bonnes pratiques + politique CVD, sans marquage CE |
| **SaaS** (instance publique `acra-cyber.com` exploitée comme service) | **Hors champ CRA** en principe (service → **NIS2**), SAUF « solution de traitement de données à distance » intégrée à un produit | Obligations NIS2 côté exploitant du service |

**À trancher (décision + juridique)** : le **modèle économique** de la distribution
du logiciel. Tant qu'il n'est pas fixé, on **prépare la conformité comme si le PEN
était dans le champ** (posture prudente, réutilisable dans tous les cas).

## 3. Catégorisation du produit

Les catégories « importantes » (classes I/II, Annexe III) et « critiques »
(Annexe IV) visent des produits de sécurité spécifiques (gestion d'identité et
d'accès, gestionnaires de mots de passe, VPN, **SIEM**, EDR, pare-feu, IDS/IPS,
PKI, microcontrôleurs sécurisés, hyperviseurs…).

- ACRA est un **outil d'analyse de risques / GRC** : il **n'entre pas** dans ces
  listes (il *transfère* des journaux vers un SIEM mais n'**est pas** un SIEM ;
  il gère des comptes applicatifs mais n'est pas un produit de gestion d'identité
  au sens de l'annexe). → **Catégorie « par défaut »** présumée.
- **Conséquence** : évaluation de conformité par **auto-évaluation** (module A)
  admise pour la catégorie par défaut — sous réserve de confirmation de la
  classification.

## 4. Exigences essentielles (Annexe I, partie I) — posture ACRA

> Reprendre les intitulés exacts sur EUR-Lex. Correspondance indicative avec les
> contrôles réellement en place (référencés dans le code / la doc).

| Exigence essentielle (résumé) | Posture ACRA | Éléments probants |
|---|---|---|
| Conçu/développé pour un niveau de cybersécurité approprié au risque | **Largement couvert** | RBAC multi-niveaux (`lib/permissions`), isolation multi-organisation (tests IDOR), TDD, revues. |
| Mise à disposition **sans vulnérabilité exploitable connue** | **En cours** | `npm audit` en CI, remédiation d'audit OWASP WSTG (`docs/audit-remediation-2026-09-21.md`), SBOM pour la veille CVE. |
| **Configuration par défaut sécurisée** (secure by default) | **Couvert** | Inscription publique, API v1 et MCP **désactivées par défaut** ; MFA/appareils de confiance opt-in ; secrets non par défaut (`startup-checks`). |
| Protection contre les accès non autorisés (authentification, gestion des identités) | **Couvert** | Auth NextAuth + MFA (OTP, super-admin inclus), verrouillage anti-brute-force, SSO/SCIM, invalidation de session (`sessionVersion`). |
| **Confidentialité** (chiffrement au repos/en transit des données sensibles) | **Partiel** | Secrets chiffrés (`secret-crypto`), hachage bcrypt ; TLS = responsabilité du reverse-proxy (à documenter). |
| **Intégrité** (protection des données/commandes/config) | **Couvert** | Piste d'audit, migrations versionnées + hash, attestations d'image (SLSA), validations d'entrée (`import-sanitize`). |
| **Minimisation des données** | **Couvert** | Modèle orienté analyse de risques ; RGPD/RoPA outillé ; pas de collecte superflue. |
| **Disponibilité / résilience** (anti-DoS) | **Couvert** | Rate limiting (store partagé multi-instance), timeouts, sauvegardes + runbook. |
| **Réduction de la surface d'attaque** | **Couvert** | Fonctionnalités opt-in, `csp`, allowlist SIEM (SSRF), webhooks validés anti-SSRF. |
| **Journalisation/monitoring** des accès/altérations | **Couvert** | `auditLog` central, transfert **SIEM** configurable. |
| **Mises à jour de sécurité** (mécanisme) | **Couvert** | Chaîne release/CI/CD, notify-only de version, runbook de mise à jour. |

## 5. Traitement des vulnérabilités (Annexe I, partie II)

| Obligation | Posture ACRA | Reste à faire |
|---|---|---|
| **Inventaire des composants / SBOM** | ✅ **Fait** — SBOM CycloneDX + attestations à chaque release (`docs/sbom.md`) | Diffusion du SBOM aux utilisateurs/déployeurs |
| **Traiter et corriger** les vulnérabilités sans délai | ⚠️ Partiel | Formaliser un **SLA de correction** par sévérité |
| **Divulgation coordonnée (CVD)** + point de contact | ✅ **Couvert** — `SECURITY.md` (GitHub Private Vulnerability Reporting + e-mail, accusé 48 h, divulgation coordonnée) + **`public/.well-known/security.txt`** (RFC 9116) ajouté | Tenir `Expires` de security.txt à jour |
| **Diffusion de correctifs** de sécurité | ✅ Chaîne release + GitHub Security Advisories (cf. `SECURITY.md`) | Canal d'avis systématique par release |
| **Signalement** des vulnérabilités activement exploitées & incidents graves (ENISA/CSIRT, délais courts) | ❌ À faire | Procédure de signalement + registre + astreinte (échéance ~sept. 2026) |
| Politique de **fin de support** annoncée | ❌ À faire | Publier une politique de support/EOL |

## 6. Documentation technique (Annexe VII)

À constituer et tenir à jour (base largement disponible) : description du produit
et de son usage prévu ; **évaluation des risques** de cybersécurité ; liste des
exigences essentielles applicables et **preuves** de couverture (§4/§5) ; **SBOM** ;
processus de traitement des vulnérabilités ; procédures de mise à jour ; résultats
des tests (suite automatisée, `tsc`, `npm audit`, CI/E2E). → À rassembler dans un
**dossier technique CRA** versionné.

## 7. Évaluation de conformité, marquage & déclaration

- Catégorie par défaut → **auto-évaluation (module A)** présumée admise.
- Produire une **déclaration UE de conformité** et apposer le **marquage CE**
  (le CE d'un produit purement logiciel s'applique à la documentation/registre,
  pas physiquement) — **si** le produit est dans le champ (§2).

## 8. Plan de conformité (proposé)

| Priorité | Action | Livrable | Jalon |
|---|---|---|---|
| **Haute** | Trancher le **modèle de mise sur le marché** + validation juridique du champ CRA | Note de décision | Immédiat |
| **Haute** | Politique **CVD** + `SECURITY.md` + `security.txt` + GitHub Security Advisories | Fichiers publics | Court terme |
| **Haute** | Procédure de **signalement** (vulns exploitées / incidents), registre, contact | Procédure + registre | Avant ~sept. 2026 |
| Moyenne | **SLA de correction** par sévérité + politique de support/EOL | Politique publiée | Court terme |
| Moyenne | **Dossier technique CRA** (Annexe VII) versionné | `docs/cra-dossier-technique/` | Avant application (~déc. 2027) |
| Moyenne | Documenter **TLS/chiffrement en transit** (reverse-proxy) et diffusion du SBOM | Doc déploiement | Court terme |
| Basse | Déclaration UE de conformité + marquage CE (si champ confirmé) | Déclaration | Avant application |

## 9. Écarts prioritaires (synthèse)

1. **Décision d'applicabilité** (modèle économique) — préalable à tout le reste.
2. **Procédure de signalement** (vulnérabilités activement exploitées / incidents
   graves à ENISA-CSIRT, délais courts) — obligation la plus **précoce** du CRA
   (~2026) et aujourd'hui **absente**. La CVD, elle, est **déjà en place**
   (`SECURITY.md` + `security.txt`). **À prioriser : le signalement.**
3. **Dossier technique** formalisé (les preuves existent, l'assemblage manque) +
   **SLA de correction** par sévérité et **politique de support/EOL**.

---

Voir aussi : `docs/sbom.md` (SBOM, exigence CRA), `docs/audit-remediation-2026-09-21.md`
(traitement de vulnérabilités), `docs/ARCHITECTURE.md`, `SECURITY.md` (CVD),
`public/.well-known/security.txt`.
