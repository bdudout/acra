# Évaluation des tiers par usage de service — cadrage

> Statut : **cadrage v0.2 (2026-10-09) — validé**, décisions ci-dessous (§ 5). Décisions déjà prises (cadrage du 2026-10-09) :
> l'évaluation porte sur le **service fourni**, pas sur l'entreprise (« un contrat est pour un service ou un ensemble de
> services ») ; **évaluation par organisation, synthèse groupe**.

## 1. Existant

| Objet | Modèle | Portée |
|---|---|---|
| Tiers (identité : nom, LEI, pays, alias, date de revue) | `Tier` | organisation racine du groupe ; accordé aux filiales (`TierOrganization`) |
| Offre / service du tiers | `TierService` (nom, type de service TIC, description, actif) | partagée par le groupe |
| Contrat TIC (DORA) et offres couvertes | `ArrangementTic` + `TierContractService` (périmètre, dates) | organisation (contrat groupe : bénéficiaires confirmés) |
| **Usage** d'une offre | `TierServiceUsage` (organisation, offre, cas d'usage, description, processus soutenu, contrat qui le couvre, criticité CRITIQUE / IMPORTANTE / NON_CRITIQUE) | **organisation** |

Il n'existe aujourd'hui **aucune évaluation de risque** : seule la criticité de l'usage est saisie.

## 2. Proposition

**Unité d'évaluation : l'usage** (organisation × offre × cas d'usage). C'est là que l'on connaît les données concernées, le
processus soutenu et le contrat applicable : la même signature électronique est anodine pour des devis et critique pour
des contrats de travail.

Par usage (fiche « Évaluation ») :
- **Données concernées** (cf. Q1) et niveau de sensibilité ;
- **Cotation** gravité × vraisemblance sur les échelles de l'organisation (cf. Q2), niveau calculé ;
- **Garanties contractuelles** du contrat qui couvre l'usage (clauses DORA art. 30 : sécurité, audit, sous-traitance,
  réversibilité / stratégie de sortie) et niveau **résiduel** (cf. Q3) ;
- évaluateur, date d'évaluation, justification ; **prochaine évaluation 12 mois après** (même règle que les revues
  périodiques, relance par le cron `relances`).

**Synthèses (pire niveau, jamais une moyenne) :**
- offre = pire de ses usages dans l'organisation ;
- tiers = pire de ses offres dans l'organisation ;
- groupe = pour chaque tiers, pire niveau parmi les organisations (avec le détail par filiale) ;
- **concentration** : nombre de processus critiques et d'usages critiques par tiers (indicateur DORA / NIS2).

## 3. Questions à trancher

### Q1 — Comment désigner les « données métier concernées » ?
| Option | Conséquences |
|---|---|
| **(a)** Catégories saisies librement + besoins DIC de l'usage | + simple, aucune dépendance ; − pas de lien avec le reste d'ACRA, vocabulaire hétérogène entre filiales, pas de consolidation fine. |
| **(b)** Liens vers l'existant : processus soutenu (déjà là) + **traitements RGPD** concernés + besoins DIC (recommandé) | + réutilise processus et registre RGPD (sous-traitant ⇒ données personnelles visibles, critère AIPD « tiers ») ; une seule saisie sert DORA, NIS2 et RGPD ; − le registre RGPD doit être tenu ; liste longue à choisir dans les grandes organisations. |
| **(c)** Liens vers les **valeurs métier des analyses** | + précision maximale ; − valeurs métier dispersées dans des analyses (doublons, analyses archivées), lien fragile dans le temps — déconseillé. |

### Q2 — Quelle méthode de cotation ?
| Option | Conséquences |
|---|---|
| **(a)** Même échelle gravité × vraisemblance que les risques (recommandé pour démarrer) | + cohérent avec la cartographie et l'appétit ; aucune méthode nouvelle à apprendre ; − cotation subjective, pas de critères fournisseur explicites. |
| **(b)** Grille fournisseur dédiée (dépendance, substituabilité, sécurité constatée, solidité financière, localisation des données…), pondérée | + discussion structurée, comparable d'un tiers à l'autre ; − nouvelle méthode, poids à paramétrer par l'ADMIN, résultat à convertir pour la cartographie. |
| **(c)** Grille (b) qui **propose** une cotation (a), modifiable | + le meilleur des deux ; − le plus long à livrer (2 lots). |

### Q3 — Cotation résiduelle selon les garanties du contrat ?
| Option | Conséquences |
|---|---|
| **(a)** Non : une seule cotation | + simple ; − on ne voit pas l'effet du contrat (ex. clause d'audit absente). |
| **(b)** Oui : inhérente + résiduelle, avec la liste des clauses DORA art. 30 cochées sur le contrat (recommandé) | + met en évidence les contrats à renégocier ; alimente le registre d'information DORA ; − 2 cotations et une liste de clauses à tenir par contrat. |

### Q4 — Qui évalue et qui valide ?
| Option | Conséquences |
|---|---|
| **(a)** Gestionnaires du registre TIC (ADMIN, RSSI, gestionnaire des risques, conformité, DPO) évaluent ; pas de validation | + rapide ; − pas de regard métier ni de second regard. |
| **(b)** Le **propriétaire du processus** (ou le métier) propose, le RSSI / gestionnaire des risques **valide** (recommandé) | + implique le métier qui connaît l'usage ; trace de validation ; − un statut de plus (proposée / validée) et des relances. |

### Q5 — Lien avec le registre des risques ?
| Option | Conséquences |
|---|---|
| **(a)** Aucun | + pas de doublon ; − les tiers critiques n'apparaissent pas dans la cartographie globale. |
| **(b)** Au-delà d'un seuil, **proposer** la création d'un risque fournisseur rattaché (validation humaine) (recommandé) | + la cartographie globale reflète la dépendance ; aucune création automatique ; − un seuil à paramétrer. |
| **(c)** Création automatique | + exhaustif ; − doublons et bruit, contraire à la règle « rien de silencieux ». |

### Q6 — Questionnaire de diligence envoyé au fournisseur ?
Hors de ce lot (accès externe sans compte à sécuriser) ; à cadrer séparément si besoin. **À confirmer.**

## 4. Lots proposés (après validation)

1. **T1** — ✅ livré (2026-10-10) : fiche d'évaluation d'un usage (méthode atelier 3, actuelle / cible, clauses, traitements RGPD, risques d'externalisation), cycle brouillon → soumise → validée (RSSI), synthèses offre / tiers au pire niveau, réévaluation à 12 mois et relances (`lib/tier-evaluation`, `EvaluationUsagePanel`, route `tier-registry/usages/[id]/evaluation`).
2. **T2** — Vue groupe (pire niveau par filiale, concentration), export Excel.
3. **T3** — Proposition de risque fournisseur au-delà d'un seuil (Q5 b) ; circuit de validation (Q4 b).
4. **T4** (option) — Grille fournisseur dédiée (Q2 c).

## 5. Décisions (2026-10-09)

- **Méthode (Q2)** : reprendre les principes de l'atelier 3 d'EBIOS RM, où les tiers sont déjà évalués — 4 critères
  **dépendance, pénétration, maturité cyber, confiance**, échelles de l'organisation (`echellesEcosysteme`),
  **menace = (dépendance × pénétration) / (maturité × confiance)**, zones **veille / contrôle / danger** (mêmes seuils que
  le radar), clauses contractuelles types de l'atelier 3 (RGPD, sécurité, PAS, PCI/PSEE, réversibilité, QoS, SLA).
- **Cotations (Q3)** : une cotation **actuelle** et une cotation **cible (résiduelle)**, comme pour les parties prenantes.
- **Évaluation / validation (Q4)** : le **propriétaire du risque ou l'analyste** évalue et soumet ; le **RSSI valide**.
- **Risques (Q5)** : l'évaluation est **rattachée à un ou plusieurs risques d'externalisation** existants du registre des
  risques de l'organisation (choisis dans la liste ; chaque organisation a les siens) — aucune création automatique.
- **Données (Q1)** : processus soutenu (déjà sur l'usage) + traitements RGPD concernés.
- **Questionnaire de diligence (Q6)** : hors du lot.

