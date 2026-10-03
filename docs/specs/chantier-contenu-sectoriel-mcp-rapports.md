# Expression de besoin — contenu sectoriel étendu, MCP phase 5, rapports et exports

Statut : **expression de besoin, aucun code** · rédigée le 2 octobre 2026 à partir du code et des spécifications présents sur `main` (vérifiés, pas recopiés des backlogs). Elle précède la conception et le découpage en lots (§ 9).

Trois chantiers :

- **A — Contenu métier des secteurs hors banque / assurance** (contrôles, KRI, missions d'audit, risques, tests de résilience, incidents types).
- **B — MCP / IA gouvernée, phase 5** (traitement de conformité, recommandation de scénarios, saisie assistée, tests d'isolation).
- **C — Rapports et exports** (appétence au risque, projet 360, tests de résilience DORA).

## 0. Corrections à l'état annoncé

Une première lecture des backlogs (`CHANTIERS-EN-COURS.md`, § 5 de `socles-sectoriels-tiers-canonique-backlog.md`) laissait croire que certains éléments manquaient. La vérification dans le code montre qu'une partie existe déjà ; les besoins ci-dessous sont **réduits à l'écart réel**.

| Élément annoncé manquant | Réalité vérifiée | Écart réel retenu |
|---|---|---|
| Export PDF de la vue RAS/RAD | **Existe** : `GET /api/appetence/export` + `ras-rad-pdf-template.tsx` (commit `d45b7f7`) | Tendances, export Excel, intégration au dossier de comité et au tableau de bord mensuel |
| Rapport PDF/Excel par domaine du projet 360 | **Existe** : `GET /api/export/[id]?format=pdf|xlsx` → rapport « méthode directe » avec ventilation par domaine (`rapport-methode-directe*.ts`), bilan par domaine et tiers du projet | Vue **portefeuille** multi-projets et son export |
| Constats de tests de résilience → plan d'action | **Existe** : `POST /api/tests-resilience/[id]/actions` (une action ouverte par constat, lien polymorphe `TEST_RESILIENCE`, idempotent) | Pièces de preuve ; synchronisation constat ↔ action ; **le type `TEST_RESILIENCE` est absent de `PLAN_ACTION_LIEN_TYPES`** (`lib/plan-action.ts`) alors que la route l'écrit : à vérifier dans la vue unifiée `/plans-actions` (facette, compteurs, filtres, clôture) |
| MCP : « phases 1 à 4b livrées » | Confirmé : outils de lecture, `propose_risk`, `propose_measure`, `propose_plan_action`, file de validation, ancrage obligatoire | `propose_conformite_treatment`, `recommend_risks_scenarios`, saisie assistée, tests d'isolation étendus |

---

# A — Contenu métier hors banque / assurance

## A.1 État actuel

**Mécanisme** (livré, à conserver) : catalogue de suggestions `lib/sector-suggestions.ts` + packs (`sector-packs.ts`, `sector-packs-bancassurance.ts`, `catalogue-risks.ts`, `catalogue-resilience.ts`) ; 11 secteurs (`SECTOR_CODES`) ; nature des éléments : processus, risques, contrôles, KRI, missions d'audit, plans de test de résilience ; **suggestions sélectionnables, jamais créées d'office** ; provenance stable (`catalogueKey` / `catalogueVersion`, index unique par organisation), idempotence, « nouveautés depuis la version importée », références citées (`references`), liens contrôle → risque (`CONTROL_RISKS`), grille de revue générée (`docs/specs/catalogue-revue-grille.csv`), libellés ×5 langues ; droits et modules actifs vérifiés par type ; aucun seuil, aucune exécution, aucune date, aucun résultat n'est jamais créé.

**Volumétrie par secteur** (catalogue 1.9, mesurée) :

| Secteur | Processus | Risques | **Contrôles** | **KRI** | **Missions d'audit** | Tests de résilience |
|---|---|---|---|---|---|---|
| Transversal (socle) | 24 | 22 | 9 | 9 | 4 | 7 |
| Banque (`FINANCE`) | 10 | 8 | **28** | 2 | 1 | 2 |
| Assurance / mutuelle (`ASSURANCE`) | 11 | 7 | **31** | 2 | 1 | 2 |
| Énergie, Transport, Télécom, Santé, Industrie, Public, Commerce, SaaS, Services (chacun) | 4 | 7 | **2** | **2** | **1** | **0** |

**Catalogues historiques distincts** (non fusionnés en profondeur) : modèles de contrôles liés à des référentiels (`controles-catalogue.ts`, ISO 27001 / DORA), programmes d'audit (`audit-programmes-catalogue.ts`, ISO 27001 / DORA), socle RoPA, gabarits de personnalisation par secteur (`gabarits.ts` : régimes d'incident, rapports, vocabulaire), exemples sectoriels d'analyse EBIOS RM (`exemples-sectoriels.ts`, 18 familles dont éducation, agricole, défense, immobilier / BTP, média, tourisme, associations — **absentes** de `SECTOR_CODES`).

**Revue** : première passe de l'équipe de développement (1ᵉʳ octobre 2026) ; **aucun secteur n'est validé par un expert** (`catalogue-revue-metier.md`).

## A.2 Besoin

Porter chacun des 9 secteurs au **niveau de profondeur de la banque / assurance** : une organisation du secteur qui active le module doit trouver, par **domaine de contrôle**, des propositions pertinentes et ancrées sur les textes d'origine du secteur, sans rien devoir saisir de zéro.

### A.2.1 Cibles quantitatives minimales par secteur

| Nature | Cible | Remarque |
|---|---|---|
| Domaines de contrôle (processus de domaine) | 6 à 9 | un domaine = un processus du secteur auquel les contrôles se rattachent |
| Contrôles-types | ≥ 20 (≥ 2 par domaine) | périodicité et type suggérés, références citées |
| KRI candidats | ≥ 8 | unité, sens, fréquence ; **jamais de seuil ni de valeur** |
| Risques (événements-types) | ≥ 12 | rattachés à un processus ; chaque contrôle cite ≥ 1 risque du secteur ou du socle |
| Missions d'audit types | ≥ 4 | 4 à 6 points de revue vérifiables, sans constat préjugé |
| Plans de test de résilience | ≥ 3 pour les secteurs soumis à NIS2 ou à un régime équivalent | types de l'art. 25 § 1 DORA seulement quand l'entité est financière ; sinon « test de continuité », « exercice de crise » (libellés non normatifs) |
| Incidents types sectoriels | ≥ 3 | s'ajoutent aux 28 incidents types transverses (`lib/incident-types-catalogue.ts`) |

### A.2.2 Domaines et textes d'ancrage proposés (à valider par un expert de chaque secteur)

Les références sont des **textes d'origine à citer** (champ `references`), jamais des libellés d'exigence reproduits. Les numéros d'articles ne sont indiqués que lorsqu'ils sont sûrs ; sinon « à vérifier ».

| Secteur | Domaines de contrôle envisagés | Textes d'ancrage (à confirmer) |
|---|---|---|
| **Énergie** | sûreté des systèmes industriels (OT / SCADA), accès des prestataires de terrain, permis de travail et sécurité des personnes, continuité d'approvisionnement, gestion de crise, cybersécurité des réseaux et des flux transfrontaliers, conformité environnementale | NIS2 (secteur à haute criticité) ; directive (UE) 2022/2557 (résilience des entités critiques) ; règlement délégué (UE) 2024/1366 (code de réseau cybersécurité du secteur de l'électricité) ; IEC 62443 |
| **Transport** | maintenance et sécurité de la flotte, sûreté des sites, temps de conduite et de repos, marchandises dangereuses, traçabilité et chaîne du froid, systèmes de billettique / réservation, continuité d'exploitation | NIS2 ; directive CER ; règlement (CE) n° 561/2006 (temps de conduite) ; ADR / RID / IMDG (marchandises dangereuses) ; code ISPS (maritime) — chaque mode (aérien, ferroviaire, maritime, routier) a son régime : à découper |
| **Télécom** | sécurité et résilience des réseaux, accès aux équipements et aux données de signalisation, interception légale, fraude (SIM-swap, revenus), qualité de service et disponibilité, protection des données de trafic, fournisseurs d'équipements | NIS2 (infrastructure numérique) ; directive (UE) 2018/1972 (code des communications électroniques européen) ; directive 2002/58/CE (vie privée et communications électroniques) |
| **Santé** | hébergement et accès aux données de santé, identitovigilance, dispositifs médicaux connectés, continuité des soins et PCA des systèmes d'information de santé, pharmacovigilance et traçabilité, consentement et droits des patients, prestataires de santé | RGPD (art. 9) ; hébergement de données de santé (HDS, Code de la santé publique) ; politique générale de sécurité des systèmes d'information de santé (PGSSI-S) ; règlement (UE) 2017/745 (dispositifs médicaux) |
| **Industrie** | sûreté des procédés (OT), qualité et libération de lots, maintenance préventive, sécurité des machines et des sites, chaîne d'approvisionnement, propriété intellectuelle et secrets de fabrication, produits connectés | IEC 62443 ; règlement (UE) 2023/1230 (machines) ; Seveso III (directive 2012/18/UE) ; règlement (UE) 2024/2847 (CRA) pour les produits à éléments numériques |
| **Public** | homologation et sécurité des systèmes d'information, marchés publics et délégations, continuité des services publics, protection des données des usagers, accessibilité, gestion budgétaire et comptable, relations avec les opérateurs | référentiel général de sécurité (RGS) ; code de la commande publique ; RGPD ; NIS2 (administration publique) ; RGAA |
| **Commerce** | paiement et données de cartes, fraude e-commerce et retours, stocks et inventaires, marketing et consentement, chaîne logistique et fournisseurs, loyauté et promotions | PCI DSS v4.0.1 ; RGPD / ePrivacy ; code de la consommation ; loi Sapin II (anticorruption fournisseurs) |
| **SaaS / numérique** | cycle de développement sécurisé, isolation multi-clients, gestion des secrets et des clés, disponibilité et reprise (SLA), sous-traitance de données, gestion des vulnérabilités et divulgation, conformité des produits | ISO/IEC 27001, 27017, 27018 ; SOC 2 ; NIS2 (fournisseurs de services numériques) ; CRA ; DORA (fournisseur de services TIC d'entités financières) ; RGPD art. 28 |
| **Services professionnels** | secret professionnel et confidentialité des dossiers, LCB-FT (avocats, notaires, experts-comptables), conflits d'intérêts, gestion des fonds de tiers, qualité et facturation, accès aux dossiers et départs de collaborateurs | RGPD ; Code monétaire et financier (LCB-FT) ; règles déontologiques de chaque profession (à citer par profession) |

**Secteurs supplémentaires** présents dans les exemples d'analyse mais pas dans le catalogue de suggestions : éducation / recherche, agricole / agroalimentaire, défense, immobilier / BTP, média, tourisme / hôtellerie, associations. **Décision à prendre** (§ 10) : les ajouter à `SECTOR_CODES` dans un second temps, ou les laisser aux exemples EBIOS RM.

## A.3 Exigences fonctionnelles

| Id | Exigence |
|---|---|
| A-1 | **Domaines de contrôle** : chaque contrôle se rattache à un processus de domaine du secteur (déjà le cas) ; l'écran de suggestions permet de **sélectionner tout un domaine** (case « tous les contrôles de ce domaine » respectant les droits et les modules actifs). |
| A-2 | **Références** : tout contrôle et toute mission d'un domaine réglementé porte au moins un texte d'origine cité (`references`), repris dans la description de l'élément créé ; test de non-régression qui refuse un contrôle sans référence dans un secteur réglementé. |
| A-3 | **Profondeur minimale** : un test échoue si un secteur est sous les cibles de § A.2.1 (empêche la régression et le « rattrapage jamais fini »). |
| A-4 | **Statut de relecture par élément** : chaque élément du catalogue porte un état (`BROUILLON` → `RELU` → `VALIDE`, relecteur et date) ; colonne dans la grille CSV ; badge « contenu validé / à valider » dans les suggestions ; **un secteur n'est annoncé « validé » que si tous ses éléments le sont**. L'application ne prétend jamais qu'un contenu est validé quand il ne l'est pas. |
| A-5 | **Traductions** : libellés ×5 (fr, en, de, es, it) ; terminologie réglementaire reprise des versions **officielles** (EUR-Lex, Légifrance) — jamais traduite par l'agent ; version du texte citée. |
| A-6 | **Incidents types sectoriels** : ajoutés au catalogue d'incidents (`incident-types-catalogue.ts`) avec régimes à examiner propres au secteur (ex. continuité d'un service essentiel, fuite de données de santé, défaillance d'un équipement de réseau). |
| A-7 | **Tests de résilience / de continuité** modèles pour les secteurs NIS2 (hors DORA : libellés non normatifs, pas de TLPT). |
| A-8 | **Liens contrôle → risque** (`CONTROL_RISKS`) complets : chaque contrôle cite ≥ 1 risque existant ; aucun risque créé implicitement. |
| A-9 | **Taille de l'entité** (à décider) : périodicités et échantillons « petite structure / entité importante » (jeu de périodicités alternatif) pour éviter de proposer à une PME des fréquences de grand groupe. |
| A-10 | **Version et nouveautés** : chaque lot incrémente `CATALOGUE_PACK_VERSION` et l'historique ; l'organisation voit les nouveautés sans que rien d'existant ne soit modifié. |

## A.4 Hors périmètre

Seuils de KRI, valeurs mesurées, exécutions de contrôle, conformité déclarée, notation d'audit, constats — **jamais** créés par le catalogue. Aucun libellé d'exigence reproduit. Pas de contenu « validé » sans expert nommé.

## A.5 Critères d'acceptation

1. Chaque secteur atteint les cibles § A.2.1 (test automatique).
2. Chaque contrôle d'un secteur réglementé cite au moins un texte d'origine ; les références sont des intitulés officiels.
3. Recette navigateur sur base réelle : import d'un domaine entier d'un secteur, avec processus, références dans la description, aucun élément exécuté ni coté, réimport idempotent.
4. Grille de revue régénérée, avec statut par élément ; le taux d'éléments relus est affiché dans la documentation.
5. `tsc`, `npm test`, `i18n:check`, build verts ; CI verte.

---

# B — MCP / IA gouvernée, phase 5

## B.1 État actuel (livré, désactivé par défaut)

Cadrage validé : `docs/mcp-cadrage.md`. ACRA est **serveur MCP** : il expose des outils, n'émet **aucun appel sortant vers un LLM** ; l'organisation branche son propre agent.

| Brique | État |
|---|---|
| Interrupteur d'instance `mcpEnabled` (SUPER_ADMIN, **OFF par défaut**, fail-closed) + `/admin/instance` | livré |
| Clé d'API org-scopée avec **scope `mcp`** (moindre privilège), révocation, `lastUsedAt` | livré |
| Endpoint `POST /api/mcp` (JSON-RPC 2.0 : initialize, ping, tools/list, tools/call), protocole pur `lib/mcp/protocol.ts` | livré |
| Limitation de débit par clé (`mcp:<keyId>`), audit `MCP_TOOL_INVOKED` (+ SIEM) | livré |
| Outils de **lecture** : `read_referentiels`, `read_taxonomie`, `read_sector_examples`, `read_risk_posture` (org-scopés) | livré |
| Modèle `McpProposal` + file de validation `/mcp-propositions` (accepter / rejeter) + audit `MCP_PROPOSAL_REVIEWED` | livré |
| Outils d'**écriture validée** : `propose_risk`, `propose_measure`, `propose_plan_action` | livré |
| **Ancrage obligatoire** : toute proposition référence un objet existant de l'organisation (`ANALYSE | RISQUE | CONFORMITE | CONTROLE | AUDIT | INCIDENT`) ; l'acceptation résout l'ancre, applique le **RBAC de l'ancre**, crée l'objet par les chemins existants | livré |
| Tests IDOR de la famille `/api/organizations/[orgId]/**` et de la lecture MCP | partiel (voir B.2.5) |

Principes non négociables (repris tels quels) : souveraineté des données ; **aucune écriture finale par la machine** ; isolation multi-organisation ; traçabilité de chaque appel ; moindre privilège ; réversibilité.

## B.2 Besoin

### B.2.1 `propose_conformite_treatment` (traitement de conformité)

Un agent propose le **traitement d'une exigence** d'un référentiel de l'organisation.

- **Ancre** : `CONFORMITE` (exigence d'un référentiel dans le suivi de conformité de l'organisation ; existence et organisation vérifiées).
- **Contenu** : statut proposé (parmi les statuts existants), commentaire argumenté, liens proposés vers des contrôles ou preuves **existants** (référencés par identifiant, résolus à l'acceptation), plan d'action associé (via `propose_plan_action` ancré à la même exigence).
- **Acceptation** : par un rôle habilité à éditer la conformité de cette organisation ; écriture par le chemin existant du suivi de conformité (mêmes validations et mêmes audits, versionnement des suivis inclus).
- **Règle de prudence** : une proposition ne peut **jamais** passer une exigence à « conforme » sans qu'un humain confirme dans la file ; la trace distingue « déclaré » et « constaté » (règle existante, `conformite-constats.ts`) ; une proposition de statut favorable alors que des constats d'audit ouverts ou des contrôles défaillants couvrent l'exigence est **signalée en rouge** dans la file.
- **Conflit** : si l'exigence a changé depuis la proposition (version, statut), l'acceptation est refusée avec explication (jamais d'écrasement silencieux).

### B.2.2 `recommend_risks_scenarios` (recommandation de scénarios)

- **Déterministe, côté ACRA** : à partir du secteur de l'organisation, du catalogue (risques, contrôles, liens `CONTROL_RISKS`), des référentiels actifs, des processus et des écarts constatés, ACRA calcule une **liste classée de candidats** avec la justification (« processus X sans risque associé », « référentiel Y : exigence Z non couverte », « incident de type T déclaré, aucun risque lié »). **Aucun LLM côté ACRA.**
- L'agent choisit parmi les candidats ou en enrichit le texte, puis dépose des `propose_risk` ancrés (analyse, registre) ; chaque proposition porte la **provenance** (clé du catalogue ou règle de recommandation).
- **Idempotence** : un candidat déjà importé (même clé de catalogue) ou déjà proposé (même ancre, même contenu) n'est pas reproposé ; la file ne contient pas de doublon.
- **Sorties** : bornées en taille, sans donnée d'une autre organisation ; mode « liste seule » sans création.

### B.2.3 Saisie assistée (intake)

Deux outils, où **l'agent fait le travail de compréhension** et ACRA reçoit un **résultat structuré** à valider.

1. `propose_referentiel_from_text` — l'agent a lu une **PSSI** : il fournit des exigences structurées (référence, intitulé, description, thème) ; ACRA propose un **référentiel interne en brouillon** (non actif tant qu'il n'est pas validé), avec aperçu, comptage, avertissements (doublons de référence, textes trop longs, caractères de contrôle).
2. `propose_analysis_intake_from_text` — l'agent a lu une **présentation de projet** : il fournit valeurs métier, biens supports, périmètre, parties prenantes proposés ; ACRA les propose comme **pré-remplissage de l'atelier 1** d'une analyse non gelée, élément par élément (accepter / rejeter chaque ligne).
- **Ancre** : l'analyse cible existante (intake) ou l'organisation (nouveau référentiel) ; droits de l'ancre.
- **Bornes** : nombre d'exigences / de lignes, tailles de champs, rejet des contenus dépassant les plafonds (déni de service), assainissement par les libs existantes (`import-sanitize`).
- **Aucune donnée n'est conservée en clair hors proposition** ; la proposition expire (§ B.2.6).

### B.2.4 Pistes complémentaires (à arbitrer, § 10)

- `propose_incident_from_type` : brouillon de déclaration d'incident à partir du catalogue d'incidents types (ancre : organisation), à valider par la 2ᵉ ligne ; ne déclare jamais à une autorité.
- `read_incidents_summary` (lecture) pour que l'agent contextualise les recommandations.

### B.2.5 Tests d'isolation et de sécurité étendus (obligatoires)

Matrice **outil × situation**, pour chaque outil de lecture et de proposition, avec la couverture automatique minimale suivante :

| Situation | Attendu |
|---|---|
| Instance MCP désactivée / scope `mcp` absent / clé révoquée ou expirée | refus, aucune écriture, audit du refus |
| Clé de l'organisation A, ancre de l'organisation B | 404 sans divulgation, aucune proposition créée |
| Clé de l'organisation A, identifiant de contrôle / preuve / exigence de B dans le contenu | refus à l'acceptation, aucun lien créé |
| Analyse gelée / validée | proposition refusée à l'acceptation (garde de gel d'analyse existante) |
| Acceptation par un rôle sans droit sur l'ancre | 403 ; une proposition n'élève jamais les droits |
| **Injection** : instructions dans le texte (« ignore les règles… », balises HTML / formules tableur) | stockées comme donnée, échappées à l'affichage et à l'export, jamais interprétées |
| Dépassement de volume / de taille, rafale d'appels | 413 / 429, aucune écriture partielle |
| Rejeu de la même proposition | dédoublonnée |
| Acceptation concurrente (deux validateurs) | une seule application (verrou), l'autre reçoit « déjà traitée » |
| Complétude de l'audit | chaque appel, proposition, acceptation et rejet journalisé avec clé, outil, organisation ; aucune donnée sensible en clair dans le journal |
| Aucun appel sortant | test qui échoue si un outil effectue une requête réseau sortante |

### B.2.6 File de validation et exploitation

- **Expiration** des propositions en attente (durée configurable) et **relance** des validateurs (système de relances existant, un seul e-mail par personne).
- **File** : filtres (type, ancre, âge, auteur / clé), **aperçu de l'effet** (différence avec l'objet existant), motif de rejet obligatoire, **badge de provenance** (clé / agent), compteur dans la navigation ; acceptation en lot **limitée** aux propositions de faible impact et de même ancre.
- **Activation à trois niveaux** (règle de configuration de ACRA, `CLAUDE.md`) : défaut (OFF) → **par organisation** (interrupteur ADMIN de l'organisation, absent aujourd'hui — l'activation actuelle est d'instance + portée de la clé) → politique d'instance du SUPER_ADMIN (`PER_ORG | FORCE_ON | FORCE_OFF`). **À arbitrer** : ajouter l'interrupteur d'organisation.
- **Guide exploitant** : documentation de connexion d'un client MCP (exemples de configuration), de création de la clé, de supervision, de révocation, et rappel de responsabilité en cas de LLM externe.

## B.3 Hors périmètre

Appel sortant d'ACRA vers un LLM ; écriture finale sans validation humaine ; agent autonome ; accès à plusieurs organisations avec une même clé ; stockage de prompts ou de conversations.

## B.4 Critères d'acceptation

1. Les deux outils `propose_conformite_treatment` et `recommend_risks_scenarios` et les deux outils d'intake sont disponibles, **désactivés par défaut**, et inopérants sans scope `mcp`.
2. La matrice B.2.5 est **entièrement automatisée** (tests unitaires + tests sur base réelle) et verte ; ajout d'un outil = ajout d'une ligne de la matrice (test cliquet).
3. Recette navigateur : un agent factice dépose une proposition de chaque type ; la file affiche l'aperçu ; acceptation par un rôle habilité crée l'objet attendu avec la provenance ; rejet sans effet ; refus propres (analyse gelée, autre organisation).
4. Aucune écriture n'est possible sans acceptation humaine (test sur chaque outil).

---

# C — Rapports et exports

## C.1 Appétence au risque (RAS / RAD)

**Existant** : page `/appetence` (menu Pilotage) ; **déclaration d'appétence (RAS)** : seuils global et par catégorie, niveaux de maturité visés par référentiel ; **tableau de bord (RAD)** : risques hors appétit, écarts de maturité, KRI en alerte, voyant par indicateur et voyant global (VERT / ORANGE / ROUGE / GRIS, règles testées `lib/ras-rad.ts`) ; **export PDF** (`/api/appetence/export`, journalisé, droits de lecture globale du dispositif) ; vue accessible si au moins un des modules registre / KRI / maturité est actif.

**Besoin** :

| Id | Exigence |
|---|---|
| C1-1 | **Historique et tendances** : instantané périodique des voyants et des indicateurs (nombre de risques évalués et hors appétit, KRI en alerte et critiques, écart de maturité, voyant global). Prise **mensuelle automatique** (tâche planifiée existante) et **à la demande** (« figer l'état » avec commentaire) ; conservation configurable. L'écran affiche l'évolution (tableau + courbe) et le PDF la reprend. Un instantané n'est jamais réécrit. |
| C1-2 | **Comparaison de périodes** : sélection de deux dates ; différences d'indicateurs et changements de voyant mis en évidence. |
| C1-3 | **Export Excel** : feuilles « Synthèse », « Risques hors appétit », « KRI », « Maturité », « Historique » ; formules neutralisées ; mêmes droits et journalisation que le PDF ; ×5 langues. |
| C1-4 | **Dossier de comité** : la vue RAS / RAD devient une section du pack de comité existant (`/api/comites/pack`). |
| C1-5 | **Tableau de bord mensuel par e-mail** : ligne « appétence » (voyant global et variation) pour les RSSI / gestionnaires des risques. |
| C1-6 | **Qualité de donnée** : avertissement quand l'appétence n'est pas déclarée (voyant GRIS), quand un KRI n'a pas de seuil (statut inconnu) ou quand l'instantané est ancien. |
| C1-7 | **Multi-organisation** : consolidation d'un groupe (périmètre = organisations visibles de l'utilisateur ; voyants par filiale) — à arbitrer. |

**Recette** : sur données historiques réelles (plusieurs mois) ; vérifier l'absence de dérive entre l'écran, le PDF et l'Excel (même agrégat serveur).

## C.2 Analyse projet 360

**Existant** : méthode `PROJET_360` ; **6 domaines** (CYBER, IT, PROJECT, BUSINESS, FRAUD, OUTSOURCING) ; questionnaire 360 (progression par domaine) ; import des risques de l'analyse cyber source (copie tracée) ; validation par le RSSI **et** le Risk Manager (cumul possible en petite structure) ; tableau de bord par domaine (risques, niveau max / moyen brut et résiduel, au-dessus de l'appétit, part traitée, trois principaux, carte de chaleur) ; **bilan par domaine et tiers du projet** ; **export PDF et Excel par projet** avec ventilation par domaine (`/api/export/[id]?format=pdf|xlsx`) ; suivi des projets (`ProjetsSuivi`).

**Besoin** :

| Id | Exigence |
|---|---|
| C2-1 | **Vue portefeuille** (page dédiée) : liste des projets 360 accessibles à l'utilisateur, avec par projet : statut de validation, avancement du questionnaire, niveau max par domaine, nombre de risques hors appétit, part traitée, tiers concernés ; filtres (organisation, état, domaine, responsable, période) ; tri par criticité. |
| C2-2 | **Agrégation multi-projets** : carte de chaleur **domaine × projet** ; top des risques tous projets ; risques **communs** à plusieurs projets (même prestataire, même bien support) ; totaux par domaine. Calcul **serveur**, périmètre = projets que l'utilisateur peut lire (aucun accès transverse). |
| C2-3 | **Export du portefeuille** : PDF (synthèse de direction + une page par projet) et Excel (une feuille portefeuille, une feuille domaine × projet, une feuille risques) ; journalisé ; limité en débit ; ×5 langues. |
| C2-4 | **Historique** : instantané des indicateurs d'un projet à chaque validation (comparaison « validation précédente / actuelle »). |
| C2-5 | **Cohérence** : le portefeuille reprend les mêmes calculs que le tableau de bord d'un projet (fonction pure partagée, test d'équivalence). |
| C2-6 | **Hors périmètre** (inchangé) : quantification financière, synchronisation continue avec l'analyse cyber source. |

## C.3 Tests de résilience opérationnelle numérique (DORA)

**Existant** : module `/reglementaire/tests-resilience` (actif avec le module réglementaire) ; données du test (type officiel art. 25 § 1 + TLPT art. 26, périmètre, **fonction critique ou importante**, testeur interne / externe et **indépendance**, statut, dates, résultat, **constats** avec sévérité 1–4 et état corrigé / non corrigé, risques du registre liés) ; indicateurs du programme par année (réalisation, répartition par type, couverture des fonctions critiques, constats ouverts, tests non indépendants, échéance TLPT triennale) ; **rapport de réexamen Word** (art. 6 § 5) ; relance des tests en retard ; **création d'une action du plan unifié depuis un constat** (idempotente) ; plans de test modèles du catalogue.

**Besoin** :

| Id | Exigence |
|---|---|
| C3-1 | **Pièces de preuve** : rattacher un ou plusieurs documents (module Documents existant, type `PREUVE`, stockage et somme de contrôle déjà gérés) **à un test** et **à un constat** ; téléversement ou sélection d'un document existant de l'organisation ; affichage sur la fiche et dans le rapport de réexamen (titre, version, date, somme de contrôle) ; mêmes droits d'accès que le test ; suppression d'un test = détachement, jamais perte de document. |
| C3-2 | **Synchronisation constat ↔ action** : l'écran montre l'état de l'action liée à chaque constat ; quand l'action passe à « fait », ACRA **propose** de marquer le constat corrigé (confirmation humaine, jamais automatique) ; réouverture d'une action sur un constat non corrigé ; vue « constats sans action » ; relance des constats ouverts critiques. |
| C3-3 | **Type de lien `TEST_RESILIENCE` dans le plan d'action unifié** : l'ajouter à `PLAN_ACTION_LIEN_TYPES` ; vérifier et compléter la vue `/plans-actions` (facette « Origine », compteurs, filtre, lien profond vers le test et le constat), la clôture, les ancres MCP (`lib/mcp/anchors.server.ts`), l'export du plan d'action ; **test de non-régression** : toute origine écrite par une route doit figurer dans la liste des types. |
| C3-4 | **Rapport de réexamen enrichi** : état des actions liées, pièces de preuve, constats ouverts par ancienneté, comparaison avec l'année précédente. |
| C3-5 | **Export Excel du programme** : tests (type, périmètre, fonction critique, dates, statut, indépendance), constats (sévérité, état, action liée, preuves), indicateurs annuels ; ×5 langues. |
| C3-6 | **Recette des permissions** : lecture globale en lecture seule, écriture ADMIN / RSSI / RISK_MANAGER, isolation entre organisations (tests IDOR dédiés), module réglementaire inactif → 404. |

## C.4 Exigences transverses aux exports

Même agrégat serveur pour l'écran, le PDF et l'Excel (test d'équivalence) ; **journalisation** de chaque export ; **limitation de débit** ; **neutralisation des formules** (CWE-1236) dans tous les classeurs ; libellés ×5 langues ; PDF produits par les gabarits compilés existants (`scripts/compile-pdf-template.mjs`, `pdf-runtime`) ; nom de fichier sûr ; aucun accès hors périmètre de l'utilisateur ; recette sur le **build de production** (le bundling PDF diffère du mode développement).

---

# 9. Découpage proposé et ordre

Les lots sont indépendants ; l'ordre privilégie la **valeur visible** et la **réduction du risque** (les corrections de cohérence d'abord).

| Lot | Contenu | Pourquoi dans cet ordre |
|---|---|---|
| **L0** | C3-3 (`TEST_RESILIENCE` dans les types de lien + vue unifiée + test cliquet) | incohérence probable déjà en production ; faible coût |
| **L1** | A-1 à A-4 (domaines sélectionnables, références obligatoires, cibles testées, statut de relecture) + **un premier secteur complet** (proposition : Santé ou Énergie, selon vos clients) servant de modèle | fixe la méthode avant de dupliquer |
| **L2** | A pour les 8 autres secteurs, par vagues de 2 à 3 secteurs, avec relecture experte entre chaque vague | volume de contenu ; la relecture est le facteur limitant |
| **L3** | C3-1, C3-2, C3-4, C3-5 (preuves, synchronisation, rapport, Excel) | complète le module DORA déjà livré |
| **L4** | C1-1 à C1-6 (instantanés, tendances, Excel, pack de comité, e-mail mensuel) | nécessite l'accumulation d'historique : plus tôt on démarre, plus la tendance est riche |
| **L5** | C2-1 à C2-5 (portefeuille projet 360 + export) | |
| **L6** | B.2.5 (matrice d'isolation complète) **avant** les nouveaux outils, puis B.2.1, B.2.2 | la sécurité précède la surface |
| **L7** | B.2.3 (saisie assistée) + B.2.6 (file, expiration, relances, guide exploitant, interrupteur d'organisation) | |

Chaque lot : test d'abord (TDD), i18n ×5, `tsc` / `npm test` / `i18n:check` / build, recette sur vraie base **et** navigateur sur build de production, mise à jour de la documentation, PR avec CI verte.

## 10. Décisions

### Tranchées par l'utilisateur (2026-10-02)

1. **Ordre et affichage des secteurs** : les secteurs sont rangés dans le même ordre que dans les analyses de risques ; seuls les secteurs **sélectionnés pour l'organisation** s'affichent. Pour une entreprise **multisecteur**, l'utilisateur choisit le **secteur actif** au moment de l'usage, qui filtre le catalogue. Le nom de l'expert relecteur n'est pas fourni : le contenu reste « à relire » et l'application l'affiche (statut de relecture par élément).
2. **Secteurs ajoutés** : oui — éducation, agricole, défense, immobilier / BTP, média, tourisme, associations rejoignent `SECTOR_CODES` et le catalogue de suggestions.
3. **Interrupteur MCP par organisation** : oui (3 niveaux : défaut OFF, ADMIN d'organisation, politique d'instance FORCE_ON / FORCE_OFF).
4. **Périodicités « petite structure »** : oui — un jeu allégé de périodicités est proposé selon un profil de taille.

### Par défaut retenus (non tranchés, modifiables)

5. `propose_incident_from_type` et lecture des incidents par MCP : **non** dans ce chantier (reporté).
6. Rétention : instantanés d'appétit 36 mois ; propositions MCP expirées purgées après 90 jours.
7. Consolidation de groupe de l'appétence : lecture seule, rôles de lecture globale uniquement.
8. Pièces de preuve : réutiliser le type de document `PREUVE` existant.
9. Portefeuille projet 360 : un seul PDF de synthèse, plus un Excel détaillé.

## 11. Risques

- **Qualité du contenu** : un contenu sectoriel non relu peut être faux ou daté ; mitigation : statut de relecture visible, références citées, aucun libellé normatif reproduit.
- **Volume de traduction** (×5) : la terminologie réglementaire doit venir des versions officielles ; prévoir une relecture linguistique par langue pour les domaines réglementés.
- **Sécurité MCP** : la surface croît avec chaque outil ; mitigation : matrice automatisée et test cliquet, désactivation par défaut, aucune écriture sans validation.
- **Historique** : sans instantanés, pas de tendance ; l'historique ne se reconstitue pas rétroactivement.
- **PDF** : le rendu diffère entre développement et production ; toute recette PDF se fait sur le build de production.
