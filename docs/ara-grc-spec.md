# ARA — Spécification : d'ACRA (cyber) vers une plateforme GRC modulaire

> Version 0.1 — 2026-07-23. Évolution de la vision « suite ARA » du 2026-06-24 :
> **une seule application, des modules activables un à un**, renommage dynamique
> quand l'organisation sort du périmètre purement cyber.

---

## 1. État des lieux d'ACRA (2026-07)

### 1.1 Volumétrie
| Indicateur | Valeur |
|---|---|
| Modèles Prisma | 26 |
| Routes API | 52 |
| Pages | 29 · Composants : 41 · Libs : 80 |
| Code source | ~65 000 lignes TS/TSX |
| Tests unitaires | 768 (Vitest, TDD) |
| Langues | 5 (fr, en, de, es, it) |
| Référentiels de contrôles | 14 (ISO 27001, NIST CSF, CIS v8, ANSSI, HDS, PCI-DSS, DORA, IEC 62443, SOC 2, NIST SSDF, RGS, ReCyF, TISAX…) |

### 1.2 Forces (au regard de la cible GRC)
Ce qui est **déjà générique** et réutilisable tel quel par tout module de risque :

- **Socle d'identité & gouvernance** : RBAC 7 rôles, multi-organisation hiérarchique
  (nœud/sous-arbre), SSO/MFA, politique de mots de passe, audit trail complet.
- **Workflow de décision** : soumission → approbation avec séparation des tâches
  (quatre-yeux), auto-validation mono-utilisateur, acceptation des risques par le
  métier, **dérogations** (workflow configurable, échéances, registre, preuves).
- **Moteur de conformité** : évaluation par référentiel, snapshots datés, roll-up
  multi-org, état « dérogé » dérivé — indépendant du cyber (un référentiel de
  contrôle permanent bancaire s'y branche tel quel).
- **Plans d'action** : le modèle `Mesure` (responsable, entité, échéance, coût,
  efficacité, statut, rattachement référentiel) est déjà un plan d'action GRC
  générique ; la vue `/actions` est déjà transverse aux analyses.
- **Objet `Risque`** : gravité × vraisemblance, stratégie de traitement, résiduel,
  justification — générique (rien de spécifiquement cyber dans sa structure).
- **Infra de configuration** : `OrganizationConfig` avec toggles hérités par
  organisation = exactement le mécanisme d'« activation module par module » demandé.
- **Qualité** : TDD, i18n systématique, CI, audit sécurité régulier.

### 1.3 Limites structurelles (dette à résorber pour le GRC)
1. **Tout part d'une `Analyse` EBIOS** : le risque est un enfant d'une analyse ;
   il n'existe pas de **registre de risques** autonome (nécessaire pour la
   cartographie et les risques « déclarés » hors démarche EBIOS).
2. **Pas de taxonomie de risques** : ACRA connaît les *secteurs d'activité* mais
   pas les *catégories de risque* (Bâle, COSO…). La maille de consolidation
   n'existe pas.
3. **Pas de référentiel de processus** : la cartographie et le contrôle permanent
   s'ancrent sur « processus × entité » ; ACRA n'a que les valeurs métier/missions
   du cadrage (proches mais par-analyse, non mutualisées).
4. **Pas d'objet Incident**, **pas d'objet Contrôle** (test planifié + résultat),
   **pas d'objet Mission d'audit / Constat**.
5. **AuditLog sans organizationId** (item connu) — bloquant pour des vues de logs
   par organisation dans un contexte multi-entités.
6. **Branding codé en dur** (« ACRA », poisson-logo, EBIOS partout dans l'UI).
7. Ergonomie : fichiers i18n ~2 200 lignes/langue (maintenable mais lourd),
   pas d'E2E automatisés (Playwright), listes longues non virtualisées.

---

## 2. Décision d'architecture : monolithe modulaire, PAS multi-apps

La vision de juin prévoyait un monorepo multi-apps (ACRA, TATOU, cartographie…).
**Révision** : la demande « modules activés un par un + renommage dynamique »
et la réalité de l'équipe (1 personne + IA) plaident pour :

> **Une seule application Next.js, un seul déploiement, une seule base** —
> les « modules » sont des **domaines fonctionnels activables** via
> `OrganizationConfig` (mécanisme déjà en production pour conformité,
> qualification, dérogations…).

Ce qu'on **garde** de la vision de juin (les coutures internes) :
- **Modèle de risque canonique** : nouvelle table `Registre de risques`
  (`RiskItem`) indépendante des analyses ; les analyses EBIOS *publient* dedans.
- **Aucun module n'écrit dans les tables d'un autre** : communication par
  services de domaine (`lib/<module>/`) et par le registre canonique.
- **Dégradation gracieuse** : ACRA seul reste léger ; chaque module ajouté
  enrichit la cartographie sans jamais être requis.

Ce qu'on **abandonne** (pour l'instant) : monorepo pnpm/turborepo, schémas
Postgres séparés, bus d'événements outbox. On les réintroduira **si** la suite
devait être re-splittée — les coutures logiques (services + registre canonique)
rendent ce split possible plus tard sans réécriture.

---

## 3. Nom de l'application — CONFIGURABLE (décision 2026-07-23)

- Le nom n'est **jamais codé en dur** : `lib/branding.ts` → `resolveBranding(cfg)`
  renvoie `{ nom, baseline, logo }`, consommé par Navbar, login, `<title>`, PDF,
  e-mails.
- **Défaut** (aucune configuration, périmètre cyber) : **ACRA — Augmented Cyber
  Risk Analysis** (existant, rassurant pour le RSSI).
- **Réglé dans la configuration** (niveau instance, SUPER_ADMIN) : `appName` +
  `appBaseline` optionnels. Renseignés → remplacent le défaut partout. C'est là
  que le **nouveau nom de gamme sera choisi** (⚠️ la marque « ARA » n'est PAS
  retenue — nom à décider plus tard ; le code ne présuppose aucun nom).
- Le module cyber garde « ACRA » comme **nom de module**, quel que soit le nom
  global. Les autres modules gardent des noms de module (à décider).

---

## 4. Les modules (activables un à un)

Chaque module = 1 toggle `OrganizationConfig` + 1 domaine `lib/<module>/` +
ses tables + ses pages. Ordre = dépendances naturelles.

### M0 — Socle GRC (prérequis invisible, non togglable)
Livré avec le premier module non-cyber :
- **Taxonomie de risques** configurable, hiérarchique (2 niveaux). Défauts
  livrés : taxonomie **Bâle II/III** (7 catégories d'événements) pour le
  risque opérationnel + taxonomie « générale » (stratégique, financier,
  juridique/conformité, RH, image, ESG…) + le cyber mappé dessus.
- **Référentiel de processus** (macro-processus → processus), rattaché à
  l'arbre d'organisations. Simple : nom, description, propriétaire, criticité.
- **Registre de risques canonique** (`RiskItem`) : intitulé, taxonomie,
  processus × entité, cotation inhérente/résiduelle (échelles existantes),
  propriétaire, statut, **provenance** (manuel | analyse ACRA | incident |
  contrôle | audit), liens plans d'action. C'est la maille de convergence.
- **AuditLog.organizationId** (résorption de dette).
- `lib/branding.ts` (cf. §3).

### M1 — Cartographie des risques (RCSA) — *le pivot*
- Vue registre + **heat map** par taxonomie × processus × entité (réutilise la
  matrice gravité×vraisemblance existante).
- **Campagnes d'évaluation** (RCSA) : le risk manager ouvre une campagne, les
  propriétaires cotent leurs risques (inhérent → efficacité des contrôles →
  résiduel), workflow de validation (réutilise quatre-yeux/dérogations).
- **Publication depuis ACRA** : à l'approbation d'une analyse EBIOS, ses risques
  sont proposés à la publication dans le registre (mode tracé 1:1, avec lien
  retour vers l'analyse). ACRA ne dépend pas de M1 : si M1 inactif, rien ne change.
- Consolidation : max / moyenne pondérée par maille (bascule à trancher).

### M2 — Incidents & pertes
- Déclaration d'incident **simple** (formulaire 2 minutes : quoi, quand, où,
  processus, taxonomie, impact estimé) — déclarable par tout utilisateur
  (rôle LECTEUR inclus, c'est la 1ʳᵉ ligne qui déclare).
- Cycle de vie : déclaré → qualifié (risk manager : taxonomie, coût réel,
  rattachement à un risque du registre) → clôturé. Pertes en € (brut/net,
  récupérations) pour la **LDC** bancaire (Bâle).
- Boucle : un incident rattaché à une maille **recalibre** la vraisemblance
  du risque (suggestion, pas automatisme) ; un incident sans risque existant
  propose la création d'un risque au registre.
- Alimente les exigences DORA (registre d'incidents ICT) et NIS2 (notification).

### M3 — Contrôle permanent
- **Bibliothèque de contrôles** (réutilise le moteur de référentiels : un plan
  de contrôle = un « référentiel » interne) rattachés aux risques/processus.
- **Plans de contrôle** : périodicité (mensuel/trimestriel/annuel), échantillon,
  responsable (1ʳᵉ ligne exécute, 2ᵉ ligne supervise = niveaux 1 et 2).
- **Exécution** : résultat conforme / anomalie (+ constat, preuve — réutilise
  l'upload data-URL des dérogations), génération de plan d'action si anomalie.
- Les résultats mettent à jour l'**efficacité des contrôles** → le résiduel
  des risques de la maille (boucle RCSA).
- Réutilise les crons (échéances de contrôles = même mécanique que dérogations).

### M4 — Audit interne (3ᵉ ligne)
- **Missions** (plan d'audit annuel, périmètre = processus/entités), **travaux**,
  **constats** (criticité, recommandation), **suivi des recommandations**
  (réutilise les plans d'action + relances par échéance).
- Suivi des **constats régulateur** (ACPR/BCE) : même objet, source différente.
- Cloisonnement : l'audit voit tout, personne ne modifie les constats d'audit
  (nouveau rôle AUDITEUR, lecture globale + écriture sur son module seul).

### M5 — ACRA (cyber) = le module existant
Inchangé fonctionnellement ; devient « le module cyber d'ARA » quand d'autres
modules sont actifs, et publie ses risques approuvés vers le registre (M1).

---

## 5. Analyse marché (synthèse)

**Segments visés** : (a) banques/assurances/mutuelles de taille intermédiaire
soumises ACPR (contrôle permanent + LDC + cartographie = obligation
réglementaire, arrêté du 3-11-2014) ; (b) ETI/PME régulées NIS2/DORA qui
découvrent la gestion des risques ; (c) cabinets de conseil (multi-clients via
le multi-org « consultant » déjà en place).

**Concurrence** :
- *GRC lourds entreprise* : Archer, MetricStream, ServiceNow IRM, MEGA HOPEX —
  chers, longs à déployer, hors de portée de la cible mid-market.
- *Cyber-only FR* : EGERIE, Agile Risk Manager — EBIOS mais pas de GRC complet.
- *Open source* : **eramba** (contrôles/conformité, UX datée), **CISO Assistant**
  (intuitem, FR, très dynamique, orienté conformité/frameworks cyber) — aucun ne
  couvre le risque opérationnel bancaire (RCSA/LDC/contrôle permanent).

**Positionnement différenciant d'ARA** : *« le GRC open-source qui guide les
non-spécialistes »* — seul outil combinant (1) EBIOS RM natif label-ready,
(2) chaîne op-risk réglementaire française (RCSA + incidents/LDC + contrôle
permanent + audit), (3) activation module par module à coût marginal nul,
(4) 5 langues, (5) on-premises simple (Docker). Le pitch bancaire : « d'abord
le cyber (NIS2/DORA), puis étendez au risque opérationnel sans changer d'outil ».

---

## 6. Modèle de données cible (nouveaux modèles, FK intra-module)

```
M0  Taxonomie(id, parentId, code, libelle, domaine)         # Bâle + générale + cyber
M0  Processus(id, organizationId, parentId, nom, proprietaire, criticite)
M0  RiskItem(id, organizationId, intitule, taxonomieId, processusId?, entite?,
             graviteInherente, vraisemblanceInherente, graviteResiduelle,
             vraisemblanceResiduelle, proprietaireId, statut, provenance,
             sourceType?, sourceId?, mesures[], derogations[]…)
M1  Campagne(id, organizationId, nom, periode, statut) + CampagneEvaluation
M2  Incident(id, organizationId, titre, dateSurvenance, processusId?, taxonomieId,
             statut, impactEstime, perteBrute?, perteNette?, recuperations?,
             riskItemId?, declarantId, qualificateurId?…)
M3  Controle(id, bibliothèque…) + PlanControle(periodicite, responsable, niveau)
    + ExecutionControle(date, resultat, constat?, preuves[], planActionId?)
M4  MissionAudit + ConstatAudit(criticite, recommandation, source: INTERNE|REGULATEUR,
    planActionId?, statutSuivi)
```
`Mesure` existante = plan d'action commun à tous les modules (ajout d'un
rattachement polymorphe léger `sourceType/sourceId`).

## 7. Séquencement proposé

| Étape | Contenu | Valeur livrée |
|---|---|---|
| 0 | Socle : branding dynamique + AuditLog.organizationId + taxonomie + processus + `RiskItem` | invisible seul, mais requis |
| 1 | **M1 Cartographie** (registre + heat map + publication depuis ACRA) | 1ʳᵉ vraie vue « tous risques » — le déclic renommage ARA |
| 2 | **M2 Incidents** (déclaration simple + qualification + lien registre) | valeur immédiate, module le plus simple |
| 3 | **M3 Contrôle permanent** | cible bancaire ACPR |
| 4 | Campagnes RCSA (M1 v2) + boucles incidents→cotation | maturité 2ᵉ ligne |
| 5 | **M4 Audit** | 3 lignes de défense complètes |

Chaque étape est livrable/démontrable seule ; ACRA reste utilisable à
l'identique à chaque instant.

## 8. Décisions produit (Brice, 2026-07-23)

1. **Architecture** : mono-application modulaire confirmée (modules = toggles
   `OrganizationConfig`) ; la vision multi-apps de juin est abandonnée, seules
   les coutures logiques (registre canonique, services par domaine) sont gardées.
2. **Marché prioritaire** : **banque/assurance ACPR** — vocabulaire 3 lignes de
   défense, taxonomie **Bâle** par défaut, contrôle permanent et LDC au cœur de
   la roadmap. (La taxonomie « générale » reste livrée pour les non-bancaires.)
3. **Méthode non-cyber** : **registre + RCSA** (déclaration directe → cotation
   inhérente → contrôles → résiduel, campagnes périodiques). Pas d'ateliers
   guidés op-risk en v1 (un parcours guidé optionnel pourra venir en v2, fidèle
   à l'ADN pédagogique d'ACRA).
4. **Premier module : M1 Cartographie** (après le socle M0) — le déclic visuel
   du renommage ARA et le prérequis des boucles incidents/contrôles.
